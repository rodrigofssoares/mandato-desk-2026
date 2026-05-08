import { useCallback, useEffect, useState } from 'react';
import { useUserRole } from '@/hooks/useUserRole';
import { usePermissoes } from '@/hooks/usePermissoes';

/**
 * Chaves dos cards de filtro do drawer de Contatos. A ordem do array aqui é
 * apenas a referência canônica de quais segmentos existem — a ordem real é
 * definida pela preferência do usuário (ver useFilterOrder) com fallback para
 * DEFAULT_FILTER_ORDER.
 */
export const FILTER_SEGMENT_KEYS = [
  'pessoais',
  'engajamento',
  'campanha',
  'atendimento',
  'funil',
  'personalizados',
  'datas',
  'localizacao',
] as const;

export type FilterSegmentKey = (typeof FILTER_SEGMENT_KEYS)[number];

/**
 * Ordem padrão dos cards (definida pelo PO em RAQ-MAND-EM063).
 * Usuários com permissão podem reordenar e a preferência fica em localStorage.
 */
export const DEFAULT_FILTER_ORDER: FilterSegmentKey[] = [...FILTER_SEGMENT_KEYS];

export const FILTER_SEGMENT_LABELS: Record<FilterSegmentKey, string> = {
  pessoais: 'Pessoais',
  engajamento: 'Engajamento Político',
  campanha: 'Campanha',
  atendimento: 'Atendimento',
  funil: 'Funil',
  personalizados: 'Personalizados',
  datas: 'Datas',
  localizacao: 'Localização',
};

const STORAGE_KEY = 'mandato:filter-order:v1';

/**
 * Roles que ganham permissão de reordenar por padrão quando a tabela
 * permissoes_perfil ainda não foi populada com a seção 'ordenacao_filtros'.
 * Sincroniza com o fallback aplicado em usePermissoesAdmin.ts -> generateDefaultPermissions.
 */
const DEFAULT_ALLOWED_ROLES = new Set(['admin', 'proprietario', 'assessor']);

function readFromStorage(): FilterSegmentKey[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;

    // Aceita apenas chaves válidas e completa com as faltantes na ordem padrão.
    const valid = parsed.filter((k): k is FilterSegmentKey =>
      (FILTER_SEGMENT_KEYS as readonly string[]).includes(k)
    );
    const missing = DEFAULT_FILTER_ORDER.filter((k) => !valid.includes(k));
    return [...valid, ...missing];
  } catch {
    return null;
  }
}

/**
 * Hook único para ler e atualizar a ordem dos cards de filtro de Contatos.
 * - `order`: ordem efetiva (localStorage do usuário, ou padrão).
 * - `canReorder`: true se a role do usuário tem `pode_editar` na seção 'ordenacao_filtros'.
 * - `setOrder(next)`: persiste nova ordem em localStorage.
 * - `resetOrder()`: limpa localStorage e volta ao padrão.
 */
export function useFilterOrder() {
  const { role } = useUserRole();
  const { canEdit, permissoes, isLoading: isPermLoading } = usePermissoes();

  const [order, setOrderState] = useState<FilterSegmentKey[]>(
    () => readFromStorage() ?? DEFAULT_FILTER_ORDER
  );

  // Se outra aba do mesmo navegador alterar, sincroniza
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key !== STORAGE_KEY) return;
      const next = readFromStorage() ?? DEFAULT_FILTER_ORDER;
      setOrderState(next);
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const setOrder = useCallback((next: FilterSegmentKey[]) => {
    // Garante que todas as chaves estão presentes e válidas
    const valid = next.filter((k): k is FilterSegmentKey =>
      (FILTER_SEGMENT_KEYS as readonly string[]).includes(k)
    );
    const missing = DEFAULT_FILTER_ORDER.filter((k) => !valid.includes(k));
    const finalOrder = [...valid, ...missing];

    setOrderState(finalOrder);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(finalOrder));
    } catch {
      // localStorage indisponível — falha silenciosa, ordem fica só em memória
    }
  }, []);

  const resetOrder = useCallback(() => {
    setOrderState(DEFAULT_FILTER_ORDER);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  // Permissão: prioriza a tabela permissoes_perfil. Quando a seção ainda não foi
  // populada (linha inexistente para essa role), aplica fallback baseado na role
  // — mantém comportamento esperado mesmo antes do admin clicar "Restaurar Padrão".
  const hasRowForSection = permissoes.some((p) => p.secao === 'ordenacao_filtros');
  const canReorder = isPermLoading
    ? false
    : hasRowForSection
      ? canEdit('ordenacao_filtros')
      : !!role && DEFAULT_ALLOWED_ROLES.has(role);

  return {
    order,
    setOrder,
    resetOrder,
    canReorder,
    isLoading: isPermLoading,
  };
}
