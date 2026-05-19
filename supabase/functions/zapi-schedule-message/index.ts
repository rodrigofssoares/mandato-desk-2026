// Edge Function: zapi-schedule-message
//
// Recebe uma solicitação de agendamento de mensagem WhatsApp e insere via
// service_role após validação completa. O INSERT direto pelo client foi
// bloqueado via RLS (policy WITH CHECK (false)) — este endpoint é o único
// caminho para criar agendamentos.
//
// Fluxo:
//   1. Valida JWT (requireAuth) — usuário autenticado e com perfil ATIVO.
//   2. Verifica permissão WhatsApp (permissoes_perfil secao=whatsapp, pode_editar=true).
//      Admin bypassa verificação de permissão.
//   3. Lê { account_id, chat_id, phone, body, scheduled_at } do body.
//   4. Valida campos: account_id existe em zapi_accounts (sem filtro por owner —
//      sistema single-tenant, migration 045), phone normalizado/válido,
//      scheduled_at no futuro (>= now + 1 min, <= now + 90 dias).
//   5. Rate-limit: rejeita se o usuário já tem >50 mensagens pendentes na fila.
//   6. Insere via service_role com created_by = callerId.
//   7. Retorna { ok: true, id, scheduled_at }.
//
// Segurança:
//   - INSERT na tabela bloqueado no client via RLS (WITH CHECK false).
//   - account_id validado contra zapi_accounts existente.
//   - Rate-limit por usuário (máximo 50 pendentes simultâneas).
//   - Janela temporal validada (futuro + <= 90 dias).
//   - Phone normalizado e validado antes de inserir.
//   - created_by sempre = callerId (não aceita from body).
//
// Referência: RAQ-MAND-EM073 — Security Fix CRÍTICA-1 + CRÍTICA-2

import { corsHeaders, jsonResponse, requireAuth } from '../_shared/auth-guard.ts';
import { normalizePhoneForZapi, isValidPhone } from '../_shared/zapi-helpers.ts';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Máximo de mensagens pendentes por usuário (rate-limit anti-spam)
const MAX_PENDING_PER_USER = 50;
// Janela mínima futura: 1 minuto (tolerância de clock skew)
const MIN_FUTURE_MS = 60_000;
// Janela máxima: 90 dias
const MAX_FUTURE_MS = 90 * 24 * 60 * 60 * 1000;

interface ScheduleBody {
  account_id?: string;
  chat_id?: string | null;
  phone?: string;
  body?: string;
  quoted_message_id?: string | null;
  scheduled_at?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Método não permitido' });

