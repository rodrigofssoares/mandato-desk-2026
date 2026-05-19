-- ============================================================================
-- Migration 075: Tabela zapi_broadcast_poll_votes (C23)
-- ============================================================================
-- Objetivo: Persistir votos de enquetes de broadcast para consolidar resultados.
-- Quando um eleitor vota em uma enquete de campanha, o zapi-webhook insere aqui.
--
-- Idempotente: usa IF NOT EXISTS.
-- RLS: SELECT por autenticados; INSERT/UPDATE apenas service_role (webhook).
-- Referência: RAQ-MAND-EM073 — T75 (Fase 6 Onda B)
-- ============================================================================

-- ─── 1. Tabela zapi_broadcast_poll_votes ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.zapi_broadcast_poll_votes (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  broadcast_id UUID        NOT NULL REFERENCES public.zapi_broadcasts(id) ON DELETE CASCADE,
  contact_id   UUID        REFERENCES public.contacts(id) ON DELETE SET NULL,
  phone        TEXT        NOT NULL,
  option_voted TEXT        NOT NULL,
  received_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice: consulta de votos por broadcast (tela de resultados)
CREATE INDEX IF NOT EXISTS idx_poll_votes_broadcast
  ON public.zapi_broadcast_poll_votes (broadcast_id, received_at DESC);

-- Índice: evitar voto duplicado (1 voto por contato por opção por broadcast)
CREATE UNIQUE INDEX IF NOT EXISTS idx_poll_votes_unique_contact_option
  ON public.zapi_broadcast_poll_votes (broadcast_id, phone, option_voted);

-- ─── 2. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.zapi_broadcast_poll_votes ENABLE ROW LEVEL SECURITY;

-- SELECT: qualquer usuário autenticado pode ler resultados de votos
DROP POLICY IF EXISTS "poll_votes_select_authenticated" ON public.zapi_broadcast_poll_votes;
CREATE POLICY "poll_votes_select_authenticated"
  ON public.zapi_broadcast_poll_votes FOR SELECT
  TO authenticated
  USING (true);

-- INSERT/UPDATE/DELETE: bloqueados para o client; apenas service_role (webhook EF)
DROP POLICY IF EXISTS "poll_votes_insert_blocked" ON public.zapi_broadcast_poll_votes;
CREATE POLICY "poll_votes_insert_blocked"
  ON public.zapi_broadcast_poll_votes FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- ─── Log ──────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  RAISE NOTICE 'Migration 075: '
    'Tabela zapi_broadcast_poll_votes criada. '
    'INSERT bloqueado no client (apenas service_role via webhook). '
    'Unique index por (broadcast_id, phone, option_voted). '
    'Referência: T75 Fase 6 Onda B.';
END
$$;
