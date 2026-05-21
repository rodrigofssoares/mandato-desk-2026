import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
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
  file_size: number;     // alias derivado de file_size_bytes (compat com UI)
  mime_type: string;     // alias derivado de file_type (compat com UI)
  status: AttachmentStatus;
  tokens_estimated: number | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;    // derivado de created_at (tabela nao tem updated_at)
}

// ============================================================================
// Hook: useAgentAttachments
// ============================================================================

/**
 * Lista os anexos do agente.
 * Apenas admin tem acesso (RLS).
 *
 * SF-4: subscribe a postgres_changes em ai_agent_attachments para invalidar
 * o cache quando status muda de 'processing' para 'ready' (ou 'error').
 * Cleanup do channel no unmount.
 */
export function useAgentAttachments(agentId?: string) {
  const { isAdmin } = useUserRole();
  const queryClient = useQueryClient();

  // SF-4: realtime listener para status de indexação
  useEffect(() => {
    if (!isAdmin || !agentId) return;

    const channel = supabase
      .channel(`agent_attachments_${agentId}`)
      .on(
        'postgres_changes' as never,
        {
          event: '*',
          schema: 'public',
          table: 'ai_agent_attachments',
          filter: `agent_id=eq.${agentId}`,
        } as never,
        () => {
          queryClient.invalidateQueries({
            queryKey: ['agent_attachments', agentId],
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [isAdmin, agentId, queryClient]);

  return useQuery<AgentAttachment[]>({
    queryKey: ['agent_attachments', agentId],
    enabled: isAdmin && !!agentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_agent_attachments' as never)
        .select(
          'id, agent_id, filename, file_type, file_size_bytes, status, tokens_estimated, error_message, created_at'
        )
        .eq('agent_id', agentId as never)
        .order('created_at', { ascending: false });

      if (error) throw error;

      return ((data ?? []) as Array<Record<string, unknown>>).map(
        (row): AgentAttachment => ({
          id: row.id as string,
          agent_id: row.agent_id as string,
          filename: row.filename as string,
          file_size: row.file_size_bytes != null ? Number(row.file_size_bytes) : 0,
          mime_type: (row.file_type as string) ?? '',
          status: row.status as AttachmentStatus,
          tokens_estimated: row.tokens_estimated != null ? Number(row.tokens_estimated) : null,
          error_message: (row.error_message ?? null) as string | null,
          created_at: row.created_at as string,
          updated_at: row.created_at as string,
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

      // Captura body real do erro pra mensagem util (supabase-js esconde por padrao).
      if (error) {
        let detail = error.message;
        try {
          const ctx = (error as { context?: Response }).context;
          if (ctx instanceof Response) {
            const body = await ctx.json().catch(() => null);
            if (body?.error) detail = body.error;
            else if (body?.hint) detail = body.hint;
          }
        } catch { /* ignora */ }
        throw new Error(detail);
      }

      // EF pode retornar { ok: false, error } com status 2xx em casos esperados
      const result = data as { ok?: boolean; error?: string; hint?: string };
      if (result?.ok === false) {
        throw new Error(result.error ?? result.hint ?? 'Falha ao processar arquivo');
      }
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
