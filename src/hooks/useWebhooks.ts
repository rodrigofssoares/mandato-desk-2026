import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activityLog';

// ---------- Types ----------

export const WEBHOOK_EVENTS = [
  'contact.created',
  'contact.updated',
  'contact.deleted',
  'contact.merged',
  'demand.created',
  'demand.updated',
  'demand.deleted',
  'tag.created',
  'tag.updated',
  'tag.deleted',
  'leader.created',
  'leader.updated',
  'leader.deleted',
  'branding.updated',
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export interface Webhook {
  id: string;
  user_id: string;
  name: string;
  url: string;
  events: WebhookEvent[];
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  webhook_logs?: WebhookLog[];
}

export interface WebhookInsert {
  name: string;
  url: string;
  events: WebhookEvent[];
  is_active?: boolean;
}

export interface WebhookUpdate extends Partial<WebhookInsert> {
  id: string;
}

export interface WebhookLog {
  id: string;
  webhook_id: string;
  event_type: string;
  status_code: number | null;
  response_body?: string | null;
  created_at: string;
}

// ---------- useWebhooks ----------

export function useWebhooks() {
  const { user } = useAuth();

  return useQuery<Webhook[]>({
    queryKey: ['webhooks', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('webhooks')
        .select('*, webhook_logs(id, webhook_id, event_type, status_code, response_body, created_at)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Limit logs to last 5 per webhook
      return (data ?? []).map((wh: any) => ({
        ...wh,
        webhook_logs: (wh.webhook_logs ?? [])
          .sort((a: WebhookLog, b: WebhookLog) => b.created_at.localeCompare(a.created_at))
          .slice(0, 5),
      })) as Webhook[];
    },
  });
}

// ---------- useCreateWebhook ----------

export function useCreateWebhook() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (input: WebhookInsert) => {
      if (!user?.id) throw new Error('Usuário não autenticado');

      const { data, error } = await supabase
        .from('webhooks')
        .insert({ ...input, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      toast.success('Webhook criado com sucesso');
      logActivity({ type: 'create', entity_type: 'permission', description: 'Criou um webhook' });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao criar webhook: ${error.message}`);
    },
  });
}

// ---------- useUpdateWebhook ----------

export function useUpdateWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: WebhookUpdate) => {
      const { id, ...updateData } = input;

      const { data, error } = await supabase
        .from('webhooks')
        .update({ ...updateData, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      toast.success('Webhook atualizado com sucesso');
      logActivity({ type: 'update', entity_type: 'permission', description: 'Atualizou um webhook' });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar webhook: ${error.message}`);
    },
  });
}

// ---------- useDeleteWebhook ----------

export function useDeleteWebhook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('webhooks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] });
      toast.success('Webhook excluído com sucesso');
      logActivity({ type: 'delete', entity_type: 'permission', description: 'Excluiu um webhook' });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao excluir webhook: ${error.message}`);
    },
  });
}

// ---------- useWebhookLogs ----------

export function useWebhookLogs(webhookId: string | undefined) {
  return useQuery<WebhookLog[]>({
    queryKey: ['webhook-logs', webhookId],
    enabled: !!webhookId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('webhook_logs')
        .select('*')
        .eq('webhook_id', webhookId!)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data ?? []) as WebhookLog[];
    },
  });
}
