// Edge Function: zapi-relationship-followup
//
// Executa as réguas de relacionamento automático (C22).
// Chamada pelo cron job diário às 8h via pg_net (migration 074).
//
// Fluxo:
//   1. Valida autenticação EXCLUSIVA via CRON_SECRET (sem fallback JWT).
//   2. Busca todas as regras ativas (zapi_relationship_rules WHERE ativo=true).
//   3. Para cada regra:
//      a. Busca a conta Z-API vinculada.
//      b. Verifica isFeatureEnabled(config, 'c22').
//      c. Busca chats da conta com status != 'finalizada' WHERE a última mensagem
//         recebida (from_me=false) tem timestamp > N dias atrás.
//      d. Filtra por board_stage_id se configurado.
//      e. Proteção anti-duplicata: exclui chats que já receberam mensagem com o
//         mesmo template nas últimas 24h.
//      f. Verifica aceita_whatsapp=true do contato.
//      g. Substitui variáveis {nome} e {protocolo} no template.
//      h. Envia via Z-API (POST send-text).
//      i. Máx 50 chats por execução total (evitar timeout).
//   4. Erros individuais não param o processamento.
//   5. Retorna { ok: true, processed: N, sent: N, skipped: N }.
//
// Segurança:
//   - Autenticação EXCLUSIVA via CRON_SECRET.
//   - Verifica opt-in (aceita_whatsapp) antes de enviar.
//   - Verifica isFeatureEnabled(config, 'c22').
//   - Proteção anti-duplicata: não re-envia nas últimas 24h.
//   - Limite de 50 chats por execução.
//
// Referência: RAQ-MAND-EM073 — T73 (Fase 6 Onda B)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/admin-guard.ts';
import { validateCronSecret } from '../_shared/cron-guard.ts';
import { isFeatureEnabled } from '../_shared/feature-flags.ts';
import { normalizePhoneForZapi, isValidPhone, ZAPI_BASE } from '../_shared/zapi-helpers.ts';

const MAX_PER_RUN = 50;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface ZapiAccount {
  id: string;
  instance_id: string;
  instance_token: string;
  client_token: string;
  recursos_config: Record<string, boolean> | null;
}

interface RelationshipRule {
  id: string;
  account_id: string;
  nome: string;
  board_stage_id: string | null;
  dias_sem_resposta: number;
  mensagem_template: string;
}

interface ChatRow {
  id: string;
  phone: string;
  contact_id: string | null;
  demand_id: string | null;
}

interface ContactRow {
  nome: string | null;
  aceita_whatsapp: boolean;
  optin_whatsapp: boolean;
  optin_data: string | null;
}