  try {
    // ── 1. Autenticação ──────────────────────────────────────────────────────
    const guard = await requireAuth(req);
    if (guard instanceof Response) return guard;
    const { admin, callerId, callerEmail, callerRole } = guard;

    // ── 2. Autorização: permissão WhatsApp (pode_editar) ─────────────────────
    const isAdmin = callerRole === 'admin';
    if (!isAdmin) {
      const { data: perm, error: permErr } = await admin
        .from('permissoes_perfil')
        .select('pode_editar')
        .eq('role', callerRole)
        .eq('secao', 'whatsapp')
        .maybeSingle();

      if (permErr) {
        console.error('zapi-schedule-message: erro ao verificar permissão', permErr.code);
        return jsonResponse(500, { error: 'Erro ao verificar permissões' });
      }

      if (!perm || perm.pode_editar !== true) {
        console.warn('zapi-schedule-message: acesso negado', { callerId, callerRole });
        return jsonResponse(403, { error: 'Sem permissão para agendar mensagens WhatsApp' });
      }
    }

    // ── 3. Parse body ────────────────────────────────────────────────────────
    let body: ScheduleBody;
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'Payload JSON inválido' });
    }

    const { account_id, chat_id = null, phone, body: msgBody, quoted_message_id = null, scheduled_at } = body;

    // ── 4a. Valida account_id ────────────────────────────────────────────────
    if (!account_id || !UUID_REGEX.test(account_id)) {
      return jsonResponse(400, { error: 'account_id deve ser um UUID válido' });
    }

    // Valida que a conta existe (sistema single-tenant — sem filtro por owner)
    const { data: account, error: accountErr } = await admin
      .from('zapi_accounts')
      .select('id, status')
      .eq('id', account_id)
      .maybeSingle();

    if (accountErr) {
      console.error('zapi-schedule-message: erro ao buscar conta', accountErr.code);
      return jsonResponse(500, { error: 'Erro ao verificar conta WhatsApp' });
    }
    if (!account) {
      return jsonResponse(404, { error: 'Conta WhatsApp não encontrada' });
    }
    if (account.status === 'disconnected') {
      return jsonResponse(422, { error: 'Conta WhatsApp está desconectada' });
    }

    // ── 4b. Valida chat_id (opcional) ────────────────────────────────────────
    if (chat_id !== null && chat_id !== undefined) {
      if (!UUID_REGEX.test(chat_id)) {
        return jsonResponse(400, { error: 'chat_id deve ser um UUID válido ou null' });
      }
    }

    // ── 4c. Valida phone ─────────────────────────────────────────────────────
    if (!phone || typeof phone !== 'string') {
      return jsonResponse(400, { error: 'phone é obrigatório' });
    }
    const normalizedPhone = normalizePhoneForZapi(phone);
    if (!isValidPhone(normalizedPhone)) {
      return jsonResponse(422, { error: `Telefone inválido: ${phone}` });
    }

    // ── 4d. Valida body da mensagem ──────────────────────────────────────────
    if (!msgBody || typeof msgBody !== 'string') {
      return jsonResponse(400, { error: 'body é obrigatório' });
    }
    if (msgBody.trim().length === 0) {
      return jsonResponse(400, { error: 'body não pode ser vazio' });
    }
    if (msgBody.length > 4096) {
      return jsonResponse(422, { error: 'body excede 4096 caracteres' });
    }

    // ── 4e. Valida quoted_message_id (opcional) ──────────────────────────────
    if (quoted_message_id !== null && quoted_message_id !== undefined) {
      if (typeof quoted_message_id !== 'string' || quoted_message_id.length > 255) {
        return jsonResponse(400, { error: 'quoted_message_id inválido (máx 255 chars)' });
      }
    }

    // ── 4f. Valida scheduled_at ──────────────────────────────────────────────
    if (!scheduled_at || typeof scheduled_at !== 'string') {
      return jsonResponse(400, { error: 'scheduled_at é obrigatório' });
    }

    const scheduledDate = new Date(scheduled_at);
    if (isNaN(scheduledDate.getTime())) {
      return jsonResponse(400, { error: 'scheduled_at deve ser uma data ISO 8601 válida' });
    }

    const now = Date.now();
    const diffMs = scheduledDate.getTime() - now;

    if (diffMs < MIN_FUTURE_MS) {
      return jsonResponse(422, {
        error: 'scheduled_at deve ser pelo menos 1 minuto no futuro',
      });
    }
    if (diffMs > MAX_FUTURE_MS) {
      return jsonResponse(422, {
        error: 'scheduled_at não pode ser mais de 90 dias no futuro',
      });
    }

    // ── 5. Rate-limit: máximo de MAX_PENDING_PER_USER mensagens pendentes ────
    const { count: pendingCount, error: countErr } = await admin
      .from('zapi_scheduled_messages')
      .select('id', { count: 'exact', head: true })
      .eq('created_by', callerId)
      .eq('status', 'pendente');

    if (countErr) {
      console.error('zapi-schedule-message: erro ao contar pendentes', countErr.code);
      return jsonResponse(500, { error: 'Erro ao verificar fila de agendamentos' });
    }

    if ((pendingCount ?? 0) >= MAX_PENDING_PER_USER) {
      console.warn('zapi-schedule-message: rate-limit atingido', {
        callerId,
        pendingCount,
        limit: MAX_PENDING_PER_USER,
      });
      return jsonResponse(429, {
        error: `Limite de ${MAX_PENDING_PER_USER} mensagens agendadas pendentes atingido. Cancele algumas antes de agendar novas.`,
      });
    }

    // ── 6. Insere via service_role (bypassa RLS) ─────────────────────────────
    // created_by SEMPRE = callerId — nunca aceito do body
    const { data: inserted, error: insertErr } = await admin
      .from('zapi_scheduled_messages')
      .insert({
        account_id,
        chat_id: chat_id ?? null,
        phone: normalizedPhone,
        body: msgBody,
        quoted_message_id: quoted_message_id ?? null,
        scheduled_at: scheduledDate.toISOString(),
        created_by: callerId,
        status: 'pendente',
      })
      .select('id, scheduled_at')
      .single();

    if (insertErr) {
      console.error('zapi-schedule-message: erro ao inserir', insertErr.code, insertErr.message);
      // Constraint de janela temporal violada (double-check no banco)
      if (insertErr.code === '23514') {
        return jsonResponse(422, { error: 'Data/hora de agendamento fora da janela permitida' });
      }
      return jsonResponse(500, { error: 'Erro ao criar agendamento' });
    }

    console.log('zapi-schedule-message: agendamento criado', {
      caller: callerEmail,
      callerId,
      msg_id: inserted.id,
      account_id,
      scheduled_at: inserted.scheduled_at,
    });

    return jsonResponse(201, {
      ok: true,
      id: inserted.id,
      scheduled_at: inserted.scheduled_at,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('zapi-schedule-message crash:', msg);
    return jsonResponse(500, { error: 'Erro interno' });
  }
});
