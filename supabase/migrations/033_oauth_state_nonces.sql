-- FIX P-HIGH-2: Tabela de nonces para OAuth state one-time-use
-- Impede replay attack: state só pode ser consumido uma vez.
-- Expiração em 10 minutos alinhada com timeout típico do fluxo OAuth.

CREATE TABLE oauth_state_nonces (
  nonce       UUID        PRIMARY KEY,
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consumed    BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes')
);

CREATE INDEX idx_oauth_state_nonces_user_id   ON oauth_state_nonces(user_id);
CREATE INDEX idx_oauth_state_nonces_expires_at ON oauth_state_nonces(expires_at);

-- Habilitar RLS — Edge Function usa service_role (bypassa RLS).
-- Nenhuma policy para authenticated: nenhuma linha visível para o client.
ALTER TABLE oauth_state_nonces ENABLE ROW LEVEL SECURITY;
