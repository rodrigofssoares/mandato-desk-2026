// Edge Function: zapi-cleanup-history
//
// Limpeza de histórico de conversas WhatsApp em 4 modos com registro de lote
// para possibilitar restauração dentro do prazo de 7 dias.
//
// Fluxo:
//   1. Valida JWT (qualquer usuário com perfil ATIVO).
//   2. Verifica permissão: pode_deletar=true em permissoes_perfil para seção 'whatsapp'.
//      Admin sempre passa. Outros roles passam apenas se habilitado na matriz.
//   3. Valida body { account_id, mode, filters }.
//   4. Verifica que account_id existe.
//   5. Cria registro em zapi_cleanup_batches (status='pending') ANTES de executar.
//   6. Executa soft-delete via executeCleanupPredicate (cleanup-predicate.ts).
//   7. Atualiza batch.row_count_estimate com o total apagado.
//   8. Retorna { ok, batch_id, row_count, expires_at }.
//
// Segurança:
//   - Verificação de permissão server-side (não confia no JWT claims).
//   - account_id validado como UUID e existente no banco.
//   - chat_ids validados como array de UUIDs (anti-injection).
//   - Datas validadas como ISO8601 (anti-injection).
//   - Batch criado ANTES do soft-delete: auditoria completa mesmo se a EF crashar.
//   - Log de auditoria sem PII de conteúdo.
//
// Referência: RAQ-MAND-EM082 — T02

import { corsHeaders, jsonResponse } from '../_shared/admin-guard.ts';
import { requireAuth } from '../_shared/auth-guard.ts';
import {
  executeCleanupPredicate,
  type CleanupFilters,
  type CleanupMode,
  type GranularItem,
} from '../_shared/cleanup-predicate.ts';

// ─── Validação ────────────────────────────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}(T[\d:.Z+-]+)?$/;

const VALID_MODES: CleanupMode[] = ['period', 'all', 'chats', 'granular'];
const VALID_ITEMS: GranularItem[] = ['messages', 'media', 'notes', 'tags', 'flags', 'logs'];

function isValidUUID(v: unknown): v is string {
  return typeof v === 'string' && UUID_REGEX.test(v);
}

function isValidISO(v: unknown): v is string {
  return typeof v === 'string' && ISO_DATE_REGEX.test(v);
}

interface CleanupBody {
  account_id?: unknown;
  mode?: unknown;
  filters?: unknown;
}

