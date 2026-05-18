-- Migration 084 — Fixes pós code-review Fase 7 (IA)
-- 1. get_audit_log: adiciona total_count via COUNT(*) OVER() para paginação correta
-- 2. pg_cron: agenda cleanup_ai_rate_limit() a cada 10 minutos
-- RAQ-MAND-EM073 — Code-Review fixes

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. get_audit_log — retorna total_count para paginação sem consulta extra
-- DROP obrigatório pois o tipo de retorno muda (adição de total_count BIGINT)
-- ══════════════════════════════════════════════════════════════════════════════

-- Revoga EXECUTE antes de dropar (evita dependências pendentes)
REVOKE EXECUTE ON FUNCTION get_audit_log(TEXT, TEXT, TEXT[], TEXT, TEXT, INT, INT) FROM authenticated;

DROP FUNCTION IF EXISTS get_audit_log(TEXT, TEXT, TEXT[], TEXT, TEXT, INT, INT);

CREATE FUNCTION get_audit_log(
  p_account_id  TEXT    DEFAULT NULL,
  p_chat_id     TEXT    DEFAULT NULL,
  p_event_types TEXT[]  DEFAULT NULL,
  p_date_from   TEXT    DEFAULT NULL,
  p_date_to     TEXT    DEFAULT NULL,
  p_limit       INT     DEFAULT 20,
  p_offset      INT     DEFAULT 0
)
  RETURNS TABLE (
    id           UUID,
    account_id   UUID,
    chat_id      UUID,
    contact_id   UUID,
    event_type   TEXT,
    actor_id     UUID,
    old_value    JSONB,
    new_value    JSONB,
    created_at   TIMESTAMPTZ,
    total_count  BIGINT
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
      a.created_at,
      COUNT(*) OVER() AS total_count
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

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. pg_cron — limpa ai_rate_limit a cada 10 minutos
-- ══════════════════════════════════════════════════════════════════════════════

-- Remove agendamento anterior caso exista (idempotente)
SELECT cron.unschedule('cleanup_ai_rate_limit')
  WHERE EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'cleanup_ai_rate_limit'
  );

SELECT cron.schedule(
  'cleanup_ai_rate_limit',   -- nome do job
  '*/10 * * * *',            -- a cada 10 minutos
  $$SELECT cleanup_ai_rate_limit()$$
);
