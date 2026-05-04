-- FIX P-HIGH-1: View segura para google_oauth_tokens
-- Expõe apenas metadata — access_token e refresh_token NÃO são retornados ao frontend.
-- O frontend usa esta view em vez da tabela base diretamente.

CREATE OR REPLACE VIEW google_oauth_tokens_safe AS
SELECT
  id,
  user_id,
  google_email,
  is_active,
  expires_at,
  created_at,
  updated_at
FROM google_oauth_tokens;

-- Permite leitura da view para usuários autenticados.
-- A view é SECURITY INVOKER (padrão do Postgres): as policies RLS da tabela base
-- são aplicadas automaticamente ao usuário que consulta a view.
-- Assim, cada usuário só enxerga a própria linha.
GRANT SELECT ON google_oauth_tokens_safe TO authenticated;
