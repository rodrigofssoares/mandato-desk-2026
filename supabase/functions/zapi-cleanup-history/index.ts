// Edge Function: zapi-cleanup-history
//
// Limpeza de histórico de conversas WhatsApp em 4 modos com registro de lote
// para possibilitar restauração dentro do prazo de 7 dias.
//
// Fluxo:
//   1. Valida JWT (qualquer usuário com perfil ATIVO).
//   2. Verifica permissão: pode_deletar=true em permissoes_perfil para seção 'whatsapp'.
//      Admin sempre passa. Outros roles passam apenas se habilitado na matriz.
//   3. Verifica acesso à conta (FIX 1 — IDOR): can_access_zapi_account(callerId, account_id).
//      Privilegiados (admin/proprietário): acesso irrestrito.
//      Restritos com pode_deletar=true: somente contas vinculadas em zapi_account_users.
//   4. Valida body { account_id, mode, filters }.
//   5. Verifica rate limit: máx 3 limpezas por (account_id + caller) nos últimos 5 min (FIX 6).
//   6. Verifica batch pending único por conta (FIX 4).
//   7. Cria registro em zapi_cleanup_batches (status='pending') ANTES de executar.
//   8. Executa soft-delete via executeCleanupPredicate (cleanup-predicate.ts).
//      Passa batch_id para gravar deleted_batch_id (FIX 2 — restore determinístico).
//   9. Atualiza batch.row_count_estimate com o total apagado (FIX 13 — loga erro sem falhar).
//  10. Retorna { ok, batch_id, row_count, expires_at }.
//
// Segurança:
//   - Verificação de permissão server-side (não confia no JWT claims).
//   - IDOR: can_access_zapi_account verifica vínculo de conta para usuários restritos (FIX 1).
//   - account_id validado como UUID e existente no banco.
//   - chat_ids validados como array de UUIDs (anti-injection).
//   - Datas validadas como ISO8601 (anti-injection).
//   - Granular com messages/media exige escopo (FIX 3).
//   - Rate limit 3/5min por (account + caller) (FIX 6).
//   - Batch único pending por conta (FIX 4).
//   - Batch criado ANTES do soft-delete: auditoria completa mesmo se a EF crashar.
//   - Erros internos retornam mensagem genérica ao client (FIX 12).
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

