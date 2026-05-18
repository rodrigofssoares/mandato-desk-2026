// ─── useFiltrosFavoritosConversas (T52 — C14) ─────────────────────────────────
// Filtros favoritos para a lista de conversas.
// Clona o padrão de useFiltrosFavoritos (contatos) — persistência em localStorage.
// Decisão: localStorage, não banco. Filtros são config pessoal do operador.

import { useState, useCallback, useEffect } from 'react';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ConversaFilters {
  status?: string | null;
  onlyMine?: boolean;
  showArchived?: boolean;
  showSnoozed?: boolean;
}

export interface FiltroFavoritoConversa {
  id: string;
  nome: string;
  filtros: ConversaFilters;
  criadoEm: string;
}

const STORAGE_KEY = 'mandato_desk_2026_filtros_favoritos_conversas';

// ─── Storage helpers ──────────────────────────────────────────────────────────

function loadFromStorage(): FiltroFavoritoConversa[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FiltroFavoritoConversa[]) : [];
  } catch {
    return [];
  }
}

function saveToStorage(favoritos: FiltroFavoritoConversa[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favoritos));
  } catch {
    // ignora erros de quota
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useFiltrosFavoritosConversas() {
  const [favoritos, setFavoritos] = useState<FiltroFavoritoConversa[]>(loadFromStorage);

  // Sync entre abas do navegador
  useEffect(() => {
    const handler = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setFavoritos(loadFromStorage());
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  const salvarFavorito = useCallback((nome: string, filtros: ConversaFilters) => {
    setFavoritos((prev) => {
      const novo: FiltroFavoritoConversa = {
        id: crypto.randomUUID(),
        nome,
        filtros,
        criadoEm: new Date().toISOString(),
      };
      const updated = [...prev, novo];
      saveToStorage(updated);
      return updated;
    });
  }, []);

  const removerFavorito = useCallback((id: string) => {
    setFavoritos((prev) => {
      const updated = prev.filter((f) => f.id !== id);
      saveToStorage(updated);
      return updated;
    });
  }, []);

  const renomearFavorito = useCallback((id: string, novoNome: string) => {
    setFavoritos((prev) => {
      const updated = prev.map((f) => (f.id === id ? { ...f, nome: novoNome } : f));
      saveToStorage(updated);
      return updated;
    });
  }, []);

  return { favoritos, salvarFavorito, removerFavorito, renomearFavorito };
}
