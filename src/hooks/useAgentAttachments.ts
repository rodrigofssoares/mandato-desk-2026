import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useUserRole } from '@/hooks/useUserRole';

// ============================================================================
// Tipos
// ============================================================================

export type AttachmentStatus = 'uploading' | 'processing' | 'ready' | 'error';

export interface AgentAttachment {
  id: string;
  agent_id: string;
  filename: string;
  file_size: number;
  mime_type: string;
  status: AttachmentStatus;
  tokens_estimated: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Hook: useAgentAttachments
// ============================================================================

/**
 * Lista os anexos do agente.
 * Apenas admin tem acesso (RLS).
 */
export function useAgentAttachments(agentId?: string) {
  const { isAdmin } = useUserRole();

  return useQuery<AgentAttachment[]>({
    queryKey: ['agent_attachments', agentId],
    enabled: isAdmin && !!agentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_agent_attachments' as never)
        .select(
          'id, agent_id, filename, file_size, mime_type, status, tokens_estimated, error_message, created_at, updated_at'
        )
        .eq('agent_id', agentId as never)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return ((data ?? []) as Array<Record<string, unknown>>).map(
        (row): AgentAttachment => ({
          id: row.id as string,
          agent_id: row.agent_id as string,
          filename: row.filename as string,
          file_size: Number(row.file_size),
          mime_type: row.mime_type as string,
          status: row.status as AttachmentStatus,
          tokens_estimated: row.tokens_estimated != null ? Number(row.tokens_estimated) : null,
          error_message: (row.error_message ?? null) as string | null,
          created_at: row.created_at as string,
          updated_at: row.updated_at as string,
        })
      );
    },
    staleTime: 30 * 1000,
  });
}

// ============================================================================
// Hook: useUploadAgentAttachment
// ============================================================================

/**
 * Envia arquivo para a Edge Function `ai-agent-extract-text`.
 * Cria registro com status 'uploading' e aguarda resposta.
 */
export function useUploadAgentAttachment(agentId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      if (agentId) {
        formData.append('agent_id', agentId);
      }

      const { data, error } = await supabase.functions.invoke('ai-agent-extract-text', {
        body: formData,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent_attachments', agentId] });
      toast.success('Arquivo enviado — indexando...');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao enviar arquivo: ${error.message}`);
    },
  });
}

// ============================================================================
// Hook: useDeleteAgentAttachment
// ============================================================================

/**
 * Remove um anexo por id.
 */
export function useDeleteAgentAttachment(agentId?: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('ai_agent_attachments' as never)
        .delete()
        .eq('id', id as never);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['agent_attachments', agentId] });
      toast.success('Arquivo removido');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao remover arquivo: ${error.message}`);
    },
  });
}

// ============================================================================
// Helpers
// ============================================================================

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? '';
}

export function isValidAttachmentType(file: File): boolean {
  const valid = ['application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain'];
  return valid.includes(file.type);
}
