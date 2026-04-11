-- ========================================================================
-- 016_merge_ai_settings.sql
-- Configurações de IA (Central de I.A — single row, single-tenant)
--
-- Parte do merge Nosso CRM → Mandato Desk 2026.
-- Issue 13-func-schema-ai-settings + Parte A obrigatória da Issue 14
-- (reforços de segurança: RLS status_aprovacao=ATIVO, mascara no frontend,
-- audit log, uso da chave exclusivamente server-side).
--
-- ⚠️ SEGURANÇA: a coluna api_key armazena a chave em texto plano
-- protegida APENAS por RLS admin-only. Esta é uma decisão consciente
-- validada em produção no Nosso CRM do Thales. Regras obrigatórias:
--   1. Leitura da coluna nunca pode acontecer no browser do usuário final
--   2. Toda feature de IA que use a chave DEVE rodar em Edge Function
--      ou backend com service_role
--   3. O frontend mostra a chave mascarada (ex: sk-...ABCD)
--   4. Toda mudança é logada em audit via activities
-- ========================================================================

-- ------------------------------------------------------------------------
-- 1. Tabela singleton ai_settings
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_settings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider    TEXT,
  model       TEXT,
  api_key     TEXT,
  ai_enabled  BOOLEAN NOT NULL DEFAULT FALSE,
  features    JSONB NOT NULL DEFAULT '{
    "resumo_demandas": false,
    "sugestao_acoes": false,
    "analise_risco": false
  }'::jsonb,
  updated_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ai_settings_provider_check
    CHECK (provider IS NULL OR provider IN ('anthropic', 'openai', 'google'))
);

-- Garantir que existe no máximo 1 linha
CREATE UNIQUE INDEX IF NOT EXISTS ai_settings_singleton
  ON ai_settings((TRUE));

CREATE TRIGGER ai_settings_updated_at
  BEFORE UPDATE ON ai_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------
-- 2. Inserir linha única inicial (só se tabela vazia)
-- ------------------------------------------------------------------------
INSERT INTO ai_settings (provider, ai_enabled)
SELECT NULL, FALSE
WHERE NOT EXISTS (SELECT 1 FROM ai_settings);

-- ------------------------------------------------------------------------
-- 3. RLS em ai_settings — admin + ativo apenas
--    (Reforço da Parte A da Issue 14: exigir status_aprovacao = 'ATIVO')
-- ------------------------------------------------------------------------
ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ai_settings_select"
  ON ai_settings FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'admin'
        AND status_aprovacao = 'ATIVO'
    )
  );

CREATE POLICY "ai_settings_update"
  ON ai_settings FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'admin'
        AND status_aprovacao = 'ATIVO'
    )
  );

-- Deliberadamente NÃO criar policy de INSERT ou DELETE:
-- - singleton já foi inserido via INSERT do step 2
-- - a linha nunca deve ser deletada, apenas atualizada
