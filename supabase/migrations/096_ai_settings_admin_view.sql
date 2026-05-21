-- ============================================================================
-- Migration 096: View admin de ai_settings com máscara SQL na api_key
-- ============================================================================
-- SEC-001 (CRITICO) — mesmo padrão corrigido em 092 para ai_provider_credentials.
-- useAISettings.ts:115 fazia .select('*') na tabela ai_settings, recebendo
-- api_key em texto puro no payload HTTP antes de maskKey() ser aplicado no JS.
--
-- Fix: view com máscara aplicada no banco — a chave real nunca sai do servidor.
-- O hook useAISettings passa a ler desta view para obter a chave mascarada.
--
-- security_invoker = true: respeita RLS de ai_settings (SELECT só para admin ativo).
-- Portanto, apenas admins ativos conseguem dados desta view.
-- ============================================================================

DROP VIEW IF EXISTS public.ai_settings_admin_view;

CREATE OR REPLACE VIEW public.ai_settings_admin_view
WITH (security_invoker = true)
AS
  SELECT
    id,
    provider,
    model,
    ai_enabled,
    features,
    updated_by,
    created_at,
    updated_at,
    CASE
      WHEN api_key IS NULL      THEN NULL
      WHEN length(api_key) <= 8 THEN repeat(chr(8226), 8)
      ELSE left(api_key, 3) || repeat(chr(8226), 12) || right(api_key, 4)
    END AS api_key_masked,
    (api_key IS NOT NULL) AS api_key_set
  FROM public.ai_settings;

REVOKE ALL ON public.ai_settings_admin_view FROM PUBLIC;
GRANT SELECT ON public.ai_settings_admin_view TO authenticated;

COMMENT ON VIEW public.ai_settings_admin_view IS
  'View admin que aplica máscara na api_key de ai_settings diretamente no banco. A chave real nunca trafega no payload HTTP. security_invoker=true respeita a RLS de ai_settings (SELECT requer admin + status ATIVO).';