/** Valida o body e retorna os campos validados ou uma string de erro. */
function validateBody(raw: CleanupBody): {
  account_id: string;
  mode: CleanupMode;
  filters: CleanupFilters;
} | string {
  const { account_id, mode, filters: rawFilters } = raw;

  if (!isValidUUID(account_id)) {
    return 'account_id deve ser um UUID válido';
  }

  if (!VALID_MODES.includes(mode as CleanupMode)) {
    return `mode deve ser um de: ${VALID_MODES.join(', ')}`;
  }

  const m = mode as CleanupMode;
  const f = (rawFilters && typeof rawFilters === 'object' ? rawFilters : {}) as Record<string, unknown>;
  const filters: CleanupFilters = {};

  if (m === 'period') {
    if (!isValidISO(f.start_date)) return 'filters.start_date deve ser uma data ISO8601 válida';
    if (!isValidISO(f.end_date))   return 'filters.end_date deve ser uma data ISO8601 válida';
    filters.start_date = f.start_date as string;
    filters.end_date   = f.end_date as string;
  }

  if (m === 'chats') {
    if (!Array.isArray(f.chat_ids) || f.chat_ids.length === 0) {
      return 'filters.chat_ids deve ser um array não-vazio de UUIDs';
    }
    for (const id of f.chat_ids) {
      if (!isValidUUID(id)) return `filters.chat_ids contém UUID inválido: ${id}`;
    }
    filters.chat_ids = f.chat_ids as string[];
  }

  if (m === 'granular') {
    if (!Array.isArray(f.items) || f.items.length === 0) {
      return 'filters.items deve ser um array não-vazio para modo granular';
    }
    for (const it of f.items) {
      if (!VALID_ITEMS.includes(it as GranularItem)) {
        return `filters.items contém item inválido: ${it}. Valores aceitos: ${VALID_ITEMS.join(', ')}`;
      }
    }
    filters.items = f.items as GranularItem[];

    // Escopo opcional de chats
    if (f.chat_ids !== undefined) {
      if (!Array.isArray(f.chat_ids)) return 'filters.chat_ids deve ser um array de UUIDs';
      for (const id of f.chat_ids) {
        if (!isValidUUID(id)) return `filters.chat_ids contém UUID inválido: ${id}`;
      }
      filters.chat_ids = f.chat_ids as string[];
    }

    // Datas opcionais (escopo para messages/media)
    if (f.start_date !== undefined) {
      if (!isValidISO(f.start_date)) return 'filters.start_date deve ser uma data ISO8601 válida';
      filters.start_date = f.start_date as string;
    }
    if (f.end_date !== undefined) {
      if (!isValidISO(f.end_date)) return 'filters.end_date deve ser uma data ISO8601 válida';
      filters.end_date = f.end_date as string;
    }
  }

  return { account_id, mode: m, filters };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResponse(405, { error: 'Método não permitido' });

  try {
    // ── 1. Autenticação ──────────────────────────────────────────────────────
    const guard = await requireAuth(req);
    if (guard instanceof Response) return guard;
    const { admin, callerId, callerEmail, callerRole } = guard;

    // ── 2. Autorização: pode_deletar em 'whatsapp' ───────────────────────────
    //
    // Admin sempre passa. Outros roles precisam ter pode_deletar=true na matriz.
    // Não usa is_zapi_privileged porque a feature permite que o admin delegue
    // permissão de limpeza para outros roles (proprietário, assessor etc.)
    // via a matriz de permissões na UI.
    const isAdmin = callerRole === 'admin';
    if (!isAdmin) {
      const { data: perm, error: permErr } = await admin
        .from('permissoes_perfil')
        .select('pode_deletar')
        .eq('role', callerRole)
        .eq('secao', 'whatsapp')
        .maybeSingle();

      if (permErr) {
        console.error('zapi-cleanup-history: erro ao verificar permissão', {
          code: permErr.code,
          callerId,
        });
        return jsonResponse(500, { error: 'Erro ao verificar permissões' });
      }

      if (!perm || perm.pode_deletar !== true) {
        console.warn('zapi-cleanup-history: acesso negado (sem pode_deletar)', {
          callerId,
          callerRole,
        });
        return jsonResponse(403, { error: 'Sem permissão para limpar histórico WhatsApp' });
      }
    }

    // ── 3. Parse e validação do body ─────────────────────────────────────────
    let rawBody: CleanupBody;
    try {
      rawBody = await req.json();
    } catch {
      return jsonResponse(400, { error: 'Payload JSON inválido' });
    }

    const validated = validateBody(rawBody);
    if (typeof validated === 'string') {
      return jsonResponse(400, { error: validated });
    }
    const { account_id, mode, filters } = validated;

    // ── 4. Verificar que account_id existe ───────────────────────────────────
    const { data: account, error: accErr } = await admin
      .from('zapi_accounts')
      .select('id')
      .eq('id', account_id)
      .maybeSingle();

    if (accErr) {
      console.error('zapi-cleanup-history: erro ao verificar conta', {
        code: accErr.code,
        account_id,
      });
      return jsonResponse(500, { error: 'Erro ao verificar conta' });
    }

    if (!account) {
      return jsonResponse(404, { error: 'Conta não encontrada' });
    }

    // ── 5. Criar batch ANTES de executar (auditoria completa) ────────────────
    const { data: batch, error: batchErr } = await admin
      .from('zapi_cleanup_batches')
      .insert({
        account_id,
        initiated_by: callerId,
        mode,
        filters: filters as unknown as Record<string, unknown>,
        status: 'pending',
        row_count_estimate: 0,
      })
      .select('id, expires_at')
      .single();

    if (batchErr || !batch) {
      console.error('zapi-cleanup-history: erro ao criar batch', {
        code: batchErr?.code,
        callerId,
        account_id,
        mode,
      });
      return jsonResponse(500, { error: 'Erro ao registrar operação de limpeza' });
    }

    // ── 6. Executar soft-delete ───────────────────────────────────────────────
    let rowCount = 0;
    try {
      const result = await executeCleanupPredicate(
        admin,
        { mode, filters, account_id, caller_id: callerId },
        false, // soft-delete
      );
      rowCount = result.row_count;
    } catch (execErr) {
      const msg = execErr instanceof Error ? execErr.message : String(execErr);
      console.error('zapi-cleanup-history: erro no predicado de limpeza', {
        callerId,
        account_id,
        mode,
        error: msg,
      });
      // Batch criado mas sem dados apagados — marcar como expired pra não deixar
      // batch "fantasma" em pending (simplifica o painel de lixeira)
      await admin
        .from('zapi_cleanup_batches')
        .update({ status: 'expired', row_count_estimate: 0 })
        .eq('id', batch.id);
      return jsonResponse(500, { error: `Erro ao executar limpeza: ${msg}` });
    }

    // ── 7. Atualizar batch com contagem real ─────────────────────────────────
    await admin
      .from('zapi_cleanup_batches')
      .update({ row_count_estimate: rowCount })
      .eq('id', batch.id);

    // ── 8. Retorno + log de auditoria ─────────────────────────────────────────
    console.log('zapi-cleanup-history: limpeza concluída', {
      caller: callerEmail,
      callerId,
      account_id,
      mode,
      batch_id: batch.id,
      row_count: rowCount,
    });

    return jsonResponse(200, {
      ok: true,
      batch_id: batch.id,
      row_count: rowCount,
      expires_at: batch.expires_at,
    });
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error('zapi-cleanup-history crash:', msg);
    return jsonResponse(500, { error: 'Erro interno' });
  }
});
