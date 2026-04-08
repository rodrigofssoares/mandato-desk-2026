import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Role } from '@/types/permissions';
import { logActivity } from '@/lib/activityLog';

export interface UserProfile {
  id: string;
  nome: string;
  email: string;
  role: Role;
  status_aprovacao: 'ATIVO' | 'PENDENTE' | 'INATIVO';
  avatar_url?: string;
  telefone?: string;
  created_at?: string;
  updated_at?: string;
}

export function useUsers() {
  return useQuery<UserProfile[]>({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('nome', { ascending: true });

      if (error) {
        console.error('Erro ao buscar usuários:', error);
        throw error;
      }

      return (data ?? []) as UserProfile[];
    },
  });
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: Role }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Cargo atualizado com sucesso');
      logActivity({ type: 'update', entity_type: 'user', description: 'Alterou role de um usuario' });
    },
    onError: (error) => {
      console.error('Erro ao atualizar cargo:', error);
      toast.error('Erro ao atualizar cargo');
    },
  });
}

export function useUpdateUserStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      newStatus,
    }: {
      userId: string;
      newStatus: 'ATIVO' | 'PENDENTE' | 'INATIVO';
    }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ status_aprovacao: newStatus })
        .eq('id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Status atualizado com sucesso');
      logActivity({ type: 'status_change', entity_type: 'user', description: 'Alterou status de um usuario' });
    },
    onError: (error) => {
      console.error('Erro ao atualizar status:', error);
      toast.error('Erro ao atualizar status');
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();

  // Não é possível deletar auth.users do client-side.
  // Apenas desativa o perfil setando status para INATIVO.
  return useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from('profiles')
        .update({ status_aprovacao: 'INATIVO' })
        .eq('id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuário desativado com sucesso');
      logActivity({ type: 'status_change', entity_type: 'user', description: 'Desativou um usuario' });
    },
    onError: (error) => {
      console.error('Erro ao desativar usuário:', error);
      toast.error('Erro ao desativar usuário');
    },
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  // TODO: Substituir supabase.auth.signUp() por chamada à Edge Function
  // quando a função 'create-user' estiver deployada no Supabase.
  // A Edge Function permite criar usuários sem afetar a sessão atual.
  return useMutation({
    mutationFn: async ({
      email,
      password,
      nome,
      role,
    }: {
      email: string;
      password: string;
      nome: string;
      role: Role;
    }) => {
      // 1. Cria o usuário via auth
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { nome },
        },
      });

      if (signUpError) throw signUpError;
      if (!signUpData.user) throw new Error('Erro ao criar usuário');

      // 2. Atualiza o perfil com role e status ativo
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          role,
          status_aprovacao: 'ATIVO',
          nome,
        })
        .eq('id', signUpData.user.id);

      if (profileError) {
        console.error('Erro ao atualizar perfil:', profileError);
        // Não faz rollback do auth user pois não temos admin API no client
      }

      return signUpData.user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuário criado com sucesso');
      logActivity({ type: 'create', entity_type: 'user', description: 'Criou um usuario' });
    },
    onError: (error) => {
      console.error('Erro ao criar usuário:', error);
      toast.error(`Erro ao criar usuário: ${error.message}`);
    },
  });
}
