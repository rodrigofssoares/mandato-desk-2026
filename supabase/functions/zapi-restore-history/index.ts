// Edge Function: zapi-restore-history
//
// Recupera um lote de histórico da lixeira dentro do prazo de 7 dias.
// Admin-only (pode_deletar_em_massa=true em permissoes_perfil para 'whatsapp').
//
// Fluxo:
//   1. Valida JWT (qualquer usuário com perfil ATIVO).
//   2. Verifica permissão: pode_deletar_em_massa=true em permissoes_perfil para 'whatsapp'.
//      Admin sempre passa.
//   3. Valida body { batch_id } (UUID válido).
//   4. Busca o batch. Retorna 404 se não existe, 410 se expirado, 409 se já restaurado.
//   5. FIX 1 — IDOR: verifica acesso à conta do batch via can_access_zapi_account.
//      (Restore é admin-only na prática, mas defense-in-depth garante que mesmo
//       um proprietário com pode_deletar_em_massa=true só restaura contas acessíveis.)
//   6. FIX 5 — TOCTOU: verifica que ainda há registros com deleted_batch_id=batch.id.
//      Se count=0 → dados já foram hard-deletados pelo cron → 410.
//   7. Re-executa o predicado dos filtros do batch com UPDATE deleted_at=NULL
//      (usando cleanup-predicate.ts, flag restore=true).
//      FIX 2: usa restore_batch_id=batch.id (determinístico, não deleted_by).
//   8. Atualiza batch.status='restored'.
//   9. Retorna { ok, restored_count }.
//
// Segurança:
//   - Verificação de permissão server-side (admin-only por padrão — não delegável).
//   - IDOR: can_access_zapi_account verifica acesso à conta do batch (FIX 1).
//   - batch_id validado como UUID.
//   - TOCTOU: verifica existência real dos dados antes de restaurar (FIX 5).
//   - FIX 2: restore usa deleted_batch_id (determinístico) — não mistura batches.
//   - Erros internos retornam mensagem genérica ao client (FIX 12).
//   - Log de auditoria sem PII de conteúdo.
//
// Referência: RAQ-MAND-EM082 — T03

import { corsHeaders, jsonResponse } from '../_shared/admin-guard.ts';
import { requireAuth } from '../_shared/auth-guard.ts';
import {
  executeCleanupPredicate,
  type CleanupFilters,
  type CleanupMode,
} from '../_shared/cleanup-predicate.ts';

// ─── Validação ────────────────────────────────────────────────────────────────

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(v: unknown): v is string {
  return typeof v === 'string' && UUID_REGEX.test(v);
}

// ─── Tipo do batch retornado pelo banco ───────────────────────────────────────

interface BatchRow {
  id: string;
  account_id: string;
  initiated_by: string;
  mode: string;
  filters: Record<string, unknown>;
  status: string;
  expires_at: string;
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

    // ── 2. Autorização: pode_deletar_em_massa em 'whatsapp' (admin-only) ─────
    //
    // Restauração de lixeira é restrita a quem tem pode_deletar_em_massa=true.
    // Por padrão, apenas admin tem essa flag.
    const isAdmin = callerRole === 'admin';
    if (!isAdmin) {
      const { data: perm, error: permErr } = await admin
        .from('permissoes_perfil')
        .select('pode_deletar_em_massa')
        .eq('role', callerRole)
        .eq('secao', 'whatsapp')
        .maybeSingle();

      if (permErr) {
        console.error('zapi-restore-history: erro ao verificar permissão', {
          code: permErr.code,
          callerId,
        });
        return jsonResponse(500, { error: 'Erro ao verificar permissões' });
      }

      if (!perm || perm.pode_deletar_em_massa !== true) {
        console.warn('zapi-restore-history: acesso negado (sem pode_deletar_em_massa)', {
          callerId,
          callerRole,
        });
        return jsonResponse(403, { error: 'Sem permissão para restaurar histórico da lixeira. Apenas administradores.' });
      }
    }

    // ── 3. Parse e validação do body ─────────────────────────────────────────
    let rawBody: { batch_id?: unknown };
    try {
      rawBody = await req.json();
    } catch {
      return jsonResponse(400, { error: 'Payload JSON inválido' });
    }

    const { batch_id } = rawBody;
    if (!isValidUUID(batch_id)) {
      return jsonResponse(400, { error: 'batch_id deve ser um UUID válido' });
    }

    // ── 4. Buscar batch ───────────────────────────────────────────────────────
    const { data: batch, error: batchErr } = await admin
      .from('zapi_cleanup_batches')
      .select('id, account_id, initiated_by, mode, filters, status, expires_at')
      .eq('id', batch_id)
      .maybeSingle<BatchRow>();

    if (batchErr) {
      console.error('zapi-restore-history: erro ao buscar batch', {
        code: batchErr.code,
        batch_id,
      });
      return jsonResponse(500, { error: 'Erro ao buscar lote' });
    }

    if (!batch) {
      return jsonResponse(404, { error: 'Lote não encontrado' });
    }

    // Status gates
    if (batch.status === 'expired') {
      return jsonResponse(410, { error: 'Prazo de restauração expirado. Os dados foram removidos definitivamente.' });
    }
    if (batch.status === 'restored') {
      return jsonResponse(409, { error: 'Este lote já foi restaurado anteriormente.' });
    }

