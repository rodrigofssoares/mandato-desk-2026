import { useState, useCallback, useEffect } from 'react';
import type { ContactFilters } from '@/hooks/useContacts';

export interface FiltroFavoritoContato {
  id: string;
  nome: string;
  filtros: ContactFilters;
  criadoEm: string;
}

const STORAGE_KEY = 'mandato_desk_2026_filtros_favoritos_contatos';

function loadFromStorage(): FiltroFavoritoContato[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as FiltroFavoritoContato[]) : [];
  } catch {
    return [];
  }
}

function saveToStorage(favoritos: FiltroFavoritoContato[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(favoritos));
  } catch {
    // ignore quota errors
  }
}

// Remove campos de paginação antes de persistir — eles não fazem parte do "filtro"
function sanitizarFiltros(filtros: ContactFilters): ContactFilters {
  const { page: _page, per_page: _perPage, ...resto } = filtros;
  void _page;
  void _perPage;
  return resto;
}

export function useFiltrosFavoritos() {
  const [favoritos, setFavoritos] = useState<FiltroFavoritoContato[]>(loadFromStorage);

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

  const salvarFavorito = useCallback((nome: string, filtros: ContactFilters) => {
    setFavoritos((prev) => {
      const novo: FiltroFavoritoContato = {
        id: crypto.randomUUID(),
        nome,
        filtros: sanitizarFiltros(filtros),
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