interface DemandRow {
  protocolo: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Método não permitido' });

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!url || !serviceRoleKey) {
      return jsonResponse(500, { error: 'Configuração do servidor incompleta (env)' });
    }

    // ── 1. Autenticação EXCLUSIVA via CRON_SECRET (timing-safe — CWE-208) ────
    const cronAuthError = validateCronSecret(req);
    if (cronAuthError) return cronAuthError;

    const admin = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── 2. Busca todas as réguas ativas ───────────────────────────────────────
    const { data: rules, error: rulesError } = await admin
      .from('zapi_relationship_rules')
      .select('id, account_id, nome, board_stage_id, dias_sem_resposta, mensagem_template')
      .eq('ativo', true);

    if (rulesError) {
      console.error('[followup] Erro ao buscar réguas:', rulesError.message);
      return jsonResponse(500, { error: 'Erro ao buscar réguas' });
    }

    if (!rules || rules.length === 0) {
      return jsonResponse(200, { ok: true, processed: 0, sent: 0, skipped: 0, message: 'Nenhuma régua ativa' });
    }

    let totalProcessed = 0;
    let totalSent = 0;
    let totalSkipped = 0;

    // Agrupa regras por conta para otimizar queries
    const rulesByAccount = new Map<string, RelationshipRule[]>();
    for (const rule of rules as RelationshipRule[]) {
      const existing = rulesByAccount.get(rule.account_id) ?? [];
      existing.push(rule);
      rulesByAccount.set(rule.account_id, existing);
    }

    // ── 3. Processa cada conta ────────────────────────────────────────────────
    for (const [accountId, accountRules] of rulesByAccount) {
      if (totalProcessed >= MAX_PER_RUN) break;

      // Busca conta Z-API
      const { data: account, error: accountError } = await admin
        .from('zapi_accounts')
        .select('id, instance_id, instance_token, client_token, recursos_config')
        .eq('id', accountId)
        .maybeSingle();

      if (accountError || !account) {
        console.error(`[followup] Conta ${accountId} não encontrada`);
        continue;
      }

      const zapiAccount = account as ZapiAccount;

      // Verifica feature c22
      if (!isFeatureEnabled(zapiAccount.recursos_config, 'c22')) {
        console.log(`[followup] Conta ${accountId}: c22 desabilitado — pulando`);
        continue;
      }

      // Busca chats não finalizados da conta
      const { data: chats, error: chatsError } = await admin
        .from('zapi_chats')
        .select('id, phone, contact_id, demand_id')
        .eq('account_id', accountId)
        .neq('status', 'finalizada');

      if (chatsError || !chats) {
        console.error(`[followup] Erro ao buscar chats conta ${accountId}:`, chatsError?.message);
        continue;
      }

      // Para cada regra da conta
      for (const rule of accountRules) {
        if (totalProcessed >= MAX_PER_RUN) break;

        const cutoffDate = new Date(Date.now() - rule.dias_sem_resposta * 24 * 60 * 60 * 1000);

        for (const chat of chats as ChatRow[]) {
          if (totalProcessed >= MAX_PER_RUN) break;

          // Verifica se a última mensagem recebida é mais antiga que o cutoff
          const { data: lastMsg, error: lastMsgError } = await admin
            .from('zapi_messages')
            .select('timestamp')
            .eq('chat_id', chat.id)
            .eq('from_me', false)
            .order('timestamp', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (lastMsgError) {
            console.error(`[followup] Erro ao buscar última mensagem chat ${chat.id}:`, lastMsgError.message);
            continue;
          }

          // Sem mensagem recebida: pular
          if (!lastMsg) continue;

          // Mensagem recente: pular
          const lastMsgDate = new Date(lastMsg.timestamp);
          if (lastMsgDate > cutoffDate) continue;

          // Filtra por etapa do funil se configurado
          if (rule.board_stage_id && chat.contact_id) {
            const { data: boardItem } = await admin
              .from('board_items')
              .select('id')
              .eq('contact_id', chat.contact_id)
              .eq('stage_id', rule.board_stage_id)
              .maybeSingle();

            if (!boardItem) continue;
          }

          // Verifica aceita_whatsapp do contato
          let contactName = 'eleitor';
          if (chat.contact_id) {
            const { data: contact, error: contactError } = await admin
              .from('contacts')
              .select('nome, aceita_whatsapp, optin_whatsapp, optin_data')
              .eq('id', chat.contact_id)
              .maybeSingle();

            if (contactError || !contact) continue;

            const contactRow = contact as ContactRow;

            // Verifica aceita_whatsapp E optin_whatsapp+optin_data (CRÍTICA-1)
            // relationship-followup é comunicação reativa (não broadcast em massa),
            // mas usamos optin como indicador de consentimento válido.
            if (!contactRow.aceita_whatsapp) {
              totalSkipped++;
              continue;
            }
            // optin_whatsapp=false apenas pula (não bloqueia relationship followup — é mensagem 1:1)
            // mas optin_data=null com optin=true indica registro inválido — pular também
            if (contactRow.optin_whatsapp && !contactRow.optin_data) {
              // opt-in marcado sem data = registro suspeito, pular por segurança
              totalSkipped++;
              continue;
            }
            contactName = contactRow.nome ?? 'eleitor';
          }

          // Proteção anti-duplicata: não re-envia nas últimas 24h
          const template = rule.mensagem_template;
          const { data: recentMsg } = await admin
            .from('zapi_messages')
            .select('id')
            .eq('chat_id', chat.id)
            .eq('from_me', true)
            .eq('body', template)
            .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
            .limit(1)
            .maybeSingle();

          if (recentMsg) {
            totalSkipped++;
            continue;
          }

          // Busca protocolo da demanda vinculada
          let protocolo = '';
          if (chat.demand_id) {
            const { data: demand } = await admin
              .from('demands')
              .select('protocolo')
              .eq('id', chat.demand_id)
              .maybeSingle();

            protocolo = (demand as DemandRow | null)?.protocolo ?? '';
          }

          // Substitui variáveis no template
          const mensagem = template
            .replace(/\{nome\}/g, contactName)
            .replace(/\{protocolo\}/g, protocolo || 'N/A');

          // Valida e normaliza o telefone
          const phone = normalizePhoneForZapi(chat.phone);
          if (!isValidPhone(phone)) {
            console.warn(`[followup] Telefone inválido no chat ${chat.id}: ${chat.phone}`);
            totalSkipped++;
            continue;
          }

          // Envia via Z-API
          try {
            const instanceId = encodeURIComponent(zapiAccount.instance_id);
            const instanceToken = encodeURIComponent(zapiAccount.instance_token);
            const zapiUrl = `${ZAPI_BASE}/${instanceId}/token/${instanceToken}/send-text`;

            const zapiResponse = await fetch(zapiUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Client-Token': zapiAccount.client_token,
              },
              body: JSON.stringify({ phone, message: mensagem }),
            });

            if (!zapiResponse.ok) {
              const errText = await zapiResponse.text().catch(() => '');
              console.error(`[followup] Z-API falhou no chat ${chat.id}: ${zapiResponse.status} ${errText}`);
              totalSkipped++;
            } else {
              totalSent++;
              console.log(`[followup] Follow-up enviado: chat ${chat.id}, regra "${rule.nome}"`);
            }
          } catch (sendErr) {
            console.error(`[followup] Exceção ao enviar chat ${chat.id}:`, sendErr);
            totalSkipped++;
          }

          totalProcessed++;
        }
      }
    }

    return jsonResponse(200, {
      ok: true,
      processed: totalProcessed,
      sent: totalSent,
      skipped: totalSkipped,
    });
  } catch (err) {
    console.error('[followup] Erro inesperado:', err);
    return jsonResponse(500, { error: 'Erro interno no servidor' });
  }
});
