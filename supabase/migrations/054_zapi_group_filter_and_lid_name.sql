-- ============================================================================
-- Migration 054: coluna whatsapp_name em zapi_chats + 'ignored' no CHECK
--                de processing_status em zapi_webhook_log
-- ============================================================================
-- Objetivo:
--   1. Adicionar coluna whatsapp_name (TEXT, nullable, max 255 chars) em
--      zapi_chats para persistir chatName/senderName de chats LID vindos
--      da Z-API. Hoje esse dado é descartado na Edge Function.
--
--   2. Ampliar o CHECK constraint de zapi_webhook_log.processing_status
--      para aceitar 'ignored' além de 'processed' e 'error'. Necessário
--      para que o guard de grupos (T03) possa logar payloads descartados
--      sem gerar constraint violation.
--
-- Idempotência: migration pode ser reaplicada sem erro.
--   - ADD COLUMN IF NOT EXISTS garante idempotência da coluna.
--   - DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT garante idempotência do CHECK.
--
-- Rollback manual (emergência):
--   ALTER TABLE public.zapi_chats DROP COLUMN IF EXISTS whatsapp_name;
--   ALTER TABLE public.zapi_webhook_log
--     DROP CONSTRAINT IF EXISTS zapi_webhook_log_processing_status_check;
--   ALTER TABLE public.zapi_webhook_log
--     ADD CONSTRAINT zapi_webhook_log_processing_status_check
--     CHECK (processing_status IN ('processed', 'error'));
--
-- Referência: RAQ-MAND-EM072B — T01.
-- ============================================================================

-- ── 1. Coluna whatsapp_name em zapi_chats ────────────────────────────────────
-- Nullable: apenas chats LID recebem nome via webhook. Telefones normais ficam NULL.
-- CHECK de comprimento máximo 255 chars (defensivo; EF também trunca antes do INSERT).

ALTER TABLE public.zapi_chats
  ADD COLUMN IF NOT EXISTS whatsapp_name TEXT
    CHECK (whatsapp_name IS NULL OR length(whatsapp_name) <= 255);

COMMENT ON COLUMN public.zapi_chats.whatsapp_name IS
  'Nome exibido no WhatsApp para o contato (chatName ou senderName do payload Z-API). '
  'Populado somente para chats LID (@lid). NULL para telefones normais. '
  'Usado como fallback de display quando contact_id é NULL: contact_name ?? whatsapp_name ?? "Contato sem nome". '
  'Adicionado em 054 (RAQ-MAND-EM072B).';

-- ── 2. CHECK de processing_status: adicionar 'ignored' ───────────────────────
-- Nome atual da constraint (confirmado via pg_constraint): zapi_webhook_log_processing_status_check
-- Recriar com os 3 valores: 'processed', 'error', 'ignored'.
-- 'ignored' é usado pelo guard de grupos/newsletter/broadcast (T03).

ALTER TABLE public.zapi_webhook_log
  DROP CONSTRAINT IF EXISTS zapi_webhook_log_processing_status_check;

ALTER TABLE public.zapi_webhook_log
  ADD CONSTRAINT zapi_webhook_log_processing_status_check
  CHECK (processing_status IN ('processed', 'error', 'ignored'));

COMMENT ON COLUMN public.zapi_webhook_log.processing_status IS
  'Status do processamento do webhook: '
  '  processed = evento processado com sucesso, '
  '  error     = exceção capturada durante o processamento, '
  '  ignored   = payload descartado intencionalmente (grupo/newsletter/broadcast). '
  'Adicionado valor ''ignored'' em 054 (RAQ-MAND-EM072B).';
