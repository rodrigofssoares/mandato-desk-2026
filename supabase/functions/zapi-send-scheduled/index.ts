// Edge Function: zapi-send-scheduled
//
// Processa a fila de mensagens agendadas (tabela zapi_scheduled_messages).
// Chamada pelo cron job "zapi-scheduled-sender" a cada minuto via pg_net.
//
// Fluxo:
//   0. Dead-letter recovery: ressuscita registros travados em 'processando' por
//      mais de 5 minutos (lock timeout — a instância anterior crashou).
//   1. Valida Authorization: Bearer <CRON_SECRET>.
//      SEM fallback de JWT de usuário. Se não for o CRON_SECRET, retorna 403.
//   2. Seleciona todas as mensagens com status='pendente' AND scheduled_at <= now().
//   3. Para cada mensagem:
//      a. Lock otimista: UPDATE status='processando', processing_started_at=now()
//         WHERE status='pendente' RETURNING *.
//         Se retornar 0 linhas, outra instância já processou — pular.
//      b. Busca credenciais da conta Z-API.
//      c. POST https://api.z-api.io/.../send-text
//      d. Atualiza status para 'enviado' (sent_at=now()) ou 'falha' (error_msg).
//   4. Retorna { ok: true, processed: N, sent: N, failed: N, recovered: N }.
//
// Segurança:
//   - Autenticação EXCLUSIVAMENTE via CRON_SECRET (env var).
//   - SEM fallback de JWT de usuário — qualquer outro token retorna 403.
//   - Lock otimista previne envio duplicado em chamadas simultâneas.
//   - processing_started_at permite dead-letter recovery (Achado MÉDIA-2).
//   - instance_id e instance_token são encodeURIComponent antes de compor a URL.
//   - Nenhum segredo é retornado na resposta.
//
// Achados corrigidos: ALTA-1 (sem fallback JWT), MÉDIA-2 (dead-letter).
// Referência: RAQ-MAND-EM073 — Security Fix

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/admin-guard.ts';
import { normalizePhoneForZapi, isValidPhone } from '../_shared/zapi-helpers.ts';

const ZAPI_BASE = 'https://api.z-api.io/instances';
// Tempo máximo de lock: se processing_started_at > 5min atrás, ressuscita
const LOCK_TIMEOUT_MINUTES = 5;

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
  status: string;
}

interface ScheduledMessage {
  id: string;
  account_id: string;
  phone: string;
  body: string;
  quoted_message_id: string | null;
  chat_id: string | null;
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

