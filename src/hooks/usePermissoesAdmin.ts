import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ROLES, SECOES, type Role, type Secao } from '@/types/permissions';

export interface PermissaoPerfil {
  id: string;
  role: string;
  secao: string;
  pode_visualizar: boolean;
  pode_criar: boolean;
  pode_editar: boolean;
  pode_excluir: boolean;
  apenas_proprio: boolean;
}

export function usePermissoesAll() {
  return useQuery<PermissaoPerfil[]>({
    queryKey: ['permissoes_perfil_all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('permissoes_perfil')
        .select('*')
        .order('role')
        .order('secao');

      if (error) {
        console.error('Erro ao buscar permissões:', error);
        throw error;
      }

      return (data ?? []) as PermissaoPerfil[];
    },
  });
}

export function useUpdatePermissao() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      field,
      value,
    }: {
      id: string;
      field: 'pode_visualizar' | 'pode_criar' | 'pode_editar' | 'pode_excluir' | 'apenas_proprio';
      value: boolean;
    }) => {
      const { error } = await supabase
        .from('permissoes_perfil')
        .update({ [field]: value })
        .eq('id', id);

      if (error) throw error;
    },
    onMutate: async ({ id, field, value }) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['permissoes_perfil_all'] });

      const previous = queryClient.getQueryData<PermissaoPerfil[]>(['permissoes_perfil_all']);

      queryClient.setQueryData<PermissaoPerfil[]>(['permissoes_perfil_all'], (old) =>
        old?.map((p) => (p.id === id ? { ...p, [field]: value } : p)) ?? []
      );

      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['permissoes_perfil_all'], context.previous);
      }
      toast.error('Erro ao atualizar permissão');
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['permissoes_perfil_all'] });
      queryClient.invalidateQueries({ queryKey: ['permissoes_perfil'] });
    },
  });
}

// Seed padrão com as 70 linhas (5 roles x 14 seções)
function generateDefaultPermissions(): Omit<PermissaoPerfil, 'id'>[] {
  const defaults: Omit<PermissaoPerfil, 'id'>[] = [];

  const roleDefaults: Record<Role, {
    fullAccess: Secao[];
    viewOnly: Secao[];
    viewCreate: Secao[];
    viewCreateEdit: Secao[];
  }> = {
    admin: {
      fullAccess: [...SECOES],
      viewOnly: [],
      viewCreate: [],
      viewCreateEdit: [],
    },
    proprietario: {
      fullAccess: [
        'dashboard', 'contatos', 'liderancas', 'demandas', 'etiquetas',
        'mapa', 'importacao', 'relatorios',
      ],
      viewOnly: ['usuarios', 'google', 'api', 'webhooks', 'personalizacao', 'permissoes'],
      viewCreate: [],
      viewCreateEdit: [],
    },
    assessor: {
      fullAccess: [],
      viewOnly: ['dashboard', 'mapa', 'relatorios'],
      viewCreate: [],
      viewCreateEdit: ['contatos', 'liderancas', 'demandas', 'etiquetas'],
    },
    assistente: {
      fullAccess: [],
      viewOnly: ['dashboard'],
      viewCreate: ['contatos', 'liderancas'],
      viewCreateEdit: [],
    },
    estagiario: {
      fullAccess: [],
      viewOnly: ['dashboard'],
      viewCreate: [],
      viewCreateEdit: [],
    },
  };

  for (const role of ROLES) {
    for (const secao of SECOES) {
      const config = roleDefaults[role];
      let perm: Omit<PermissaoPerfil, 'id'>;

      if (config.fullAccess.includes(secao)) {
        perm = {
          role, secao,
          pode_visualizar: true, pode_criar: true,
          pode_editar: true, pode_excluir: true,
          apenas_proprio: false,
        };
      } else if (config.viewCreateEdit.includes(secao)) {
        perm = {
          role, secao,
          pode_visualizar: true, pode_criar: true,
          pode_editar: true, pode_excluir: false,
          apenas_proprio: role === 'assessor' ? false : true,
        };
      } else if (config.viewCreate.includes(secao)) {
        perm = {
          role, secao,
          pode_visualizar: true, pode_criar: true,
          pode_editar: false, pode_excluir: false,
          apenas_proprio: true,
        };
      } else if (config.viewOnly.includes(secao)) {
        perm = {
          role, secao,
          pode_visualizar: true, pode_criar: false,
          pode_editar: false, pode_excluir: false,
          apenas_proprio: false,
        };
      } else {
        perm = {
          role, secao,
          pode_visualizar: false, pode_criar: false,
          pode_editar: false, pode_excluir: false,
          apenas_proprio: false,
        };
      }

      defaults.push(perm);
    }
  }

  return defaults;
}

export function useSeedPermissoes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // Remove todas as permissões existentes
      const { error: deleteError } = await supabase
        .from('permissoes_perfil')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // deleta tudo

      if (deleteError) throw deleteError;

      // Insere os defaults
      const defaults = generateDefaultPermissions();
      const { error: insertError } = await supabase
        .from('permissoes_perfil')
        .insert(defaults);

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissoes_perfil_all'] });
      queryClient.invalidateQueries({ queryKey: ['permissoes_perfil'] });
      toast.success('Permissões restauradas para o padrão');
    },
    onError: (error) => {
      console.error('Erro ao restaurar permissões:', error);
      toast.error('Erro ao restaurar permissões');
    },
  });
}
