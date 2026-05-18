// Edge Function: zapi-demand-notify
//
// Envia mensagem automática ao eleitor no WhatsApp quando o status de uma
// demanda muda (C18 — Protocolo de Demanda).
//
// Chamada pelo trigger on_demand_status_change (migration 069) via pg_net,
// usando CRON_SECRET como autenticação (mesmo padrão de zapi-send-scheduled).
//
// Fluxo:
//   1. Valida autenticação via CRON_SECRET (header Authorization: Bearer <secret>).
//   2. Lê { demand_id, old_status, new_status } do body.
//   3. Busca: demands.protocolo, demands.contact_id, demanda completa.
//   4. Verifica: conta com isFeatureEnabled(config, 'c18').
//   5. Verifica: contato com aceita_whatsapp = true.
//   6. Busca: zapi_chats vinculado (zapi_chats.demand_id = demand_id).
//   7. Seleciona template de mensagem baseado na transição de status.
//   8. Envia via zapi-send-text (chama a EF internamente ou direto via Z-API).
//   9. Em caso de erro no envio, registra log mas retorna 200 (trigger não deve falhar).
//
// Templates de mensagem:
//   open → in_progress: "Olá {nome}! Seu pedido com protocolo {protocolo} foi
//     recebido e está sendo analisado. Em breve retornaremos."
//   in_progress → resolved: "Olá {nome}! Seu pedido com protocolo {protocolo}
//     foi concluído. Agradecemos o contato!"
//
// Segurança:
//   - Autenticação EXCLUSIVA via CRON_SECRET — sem fallback de JWT.
//   - Verificação de feature flag c18 antes de qualquer ação.
//   - Verificação de aceita_whatsapp antes de enviar.
//   - Tokens Z-API nunca aparecem na resposta.
//
// Referência: RAQ-MAND-EM073 — T61 (Fase 6 Onda A)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/admin-guard.ts';
import { validateCronSecret } from '../_shared/cron-guard.ts';
import { isValidPhone, normalizePhoneForZapi } from '../_shared/zapi-helpers.ts';
import { isFeatureEnabled } from '../_shared/feature-flags.ts';

const ZAPI_BASE = 'https://api.z-api.io/instances';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface NotifyBody {
  demand_id?: string;
  old_status?: string;
  new_status?: string;
}

interface ZapiAccount {
  id: string;
  instance_id: string;
  instance_token: string;
  client_token: string;
  status: string;
  recursos_config: Record<string, boolean> | null;
}

