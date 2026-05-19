// ─── useKeyboardShortcuts (T56 — #53) ────────────────────────────────────────
// Hook genérico para atalhos de teclado globais.
// Registra listeners no document e os despacha via callbacks.
// Desativa atalhos com disableInInputs=true quando o foco está em inputs.

import { useEffect, useRef } from 'react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface KeyboardShortcut {
  /** Tecla principal (ex: 'k', 'f', '/', 'Escape', 'Enter') */
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  /** Se true, o atalho é ignorado quando o foco está em input/textarea/contenteditable */
  disableInInputs?: boolean;
  /** Callback disparado quando o atalho é detectado */
  handler: (e: KeyboardEvent) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isInputFocused(e: KeyboardEvent): boolean {
  const target = e.target as HTMLElement | null;
  if (!target) return false;
  return !!(target.closest('input, textarea, select, [contenteditable]'));
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Registra atalhos de teclado globais.
 * @param shortcuts - Lista de atalhos a registrar.
 * @param enabled - Se false, nenhum atalho é registrado (use para desativar por contexto).
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[], enabled = true) {
  // Mantém a lista de shortcuts sempre atualizada sem re-registrar o listener.
  const shortcutsRef = useRef(shortcuts);
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  });

  useEffect(() => {
    if (!enabled) return;

    function handler(e: KeyboardEvent) {
      for (const shortcut of shortcutsRef.current) {
        const keyMatch = e.key === shortcut.key;
        const ctrlMatch = (shortcut.ctrlKey ?? false) === e.ctrlKey;
        const shiftMatch = (shortcut.shiftKey ?? false) === e.shiftKey;
        const altMatch = (shortcut.altKey ?? false) === e.altKey;

        if (!keyMatch || !ctrlMatch || !shiftMatch || !altMatch) continue;

        // Ignorar se foco em input (e o atalho pede isso)
        if (shortcut.disableInInputs && isInputFocused(e)) continue;

        shortcut.handler(e);
        break;
      }
    }

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [enabled]);
}
