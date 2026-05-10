import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// ─── Tipos ──────────────────────────────────────────────────────────────────

export type ZapiMediaType = 'image' | 'video' | 'audio' | 'document';

export interface UploadInput {
  account_id: string;
  file: File;
}

export interface UploadResult {
  path: string;
  url: string;
  mime: string;
  size: number;
}

export interface SendMediaInput {
  account_id: string;
  phone: string;
  type: ZapiMediaType;
  media_url: string;
  caption?: string;
  file_name?: string;
  mime_type?: string;
}

export interface SendMediaResult {
  ok: true;
  message_id: string;
  chat_id: string;
}

export interface SendPollInput {
  account_id: string;
  phone: string;
  question: string;
  options: string[];
  allow_multiple_answers?: boolean;
}

interface InvokeError {
  error?: string;
}

// ─── Limites por tipo (espelham WhatsApp) ──────────────────────────────────

export const MEDIA_LIMITS: Record<ZapiMediaType, { maxBytes: number; mimes: RegExp; label: string }> = {
  image: { maxBytes: 5 * 1024 * 1024, mimes: /^image\/(jpeg|png|webp|gif)$/i, label: 'Imagem' },
  video: { maxBytes: 16 * 1024 * 1024, mimes: /^video\/(mp4|3gpp|quicktime)$/i, label: 'Vídeo' },
  audio: { maxBytes: 16 * 1024 * 1024, mimes: /^audio\//i, label: 'Áudio' },
  document: { maxBytes: 100 * 1024 * 1024, mimes: /.*/, label: 'Documento' },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function sanitizeFilename(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 200);
}

function extractInvokeError(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'error' in err) {
    const inner = (err as InvokeError).error;
    if (typeof inner === 'string' && inner.length > 0) return inner;
  }
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

async function readSupabaseFunctionError(err: Error): Promise<string> {
  const ctx = (err as unknown as { context?: { json?: () => Promise<unknown> } }).context;
  if (ctx?.json) {
    try {
      const parsed = await ctx.json();
      return extractInvokeError(parsed, err.message);
    } catch {
      // segue
    }
  }
  return err.message;
}

// ─── useUploadZapiAttachment ───────────────────────────────────────────────

/**
 * Faz upload do arquivo no bucket Storage zapi-attachments e retorna a URL
 * pública. Path: <account_id>/<timestamp>-<random>-<filename>.
 *
 * Validação de tamanho/MIME no cliente — defesa em profundidade. RLS bloqueia
 * uploads inválidos no backend, mas verificamos antes pra UX.
 */
export function useUploadZapiAttachment() {
  return useMutation<UploadResult, Error, UploadInput & { type: ZapiMediaType }>({
    mutationFn: async ({ account_id, file, type }) => {
      const limit = MEDIA_LIMITS[type];

      if (!limit.mimes.test(file.type) && type !== 'document') {
        throw new Error(`Tipo de arquivo não suportado para ${limit.label.toLowerCase()}`);
      }
      if (file.size > limit.maxBytes) {
        const mb = Math.round(limit.maxBytes / 1024 / 1024);
        throw new Error(`Arquivo excede o limite de ${mb}MB para ${limit.label.toLowerCase()}`);
      }

      const ts = Date.now();
      const rand = Math.random().toString(36).slice(2, 8);
      const path = `${account_id}/${ts}-${rand}-${sanitizeFilename(file.name)}`;

      const { error: uploadErr } = await supabase.storage
        .from('zapi-attachments')
        .upload(path, file, {
          contentType: file.type || 'application/octet-stream',
          upsert: false,
          cacheControl: '3600',
        });

      if (uploadErr) throw new Error(`Falha no upload: ${uploadErr.message}`);

      const { data: pub } = supabase.storage.from('zapi-attachments').getPublicUrl(path);

      return {
        path,
        url: pub.publicUrl,
        mime: file.type || 'application/octet-stream',
        size: file.size,
      };
    },
    onError: (err) => toast.error(err.message),
  });
}

// ─── useSendZapiMedia ──────────────────────────────────────────────────────

export function useSendZapiMedia() {
  const queryClient = useQueryClient();

  return useMutation<SendMediaResult, Error, SendMediaInput>({
    mutationFn: async (input): Promise<SendMediaResult> => {
      const { data, error } = await supabase.functions.invoke<SendMediaResult | InvokeError>(
        'zapi-send-media',
        { body: input },
      );

      if (error) throw new Error(await readSupabaseFunctionError(error));
      if (!data || 'error' in data) {
        throw new Error(extractInvokeError(data, 'Resposta inválida'));
      }
      return data as SendMediaResult;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['zapi-chats'] });
      queryClient.invalidateQueries({ queryKey: ['zapi-messages', data.chat_id] });
      toast.success('Mídia enviada');
    },
    onError: (err) => toast.error(err.message || 'Erro ao enviar mídia'),
  });
}

// ─── useSendZapiPoll ───────────────────────────────────────────────────────

export function useSendZapiPoll() {
  const queryClient = useQueryClient();

  return useMutation<SendMediaResult, Error, SendPollInput>({
    mutationFn: async (input): Promise<SendMediaResult> => {
      const { data, error } = await supabase.functions.invoke<SendMediaResult | InvokeError>(
        'zapi-send-poll',
        { body: input },
      );

      if (error) throw new Error(await readSupabaseFunctionError(error));
      if (!data || 'error' in data) {
        throw new Error(extractInvokeError(data, 'Resposta inválida'));
      }
      return data as SendMediaResult;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['zapi-chats'] });
      queryClient.invalidateQueries({ queryKey: ['zapi-messages', data.chat_id] });
      toast.success('Enquete enviada');
    },
    onError: (err) => toast.error(err.message || 'Erro ao enviar enquete'),
  });
}