    // Verificação extra de expires_at (o cron pode ter atrasado)
    if (new Date(batch.expires_at) < new Date()) {
      await admin
        .from('zapi_cleanup_batches')
        .update({ status: 'expired' })
        .eq('id', batch.id);
      return jsonResponse(410, { error: 'Prazo de restauração expirado. Os dados foram removidos definitivamente.' });
    }

    // ── 5. FIX 1 — IDOR: verifica acesso à conta do batch ───────────────────
    //
    // Defense-in-depth: mesmo que o caller tenha pode_deletar_em_massa=true,
    // ele só pode restaurar lotes de contas às quais tem acesso.
    // Na prática é admin-only, mas previne escalada lateral se a flag for delegada.
    if (!isAdmin) {
      const { data: canAccess, error: accessErr } = await admin
        .rpc('can_access_zapi_account', { _uid: callerId, _account_id: batch.account_id });

      if (accessErr) {
        console.error('zapi-restore-history: erro ao verificar acesso à conta', {
          code: accessErr.code,
          callerId,
          account_id: batch.account_id,
        });
        return jsonResponse(500, { error: 'Erro ao verificar acesso à conta' });
      }

      if (!canAccess) {
        console.warn('zapi-restore-history: tentativa de IDOR bloqueada', {
          callerId,
          callerRole,
          batch_id,
          account_id: batch.account_id,
        });
        return jsonResponse(403, { error: 'Sem acesso a esta conta WhatsApp' });
      }
    }

    // ── 6. FIX 5 — TOCTOU: verificar que dados ainda existem no lote ─────────
    //
    // O cron zapi-purge-trash pode ter rodado entre o check de expires_at e agora.
    // Verificamos se há pelo menos 1 registro com deleted_batch_id = batch.id.
    // Se count=0, os dados já foram hard-deletados e não há o que restaurar.
    //
    // Verificamos em zapi_messages (tabela com mais registros por lote).
    // Se o lote apagou apenas notes/tags/flags (granular), pode ser 0 em messages —
    // portanto checamos em todas as 6 tabelas em paralelo.
    const toctouChecks = await Promise.all([
      admin.from('zapi_messages').select('id', { count: 'exact', head: true }).eq('deleted_batch_id', batch.id),
      admin.from('zapi_chats').select('id', { count: 'exact', head: true }).eq('deleted_batch_id', batch.id),
      admin.from('zapi_chat_notes').select('id', { count: 'exact', head: true }).eq('deleted_batch_id', batch.id),
      admin.from('zapi_chat_tags').select('id', { count: 'exact', head: true }).eq('deleted_batch_id', batch.id),
      admin.from('zapi_chat_message_flags').select('id', { count: 'exact', head: true }).eq('deleted_batch_id', batch.id),
      admin.from('zapi_webhook_log').select('id', { count: 'exact', head: true }).eq('deleted_batch_id', batch.id),
    ]);

    const totalRemaining = toctouChecks.reduce((sum, r) => sum + (r.count ?? 0), 0);

    if (totalRemaining === 0) {
      // Marcar como expirado para consistência do painel
      await admin
        .from('zapi_cleanup_batches')
        .update({ status: 'expired' })
        .eq('id', batch.id);
      return jsonResponse(410, {
        error: 'Os dados deste lote foram permanentemente removidos. O prazo de restauração expirou.',
      });
    }

    // ── 7. Re-executar predicado em modo restauração ─────────────────────────
    //
    // FIX 2: usa restore_batch_id=batch.id em vez de restore_initiated_by.
    // O predicado filtra por deleted_batch_id = batch.id (determinístico):
    // só os registros deste lote específico são revertidos — não toca registros
    // apagados por outros batches na mesma conta.
    let restoredCount = 0;
    try {
      const result = await executeCleanupPredicate(
        admin,
        {
          mode: batch.mode as CleanupMode,
          filters: batch.filters as CleanupFilters,
          account_id: batch.account_id,
          caller_id: callerId,
          restore_batch_id: batch.id, // FIX 2: determinístico por batch.id
        },
        true, // restore
      );
      restoredCount = result.row_count;
    } catch (execErr) {
      const msg = execErr instanceof Error ? execErr.message : String(execErr);
      console.error('zapi-restore-history: erro no predicado de restauração', {
        callerId,
        batch_id,
        error: msg,
      });
      return jsonResponse(500, { error: 'Erro ao restaurar histórico' }); // FIX 12: mensagem genérica
    }

    // ── 8. Atualizar batch.status = 'restored' ────────────────────────────────
    const { error: updateErr } = await admin
      .from('zapi_cleanup_batches')
      .update({ status: 'restored' })
      .eq('id', batch.id);

    if (updateErr) {
      // Não é fatal — os dados já foram restaurados; só o status ficou desatualizado.
      console.warn('zapi-restore-history: falha ao atualizar status do batch', {
        code: updateErr.code,
        batch_id,
      });
    }

    // ── 9. Retorno + log de auditoria ─────────────────────────────────────────
    console.log('zapi-restore-history: restauração concluída', {
      caller: callerEmail,
      callerId,
      batch_id,
      account_id: batch.account_id,
      mode: batch.mode,
      restored_count: restoredCount,
    });

    return jsonResponse(200, {
      ok: true,
      restored_count: restoredCount,
    });
  } catch (err) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error('zapi-restore-history crash:', msg);
    return jsonResponse(500, { error: 'Erro interno' }); // FIX 12: nunca vaza detalhe interno
  }
});
