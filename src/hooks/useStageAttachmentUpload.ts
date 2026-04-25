import { useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const BUCKET = 'stage-checklist';
const SIGNED_URL_TTL = 60 * 60; // 1h

const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const VIDEO_MIME = ['video/mp4', 'video/webm'];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB

export interface UploadResult {
  storage_path: string;
  mime_type: string;
  tamanho_bytes: number;
  nome_original: string;
  tipo: 'imagem' | 'video';
}

function extFromName(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : 'bin';
}

function uuid(): string {
  return (crypto as Crypto & { randomUUID?: () => string }).randomUUID?.() ??
    Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export class AttachmentValidationError extends Error {}

/**
 * Valida tipo MIME e tamanho do arquivo. Lança AttachmentValidationError com
 * mensagem amigável (pt-BR) caso inválido. Retorna o `tipo` discriminado.
 */
export function validateAttachmentFile(file: File): 'imagem' | 'video' {
  if (IMAGE_MIME.includes(file.type)) {
    if (file.size > MAX_IMAGE_BYTES) throw new AttachmentValidationError('Imagem maior que 5 MB');
    return 'imagem';
  }
  if (VIDEO_MIME.includes(file.type)) {
    if (file.size > MAX_VIDEO_BYTES) throw new AttachmentValidationError('Vídeo maior que 50 MB');
    return 'video';
  }
  throw new AttachmentValidationError('Tipo não suportado (use JPG, PNG, WEBP, MP4 ou WEBM)');
}

/**
 * Faz upload de um arquivo para o bucket `stage-checklist` em
 * `{boardId}/{stageId}/{itemId}/{uuid}.{ext}`. Validação client-side antes
 * do request — também há o limite no próprio bucket como segunda camada.
 */
export function useStageAttachmentUpload() {
  return useMutation<UploadResult, Error, {
    boardId: string;
    stageId: string;
    itemId: string;
    file: File;
  }>({
    mutationFn: async ({ boardId, stageId, itemId, file }) => {
      const tipo = validateAttachmentFile(file);

      const path = `${boardId}/${stageId}/${itemId}/${uuid()}.${extFromName(file.name)}`;
      const { error } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
      if (error) throw error;

      return {
        storage_path: path,
        mime_type: file.type,
        tamanho_bytes: file.size,
        nome_original: file.name,
        tipo,
      };
    },
    onError: (error) => {
      toast.error(`Erro no upload: ${error.message}`);
    },
  });
}

/**
 * Gera signed URL para um único objeto. Útil quando o consumer precisa
 * só de uma URL pontual.
 */
export async function getSignedUrl(path: string, ttl = SIGNED_URL_TTL): Promise<string> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, ttl);
  if (error) throw error;
  return data.signedUrl;
}

/**
 * Hook que recebe uma lista de storage_paths e devolve um mapa
 * `path -> signed URL`. Usado pelo viewer da V4 para renderizar imagens/videos.
 */
export function useSignedUrls(paths: string[]) {
  const sortedKey = [...paths].sort().join('|');
  return useQuery<Record<string, string>>({
    queryKey: ['stage_checklist_signed_urls', sortedKey],
    queryFn: async () => {
      if (paths.length === 0) return {};
      const { data, error } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(paths, SIGNED_URL_TTL);
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const entry of data ?? []) {
        if (entry.path && entry.signedUrl) map[entry.path] = entry.signedUrl;
      }
      return map;
    },
    enabled: paths.length > 0,
    staleTime: (SIGNED_URL_TTL - 60) * 1000, // re-busca antes de expirar
  });
}
