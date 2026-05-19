-- Migration 080 — IA: colunas de análise em zapi_chats
-- Adiciona resumo, intenção e sentimento gerados por IA (C33 / C35 / C36)
-- Padrão expand-contract: colunas nullable, sem breaking change.

ALTER TABLE zapi_chats
  ADD COLUMN IF NOT EXISTS ai_summary       TEXT,
  ADD COLUMN IF NOT EXISTS ai_intent        TEXT,
  ADD COLUMN IF NOT EXISTS ai_sentiment     TEXT
    CONSTRAINT zapi_chats_ai_sentiment_check
      CHECK (ai_sentiment IN ('positivo', 'neutro', 'negativo', 'urgente')),
  ADD COLUMN IF NOT EXISTS ai_analyzed_at   TIMESTAMPTZ;

-- Índice para consultas "conversas com análise stale"
CREATE INDEX IF NOT EXISTS idx_zapi_chats_ai_analyzed_at
  ON zapi_chats (ai_analyzed_at)
  WHERE ai_analyzed_at IS NOT NULL;

-- Índice parcial para filtrar urgentes com rapidez na lista de conversas
CREATE INDEX IF NOT EXISTS idx_zapi_chats_ai_sentiment_urgente
  ON zapi_chats (account_id, ai_sentiment)
  WHERE ai_sentiment = 'urgente';
