-- ============================================================================
-- Migration 093: Corrige trigger de limite de sessões — UUID não é cronológico
-- ============================================================================
-- SEC-006 / must-fix 2 do Code Review:
-- 090_ai_chat_schema.sql:72 usava MIN(s.id) para encontrar a sessão mais antiga.
-- UUID v4 é aleatório — MIN(uuid) retorna o lexicograficamente menor, não o
-- mais antigo. Isso causava deleção de sessão imprevisível.
--
-- Fix: duas queries separadas (COUNT depois SELECT com ORDER BY created_at ASC).
-- Tiebreaker id ASC garante resultado estável quando dois inserts são simultâneos.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ai_chat_sessions_limit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_count     INT;
  v_oldest_id UUID;
BEGIN
  SELECT COUNT(*)
    INTO v_count
  FROM public.ai_chat_sessions
  WHERE user_id = NEW.user_id;

  IF v_count >= 200 THEN
    SELECT id
      INTO v_oldest_id
    FROM public.ai_chat_sessions
    WHERE user_id = NEW.user_id
    ORDER BY created_at ASC, id ASC
    LIMIT 1;

    DELETE FROM public.ai_chat_sessions WHERE id = v_oldest_id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.ai_chat_sessions_limit_trigger() IS
  'Limita 200 sessões por usuário. Ao ultrapassar, deleta a mais antiga por created_at ASC (tiebreaker id ASC). Substitui versão anterior que usava MIN(id) — UUID v4 não é cronológico.';
