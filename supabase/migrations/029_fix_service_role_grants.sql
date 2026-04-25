-- =====================================================================
-- RAQ-MAND-EM037 — Restaurar grants do service_role no schema public
-- =====================================================================
-- O role service_role estava sem grants nas tabelas do schema public
-- (provavelmente por algum REVOKE antigo que removeu o default).
-- As edge functions usando SUPABASE_SERVICE_ROLE_KEY falhavam com
-- "permission denied for table profiles [code=42501]".
-- =====================================================================

GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Garante que tabelas/sequences criadas no futuro também sejam acessíveis
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO service_role;