// FIX 11: limite de chat_ids por operação
const MAX_CHAT_IDS = 500;

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
    // FIX 8: validar intervalo (end >= start)
    if (new Date(f.end_date as string) < new Date(f.start_date as string)) {
      return 'filters.end_date não pode ser anterior a filters.start_date';
    }
    filters.start_date = f.start_date as string;
    filters.end_date   = f.end_date as string;
  }

  if (m === 'chats') {
    if (!Array.isArray(f.chat_ids) || f.chat_ids.length === 0) {
      return 'filters.chat_ids deve ser um array não-vazio de UUIDs';
    }
    // FIX 11: limite de chat_ids
    if (f.chat_ids.length > MAX_CHAT_IDS) {
      return `filters.chat_ids excede o limite máximo de ${MAX_CHAT_IDS} conversas por operação`;
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

    // FIX 3: granular com messages/media exige escopo (chat_ids OU datas)
    const hasMessagesOrMedia = filters.items.some((i) => i === 'messages' || i === 'media');
    if (hasMessagesOrMedia) {
      const hasChatScope = Array.isArray(f.chat_ids) && (f.chat_ids as unknown[]).length > 0;
      const hasDateScope = isValidISO(f.start_date) && isValidISO(f.end_date);
      if (!hasChatScope && !hasDateScope) {
        return 'granular com messages/media exige chat_ids ou período (start_date + end_date)';
      }
    }

    // Escopo opcional de chats
    if (f.chat_ids !== undefined) {
      if (!Array.isArray(f.chat_ids)) return 'filters.chat_ids deve ser um array de UUIDs';
      // FIX 11: limite de chat_ids
      if (f.chat_ids.length > MAX_CHAT_IDS) {
        return `filters.chat_ids excede o limite máximo de ${MAX_CHAT_IDS} conversas por operação`;
      }
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

    // FIX 8: validar intervalo invertido quando ambas as datas estão presentes
    if (filters.start_date && filters.end_date) {
      if (new Date(filters.end_date) < new Date(filters.start_date)) {
        return 'filters.end_date não pode ser anterior a filters.start_date';
      }
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

    // ── 4b. FIX 1 — IDOR: verificar acesso à conta ───────────────────────────
    //
    // Usa o helper can_access_zapi_account criado na migration 112.
    // Privilegiados (admin/proprietário): acesso a qualquer conta.
    // Restritos com pode_deletar=true: somente contas vinculadas em zapi_account_users.
    // Isso evita que um assessor com pode_deletar=true passe account_id arbitrário
    // e apague dados de uma conta à qual não tem acesso.
    if (!isAdmin) {
      const { data: canAccess, error: accessErr } = await admin
        .rpc('can_access_zapi_account', { _uid: callerId, _account_id: account_id });

      if (accessErr) {
        console.error('zapi-cleanup-history: erro ao verificar acesso à conta', {
          code: accessErr.code,
          callerId,
          account_id,
        });
        return jsonResponse(500, { error: 'Erro ao verificar acesso à conta' });
      }

      if (!canAccess) {
        console.warn('zapi-cleanup-history: tentativa de IDOR bloqueada', {
          callerId,
          callerRole,
          account_id,
        });
        return jsonResponse(403, { error: 'Sem acesso a esta conta WhatsApp' });
      }
    }

    // ── 5. FIX 6 — Rate limit: máx 3 limpezas por (account + caller) em 5 min ─
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const { count: recentCount, error: rateErr } = await admin
      .from('zapi_cleanup_batches')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', account_id)
      .eq('initiated_by', callerId)
      .gte('created_at', fiveMinAgo);

    if (rateErr) {
      console.error('zapi-cleanup-history: erro ao verificar rate limit', {
        code: rateErr.code,
        callerId,
        account_id,
      });
      return jsonResponse(500, { error: 'Erro ao verificar limite de operações' });
    }

    if ((recentCount ?? 0) >= 3) {
      console.warn('zapi-cleanup-history: rate limit atingido', { callerId, account_id });
      return jsonResponse(429, {
        error: 'Muitas operações de limpeza em curto período. Aguarde alguns minutos.',
      });
    }

    // ── 6. FIX 4 — Verificar batch pending único por conta ───────────────────
    const { data: pendingBatch, error: pendingErr } = await admin
      .from('zapi_cleanup_batches')
      .select('id')
      .eq('account_id', account_id)
      .eq('status', 'pending')
      .maybeSingle();

    if (pendingErr) {
      console.error('zapi-cleanup-history: erro ao verificar batch pending', {
        code: pendingErr.code,
        account_id,
      });
      return jsonResponse(500, { error: 'Erro ao verificar operações pendentes' });
    }

    if (pendingBatch) {
      return jsonResponse(409, {
        error: 'Já existe uma limpeza pendente para esta conta. Aguarde a conclusão antes de iniciar outra.',
      });
    }

    // ── 7. Criar batch ANTES de executar (auditoria completa) ────────────────
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
      // FIX 4: tratar violação do unique constraint como 409
      const isUniqueViolation = batchErr?.code === '23505';
      if (isUniqueViolation) {
        console.warn('zapi-cleanup-history: unique constraint de batch pending violado (race condition)', {
          callerId,
          account_id,
        });
        return jsonResponse(409, {
          error: 'Já existe uma limpeza pendente para esta conta. Aguarde a conclusão antes de iniciar outra.',
        });
      }

      console.error('zapi-cleanup-history: erro ao criar batch', {
        code: batchErr?.code,
        callerId,
        account_id,
        mode,
      });
      return jsonResponse(500, { error: 'Erro ao registrar operação de limpeza' });
    }

    // ── 8. Executar soft-delete ───────────────────────────────────────────────
    let rowCount = 0;
    try {
      const result = await executeCleanupPredicate(
        admin,
        {
          mode,
          filters,
          account_id,
          caller_id: callerId,
          batch_id: batch.id, // FIX 2: gravar deleted_batch_id nos registros
        },
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
      return jsonResponse(500, { error: 'Erro ao executar limpeza' }); // FIX 12: mensagem genérica
    }

    // ── 9. Atualizar batch com contagem real (FIX 13 — loga erro sem falhar) ──
    const { error: updateErr } = await admin
      .from('zapi_cleanup_batches')
      .update({ row_count_estimate: rowCount })
      .eq('id', batch.id);

    if (updateErr) {
      // Não é fatal — o dado já foi apagado; só a estimativa ficou em 0.
      // Logar para diagnóstico sem devolver erro ao cliente.
      console.error('zapi-cleanup-history: falha ao atualizar row_count_estimate', {
        code: updateErr.code,
        batch_id: batch.id,
      });
    }

    // ── 10. Retorno + log de auditoria ─────────────────────────────────────────
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
    return jsonResponse(500, { error: 'Erro interno' }); // FIX 12: nunca vaza detalhe interno
  }
});
