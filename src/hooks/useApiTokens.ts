import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';

export interface ApiToken {
  id: string;
  user_id: string;
  token: string;
  created_at: string;
  last_used_at?: string | null;
}

export function useApiToken() {
  const { user } = useAuth();

  return useQuery<ApiToken | null>({
    queryKey: ['api-token', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('api_tokens')
        .select('*')
        .eq('user_id', user!.id)
        .maybeSingle();

      if (error) throw error;
      return data as ApiToken | null;
    },
  });
}

function generateSecureToken(): string {
  const g = globalThis as typeof globalThis & { crypto?: Crypto };
  const c = g.crypto;

  if (c?.randomUUID) {
    return `${c.randomUUID()}-${c.randomUUID()}`;
  }

  if (c?.getRandomValues) {
    const bytes = new Uint8Array(32);
    c.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  const rand = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
  return `${rand()}-${rand()}-${rand()}-${rand()}`;
}

export function useGenerateToken() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      // Delete existing token
      await supabase.from('api_tokens').delete().eq('user_id', user.id);

      const token = generateSecureToken();

      const { data, error } = await supabase
        .from('api_tokens')
        .insert({ user_id: user.id, token })
        .select()
        .single();

      if (error) throw error;
      return data as ApiToken;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-token'] });
      toast.success('Token gerado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao gerar token: ${error.message}`);
    },
  });
}

export function useRevokeToken() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const { error } = await supabase.from('api_tokens').delete().eq('user_id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-token'] });
      toast.success('Token revogado com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao revogar token: ${error.message}`);
    },
  });
}
