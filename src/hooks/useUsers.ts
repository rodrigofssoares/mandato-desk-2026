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
      logActivity({ type: 'update', entity_type: 'user', description: 'Alterou role de um usuário' });
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
      logActivity({ type: 'status_change', entity_type: 'user', description: 'Alterou status de um usuário' });
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
      logActivity({ type: 'status_change', entity_type: 'user', description: 'Desativou um usuário' });
    },
    onError: (error) => {
      console.error('Erro ao desativar usuário:', error);
      toast.error('Erro ao desativar usuário');
    },
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();

  // Chama a edge function `create-user` (admin API) que cria o usuário
  // já com email_confirmed_at, senha_temporaria=true em profiles, e sem
  // afetar a sessão do admin chamador.
  return useMutation({
    mutationFn: async ({
      email,
      password,
      nome,
      role,
      telefone,
    }: {
      email: string;
      password: string;
      nome: string;
      role: Role;
      telefone?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('create-user', {
        body: {
          email,
          password,
          nome,
          role,
          telefone: telefone || null,
        },
      });

      if (error) {
        // Quando a edge function retorna non-2xx, supabase-js embrulha a
        // Response original em `error.context` — precisamos ler o body
        // pra expor a mensagem real.
        let detail =
          (data as { error?: string } | null)?.error ??
          (error as { message?: string }).message ??
          'Erro ao criar usuário';
        const ctx = (error as { context?: Response }).context;
        if (ctx && typeof ctx.json === 'function') {
          try {
            const body = await ctx.json();
            if (body?.error) detail = body.error;
          } catch {
            /* body não é JSON */
          }
        }
        throw new Error(detail);
      }

      return (data as { user: { id: string; email: string; nome: string; role: string } }).user;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuário criado com sucesso. Senha temporária ativada.');
      logActivity({ type: 'create', entity_type: 'user', description: 'Criou um usuário' });
    },
    onError: (error) => {
      console.error('Erro ao criar usuário:', error);
      toast.error(`Erro ao criar usuário: ${error.message}`);
    },
  });
}

interface UpdateProfileParams {
  userId: string;
  nome?: string;
  telefone?: string;
  role?: Role;
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, nome, telefone, role }: UpdateProfileParams) => {
      const updates: Record<string, unknown> = {};
      if (nome !== undefined) updates.nome = nome;
      if (telefone !== undefined) updates.telefone = telefone || null;
      if (role !== undefined) updates.role = role;

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard', 'profiles'] });
      toast.success('Perfil atualizado com sucesso');
      logActivity({ type: 'update', entity_type: 'user', description: 'Atualizou perfil de usuário' });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar perfil: ${error.message}`);
    },
  });
}
