-- Migration 062: Adiciona colunas de quoted message e edição/exclusão em zapi_messages
-- Fase 4 (Interações nativas) — Tasks T31, T32, T41
--
-- Expand-contract: todas as colunas são nullable sem default.
-- Linhas existentes ficam com NULL — sem impacto em dados existentes.
-- Idempotente via ADD COLUMN IF NOT EXISTS.

-- ── Quoted message (reply) ─────────────────────────────────────────────────
ALTER TABLE public.zapi_messages
  ADD COLUMN IF NOT EXISTS quoted_message_id TEXT,
  ADD COLUMN IF NOT EXISTS quoted_body      TEXT,
  ADD COLUMN IF NOT EXISTS quoted_type      TEXT;

-- ── Edição e exclusão refletidas do WhatsApp ───────────────────────────────
ALTER TABLE public.zapi_messages
  ADD COLUMN IF NOT EXISTS edited_body TEXT,
  ADD COLUMN IF NOT EXISTS edited_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ;

-- ── Índices parciais para queries de mensagens editadas/deletadas ──────────
CREATE INDEX IF NOT EXISTS idx_zapi_messages_edited
  ON public.zapi_messages (chat_id)
  WHERE edited_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_zapi_messages_deleted
  ON public.zapi_messages (chat_id)
  WHERE deleted_at IS NOT NULL;

-- Sem RLS extra: zapi_messages já tem policies; novas colunas nullable herdam.
-- Sem FK em quoted_message_id: message_id é TEXT (ID Z-API), não UUID.
-- Purge futura pode NULL esses campos; nenhuma constraint adicional necessária.
