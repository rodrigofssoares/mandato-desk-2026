-- ============================================================================
-- Migration 095: Correção de segurança nas views públicas do agente
-- ============================================================================
-- SEC-002 (ALTO): views com security_invoker=false fazem bypass de RLS.
--
-- Análise das duas abordagens:
--
-- Opção A (security_invoker=true + policy SELECT aberta em authenticated):
--   Problema: a policy aberta permitiria que qualquer autenticado acesse a tabela
--   diretamente via SQL (SELECT * FROM ai_agents), expondo system_prompt e
--   text_only_mode. Inaceitável.
--
-- Opção B (security_invoker=false + REVOKE SELECT na tabela para authenticated):
--   A view continua rodando como owner (bypassa RLS da tabela), mas o GRANT
--   SELECT na view é a única rota de acesso. Usuários autenticados NÃO conseguem
--   mais fazer SELECT direto na tabela — apenas pelas views curadas, que expõem
--   colunas seguras (sem api_key, sem system_prompt).
--
-- Decisão: Opção B é mais segura para este schema onde a tabela base contém
-- colunas sensíveis (system_prompt, api_key) que NÃO devem ser acessíveis
-- diretamente por não-admins.
--
-- O que esta migration faz:
--   1. Revoga SELECT direto de authenticated nas tabelas ai_agents e
--      ai_provider_credentials (acesso só via views ou policies de admin).
--   2. Recria as views públicas com comentários atualizados e GRANT explícito.
--   3. As views continuam com security_invoker=false (owner context) porque
--      as tabelas base têm RLS restritivo — a view é o canal controlado.
-- ============================================================================

-- ─── ai_agents: revogar acesso direto de authenticated ───────────────────────
-- Após este REVOKE, usuário comum só acessa via ai_agents_public_view.
-- Admin ainda acessa via policies RLS (SELECT com is_admin()).
REVOKE SELECT ON public.ai_agents FROM authenticated;

-- Recriar view pública — mantém security_invoker=false (seguro com REVOKE acima)
DROP VIEW IF EXISTS public.ai_agents_public_view;
CREATE OR REPLACE VIEW public.ai_agents_public_view
WITH (security_invoker = false)
AS
  SELECT id, name, is_active
  FROM public.ai_agents;

REVOKE ALL ON public.ai_agents_public_view FROM PUBLIC;
GRANT SELECT ON public.ai_agents_public_view TO authenticated;

COMMENT ON VIEW public.ai_agents_public_view IS
  'Canal único de leitura para não-admins: expõe apenas id, name, is_active. REVOKE SELECT na tabela base garante que authenticated não acessa colunas sensíveis (system_prompt, text_only_mode) diretamente. security_invoker=false é seguro aqui porque authenticated não tem GRANT na tabela.';

-- ─── ai_provider_credentials: revogar acesso direto de authenticated ─────────
-- Após este REVOKE, usuário comum só acessa via ai_provider_credentials_public_view.
-- Admin acessa via policies RLS (SELECT com is_admin()) ou via admin_view (092).
REVOKE SELECT ON public.ai_provider_credentials FROM authenticated;

-- Recriar view pública
DROP VIEW IF EXISTS public.ai_provider_credentials_public_view;
CREATE OR REPLACE VIEW public.ai_provider_credentials_public_view
WITH (security_invoker = false)
AS
  SELECT provider, is_active, last_test_status
  FROM public.ai_provider_credentials;

REVOKE ALL ON public.ai_provider_credentials_public_view FROM PUBLIC;
GRANT SELECT ON public.ai_provider_credentials_public_view TO authenticated;

COMMENT ON VIEW public.ai_provider_credentials_public_view IS
  'Canal único de leitura para não-admins: expõe apenas provider, is_active e last_test_status (sem api_key). REVOKE SELECT na tabela base garante que authenticated não acessa api_key diretamente.';