    // ── 1. Autenticação EXCLUSIVA via CRON_SECRET ────────────────────────────
    // NÃO há fallback de JWT de usuário. Apenas o cron job (pg_net) pode chamar.
    const cronSecret = Deno.env.get('CRON_SECRET');
    if (!cronSecret) {
      // CRON_SECRET não configurado — EF não deve executar
      console.error('zapi-send-scheduled: CRON_SECRET não configurado');
      return jsonResponse(500, { error: 'Configuração incompleta: CRON_SECRET ausente' });
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

    // Comparação em tempo constante para evitar timing attacks
    if (!token || token.length !== cronSecret.length || token !== cronSecret) {
      console.warn('zapi-send-scheduled: token inválido ou ausente (não é o CRON_SECRET)');
      return jsonResponse(403, { error: 'Acesso negado' });
    }

    // ── 2. Cliente admin (service_role) ──────────────────────────────────────
    const admin = createClient(url, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── 0. Dead-letter recovery: ressuscita locks travados ───────────────────
    const lockTimeoutAgo = new Date(
      Date.now() - LOCK_TIMEOUT_MINUTES * 60 * 1000
    ).toISOString();

    const { count: recovered, error: recoveryErr } = await admin
      .from('zapi_scheduled_messages')
      .update({ status: 'pendente', processing_started_at: null }, { count: 'exact' })
      .eq('status', 'processando')
      .lt('processing_started_at', lockTimeoutAgo);

    if (recoveryErr) {
      // Logar mas não interromper — continuar processamento normal
      console.warn('zapi-send-scheduled: erro no dead-letter recovery', recoveryErr.code);
    } else if ((recovered ?? 0) > 0) {
      console.log(`zapi-send-scheduled: ressuscitou ${recovered} mensagem(ns) travada(s)`);
    }

    // ── 3. Seleciona mensagens pendentes vencidas ─────────────────────────────
    const now = new Date().toISOString();
    const { data: pending, error: selectErr } = await admin
      .from('zapi_scheduled_messages')
      .select('id, account_id, phone, body, quoted_message_id, chat_id')
      .eq('status', 'pendente')
      .lte('scheduled_at', now)
      .limit(50); // Processa no máximo 50 por rodada (proteção contra backlog grande)

    if (selectErr) {
      console.error('zapi-send-scheduled: erro ao buscar pendentes', selectErr.code);
      return jsonResponse(500, { error: 'Erro ao buscar fila' });
    }

    if (!pending || pending.length === 0) {
      return jsonResponse(200, { ok: true, processed: 0, sent: 0, failed: 0, recovered: recovered ?? 0 });
    }

    let sent = 0;
    let failed = 0;

    // Cache de contas para evitar N buscas iguais
    const accountCache = new Map<string, ZapiAccount | null>();

    for (const msg of pending as ScheduledMessage[]) {
      // ── 3a. Lock otimista com processing_started_at ────────────────────────
      // UPDATE WHERE status='pendente' → se 0 linhas, outra instância já pegou.
      // Grava processing_started_at para dead-letter recovery.
      const { data: locked, error: lockErr } = await admin
        .from('zapi_scheduled_messages')
        .update({
          status: 'processando',
          processing_started_at: new Date().toISOString(),
        })
        .eq('id', msg.id)
        .eq('status', 'pendente')
        .select('id')
        .maybeSingle();

      if (lockErr || !locked) {
        // Outra instância já está processando — pular
        continue;
      }

      // ── 3b. Busca credenciais da conta ─────────────────────────────────────
      let account = accountCache.get(msg.account_id) ?? null;
      if (!accountCache.has(msg.account_id)) {
        const { data: acc } = await admin
          .from('zapi_accounts')
          .select('id, instance_id, instance_token, client_token, status')
          .eq('id', msg.account_id)
          .maybeSingle<ZapiAccount>();
        account = acc ?? null;
        accountCache.set(msg.account_id, account);
      }

      if (!account || account.status === 'disconnected') {
        await admin
          .from('zapi_scheduled_messages')
          .update({
            status: 'falha',
            error_msg: 'Conta Z-API desconectada ou não encontrada',
            processing_started_at: null,
          })
          .eq('id', msg.id);
        failed++;
        continue;
      }

      // ── 3c. Normaliza e valida phone ────────────────────────────────────────
      const phone = normalizePhoneForZapi(msg.phone);
      if (!isValidPhone(phone)) {
        await admin
          .from('zapi_scheduled_messages')
          .update({
            status: 'falha',
            error_msg: `Telefone inválido: ${msg.phone}`,
            processing_started_at: null,
          })
          .eq('id', msg.id);
        failed++;
        continue;
      }

      // ── 3d. Chamada Z-API ───────────────────────────────────────────────────
      const zapiUrl = `${ZAPI_BASE}/${encodeURIComponent(account.instance_id)}/token/${encodeURIComponent(account.instance_token)}/send-text`;

      const zapiBody: Record<string, unknown> = { phone, message: msg.body };
      if (msg.quoted_message_id) {
        zapiBody.quoted = { messageId: msg.quoted_message_id };
      }

      let zapiOk = false;
      let zapiErrorMsg = '';
      let zapiMessageId = '';

      try {
        const zapiResp = await fetch(zapiUrl, {
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
          zapiMessageId = (
            (zapiRespBody.messageId ?? zapiRespBody.id ?? zapiRespBody.zaapId) as string
          ) ?? `sent-${crypto.randomUUID()}`;
        } else {
          const detail = (zapiRespBody.error as string) ?? `HTTP ${zapiResp.status}`;
          zapiErrorMsg = `Z-API: ${detail}`.slice(0, 1024);
        }
      } catch (fetchErr) {
        zapiErrorMsg = `Falha de rede: ${fetchErr instanceof Error ? fetchErr.message : 'unknown'}`.slice(0, 1024);
      }

      // ── 3e. Atualiza status na tabela ───────────────────────────────────────
      const nowSent = new Date().toISOString();

      if (zapiOk) {
        await admin
          .from('zapi_scheduled_messages')
          .update({
            status: 'enviado',
            sent_at: nowSent,
            error_msg: null,
            processing_started_at: null,
          })
          .eq('id', msg.id);

        // Persiste mensagem outbound no histórico
        const preview = msg.body.length > 200 ? `${msg.body.slice(0, 197)}...` : msg.body;
        await admin.from('zapi_messages').insert({
          account_id: msg.account_id,
          chat_id: msg.chat_id,
          message_id: zapiMessageId,
          direction: 'outbound',
          body: msg.body.slice(0, 4096),
          status: 'sent',
          sent_at: nowSent,
          quoted_message_id: msg.quoted_message_id ?? null,
        });

        // Atualiza preview do chat
        if (msg.chat_id) {
          await admin
            .from('zapi_chats')
            .update({ last_message_at: nowSent, last_message_preview: preview, updated_at: nowSent })
            .eq('id', msg.chat_id);
        }

        sent++;
        console.log('zapi-send-scheduled: enviado', { msg_id: msg.id, account_id: msg.account_id });
      } else {
        await admin
          .from('zapi_scheduled_messages')
          .update({
            status: 'falha',
            error_msg: zapiErrorMsg,
            processing_started_at: null,
          })
          .eq('id', msg.id);
        failed++;
        console.warn('zapi-send-scheduled: falha', { msg_id: msg.id, error: zapiErrorMsg });
      }
    }

    const processed = sent + failed;
    console.log(`zapi-send-scheduled: concluído. processed=${processed} sent=${sent} failed=${failed} recovered=${recovered ?? 0}`);

    return jsonResponse(200, { ok: true, processed, sent, failed, recovered: recovered ?? 0 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('zapi-send-scheduled crash:', msg);
    return jsonResponse(500, { error: 'Erro interno' });
  }
});