// Gera o texto de notificação baseado na transição de status
function buildNotifyMessage(
  nome: string,
  protocolo: string,
  oldStatus: string,
  newStatus: string,
): string | null {
  if (oldStatus === 'open' && newStatus === 'in_progress') {
    return `Olá ${nome}! Seu pedido com protocolo ${protocolo} foi recebido e está sendo analisado. Em breve retornaremos.`;
  }
  if (oldStatus === 'in_progress' && newStatus === 'resolved') {
    return `Olá ${nome}! Seu pedido com protocolo ${protocolo} foi concluído. Agradecemos o contato!`;
  }
  // Outras transições: sem envio
  return null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Método não permitido' });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(500, { error: 'Configuração do servidor incompleta (env)' });
    }

    // ── 1. Autenticação via CRON_SECRET (timing-safe — CWE-208) ─────────────
    const cronAuthError = validateCronSecret(req);
    if (cronAuthError) return cronAuthError;

    // ── 2. Parse body ─────────────────────────────────────────────────────────
    let body: NotifyBody;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'Payload JSON inválido' });
    }

    const { demand_id, old_status, new_status } = body;

    if (!demand_id || !old_status || !new_status) {
      return jsonResponse(400, { error: 'demand_id, old_status e new_status são obrigatórios' });
    }

    // ── 3. Verifica se a transição gera mensagem ──────────────────────────────
    // Verifica antes de qualquer query — economiza DB calls para transições irrelevantes
    const templateTest = buildNotifyMessage('X', 'X', old_status, new_status);
    if (!templateTest) {
      console.log(`zapi-demand-notify: transição ${old_status}→${new_status} não gera mensagem`);
      return jsonResponse(200, { ok: true, action: 'skip_transition' });
    }

    // ── 4. Cliente admin ──────────────────────────────────────────────────────
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── 5. Busca a demanda + contato ──────────────────────────────────────────
    const { data: demand, error: demandErr } = await admin
      .from('demands')
      .select('id, protocolo, contact_id, contacts:contact_id(id, nome, aceita_whatsapp, whatsapp)')
      .eq('id', demand_id)
      .maybeSingle();

    if (demandErr) {
      console.error('zapi-demand-notify: erro ao buscar demanda', demandErr.code);
      return jsonResponse(200, { ok: true, action: 'skip_db_error' });
    }

    if (!demand) {
      console.warn('zapi-demand-notify: demanda não encontrada', demand_id);
      return jsonResponse(200, { ok: true, action: 'skip_demand_not_found' });
    }

    if (!demand.contact_id) {
      console.log('zapi-demand-notify: demanda sem contato vinculado');
      return jsonResponse(200, { ok: true, action: 'skip_no_contact' });
    }

    const contact = demand.contacts as {
      id: string;
      nome: string;
      aceita_whatsapp: boolean | null;
      whatsapp: string | null;
    } | null;

    if (!contact) {
      console.log('zapi-demand-notify: contato não encontrado');
      return jsonResponse(200, { ok: true, action: 'skip_contact_not_found' });
    }

    // ── 6. Verifica aceita_whatsapp ───────────────────────────────────────────
    if (!contact.aceita_whatsapp) {
      console.log('zapi-demand-notify: contato sem aceita_whatsapp', { contact_id: contact.id });
      return jsonResponse(200, { ok: true, action: 'skip_no_consent' });
    }

    if (!contact.whatsapp) {
      console.log('zapi-demand-notify: contato sem whatsapp', { contact_id: contact.id });
      return jsonResponse(200, { ok: true, action: 'skip_no_phone' });
    }

    // ── 7. Busca chat vinculado para encontrar a conta Z-API ─────────────────
    const { data: chat, error: chatErr } = await admin
      .from('zapi_chats')
      .select('id, account_id')
      .eq('demand_id', demand_id)
      .maybeSingle();

    if (chatErr) {
      console.error('zapi-demand-notify: erro ao buscar chat vinculado', chatErr.code);
      return jsonResponse(200, { ok: true, action: 'skip_chat_error' });
    }

    if (!chat) {
      console.log('zapi-demand-notify: nenhum chat vinculado à demanda', demand_id);
      return jsonResponse(200, { ok: true, action: 'skip_no_chat' });
    }

    // ── 8. Busca conta Z-API e verifica feature flag c18 ─────────────────────
    const { data: account, error: accountErr } = await admin
      .from('zapi_accounts')
      .select('id, instance_id, instance_token, client_token, status, recursos_config')
      .eq('id', chat.account_id)
      .maybeSingle<ZapiAccount>();

    if (accountErr || !account) {
      console.error('zapi-demand-notify: conta Z-API não encontrada', { account_id: chat.account_id });
      return jsonResponse(200, { ok: true, action: 'skip_no_account' });
    }

    // Verifica feature flag c18
    if (!isFeatureEnabled(account.recursos_config, 'c18')) {
      console.log('zapi-demand-notify: feature c18 desabilitada', { account_id: account.id });
      return jsonResponse(200, { ok: true, action: 'skip_feature_disabled' });
    }

    if (account.status === 'disconnected') {
      console.warn('zapi-demand-notify: conta desconectada', { account_id: account.id });
      return jsonResponse(200, { ok: true, action: 'skip_disconnected' });
    }

    // ── 9. Anti-duplicata: verifica se já há notificação outbound nas últimas 24h ─
    // ALTA-5: atendente togglando open↔in_progress spammaria o eleitor sem esta proteção.
    const cutoff24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: recentNotify } = await admin
      .from('zapi_messages')
      .select('id')
      .eq('chat_id', chat.id)
      .eq('direction', 'outbound')
      .gte('sent_at', cutoff24h)
      .limit(1)
      .maybeSingle();

    if (recentNotify) {
      console.log('zapi-demand-notify: notificação outbound já enviada nas últimas 24h — pulando', {
        demand_id,
        chat_id: chat.id,
        transition: `${old_status}→${new_status}`,
      });
      return jsonResponse(200, { ok: true, action: 'skip_antiduplicate_24h' });
    }

    // ── 10. Monta e envia a mensagem ──────────────────────────────────────────
    const protocolo = demand.protocolo ?? demand_id.slice(0, 8).toUpperCase();
    const nome = contact.nome ?? 'Eleitor';
    const message = buildNotifyMessage(nome, protocolo, old_status, new_status)!;

    const phone = normalizePhoneForZapi(contact.whatsapp);
    if (!isValidPhone(phone)) {
      console.warn('zapi-demand-notify: telefone inválido', { phone: contact.whatsapp });
      return jsonResponse(200, { ok: true, action: 'skip_invalid_phone' });
    }

    const zapiUrl = `${ZAPI_BASE}/${encodeURIComponent(account.instance_id)}/token/${encodeURIComponent(account.instance_token)}/send-text`;

    let zapiOk = false;
    let zapiError = '';

    try {
      const zapiResp = await fetch(zapiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Client-Token': account.client_token,
        },
        body: JSON.stringify({ phone, message }),
      });

      let zapiBody: Record<string, unknown> = {};
      try { zapiBody = await zapiResp.json(); } catch { /* sem JSON */ }

      if (zapiResp.ok) {
        zapiOk = true;
        const msgId = (zapiBody.messageId ?? zapiBody.id ?? zapiBody.zaapId) as string ?? `notify-${crypto.randomUUID()}`;
        const nowIso = new Date().toISOString();

        // Persiste mensagem outbound no histórico
        await admin.from('zapi_messages').insert({
          account_id: account.id,
          chat_id: chat.id,
          message_id: msgId,
          direction: 'outbound',
          body: message.slice(0, 4096),
          status: 'sent',
          sent_at: nowIso,
        }).then(({ error: e }) => {
          if (e && e.code !== '23505') {
            console.warn('zapi-demand-notify: falha ao persistir mensagem', e.code);
          }
        });

        // Atualiza preview do chat
        await admin.from('zapi_chats').update({
          last_message_at: nowIso,
          last_message_preview: message.length > 200 ? `${message.slice(0, 197)}...` : message,
          updated_at: nowIso,
        }).eq('id', chat.id);

        console.log('zapi-demand-notify: mensagem enviada', {
          demand_id,
          chat_id: chat.id,
          transition: `${old_status}→${new_status}`,
        });
      } else {
        zapiError = ((zapiBody.error as string) ?? `HTTP ${zapiResp.status}`).slice(0, 512);
      }
    } catch (fetchErr) {
      zapiError = `Falha de rede: ${fetchErr instanceof Error ? fetchErr.message : 'unknown'}`.slice(0, 512);
    }

    if (!zapiOk) {
      // Registra falha mas não lança erro — trigger não deve bloquear o UPDATE da demanda
      console.error('zapi-demand-notify: falha no envio Z-API', {
        demand_id,
        transition: `${old_status}→${new_status}`,
        error: zapiError,
      });
      return jsonResponse(200, { ok: true, action: 'sent_failed', error: zapiError });
    }

    return jsonResponse(200, { ok: true, action: 'sent' });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('zapi-demand-notify crash:', msg);
    // Retorna 200 — trigger pg_net não deve falhar
    return jsonResponse(200, { ok: false, error: 'Erro interno' });
  }
});
