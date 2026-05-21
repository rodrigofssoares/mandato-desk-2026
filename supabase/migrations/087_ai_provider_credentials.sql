-- ============================================================================
-- Migration 087: Credenciais de providers de IA (1 chave por provider)
-- ============================================================================
-- Armazena as chaves de API dos providers OpenAI, Anthropic e OpenRouter.
-- Cada provider tem exatamente 1 linha (UNIQUE em provider).
--
-- SEGURANÇA: a chave real (api_key) NUNCA é exposta ao frontend. A view
-- pública `ai_provider_credentials_public_view` expõe apenas provider,
-- is_active e last_test_status — sem api_key.
--
-- A mascaragem para admin é feita no hook TypeScript (useAdminProviderCredentials)
-- reutilizando a função maskKey() de useAISettings.ts.
--
-- RLS: SELECT/INSERT/UPDATE/DELETE apenas para admin ATIVO.
-- A view pública usa GRANT SELECT TO authenticated para usuários comuns
-- visualizarem o status sem ver a chave.
-- ============================================================================

-- ─── Tabela de credenciais ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_provider_credentials (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  provider          TEXT NOT NULL
                    CHECK (provider IN ('openai', 'anthropic', 'openrouter')),
  api_key           TEXT NOT NULL,
  is_active         BOOLEAN NOT NULL DEFAULT true,

  -- Diagnóstico de última validação
  last_tested_at    TIMESTAMPTZ,
  last_test_status  TEXT
                    CHECK (last_test_status IN ('valid', 'invalid', 'untested'))
                    DEFAULT 'untested',

  -- Auditoria
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_provider_credentials IS
  'Armazena 1 chave de API por provider (OpenAI, Anthropic, OpenRouter). A chave nunca é exposta ao frontend — usar view pública ou mascaramento no hook de admin.';

COMMENT ON COLUMN public.ai_provider_credentials.api_key IS
  'Chave de API real do provider. NUNCA expor ao frontend. Acessível apenas via admin com mascaramento no hook TypeScript.';

COMMENT ON COLUMN public.ai_provider_credentials.last_test_status IS
  'Resultado do último teste de conectividade executado pela Edge Function ai-test-provider-key. valid | invalid | untested.';

-- UNIQUE: 1 linha por provider
CREATE UNIQUE INDEX IF NOT EXISTS ai_provider_credentials_provider_unique
  ON public.ai_provider_credentials (provider);

-- ─── Trigger updated_at ──────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_ai_provider_credentials_updated_at ON public.ai_provider_credentials;
CREATE TRIGGER trg_ai_provider_credentials_updated_at
  BEFORE UPDATE ON public.ai_provider_credentials
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.ai_provider_credentials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_provider_credentials: admin pode ver" ON public.ai_provider_credentials;
CREATE POLICY "ai_provider_credentials: admin pode ver"
  ON public.ai_provider_credentials
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "ai_provider_credentials: admin pode inserir" ON public.ai_provider_credentials;
CREATE POLICY "ai_provider_credentials: admin pode inserir"
  ON public.ai_provider_credentials
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "ai_provider_credentials: admin pode editar" ON public.ai_provider_credentials;
CREATE POLICY "ai_provider_credentials: admin pode editar"
  ON public.ai_provider_credentials
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "ai_provider_credentials: admin pode deletar" ON public.ai_provider_credentials;
CREATE POLICY "ai_provider_credentials: admin pode deletar"
  ON public.ai_provider_credentials
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ─── VIEW pública: status sem chave ──────────────────────────────────────────
-- Permite que a UI mostre "OpenAI: configurado / válido" sem expor a chave.

DROP VIEW IF EXISTS public.ai_provider_credentials_public_view;
CREATE OR REPLACE VIEW public.ai_provider_credentials_public_view
WITH (security_invoker = false)
AS
  SELECT provider, is_active, last_test_status
  FROM public.ai_provider_credentials;

REVOKE ALL ON public.ai_provider_credentials_public_view FROM PUBLIC;
GRANT SELECT ON public.ai_provider_credentials_public_view TO authenticated;

COMMENT ON VIEW public.ai_provider_credentials_public_view IS
  'Expõe apenas provider, is_active e last_test_status para usuários autenticados. Sem api_key.';
