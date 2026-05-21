-- ============================================================================
-- Migration 097: View admin de ai_agents — fix regressão SEC-004
-- ============================================================================
-- Contexto: migration 095 revogou SELECT na tabela ai_agents para authenticated
-- (Opção B: acesso apenas via views curadas). Isso bloqueia corretamente usuários
-- comuns, mas também bloqueou o branch admin de useAgentSettings.ts que fazia
-- .from('ai_agents').select('*') direto — regressão SEC-004.
--
-- Fix: criar view ai_agents_admin_view com security_invoker=true.
--   - security_invoker=true → view roda no contexto do chamador.
--   - Chamador precisa passar a RLS policy "ai_agents: admin pode ver" (is_admin()).
--   - Usuário comum não passa na RLS → sem dados.
--   - Admin ativo passa na RLS → dados completos (system_prompt, text_only_mode).
--
-- Por que security_invoker=true aqui (e não false como na public_view)?
--   A view pública usa false porque authenticated não tem GRANT na tabela —
--   a view é o único canal. Aqui queremos exatamente o oposto: queremos que a
--   RLS da tabela seja respeitada para filtrar admin vs não-admin, então
--   security_invoker=true é o comportamento correto.
--
-- Padrão idêntico ao da ai_provider_credentials_admin_view (migration 092) e
-- ai_settings_admin_view (migration 096).
-- ============================================================================

DROP VIEW IF EXISTS public.ai_agents_admin_view;

CREATE OR REPLACE VIEW public.ai_agents_admin_view
  WITH (security_invoker = true)
  AS
  SELECT
    id,
    name,
    system_prompt,
    is_active,
    text_only_mode,
    created_by,
    updated_by,
    created_at,
    updated_at
  FROM public.ai_agents;

REVOKE ALL ON public.ai_agents_admin_view FROM PUBLIC;
GRANT SELECT ON public.ai_agents_admin_view TO authenticated;

COMMENT ON VIEW public.ai_agents_admin_view IS
  'View completa de ai_agents para uso administrativo no frontend. security_invoker=true respeita a RLS de ai_agents (SELECT requer is_admin()) — apenas admin ativo obtém dados, incluindo system_prompt e text_only_mode. Criada para resolver regressão SEC-004: após REVOKE SELECT da migration 095, o branch admin de useAgentSettings não conseguia mais ler a tabela diretamente.';
