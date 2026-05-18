// Edge Function: zapi-broadcast-send
//
// Processa a fila de targets de broadcasts ativos (status='enviando').
// Chamada pelo cron job 'zapi-broadcast-sender' a cada minuto via pg_net.
//
// Fluxo:
//   1. Valida autenticação via CRON_SECRET (sem fallback de JWT).
//   2. Busca broadcasts com status='enviando'.
//   3. Para cada broadcast ativo:
//      a. Lê N targets 'pendente' (N = ritmo_por_minuto).
//      b. Double-check: verifica optin_whatsapp do contato antes de enviar.
//      c. Chama Z-API (send-text ou send-text-poll dependendo do tipo).
//      d. Atualiza status do target (enviado/falha).
//      e. Atualiza contadores do broadcast.
//      f. Se todos enviados: muda status para 'concluido'.
//   4. Erros individuais não param o processamento.
//
// Segurança:
//   - Autenticação EXCLUSIVA via CRON_SECRET.
//   - Double-check opt-in antes de cada envio.
//   - Limite de N mensagens por broadcast por minuto (anti-ban).
//   - Apenas 1 broadcast processado por vez para evitar sobrecarga.
//
// Referência: RAQ-MAND-EM073 — T64 (Fase 6 Onda A)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/admin-guard.ts';
import { validateCronSecret } from '../_shared/cron-guard.ts';
import { isValidPhone, normalizePhoneForZapi, truncatePreview, ZAPI_BASE } from '../_shared/zapi-helpers.ts';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

interface BroadcastRow {
  id: string;
  account_id: string;
  body: string;
  tipo: string;
  poll_question: string | null;
  poll_options: unknown;
  ritmo_por_minuto: number;
  total_targets: number;
  sent_count: number;
  failed_count: number;
}

interface TargetRow {
  id: string;
  contact_id: string | null;
  phone: string;
}

interface ZapiAccount {
  id: string;
  instance_id: string;
  instance_token: string;
  client_token: string;
  status: string;
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

    // ── 1. Autenticação via CRON_SECRET (timing-safe — CWE-208) ───────────────
    const cronAuthError = validateCronSecret(req);
    if (cronAuthError) return cronAuthError;

    // ── 2. Cliente admin ───────────────────────────────────────────────────────
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── 3. Busca broadcasts em andamento ───────────────────────────────────────
    // Processamos 1 broadcast por vez para evitar sobrecarga no número WhatsApp
    const { data: broadcasts, error: bErr } = await admin
      .from('zapi_broadcasts')
      .select('id, account_id, body, tipo, poll_question, poll_options, ritmo_por_minuto, total_targets, sent_count, failed_count')
      .eq('status', 'enviando')
      .limit(3); // Máximo 3 broadcasts simultâneos

    if (bErr) {
      console.error('zapi-broadcast-send: erro ao buscar broadcasts', bErr.code);
      return jsonResponse(500, { error: 'Erro ao buscar campanhas ativas' });
    }

    if (!broadcasts || broadcasts.length === 0) {
      return jsonResponse(200, { ok: true, processed: 0 });
    }

    // Cache de contas
    const accountCache = new Map<string, ZapiAccount | null>();

    // CRÍTICA-3: throttle global por conta — rastreia msgs enviadas no ciclo atual
    // Teto máximo de 20 msgs/min por account_id distribuído entre todos os broadcasts
    const TETO_GLOBAL_POR_CONTA = 20;
    const accountEnviadosNoCiclo = new Map<string, number>();

    let totalSent = 0;
    let totalFailed = 0;

