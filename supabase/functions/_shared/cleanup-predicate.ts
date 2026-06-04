// _shared/cleanup-predicate.ts
//
// Construtor de predicados SQL para as operações de limpeza/restauração
// de histórico WhatsApp (RAQ-MAND-EM082).
//
// Compartilhado entre:
//   - zapi-cleanup-history (soft-delete)
//   - zapi-restore-history (reverter soft-delete)
//
// Por que centralizar aqui:
//   A EF de restauração precisa re-executar EXATAMENTE o mesmo predicado da limpeza,
//   só invertendo o UPDATE (deleted_at=NULL vs deleted_at=now()). Se a lógica ficar
//   duplicada, qualquer divergência entre os dois predicados cria janelas onde a
//   restauração não reverte tudo que foi apagado (ou reverte coisas que não deveria).
//   Fonte única de verdade = sem drift.
//
// Decisões de semântica documentadas:
//
//   Modo 'period':
//     Soft-deleta mensagens com sent_at no intervalo [start_date, end_date].
//     Chats cujas TODAS as mensagens ativas caem no período também são soft-deletados.
//     Notas, etiquetas, flags e logs dos chats totalmente no período também são apagados.
//     Chats que têm mensagens fora do período são MANTIDOS (soft-delete conservador).
//     Razão: evitar que o usuário apague acidentalmente chats com mensagens recentes
//     só porque tem histórico antigo no período selecionado.
//
//   Modo 'all':
//     Soft-deleta tudo: chats, mensagens, notas, etiquetas, flags e logs da conta.
//
//   Modo 'chats':
//     Soft-deleta os chats listados + todos os filhos (mensagens, notas, etiquetas, flags).
//     Logs de webhook NÃO são afetados (logs são de sistema, não de chat específico).
//
//   Modo 'granular':
//     Soft-deleta apenas os tipos selecionados em `items`.
//     'messages' = mensagens texto (body NOT NULL ou body IS NULL — todas as mensagens)
//     'media'    = atalho semântico para zapi_messages com body IS NULL (só mídias)
//     'notes'    = notas internas (zapi_chat_notes)
//     'tags'     = etiquetas de conversa (zapi_chat_tags)
//     'flags'    = mensagens favoritas (zapi_chat_message_flags)
//     'logs'     = logs de webhook (zapi_webhook_log)
//     Escopo opcional: chat_ids restringe a itens daquelas conversas.
//     Datas opcionais: start_date/end_date restringe pelo sent_at das mensagens
//     (aplicável apenas a 'messages' e 'media'; ignorado para notas/tags/flags/logs).

import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ─── Tipos públicos ────────────────────────────────────────────────────────────

export type CleanupMode = 'period' | 'all' | 'chats' | 'granular';

export type GranularItem = 'messages' | 'media' | 'notes' | 'tags' | 'flags' | 'logs';

export interface CleanupFilters {
  // mode='period'
  start_date?: string;
  end_date?: string;
  // mode='chats'
  chat_ids?: string[];
  // mode='granular'
  items?: GranularItem[];
  // granular + escopo opcional de chats e datas
  // (reutiliza start_date/end_date e chat_ids acima)
}

export interface CleanupParams {
  mode: CleanupMode;
  filters: CleanupFilters;
  account_id: string;
  /** Para soft-delete: UUID do usuário que executou a limpeza. */
  caller_id: string;
  /** Para restauração: UUID do usuário que INICIOU a limpeza original (= batch.initiated_by). */
  restore_initiated_by?: string;
}

