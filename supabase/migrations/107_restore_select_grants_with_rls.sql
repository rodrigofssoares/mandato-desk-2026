-- 107_restore_select_grants_with_rls.sql
-- 2026-05-21 — Fix runtime: "permission denied for table ai_agents"
--
-- Causa raiz: a migration 095 (Onda 1.1) revogou SELECT em ai_agents e
-- ai_provider_credentials para 'authenticated'. As views admin (096/097) foram
-- criadas com security_invoker=true, que executa SELECT na tabela base com
-- a permissao do caller — mas o caller (admin autenticado) nao tem mais GRANT.
-- Resultado: views quebram em runtime mesmo para admin.
--
-- Fix: restaurar GRANT SELECT para 'authenticated' nas duas tabelas. As RLS
-- policies (admin-only via public.is_admin()) ja garantem que so admin le
-- as linhas. A defesa em profundidade contra leak de api_key continua via
-- view ai_provider_credentials_admin_view que mascara a chave em SQL.

-- ai_agents: restaura SELECT (RLS ja filtra admin only via "ai_agents: admin pode ver")
GRANT SELECT ON public.ai_agents TO authenticated;

-- ai_provider_credentials: restaura SELECT (RLS filtra admin only)
-- IMPORTANTE: hooks do frontend devem continuar lendo de ai_provider_credentials_admin_view
-- (que mascara a chave). SELECT direto na tabela existe como fallback admin-only e
-- e necessario para que a view com security_invoker=true funcione.
GRANT SELECT ON public.ai_provider_credentials TO authenticated;

COMMENT ON TABLE public.ai_agents IS
  'Singleton de configuracao do agente IA. RLS admin-only para SELECT/INSERT/UPDATE/DELETE.';

COMMENT ON TABLE public.ai_provider_credentials IS
  'Credenciais de API por provider (OpenAI/Anthropic/OpenRouter). RLS admin-only. Frontend deve usar ai_provider_credentials_admin_view para evitar trafego da chave em payload HTTP.';
