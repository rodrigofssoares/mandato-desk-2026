/**
 * boardFilterStorage.ts
 *
 * Utilitário para persistir/recuperar o estado do filtro de aceite WhatsApp
 * por funil via localStorage.
 *
 * Chave: `em074:funnelFilter:<board_id>`
 * Payload: { mode, stageFromId }
 *
 * Usa o `id` da etapa (não o índice) para ser robusto contra reordenações.
 * Todo acesso é envolvido em try/catch — modo privado/restrito pode bloquear
 * o localStorage sem que a feature quebre.
 */

export type WhatsAppFilterMode = 'all' | 'yes' | 'no';

export interface BoardFilterState {
  mode: WhatsAppFilterMode;
  /** UUID da etapa selecionada em "a partir de:". null = sem preferência salva. */
  stageFromId: string | null;
}

const PREFIX = 'em074:funnelFilter:';

function storageKey(boardId: string): string {
  return `${PREFIX}${boardId}`;
}

/** Lê o estado salvo para um funil. Retorna null se não existir ou falhar. */
export function getFilter(boardId: string): BoardFilterState | null {
  try {
    const raw = localStorage.getItem(storageKey(boardId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'mode' in parsed &&
      'stageFromId' in parsed
    ) {
      const { mode, stageFromId } = parsed as Record<string, unknown>;
      if (
        (mode === 'all' || mode === 'yes' || mode === 'no') &&
        (typeof stageFromId === 'string' || stageFromId === null)
      ) {
        return {
          mode: mode as WhatsAppFilterMode,
          stageFromId: typeof stageFromId === 'string' ? stageFromId : null,
        };
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Persiste o estado do filtro para um funil. Falha silenciosamente. */
export function setFilter(boardId: string, state: BoardFilterState): void {
  try {
    localStorage.setItem(storageKey(boardId), JSON.stringify(state));
  } catch {
    // localStorage indisponível (modo privado) — ignora sem quebrar
  }
}
