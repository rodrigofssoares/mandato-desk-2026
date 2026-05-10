-- ============================================================================
-- Migration 048: Suporte completo a mídia, enquetes, localização e contatos
-- ============================================================================
-- Estende zapi_messages com colunas de mídia + cria bucket Storage pra
-- hospedar arquivos enviados (imagem, vídeo, áudio, documento). A Z-API
-- aceita URL pública — então o frontend faz upload no bucket e manda a URL
-- pra EF que repassa pra Z-API.
--
-- Para mensagens INBOUND, a Z-API entrega URLs próprias dela (mídia hospedada
-- no servidor Z-API). Armazenamos a URL diretamente em media_url; se o cliente
-- quiser persistência longa, mais tarde podemos baixar pro bucket via job.
--
-- Reference: RAQ-MAND-EM051 — extensão "pacote completo de mídia".
-- Rollback:
--   ALTER TABLE zapi_messages DROP COLUMN media_type, media_url, media_mime,
--                                          media_filename, media_caption, media_metadata;
--   DELETE FROM storage.buckets WHERE id = 'zapi-attachments';
-- ============================================================================

-- ── 1. Colunas de mídia em zapi_messages ───────────────────────────────────

ALTER TABLE public.zapi_messages
  ADD COLUMN IF NOT EXISTS media_type TEXT NOT NULL DEFAULT 'text'
    CHECK (media_type IN ('text', 'image', 'audio', 'video', 'document', 'sticker', 'poll', 'location', 'contact', 'unknown')),
  ADD COLUMN IF NOT EXISTS media_url TEXT,
  ADD COLUMN IF NOT EXISTS media_mime TEXT,
  ADD COLUMN IF NOT EXISTS media_filename TEXT,
  ADD COLUMN IF NOT EXISTS media_caption TEXT,
  ADD COLUMN IF NOT EXISTS media_metadata JSONB;

COMMENT ON COLUMN public.zapi_messages.media_type IS
  'Tipo da mensagem: text (default), image, audio, video, document, sticker, poll, location, contact, unknown.';

COMMENT ON COLUMN public.zapi_messages.media_url IS
  'URL pública da mídia. Outbound: bucket Storage zapi-attachments. Inbound: URL '
  'fornecida pela Z-API (hospedada no servidor deles, expira em alguns dias).';

COMMENT ON COLUMN public.zapi_messages.media_metadata IS
  'JSON com metadados específicos do tipo: poll → { question, options[], allowMultipleAnswers }. '
  'location → { lat, lng, name, address }. contact → { name, phones[] }. '
  'duration (audio/video) e dimensões (image/video) também entram aqui.';

-- ── 2. Constraints de tamanho (defesa em profundidade) ─────────────────────

ALTER TABLE public.zapi_messages
  ADD CONSTRAINT chk_zapi_messages_media_url_len
    CHECK (media_url IS NULL OR length(media_url) <= 2048);

ALTER TABLE public.zapi_messages
  ADD CONSTRAINT chk_zapi_messages_media_filename_len
    CHECK (media_filename IS NULL OR length(media_filename) <= 255);

ALTER TABLE public.zapi_messages
  ADD CONSTRAINT chk_zapi_messages_media_caption_len
    CHECK (media_caption IS NULL OR length(media_caption) <= 1024);

ALTER TABLE public.zapi_messages
  ADD CONSTRAINT chk_zapi_messages_media_metadata_size
    CHECK (media_metadata IS NULL OR octet_length(media_metadata::text) <= 16384);

-- ── 3. Bucket Storage zapi-attachments ─────────────────────────────────────
-- Público (anyone read) pra que a Z-API consiga baixar a URL e entregar.
-- Insert/update/delete restritos a usuários autenticados.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'zapi-attachments',
  'zapi-attachments',
  true,
  104857600,  -- 100 MB (limite WhatsApp pra documento)
  NULL  -- aceita qualquer MIME (imagem/vídeo/áudio/documento) — validação no frontend
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit;

-- Drop policies antigas (idempotência se rerun)
DROP POLICY IF EXISTS "zapi_attachments_select"  ON storage.objects;
DROP POLICY IF EXISTS "zapi_attachments_insert"  ON storage.objects;
DROP POLICY IF EXISTS "zapi_attachments_update"  ON storage.objects;
DROP POLICY IF EXISTS "zapi_attachments_delete"  ON storage.objects;

-- Public read — qualquer um pode ler (necessário pra Z-API baixar a URL)
CREATE POLICY "zapi_attachments_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'zapi-attachments');

-- Insert: qualquer autenticado pode subir mídia (atendentes não-admin também)
CREATE POLICY "zapi_attachments_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'zapi-attachments');

-- Update: dono do upload (owner = auth.uid()) ou admin
CREATE POLICY "zapi_attachments_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'zapi-attachments'
    AND (owner = auth.uid() OR has_role(auth.uid(), 'admin'))
  );

-- Delete: dono do upload ou admin
CREATE POLICY "zapi_attachments_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'zapi-attachments'
    AND (owner = auth.uid() OR has_role(auth.uid(), 'admin'))
  );
