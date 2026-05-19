-- Migration 079 — IA: colunas de transcrição + next-action
-- Expande zapi_messages com transcrição de áudio (C38)
-- Expande contacts com next-best-action de IA (C37)
-- Padrão expand-contract: só adiciona colunas nullable — sem breaking change.

-- ── zapi_messages: transcrição de áudio ──────────────────────────────────────

ALTER TABLE zapi_messages
  ADD COLUMN IF NOT EXISTS transcription        TEXT,
  ADD COLUMN IF NOT EXISTS transcribed_at       TIMESTAMPTZ;

-- ── contacts: next-best-action de IA ─────────────────────────────────────────

ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS ai_next_action       TEXT,
  ADD COLUMN IF NOT EXISTS ai_next_action_at    TIMESTAMPTZ;

-- Índice para consultas "quais contatos têm sugestão stale?"
CREATE INDEX IF NOT EXISTS idx_contacts_ai_next_action_at
  ON contacts (ai_next_action_at)
  WHERE ai_next_action_at IS NOT NULL;