    for (const broadcast of broadcasts as BroadcastRow[]) {
      // ── 4. Busca conta Z-API (com cache) ──────────────────────────────────────
      let account = accountCache.get(broadcast.account_id) ?? null;
      if (!accountCache.has(broadcast.account_id)) {
        const { data: acc } = await admin
          .from('zapi_accounts')
          .select('id, instance_id, instance_token, client_token, status')
          .eq('id', broadcast.account_id)
          .maybeSingle<ZapiAccount>();
        account = acc ?? null;
        accountCache.set(broadcast.account_id, account);
      }

      if (!account || account.status === 'disconnected') {
        console.warn('zapi-broadcast-send: conta indisponível', { account_id: broadcast.account_id });
        await admin
          .from('zapi_broadcasts')
          .update({ status: 'falha' })
          .eq('id', broadcast.id);
        continue;
      }

      // ── CRÍTICA-3: throttle global por conta ─────────────────────────────────
      // Verifica quantas mensagens já foram enviadas por esta conta neste ciclo.
      // Limita a TETO_GLOBAL_POR_CONTA (20) distribuídos entre todos os broadcasts da conta.
      const jaEnviados = accountEnviadosNoCiclo.get(broadcast.account_id) ?? 0;
      if (jaEnviados >= TETO_GLOBAL_POR_CONTA) {
        console.log('zapi-broadcast-send: teto global atingido para conta', {
          account_id: broadcast.account_id,
          enviados_no_ciclo: jaEnviados,
          teto: TETO_GLOBAL_POR_CONTA,
        });
        continue;
      }

      // Fatia do teto restante para este broadcast
      const sliceDisponivel = TETO_GLOBAL_POR_CONTA - jaEnviados;
      const limitParaBroadcast = Math.min(broadcast.ritmo_por_minuto, sliceDisponivel);

      // ── 5. Busca targets pendentes (respeitando ritmo_por_minuto + teto global) ──
      const { data: targets, error: tErr } = await admin
        .from('zapi_broadcast_targets')
        .select('id, contact_id, phone')
        .eq('broadcast_id', broadcast.id)
        .eq('status', 'pendente')
        .limit(limitParaBroadcast);

      if (tErr) {
        console.error('zapi-broadcast-send: erro ao buscar targets', tErr.code);
        continue;
      }

      if (!targets || targets.length === 0) {
        // Verificar se o broadcast foi concluído
        const remaining = broadcast.total_targets - broadcast.sent_count - broadcast.failed_count;
        if (remaining <= 0) {
          await admin
            .from('zapi_broadcasts')
            .update({ status: 'concluido', finished_at: new Date().toISOString() })
            .eq('id', broadcast.id);
          console.log('zapi-broadcast-send: broadcast concluído', { id: broadcast.id });
        }
        continue;
      }

      let broadcastSent = 0;
      let broadcastFailed = 0;

      for (const target of targets as TargetRow[]) {
        // ── 6. Double-check opt-in + optin_data antes de enviar ──────────────
        // CRÍTICA-1: optin_data IS NOT NULL obrigatório (opt-in sem data = inválido)
        if (target.contact_id) {
          const { data: contactCheck } = await admin
            .from('contacts')
            .select('optin_whatsapp, optin_data, merged_into')
            .eq('id', target.contact_id)
            .maybeSingle();

          if (
            !contactCheck ||
            !contactCheck.optin_whatsapp ||
            !contactCheck.optin_data ||
            contactCheck.merged_into
          ) {
            // Contato perdeu opt-in, nunca teve data registrada, ou foi mesclado — bloquear
            await admin
              .from('zapi_broadcast_targets')
              .update({
                status: 'bloqueado',
                bloqueio_motivo: contactCheck?.merged_into ? 'merged' : 'sem_optin',
              })
              .eq('id', target.id);
            // Não conta como falha — apenas bloqueado
            continue;
          }
        }

        // ── 7. Normaliza telefone ─────────────────────────────────────────────
        const phone = normalizePhoneForZapi(target.phone);
        if (!isValidPhone(phone)) {
          await admin
            .from('zapi_broadcast_targets')
            .update({ status: 'falha', error_msg: 'Telefone inválido' })
            .eq('id', target.id);
          broadcastFailed++;
          continue;
        }

        // ── 8. Chama Z-API ────────────────────────────────────────────────────
        let zapiOk = false;
        let zapiErrorMsg = '';

        try {
          let zapiEndpoint: string;
          let zapiBody: Record<string, unknown>;

          if (broadcast.tipo === 'enquete' && broadcast.poll_question) {
            // Enquete
            zapiEndpoint = `${ZAPI_BASE}/${encodeURIComponent(account.instance_id)}/token/${encodeURIComponent(account.instance_token)}/send-text-poll`;
            const options = Array.isArray(broadcast.poll_options)
              ? (broadcast.poll_options as string[])
              : [];
            zapiBody = {
              phone,
              message: broadcast.poll_question,
              poll_max_options_selected: 1,
              options,
            };
          } else {
            // Mensagem de texto
            zapiEndpoint = `${ZAPI_BASE}/${encodeURIComponent(account.instance_id)}/token/${encodeURIComponent(account.instance_token)}/send-text`;
            zapiBody = { phone, message: broadcast.body };
          }

          const zapiResp = await fetch(zapiEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Client-Token': account.client_token,
            },
            body: JSON.stringify(zapiBody),
          });

          let zapiRespBody: Record<string, unknown> = {};
          try { zapiRespBody = await zapiResp.json(); } catch { /* sem JSON */ }

          if (zapiResp.ok) {
            zapiOk = true;
          } else {
            zapiErrorMsg = ((zapiRespBody.error as string) ?? `HTTP ${zapiResp.status}`).slice(0, 1024);
          }
        } catch (fetchErr) {
          zapiErrorMsg = `Falha de rede: ${fetchErr instanceof Error ? fetchErr.message : 'unknown'}`.slice(0, 1024);
        }