export interface CleanupResult {
  /** Total de linhas afetadas (soma de todas as tabelas). */
  row_count: number;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const SOFT_DELETE_PAYLOAD = (callerId: string) => ({
  deleted_at: new Date().toISOString(),
  deleted_by: callerId,
});

const RESTORE_PAYLOAD = {
  deleted_at: null,
  deleted_by: null,
};

// ─── Utilitários internos ─────────────────────────────────────────────────────

/** Conta linhas afetadas pelo resultado do Supabase. */
function countRows(count: number | null): number {
  return count ?? 0;
}

// ─── Executor principal ───────────────────────────────────────────────────────

/**
 * Executa o predicado de limpeza (soft-delete) ou restauração (undelete)
 * de acordo com `params.mode` e `params.filters`.
 *
 * @param admin  Cliente Supabase com service_role (bypassa RLS).
 * @param params Parâmetros do predicado.
 * @param restore Se true, reverte o soft-delete (UPDATE deleted_at=NULL).
 *                Se false (default), aplica o soft-delete.
 */
export async function executeCleanupPredicate(
  admin: SupabaseClient,
  params: CleanupParams,
  restore = false,
): Promise<CleanupResult> {
  const { mode, filters, account_id, caller_id, restore_initiated_by } = params;
  const payload = restore ? RESTORE_PAYLOAD : SOFT_DELETE_PAYLOAD(caller_id);
  let total = 0;

  switch (mode) {
    case 'all':
      total += await execAll(admin, account_id, payload, restore, restore_initiated_by);
      break;

    case 'period':
      total += await execPeriod(admin, account_id, filters, payload, restore, restore_initiated_by);
      break;

    case 'chats':
      total += await execChats(admin, account_id, filters.chat_ids ?? [], payload, restore, restore_initiated_by);
      break;

    case 'granular':
      total += await execGranular(admin, account_id, filters, payload, restore, restore_initiated_by);
      break;
  }

  return { row_count: total };
}

// ─── Implementações por modo ──────────────────────────────────────────────────

/** Modo 'all': soft-delete/restaura tudo da conta. */
async function execAll(
  admin: SupabaseClient,
  accountId: string,
  payload: Record<string, unknown>,
  restore: boolean,
  initiatedBy?: string,
): Promise<number> {
  let total = 0;

  // Para restauração: filtrar apenas registros apagados pelo iniciador original do batch
  // (evita restaurar registros apagados por outros batches/operações)
  const restoreFilter = restore && initiatedBy ? initiatedBy : null;

  // 1. Mensagens
  {
    let q = admin
      .from('zapi_messages')
      .update(payload, { count: 'exact' })
      .eq('account_id', accountId);
    if (restore) {
      q = q.not('deleted_at', 'is', null);
      if (restoreFilter) q = q.eq('deleted_by', restoreFilter);
    } else {
      q = q.is('deleted_at', null);
    }
    const { count, error } = await q;
    if (error) throw new Error(`all/messages: ${error.message}`);
    total += countRows(count);
  }

  // 2. Notas
  {
    let q = admin
      .from('zapi_chat_notes')
      .update(payload, { count: 'exact' })
      .eq('account_id', accountId);
    if (restore) {
      q = q.not('deleted_at', 'is', null);
      if (restoreFilter) q = q.eq('deleted_by', restoreFilter);
    } else {
      q = q.is('deleted_at', null);
    }
    const { count, error } = await q;
    if (error) throw new Error(`all/notes: ${error.message}`);
    total += countRows(count);
  }

  // 3. Etiquetas
  {
    let q = admin
      .from('zapi_chat_tags')
      .update(payload, { count: 'exact' })
      .eq('account_id', accountId);
    if (restore) {
      q = q.not('deleted_at', 'is', null);
      if (restoreFilter) q = q.eq('deleted_by', restoreFilter);
    } else {
      q = q.is('deleted_at', null);
    }
    const { count, error } = await q;
    if (error) throw new Error(`all/tags: ${error.message}`);
    total += countRows(count);
  }

  // 4. Flags (favoritos)
  {
    let q = admin
      .from('zapi_chat_message_flags')
      .update(payload, { count: 'exact' })
      .eq('account_id', accountId);
    if (restore) {
      q = q.not('deleted_at', 'is', null);
      if (restoreFilter) q = q.eq('deleted_by', restoreFilter);
    } else {
      q = q.is('deleted_at', null);
    }
    const { count, error } = await q;
    if (error) throw new Error(`all/flags: ${error.message}`);
    total += countRows(count);
  }

  // 5. Webhook log — só deleted_at (sem deleted_by)
  {
    const logPayload = restore
      ? { deleted_at: null }
      : { deleted_at: (payload as { deleted_at: string }).deleted_at };

    let q = admin
      .from('zapi_webhook_log')
      .update(logPayload, { count: 'exact' })
      .eq('account_id', accountId);
    if (restore) {
      q = q.not('deleted_at', 'is', null);
    } else {
      q = q.is('deleted_at', null);
    }
    const { count, error } = await q;
    if (error) throw new Error(`all/webhook_log: ${error.message}`);
    total += countRows(count);
  }

  // 6. Chats — por último (pai dos filhos acima)
  {
    let q = admin
      .from('zapi_chats')
      .update(payload, { count: 'exact' })
      .eq('account_id', accountId);
    if (restore) {
      q = q.not('deleted_at', 'is', null);
      if (restoreFilter) q = q.eq('deleted_by', restoreFilter);
    } else {
      q = q.is('deleted_at', null);
    }
    const { count, error } = await q;
    if (error) throw new Error(`all/chats: ${error.message}`);
    total += countRows(count);
  }

  return total;
}

/** Modo 'period': soft-delete/restaura por intervalo de datas. */
async function execPeriod(
  admin: SupabaseClient,
  accountId: string,
  filters: CleanupFilters,
  payload: Record<string, unknown>,
  restore: boolean,
  initiatedBy?: string,
): Promise<number> {
  const { start_date, end_date } = filters;
  if (!start_date || !end_date) {
    throw new Error('period: start_date e end_date são obrigatórios');
  }

  let total = 0;
  const restoreFilter = restore && initiatedBy ? initiatedBy : null;

  // 1. Mensagens no período
  {
    let q = admin
      .from('zapi_messages')
      .update(payload, { count: 'exact' })
      .eq('account_id', accountId)
      .gte('sent_at', start_date)
      .lte('sent_at', end_date);
    if (restore) {
      q = q.not('deleted_at', 'is', null);
      if (restoreFilter) q = q.eq('deleted_by', restoreFilter);
    } else {
      q = q.is('deleted_at', null);
    }
    const { count, error } = await q;
    if (error) throw new Error(`period/messages: ${error.message}`);
    total += countRows(count);
  }

  // 2. Identificar chats completamente dentro do período (todas as mensagens ATIVAS no intervalo)
  //
  // Semântica conservadora: um chat é "totalmente dentro do período" somente se
  // ele não possui nenhuma mensagem ativa FORA do intervalo. Isso evita apagar
  // chats com mensagens recentes (fora do período) junto com as antigas.
  //
  // Na restauração: restauramos chats que foram soft-deletados pelo mesmo iniciador.
  let chatIds: string[] = [];
  if (!restore) {
    // Busca chats da conta com alguma mensagem no período (para verificar os que caem 100%)
    const { data: chatsInPeriod, error: chatPeriodErr } = await admin
      .from('zapi_chats')
      .select('id')
      .eq('account_id', accountId)
      .is('deleted_at', null);

    if (chatPeriodErr) throw new Error(`period/chat_scan: ${chatPeriodErr.message}`);

    const allChatIds = (chatsInPeriod ?? []).map((c: { id: string }) => c.id);

    if (allChatIds.length > 0) {
      // Para cada chat: verificar se há mensagem ATIVA fora do intervalo
      const { data: chatsWithOutside, error: outsideErr } = await admin
        .from('zapi_messages')
        .select('chat_id')
        .in('chat_id', allChatIds)
        .is('deleted_at', null)
        .or(`sent_at.lt.${start_date},sent_at.gt.${end_date}`);

      if (outsideErr) throw new Error(`period/outside_check: ${outsideErr.message}`);

      const chatsWithOutsideIds = new Set(
        (chatsWithOutside ?? []).map((m: { chat_id: string }) => m.chat_id),
      );

      // Chats que têm pelo menos 1 mensagem no período E nenhuma fora = candidatos
      const { data: chatsWithInside, error: insideErr } = await admin
        .from('zapi_messages')
        .select('chat_id')
        .in('chat_id', allChatIds)
        .is('deleted_at', null)
        .gte('sent_at', start_date)
        .lte('sent_at', end_date);

      if (insideErr) throw new Error(`period/inside_check: ${insideErr.message}`);

      const chatsWithInsideIds = new Set(
        (chatsWithInside ?? []).map((m: { chat_id: string }) => m.chat_id),
      );

      chatIds = allChatIds.filter(
        (id: string) => chatsWithInsideIds.has(id) && !chatsWithOutsideIds.has(id),
      );
    }
  } else {
    // Restauração: busca chats soft-deletados pelo iniciador original
    let q = admin
      .from('zapi_chats')
      .select('id')
      .eq('account_id', accountId)
      .not('deleted_at', 'is', null);
    if (restoreFilter) q = q.eq('deleted_by', restoreFilter);
    const { data, error } = await q;
    if (error) throw new Error(`period/restore_chats: ${error.message}`);
    chatIds = (data ?? []).map((c: { id: string }) => c.id);
  }

  // 3. Soft-delete/restaura chats completamente no período
  if (chatIds.length > 0) {
    const chatPayload = restore ? { deleted_at: null, deleted_by: null } : payload;
    let q = admin
      .from('zapi_chats')
      .update(chatPayload, { count: 'exact' })
      .in('id', chatIds);
    if (restore) {
      q = q.not('deleted_at', 'is', null);
    } else {
      q = q.is('deleted_at', null);
    }
    const { count, error } = await q;
    if (error) throw new Error(`period/chats: ${error.message}`);
    total += countRows(count);

    // 4. Filhos dos chats soft-deletados no modo period
    if (!restore) {
      total += await softDeleteChatChildren(admin, chatIds, payload);
    } else {
      total += await restoreChatChildren(admin, chatIds, restoreFilter);
    }
  }

  return total;
}

/** Modo 'chats': soft-delete/restaura chats específicos + filhos. */
async function execChats(
  admin: SupabaseClient,
  accountId: string,
  chatIds: string[],
  payload: Record<string, unknown>,
  restore: boolean,
  initiatedBy?: string,
): Promise<number> {
  if (chatIds.length === 0) {
    throw new Error('chats: chat_ids não pode ser vazio');
  }

  let total = 0;
  const restoreFilter = restore && initiatedBy ? initiatedBy : null;

  // Verifica que os chat_ids pertencem à conta (anti-IDOR)
  const { data: validChats, error: validErr } = await admin
    .from('zapi_chats')
    .select('id')
    .eq('account_id', accountId)
    .in('id', chatIds);

  if (validErr) throw new Error(`chats/validate: ${validErr.message}`);

  const validIds = (validChats ?? []).map((c: { id: string }) => c.id);
  if (validIds.length === 0) return 0;

  // Chats
  {
    let q = admin
      .from('zapi_chats')
      .update(payload, { count: 'exact' })
      .in('id', validIds);
    if (restore) {
      q = q.not('deleted_at', 'is', null);
      if (restoreFilter) q = q.eq('deleted_by', restoreFilter);
    } else {
      q = q.is('deleted_at', null);
    }
    const { count, error } = await q;
    if (error) throw new Error(`chats/chats: ${error.message}`);
    total += countRows(count);
  }

  // Filhos
  if (!restore) {
    total += await softDeleteChatChildren(admin, validIds, payload);
  } else {
    total += await restoreChatChildren(admin, validIds, restoreFilter);
  }

  return total;
}

/** Modo 'granular': soft-delete/restaura itens selecionados. */
async function execGranular(
  admin: SupabaseClient,
  accountId: string,
  filters: CleanupFilters,
  payload: Record<string, unknown>,
  restore: boolean,
  initiatedBy?: string,
): Promise<number> {
  const { items = [], chat_ids, start_date, end_date } = filters;
  if (items.length === 0) {
    throw new Error('granular: items não pode ser vazio');
  }

  let total = 0;
  const restoreFilter = restore && initiatedBy ? initiatedBy : null;

  // Filtra chat_ids pela conta se informado (anti-IDOR)
  let validChatIds: string[] | null = null;
  if (chat_ids && chat_ids.length > 0) {
    const { data, error } = await admin
      .from('zapi_chats')
      .select('id')
      .eq('account_id', accountId)
      .in('id', chat_ids);
    if (error) throw new Error(`granular/validate_chats: ${error.message}`);
    validChatIds = (data ?? []).map((c: { id: string }) => c.id);
    if (validChatIds.length === 0) return 0;
  }

  for (const item of items) {
    switch (item) {
      case 'messages':
      case 'media': {
        // 'messages' = todas as mensagens (incluindo mídias)
        // 'media'    = apenas mídias (body IS NULL)
        let q = admin
          .from('zapi_messages')
          .update(payload, { count: 'exact' })
          .eq('account_id', accountId);

        if (item === 'media') q = q.is('body', null);

        if (validChatIds) q = q.in('chat_id', validChatIds);
        if (start_date)   q = q.gte('sent_at', start_date);
        if (end_date)     q = q.lte('sent_at', end_date);

        if (restore) {
          q = q.not('deleted_at', 'is', null);
          if (restoreFilter) q = q.eq('deleted_by', restoreFilter);
        } else {
          q = q.is('deleted_at', null);
        }

        const { count, error } = await q;
        if (error) throw new Error(`granular/${item}: ${error.message}`);
        total += countRows(count);
        break;
      }

      case 'notes': {
        let q = admin
          .from('zapi_chat_notes')
          .update(payload, { count: 'exact' })
          .eq('account_id', accountId);

        if (validChatIds) q = q.in('chat_id', validChatIds);

        if (restore) {
          q = q.not('deleted_at', 'is', null);
          if (restoreFilter) q = q.eq('deleted_by', restoreFilter);
        } else {
          q = q.is('deleted_at', null);
        }

        const { count, error } = await q;
        if (error) throw new Error(`granular/notes: ${error.message}`);
        total += countRows(count);
        break;
      }

      case 'tags': {
        let q = admin
          .from('zapi_chat_tags')
          .update(payload, { count: 'exact' })
          .eq('account_id', accountId);

        if (validChatIds) q = q.in('chat_id', validChatIds);

        if (restore) {
          q = q.not('deleted_at', 'is', null);
          if (restoreFilter) q = q.eq('deleted_by', restoreFilter);
        } else {
          q = q.is('deleted_at', null);
        }

        const { count, error } = await q;
        if (error) throw new Error(`granular/tags: ${error.message}`);
        total += countRows(count);
        break;
      }

      case 'flags': {
        let q = admin
          .from('zapi_chat_message_flags')
          .update(payload, { count: 'exact' })
          .eq('account_id', accountId);

        if (validChatIds) q = q.in('chat_id', validChatIds);

        if (restore) {
          q = q.not('deleted_at', 'is', null);
          if (restoreFilter) q = q.eq('deleted_by', restoreFilter);
        } else {
          q = q.is('deleted_at', null);
        }

        const { count, error } = await q;
        if (error) throw new Error(`granular/flags: ${error.message}`);
        total += countRows(count);
        break;
      }

      case 'logs': {
        // webhook_log só tem deleted_at (sem deleted_by)
        const logPayload = restore
          ? { deleted_at: null }
          : { deleted_at: (payload as { deleted_at: string }).deleted_at };

        let q = admin
          .from('zapi_webhook_log')
          .update(logPayload, { count: 'exact' })
          .eq('account_id', accountId);

        if (restore) {
          q = q.not('deleted_at', 'is', null);
        } else {
          q = q.is('deleted_at', null);
        }

        const { count, error } = await q;
        if (error) throw new Error(`granular/logs: ${error.message}`);
        total += countRows(count);
        break;
      }
    }
  }

  return total;
}

// ─── Helpers de cascata ────────────────────────────────────────────────────────

/** Soft-deleta todos os filhos dos chats informados (mensagens, notas, etiquetas, flags). */
async function softDeleteChatChildren(
  admin: SupabaseClient,
  chatIds: string[],
  payload: Record<string, unknown>,
): Promise<number> {
  let total = 0;
  const tables = [
    'zapi_messages',
    'zapi_chat_notes',
    'zapi_chat_tags',
    'zapi_chat_message_flags',
  ] as const;

  for (const table of tables) {
    const { count, error } = await admin
      .from(table)
      .update(payload, { count: 'exact' })
      .in('chat_id', chatIds)
      .is('deleted_at', null);

    if (error) throw new Error(`cascade/${table}: ${error.message}`);
    total += countRows(count);
  }

  return total;
}

/** Restaura todos os filhos soft-deletados dos chats informados. */
async function restoreChatChildren(
  admin: SupabaseClient,
  chatIds: string[],
  initiatedBy: string | null,
): Promise<number> {
  let total = 0;
  const tables = [
    'zapi_messages',
    'zapi_chat_notes',
    'zapi_chat_tags',
    'zapi_chat_message_flags',
  ] as const;

  for (const table of tables) {
    let q = admin
      .from(table)
      .update({ deleted_at: null, deleted_by: null }, { count: 'exact' })
      .in('chat_id', chatIds)
      .not('deleted_at', 'is', null);

    if (initiatedBy) q = q.eq('deleted_by', initiatedBy);

    const { count, error } = await q;
    if (error) throw new Error(`restore/${table}: ${error.message}`);
    total += countRows(count);
  }

  return total;
}
