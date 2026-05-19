// Hook: useDraftPersistence
//
// Persiste o rascunho de texto do compositor por conversa no localStorage.
// Key: `zapi_draft_${chatId}` — cada conversa tem seu rascunho independente.
// Usa debounce de 500ms para evitar escrita excessiva no localStorage.
//
// API:
//   - draft: string (estado local React)
//   - setDraft(text): escreve no localStorage com debounce 500ms
//   - clearDraft(): remove a key do localStorage imediatamente
//
// Erros de quota do localStorage são silenciados via try/catch.
//
// Referência: RAQ-MAND-EM073 — T49

import { useState, useCallback, useRef, useEffect } from 'react';

const DEBOUNCE_MS = 500;
const KEY_PREFIX = 'zapi_draft_';

function getDraftKey(chatId: string): string {
  return `${KEY_PREFIX}${chatId}`;
}

function readDraft(chatId: string): string {
  try {
    return localStorage.getItem(getDraftKey(chatId)) ?? '';
  } catch {
    return '';
  }
}

function writeDraft(chatId: string, text: string): void {
  try {
    if (text) {
      localStorage.setItem(getDraftKey(chatId), text);
    } else {
      localStorage.removeItem(getDraftKey(chatId));
    }
  } catch {
    // Silencia quota errors — sem crash
  }
}

function removeDraft(chatId: string): void {
  try {
    localStorage.removeItem(getDraftKey(chatId));
  } catch {
    // Silencia
  }
}

export interface DraftPersistenceResult {
  draft: string;
  setDraft: (text: string) => void;
  clearDraft: () => void;
}

/**
 * Persiste o rascunho de texto por conversa no localStorage.
 * @param chatId - ID do chat. Quando null, retorna draft vazio e setDraft é no-op.
 */
export function useDraftPersistence(chatId: string | null): DraftPersistenceResult {
  // Inicializa o draft com o valor do localStorage para o chat atual
  const [draft, setDraftState] = useState<string>(() => {
    if (!chatId) return '';
    return readDraft(chatId);
  });

  // Ref para o timer de debounce
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Quando chatId muda, lê o novo rascunho do localStorage
  useEffect(() => {
    if (!chatId) {
      setDraftState('');
      return;
    }
    setDraftState(readDraft(chatId));
  }, [chatId]);

  // Cleanup do timer no unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const setDraft = useCallback(
    (text: string) => {
      // Atualiza o estado React imediatamente (para a UI ser responsiva)
      setDraftState(text);

      if (!chatId) return;

      // Debounce a escrita no localStorage
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        writeDraft(chatId, text);
      }, DEBOUNCE_MS);
    },
    [chatId],
  );

  const clearDraft = useCallback(() => {
    setDraftState('');
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (!chatId) return;
    removeDraft(chatId);
  }, [chatId]);

  return { draft, setDraft, clearDraft };
}

// ─── Utilitário: lê todos os chatIds com rascunho ────────────────────────────

/**
 * Retorna o Set de chatIds que possuem rascunho não-vazio no localStorage.
 * Usado pelo ChatListItem para exibir o ícone de lápis.
 */
export function getDraftChatIds(): Set<string> {
  const result = new Set<string>();
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(KEY_PREFIX)) {
        const chatId = key.slice(KEY_PREFIX.length);
        const value = localStorage.getItem(key);
        if (value && value.trim()) result.add(chatId);
      }
    }
  } catch {
    // Silencia
  }
  return result;
}
