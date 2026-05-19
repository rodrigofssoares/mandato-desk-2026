-- Migration 083 — Segurança IA: rate-limit, audit log restrito, view via RPC
-- Corrige findings do pentest da Fase 7 (IA) do WhatsApp CRM.
-- RAQ-MAND-EM073 — Hardening de segurança

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. Tabela ai_rate_limit — janela deslizante por usuário (1 minuto)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ai_rate_limit (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ef_name     TEXT        NOT NULL,  -- nome da edge function chamada
  called_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice para a query de contagem na janela deslizante
CREATE INDEX IF NOT EXISTS idx_ai_rate_limit_user_called
  ON ai_rate_limit (user_id, called_at DESC);

-- Limpeza automática de entradas antigas (> 5 minutos) para não acumular
CREATE OR REPLACE FUNCTION cleanup_ai_rate_limit() RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM ai_rate_limit WHERE called_at < now() - INTERVAL '5 minutes';
END;
$$;

-- RLS: usuários não devem ler nem manipular a tabela diretamente
ALTER TABLE ai_rate_limit ENABLE ROW LEVEL SECURITY;

-- Sem policy SELECT para authenticated (apenas service_role lê/escreve via EF)
-- Sem policies UPDATE/DELETE — imutável via client

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. zapi_audit_log — restringir SELECT a role=admin
-- ══════════════════════════════════════════════════════════════════════════════

-- Remove a policy permissiva anterior (criada em 081 e recriada em 082)
DROP POLICY IF EXISTS "zapi_audit_log_select" ON zapi_audit_log;

-- Nova policy: apenas admin pode ler o audit log diretamente
CREATE POLICY "zapi_audit_log_select_admin_only"
  ON zapi_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.status_aprovacao = 'ATIVO'
        AND profiles.role = 'admin'
    )
  );

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. v_dashboard_atendimento — revogar acesso direto, expor via RPC SECURITY DEFINER
-- ══════════════════════════════════════════════════════════════════════════════

-- Revoga SELECT direto na view para authenticated
REVOKE SELECT ON v_dashboard_atendimento FROM authenticated;

-- RPC que verifica role=admin antes de retornar os dados da view
CREATE OR REPLACE FUNCTION get_dashboard_atendimento(p_account_id TEXT DEFAULT NULL)
  RETURNS TABLE (
    account_id                  TEXT,
    conversas_abertas           INT,
    conversas_finalizadas_hoje  INT,
    conversas_por_atendente     JSONB,
    tempo_medio_resposta_min    NUMERIC
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  -- Verifica que o caller é admin ativo
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.status_aprovacao = 'ATIVO'
      AND profiles.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem acessar o dashboard de atendimento'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_account_id IS NOT NULL AND p_account_id <> '__all__' THEN
    RETURN QUERY
      SELECT
        v.account_id::TEXT,
        v.conversas_abertas,
        v.conversas_finalizadas_hoje,
        v.conversas_por_atendente,
        v.tempo_medio_resposta_min
      FROM v_dashboard_atendimento v
      WHERE v.account_id::TEXT = p_account_id;
  ELSE
    RETURN QUERY
      SELECT
        v.account_id::TEXT,
        v.conversas_abertas,
        v.conversas_finalizadas_hoje,
        v.conversas_por_atendente,
        v.tempo_medio_resposta_min
      FROM v_dashboard_atendimento v;
  END IF;
END;
$$;

-- Garante que authenticated pode invocar a RPC
GRANT EXECUTE ON FUNCTION get_dashboard_atendimento(TEXT) TO authenticated;

-- ══════════════════════════════════════════════════════════════════════════════
-- 4. RPC get_audit_log — audit log paginado via RPC SECURITY DEFINER (admin only)
-- ══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_audit_log(
  p_account_id  TEXT    DEFAULT NULL,
  p_chat_id     TEXT    DEFAULT NULL,
  p_event_types TEXT[]  DEFAULT NULL,
  p_date_from   TEXT    DEFAULT NULL,
  p_date_to     TEXT    DEFAULT NULL,
  p_limit       INT     DEFAULT 20,
  p_offset      INT     DEFAULT 0
)
  RETURNS TABLE (
    id          UUID,
    account_id  UUID,
    chat_id     UUID,
    contact_id  UUID,
    event_type  TEXT,
    actor_id    UUID,
    old_value   JSONB,
    new_value   JSONB,
    created_at  TIMESTAMPTZ
  )
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
BEGIN
  -- Verifica que o caller é admin ativo
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.status_aprovacao = 'ATIVO'
      AND profiles.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Acesso negado: apenas administradores podem acessar o log de auditoria'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
    SELECT
      a.id,
      a.account_id,
      a.chat_id,
      a.contact_id,
      a.event_type,
      a.actor_id,
      a.old_value,
      a.new_value,
      a.created_at
    FROM zapi_audit_log a
    WHERE
      (p_account_id IS NULL OR p_account_id = '__all__' OR a.account_id::TEXT = p_account_id)
      AND (p_chat_id IS NULL OR a.chat_id::TEXT = p_chat_id)
      AND (p_event_types IS NULL OR a.event_type = ANY(p_event_types))
      AND (p_date_from IS NULL OR a.created_at >= p_date_from::TIMESTAMPTZ)
      AND (p_date_to   IS NULL OR a.created_at <= p_date_to::TIMESTAMPTZ)
    ORDER BY a.created_at DESC
    LIMIT  LEAST(p_limit, 100)   -- teto de 100 por página
    OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION get_audit_log(TEXT, TEXT, TEXT[], TEXT, TEXT, INT, INT) TO authenticated;
