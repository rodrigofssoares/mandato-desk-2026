-- ============================================================================
-- Migration 103: Advisory locks nos triggers de limite + singleton ai_agents
-- ============================================================================
-- PEN-005 [MEDIA] Race condition nos triggers de limite (favoritos/sessões/anexos)
-- PEN-006 [MEDIA] ai_agents singleton sem UNIQUE constraint
--
-- Contexto:
--   Os triggers de limite faziam SELECT COUNT(*) sem lock, permitindo que dois
--   INSERTs simultâneos passassem com count=499/199/9 e ambos fossem aceitos.
--   pg_advisory_xact_lock por user_id (favoritos/sessões) ou agent_id (anexos)
--   serializa o check garantindo que o contador já inclua o insert concorrente.
--
--   ai_agents não tinha UNIQUE constraint — um segundo INSERT (bug de seed ou
--   admin comprometido) tirava todo o chat do ar via maybeSingle() → PGRST116.
-- ============================================================================

-- ─── PEN-005: Trigger de favoritos com advisory lock ──────────────────────────

CREATE OR REPLACE FUNCTION public.ai_chat_favorites_limit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INT;
BEGIN
  -- Lock por usuário serializa o check; libera no commit
  PERFORM pg_advisory_xact_lock(hashtext('fav:' || NEW.user_id::TEXT)::BIGINT);

  SELECT COUNT(*) INTO v_count
  FROM public.ai_chat_favorites
  WHERE user_id = NEW.user_id;

  IF v_count >= 500 THEN
    RAISE EXCEPTION 'favorites_limit_reached'
      USING HINT    = 'Limite de 500 favoritos atingido. Remova alguns para adicionar novos.',
            ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.ai_chat_favorites_limit_trigger() IS
  'PEN-005: limita 500 favoritos por usuário com advisory lock — elimina race condition em INSERTs paralelos.';

-- ─── PEN-005: Trigger de sessões com advisory lock ────────────────────────────

CREATE OR REPLACE FUNCTION public.ai_chat_sessions_limit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count     INT;
  v_oldest_id UUID;
BEGIN
  -- Lock por usuário serializa o check; libera no commit
  PERFORM pg_advisory_xact_lock(hashtext('sess:' || NEW.user_id::TEXT)::BIGINT);

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
  'PEN-005 + fix-093: limita 200 sessões por usuário com advisory lock. Apaga a mais antiga por created_at ASC (tiebreaker id ASC).';

-- ─── PEN-005: Trigger de anexos com advisory lock ────────────────────────────

CREATE OR REPLACE FUNCTION public.ai_agent_attachments_limit_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_count INT;
BEGIN
  -- Lock por agent_id serializa o check; libera no commit
  PERFORM pg_advisory_xact_lock(hashtext('att:' || NEW.agent_id::TEXT)::BIGINT);

  SELECT COUNT(*) INTO v_count
  FROM public.ai_agent_attachments
  WHERE agent_id = NEW.agent_id;

  IF v_count >= 10 THEN
    RAISE EXCEPTION 'attachments_limit_reached'
      USING HINT    = 'Limite de 10 documentos atingido. Remova um para adicionar outro.',
            ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.ai_agent_attachments_limit_trigger() IS
  'PEN-005: limita 10 anexos por agente com advisory lock — elimina race condition em uploads paralelos.';

-- ─── PEN-006: UNIQUE constraint no singleton ai_agents ───────────────────────
-- Garante que nunca haverá mais de 1 linha na tabela.
-- INDEX em (true) é o padrão Postgres para singleton constraint.
-- Qualquer segundo INSERT levanta UNIQUE violation, não quebrando o chat.

CREATE UNIQUE INDEX IF NOT EXISTS ai_agents_singleton_idx
  ON public.ai_agents ((true));

COMMENT ON INDEX public.ai_agents_singleton_idx IS
  'PEN-006: garante exatamente 1 linha na tabela ai_agents (singleton). Previne DoS via maybeSingle() → PGRST116 se admin comprometido inserir segunda linha.';
