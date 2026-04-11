import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import type { Role, Secao } from '@/types/permissions';

interface PermissaoPerfil {
  id: string;
  role: string;
  secao: string;
  pode_ver: boolean;
  pode_criar: boolean;
  pode_editar: boolean;
  pode_deletar: boolean;
  pode_deletar_em_massa: boolean;
  so_proprio: boolean;
}

export function usePermissoes(roleOverride?: Role) {
  const { role: userRole, isAdmin, isLoading: isRoleLoading } = useUserRole();
  const activeRole = roleOverride ?? userRole;

  const { data: permissoes = [], isLoading: isQueryLoading } = useQuery<PermissaoPerfil[]>({
    queryKey: ['permissoes_perfil', activeRole],
    queryFn: async () => {
      if (!activeRole) return [];

      const { data, error } = await supabase
        .from('permissoes_perfil')
        .select('*')
        .eq('role', activeRole);

      if (error) {
        console.error('Erro ao buscar permissoes:', error);
        return [];
      }

      return data as PermissaoPerfil[];
    },
    enabled: !!activeRole,
    staleTime: 5 * 60 * 1000,
  });

  const isAdminEffective = roleOverride ? roleOverride === 'admin' : isAdmin;

  const findPermissao = (secao: Secao) =>
    permissoes.find((p) => p.secao === secao);

  const canView = (secao: Secao): boolean => {
    if (isAdminEffective) return true;
    return findPermissao(secao)?.pode_ver ?? false;
  };

  const canCreate = (secao: Secao): boolean => {
    if (isAdminEffective) return true;
    return findPermissao(secao)?.pode_criar ?? false;
  };

  const canEdit = (secao: Secao): boolean => {
    if (isAdminEffective) return true;
    return findPermissao(secao)?.pode_editar ?? false;
  };

  const canDelete = (secao: Secao): boolean => {
    if (isAdminEffective) return true;
    return findPermissao(secao)?.pode_deletar ?? false;
  };

  const canBulkDelete = (secao: Secao): boolean => {
    if (isAdminEffective) return true;
    return findPermissao(secao)?.pode_deletar_em_massa ?? false;
  };

  const isOwnOnly = (secao: Secao): boolean => {
    if (isAdminEffective) return false;
    return findPermissao(secao)?.so_proprio ?? false;
  };

  return {
    permissoes,
    canView,
    canCreate,
    canEdit,
    canDelete,
    canBulkDelete,
    isOwnOnly,
    isLoading: isRoleLoading || isQueryLoading,
  };
}