        // ── 9. Atualiza target ─────────────────────────────────────────────────
        if (zapiOk) {
          await admin
            .from('zapi_broadcast_targets')
            .update({ status: 'enviado', sent_at: new Date().toISOString() })
            .eq('id', target.id);
          broadcastSent++;
          totalSent++;
          // CRÍTICA-3: incrementa contador global por conta
          accountEnviadosNoCiclo.set(
            broadcast.account_id,
            (accountEnviadosNoCiclo.get(broadcast.account_id) ?? 0) + 1
          );
        } else {
          await admin
            .from('zapi_broadcast_targets')
            .update({ status: 'falha', error_msg: zapiErrorMsg })
            .eq('id', target.id);
          broadcastFailed++;
          totalFailed++;
        }

        // CRÍTICA-3: jitter anti-ban — aguarda 800–2500ms entre envios
        const jitter = 800 + Math.floor(Math.random() * 1700);
        await new Promise((resolve) => setTimeout(resolve, jitter));
      }

      // ── 10. Atualiza contadores do broadcast ───────────────────────────────
      const newSent = broadcast.sent_count + broadcastSent;
      const newFailed = broadcast.failed_count + broadcastFailed;
      const isDone = (newSent + newFailed) >= broadcast.total_targets;

      const updatePayload: Record<string, unknown> = {
        sent_count: newSent,
        failed_count: newFailed,
      };

      if (isDone) {
        updatePayload.status = 'concluido';
        updatePayload.finished_at = new Date().toISOString();
        console.log('zapi-broadcast-send: broadcast concluído', {
          id: broadcast.id,
          sent: newSent,
          failed: newFailed,
        });
      }

      await admin
        .from('zapi_broadcasts')
        .update(updatePayload)
        .eq('id', broadcast.id);
    }

    console.log(`zapi-broadcast-send: concluído. broadcasts=${broadcasts.length} sent=${totalSent} failed=${totalFailed}`);

    return jsonResponse(200, {
      ok: true,
      broadcasts_processed: broadcasts.length,
      sent: totalSent,
      failed: totalFailed,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('zapi-broadcast-send crash:', msg);
    return jsonResponse(500, { error: 'Erro interno' });
  }
});
