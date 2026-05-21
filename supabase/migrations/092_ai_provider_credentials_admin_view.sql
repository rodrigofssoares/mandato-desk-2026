-- ============================================================================
-- Migration 092: View admin de credenciais do provider com máscara SQL
-- ============================================================================
-- SEC-001 (CRITICO): a chave de API chegava ao frontend em texto puro no payload
-- HTTP do Supabase antes de maskKey() ser aplicado no JS.
--
-- Fix: view com máscara aplicada no banco (SQL CASE) — a chave real nunca sai
-- do servidor. O hook useAdminProviderCredentials passa a ler desta view,
-- recebendo api_key_masked e api_key_set em vez de api_key.
--
-- security_invoker = true: a view respeita RLS da tabela base (ai_provider_credentials
-- já tem policy SELECT restrita a is_admin() — isso garante que apenas admins
-- conseguem dados desta view).
-- ============================================================================

DROP VIEW IF EXISTS public.ai_provider_credentials_admin_view;

CREATE OR REPLACE VIEW public.ai_provider_credentials_admin_view
WITH (security_invoker = true)
AS
  SELECT
    id,
    provider,
    is_active,
    last_test_status,
    last_tested_at,
    created_at,
    updated_at,
    CASE
      WHEN api_key IS NULL      THEN NULL
      WHEN length(api_key) <= 8 THEN repeat(chr(8226), 8)
      ELSE left(api_key, 3) || repeat(chr(8226), 12) || right(api_key, 4)
    END AS api_key_masked,
    (api_key IS NOT NULL) AS api_key_set
  FROM public.ai_provider_credentials;

REVOKE ALL ON public.ai_provider_credentials_admin_view FROM PUBLIC;
GRANT SELECT ON public.ai_provider_credentials_admin_view TO authenticated;

COMMENT ON VIEW public.ai_provider_credentials_admin_view IS
  'View admin que aplica máscara na api_key diretamente no banco. A chave real nunca trafega no payload HTTP. Requer que o chamador seja admin (security_invoker=true respeita RLS de ai_provider_credentials, onde SELECT requer is_admin()).';
