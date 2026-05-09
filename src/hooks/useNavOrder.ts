import { useCallback, useEffect, useState } from 'react';

/**
 * Chaves das seções da sidebar que aparecem como itens de navegação arrastáveis.
 * Exclui 'configuracoes' (fixada no fim) e seções que não têm item próprio na
 * sidebar (usuarios, permissoes, google, api, webhooks, personalizacao,
 * relatorios, ordenacao_filtros).
 *
 * ATENÇÃO: ao adicionar item em NAV_ITEMS (AppSidebar.tsx), adicione também aqui
 * em NAV_ITEM_KEYS, em DEFAULT_NAV_ORDER e em NAV_ITEM_LABELS.
 */
export const NAV_ITEM_KEYS = [
  'dashboard',
  'contatos',
  'liderancas',
  'board',
  'tarefas',
  'demandas',
  'etiquetas',
  'mapa',
  'importacao',
  'campanha',
] as const;

export type NavItemKey = (typeof NAV_ITEM_KEYS)[number];

/**
 * Ordem padrão das abas — espelha a sequência de NAV_ITEMS em AppSidebar.tsx
 * (excluindo 'configuracoes', que é sempre fixada no fim).
 */
export const DEFAULT_NAV_ORDER: NavItemKey[] = [...NAV_ITEM_KEYS];

/** Chave de localStorage usada para persistir a ordem escolhida pelo usuário. */
export const NAV_ORDER_STORAGE_KEY = 'mandato:nav-order:v1';

/** Set para checagem O(1) de chaves válidas. */
export const NAV_ITEM_KEYS_SET = new Set<string>(NAV_ITEM_KEYS);

/**
 * Labels em pt-BR para exibição no componente NavOrderTab.
 */
export const NAV_ITEM_LABELS: Record<NavItemKey, string> = {
  dashboard: 'Dashboard',
  contatos: 'Contatos',
  liderancas: 'Articuladores',
  board: 'Funil',
  tarefas: 'Tarefas',
  demandas: 'Demandas',
  etiquetas: 'Etiquetas',
  mapa: 'Mapa',
  importacao: 'Importação',
  campanha: 'Campos de Campanha',
};

function readFromStorage(): NavItemKey[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(NAV_ORDER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    // Aceita apenas chaves válidas e completa com as faltantes ao fim (merge defensivo).
    const valid = parsed.filter((k): k is NavItemKey => NAV_ITEM_KEYS_SET.has(k));
    const missing = DEFAULT_NAV_ORDER.filter((k) => !valid.includes(k));
    return [...valid, ...missing];
  } catch {
    return null;
  }
}

/**
 * Hook de preferência de ordem das abas da sidebar.
 * - `order`: ordem efetiva (localStorage ou padrão).
 * - `setOrder(next)`: persiste nova ordem em localStorage e sincroniza instâncias na mesma aba.
 * - `resetOrder()`: limpa localStorage e volta ao padrão.
 *
 * Sem `canReorder` — qualquer usuário autenticado pode reordenar (preferência pessoal).
 * Sem `isLoading` — leitura síncrona do localStorage.
 */
export function useNavOrder() {
  const [order, setOrderState] = useState<NavItemKey[]>(
    () => readFromStorage() ?? DEFAULT_NAV_ORDER
  );

  // Sincroniza quando outra aba (ou a própria aba via dispatchEvent) alterar o storage.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== NAV_ORDER_STORAGE_KEY) return;
      if (e.newValue === null) {
        // resetOrder foi chamado
        setOrderState(DEFAULT_NAV_ORDER);
      } else {
        const next = readFromStorage() ?? DEFAULT_NAV_ORDER;
        setOrderState(next);
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setOrder = useCallback((next: NavItemKey[]) => {
    // Merge defensivo: garante apenas chaves válidas e completa as faltantes.
    const valid = next.filter((k): k is NavItemKey => NAV_ITEM_KEYS_SET.has(k));
    const missing = DEFAULT_NAV_ORDER.filter((k) => !valid.includes(k));
    const finalOrder = [...valid, ...missing];

    setOrderState(finalOrder);
    try {
      window.localStorage.setItem(NAV_ORDER_STORAGE_KEY, JSON.stringify(finalOrder));
      // Dispara evento manual para sincronizar outras instâncias do hook na mesma aba
      // (window.storage event só dispara em outras abas nativas; este cobre a mesma aba).
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: NAV_ORDER_STORAGE_KEY,
          newValue: JSON.stringify(finalOrder),
          storageArea: window.localStorage,
        })
      );
    } catch {
      // localStorage indisponível (modo incógnito, SSR) — falha silenciosa.
    }
  }, []);

  const resetOrder = useCallback(() => {
    setOrderState(DEFAULT_NAV_ORDER);
    try {
      window.localStorage.removeItem(NAV_ORDER_STORAGE_KEY);
      // Dispara evento manual para sincronizar outras instâncias na mesma aba.
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: NAV_ORDER_STORAGE_KEY,
          newValue: null,
          storageArea: window.localStorage,
        })
      );
    } catch {
      // ignore
    }
  }, []);

  return { order, setOrder, resetOrder };
}
