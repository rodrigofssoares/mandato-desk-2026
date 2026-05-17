-- ============================================================================
-- Migration 051: Adiciona 'reaction' ao CHECK constraint de media_type
-- ============================================================================
-- O CHECK inline da coluna `media_type` (adicionado em 048_zapi_media_support)
-- não inclui o valor 'reaction'. Esta migration dropa o constraint auto-gerado
-- (verificado via pg_constraint: `zapi_messages_media_type_check`) e recria
-- com 'reaction' adicionado.
--
-- Idempotente: usa DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT IF NOT EXISTS
-- via recriação nomeada (Postgres não tem ADD CONSTRAINT IF NOT EXISTS, mas
-- o DROP IF EXISTS garante que re-execução não levanta erro).
--
-- Reference: RAQ-MAND-EM072 — T04.
-- Rollback:
--   ALTER TABLE public.zapi_messages DROP CONSTRAINT zapi_messages_media_type_check;
--   ALTER TABLE public.zapi_messages ADD CONSTRAINT zapi_messages_media_type_check
--     CHECK (media_type IN ('text','image','audio','video','document','sticker',
--                           'poll','location','contact','unknown'));
-- ============================================================================

-- Dropa o constraint auto-gerado da migration 048 (nome confirmado via
-- SELECT conname FROM pg_constraint WHERE conrelid='public.zapi_messages'::regclass AND contype='c')
ALTER TABLE public.zapi_messages
  DROP CONSTRAINT IF EXISTS zapi_messages_media_type_check;

-- Recria com 'reaction' incluído
ALTER TABLE public.zapi_messages
  ADD CONSTRAINT zapi_messages_media_type_check
    CHECK (media_type IN (
      'text', 'image', 'audio', 'video', 'document',
      'sticker', 'poll', 'location', 'contact',
      'reaction', 'unknown'
    ));

-- Atualiza comentário da coluna para refletir o novo tipo suportado
COMMENT ON COLUMN public.zapi_messages.media_type IS
  'Tipo da mensagem: text (default), image, audio, video, document, sticker, '
  'poll, location, contact, reaction, unknown. '
  'reaction = emoji de reação do WhatsApp; metadata contém { emoji, reaction_message_id, reaction_by, reaction_time }.';
