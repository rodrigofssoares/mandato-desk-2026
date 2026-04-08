-- Adicionar campo para rastrear ultimo uso do token API
ALTER TABLE api_tokens ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;
