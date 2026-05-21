-- ============================================================================
-- Migration 100: RPC ai_reserve_user_quota — serializa check de budget por usuário
-- ============================================================================
-- PEN-002 [ALTA] TOCTOU no cap diário/mensal + budget global
--
-- Entre os checks de orçamento e o INSERT do custo há ~3-5s de janela assíncrona.
-- 100 requests paralelos passam todos os checks com o mesmo "snapshot" de gasto.
--
-- Fix: pg_advisory_xact_lock baseado no hash do user_id serializa o check por
-- usuário. O lock se mantém até o commit (quando o INSERT do custo ocorre).
-- EF substitui os 3 checks individuais por uma única chamada a esta RPC.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ai_reserve_user_quota(
  p_user_id            UUID,
  p_max_msgs_per_day   INT,
  p_max_brl_per_month  NUMERIC,
  p_monthly_limit_brl  NUMERIC,
  p_auto_block         BOOLEAN
)
  RETURNS JSONB
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_lock_key     BIGINT;
  v_msgs_today   INT;
  v_user_spend   NUMERIC;
  v_global_spend NUMERIC;
BEGIN
  -- Advisory lock serializado por usuário.
  -- hashtext retorna INT4; cast para BIGINT para pg_advisory_xact_lock.
  v_lock_key := hashtext(p_user_id::TEXT)::BIGINT;
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Cap diário: conta mensagens do usuário desde meia-noite UTC de hoje
  SELECT COUNT(*) INTO v_msgs_today
  FROM public.ai_chat_messages m
  JOIN public.ai_chat_sessions s ON s.id = m.session_id
  WHERE s.user_id = p_user_id
    AND m.role    = 'user'
    AND m.created_at >= CURRENT_DATE;

  IF v_msgs_today >= p_max_msgs_per_day THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason',  'user_daily_cap',
      'count',   v_msgs_today,
      'limit',   p_max_msgs_per_day
    );
  END IF;

  -- Cap mensal por usuário (custo em BRL)
  SELECT COALESCE(SUM(total_cost_brl), 0) INTO v_user_spend
  FROM public.ai_chat_messages_cost
  WHERE user_id    = p_user_id
    AND created_at >= date_trunc('month', now());

  IF v_user_spend >= p_max_brl_per_month THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'reason',  'user_monthly_cap',
      'spent',   v_user_spend,
      'limit',   p_max_brl_per_month
    );
  END IF;

  -- Hard cap global (apenas se auto_block estiver ativo)
  IF p_auto_block THEN
    SELECT COALESCE(SUM(total_cost_brl), 0) INTO v_global_spend
    FROM public.ai_chat_messages_cost
    WHERE created_at >= date_trunc('month', now());

    IF v_global_spend >= p_monthly_limit_brl THEN
      RETURN jsonb_build_object(
        'allowed', false,
        'reason',  'budget_exceeded',
        'spent',   v_global_spend,
        'limit',   p_monthly_limit_brl
      );
    END IF;
  END IF;

  RETURN jsonb_build_object('allowed', true);
END;
$$;

-- Acesso restrito: apenas service_role (usado pela Edge Function)
REVOKE EXECUTE ON FUNCTION public.ai_reserve_user_quota FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.ai_reserve_user_quota TO service_role;

COMMENT ON FUNCTION public.ai_reserve_user_quota IS
  'PEN-002: serializa check de orçamento por usuário via advisory lock. Previne TOCTOU em requisições paralelas que burlariam cap diário/mensal/global.';
