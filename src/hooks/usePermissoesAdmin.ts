import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ROLES, SECOES, type Role, type Secao } from '@/types/permissions';
import { logActivity } from '@/lib/activityLog';

export interface PermissaoPerfil {
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
      field: 'pode_ver' | 'pode_criar' | 'pode_editar' | 'pode_deletar' | 'pode_deletar_em_massa' | 'so_proprio';
      value: boolean;
    }) => {
      const { error } = await supabase
        .from('permissoes_perfil')
        .update({ [field]: value })
        .eq('id', id);

      if (error) throw error;
    },
    onMutate: async ({ id, field, value }) => {
      await queryClient.cancelQueries({ queryKey: ['permissoes_perfil_all'] });

      const previous = queryClient.getQueryData<PermissaoPerfil[]>(['permissoes_perfil_all']);

      queryClient.setQueryData<PermissaoPerfil[]>(['permissoes_perfil_all'], (old) =>
        old?.map((p) => (p.id === id ? { ...p, [field]: value } : p)) ?? []
      );

      return { previous };
    },
    onSuccess: () => {
      logActivity({ type: 'update', entity_type: 'permission', description: 'Atualizou permissoes de um perfil' });
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

// Seed padrão com 5 roles × 22 seções = 110 linhas (inclui ordem_abas e alertas — migration 050)
function generateDefaultPermissions() {
  const defaults: Array<{
    role: string;
    secao: string;
    pode_ver: boolean;
    pode_criar: boolean;
    pode_editar: boolean;
    pode_deletar: boolean;
    pode_deletar_em_massa: boolean;
    so_proprio: boolean;
  }> = [];

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
        'mapa', 'importacao', 'relatorios', 'board', 'tarefas',
      ],
      viewOnly: [
        'usuarios', 'google', 'api', 'webhooks', 'personalizacao', 'permissoes',
        'configuracoes',
      ],
      viewCreate: [],
      viewCreateEdit: [],
    },
    assessor: {
      fullAccess: [],
      viewOnly: ['dashboard', 'mapa', 'relatorios'],
      viewCreate: [],
      viewCreateEdit: ['contatos', 'liderancas', 'demandas', 'etiquetas', 'board', 'tarefas'],
    },
    assistente: {
      fullAccess: [],
      viewOnly: ['dashboard', 'board'],
      viewCreate: ['contatos', 'liderancas'],
      viewCreateEdit: ['tarefas'],
    },
    estagiario: {
      fullAccess: [],
      viewOnly: ['dashboard', 'board', 'tarefas'],
      viewCreate: [],
      viewCreateEdit: [],
    },
  };

  for (const role of ROLES) {
    for (const secao of SECOES) {
      const config = roleDefaults[role];

      // Bulk delete é liberado por padrão só para admin e proprietario
      const allowsBulkDelete = role === 'admin' || role === 'proprietario';

      if (config.fullAccess.includes(secao)) {
        defaults.push({
          role, secao,
          pode_ver: true, pode_criar: true,
          pode_editar: true, pode_deletar: true,
          pode_deletar_em_massa: allowsBulkDelete,
          so_proprio: false,
        });
      } else if (config.viewCreateEdit.includes(secao)) {
        defaults.push({
          role, secao,
          pode_ver: true, pode_criar: true,
          pode_editar: true, pode_deletar: false,
          pode_deletar_em_massa: false,
          so_proprio: role === 'assessor' ? false : true,
        });
      } else if (config.viewCreate.includes(secao)) {
        defaults.push({
          role, secao,
          pode_ver: true, pode_criar: true,
          pode_editar: false, pode_deletar: false,
          pode_deletar_em_massa: false,
          so_proprio: true,
        });
      } else if (config.viewOnly.includes(secao)) {
        defaults.push({
          role, secao,
          pode_ver: true, pode_criar: false,
          pode_editar: false, pode_deletar: false,
          pode_deletar_em_massa: false,
          so_proprio: false,
        });
      } else {
        defaults.push({
          role, secao,
          pode_ver: false, pode_criar: false,
          pode_editar: false, pode_deletar: false,
          pode_deletar_em_massa: false,
          so_proprio: false,
        });
      }
    }
  }

  // -----------------------------------------------------------------------
  // Opção B: tratamento explícito pós-loop para seções com defaults que NÃO
  // cabem nos buckets genéricos (ordem_abas e alertas — migration 050).
  //
  // O loop acima já inseriu linhas para essas seções via fallback (todos FALSE),
  // mas os defaults corretos diferem do fallback (ex: estagiário tem pode_ver=true
  // em alertas). Sobrescrevemos as linhas geradas pelo fallback com os valores corretos.
  // -----------------------------------------------------------------------
  const secoesEspeciais = ['ordem_abas', 'alertas'] as const;

  const defaultsEspeciais: Record<typeof secoesEspeciais[number], Record<Role, {
    pode_ver: boolean; pode_criar: boolean; pode_editar: boolean;
    pode_deletar: boolean; pode_deletar_em_massa: boolean; so_proprio: boolean;
  }>> = {
    ordem_abas: {
      admin:        { pode_ver: true,  pode_criar: false, pode_editar: true,  pode_deletar: false, pode_deletar_em_massa: false, so_proprio: false },
      proprietario: { pode_ver: true,  pode_criar: false, pode_editar: true,  pode_deletar: false, pode_deletar_em_massa: false, so_proprio: false },
      assessor:     { pode_ver: true,  pode_criar: false, pode_editar: true,  pode_deletar: false, pode_deletar_em_massa: false, so_proprio: false },
      assistente:   { pode_ver: true,  pode_criar: false, pode_editar: false, pode_deletar: false, pode_deletar_em_massa: false, so_proprio: false },
      estagiario:   { pode_ver: false, pode_criar: false, pode_editar: false, pode_deletar: false, pode_deletar_em_massa: false, so_proprio: false },
    },
    alertas: {
      admin:        { pode_ver: true, pode_criar: false, pode_editar: false, pode_deletar: true,  pode_deletar_em_massa: true,  so_proprio: false },
      proprietario: { pode_ver: true, pode_criar: false, pode_editar: false, pode_deletar: true,  pode_deletar_em_massa: true,  so_proprio: false },
      assessor:     { pode_ver: true, pode_criar: false, pode_editar: false, pode_deletar: true,  pode_deletar_em_massa: false, so_proprio: false },
      assistente:   { pode_ver: true, pode_criar: false, pode_editar: false, pode_deletar: true,  pode_deletar_em_massa: false, so_proprio: false },
      estagiario:   { pode_ver: true, pode_criar: false, pode_editar: false, pode_deletar: false, pode_deletar_em_massa: false, so_proprio: false },
    },
  };

  for (const secao of secoesEspeciais) {
    for (const role of ROLES) {
      // Remove a linha do fallback inserida pelo loop principal
      const idx = defaults.findIndex((d) => d.role === role && d.secao === secao);
      if (idx !== -1) defaults.splice(idx, 1);

      // Insere com os valores corretos conforme migration 050
      defaults.push({ role, secao, ...defaultsEspeciais[secao][role] });
    }
  }

  return defaults;
}

export function useSeedPermissoes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      // Primeiro gera os defaults para garantir que temos dados antes de deletar
      const defaults = generateDefaultPermissions();

      // Remove todas as permissões existentes
      const { error: deleteError } = await supabase
        .from('permissoes_perfil')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (deleteError) throw deleteError;

      // Insere os defaults com nomes corretos das colunas
      const { error: insertError } = await supabase
        .from('permissoes_perfil')
        .insert(defaults);

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissoes_perfil_all'] });
      queryClient.invalidateQueries({ queryKey: ['permissoes_perfil'] });
      toast.success('Permissões restauradas para o padrão');
      logActivity({ type: 'create', entity_type: 'permission', description: 'Semeou permissoes iniciais' });
    },
    onError: (error) => {
      console.error('Erro ao restaurar permissões:', error);
      toast.error('Erro ao restaurar permissões');
    },
  });
}
