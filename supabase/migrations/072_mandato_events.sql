-- ============================================================================
-- Migration 072: Tabelas mandato_events + contact_event_rsvps (C20)
-- ============================================================================
-- Objetivo: Criar infraestrutura de dados para convites a eventos (C20).
--   - mandato_events: eventos do mandato (agenda pública)
--   - contact_event_rsvps: confirmações de presença (RSVP)
--
-- Idempotente: usa IF NOT EXISTS em todas as criações.
-- RLS: habilitado em ambas as tabelas.
-- Referência: RAQ-MAND-EM073 — T69 (Fase 6 Onda B)
-- ============================================================================

-- ─── 1. Tabela mandato_events ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mandato_events (
  id           UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title        TEXT        NOT NULL,
  descricao    TEXT,
  data_evento  TIMESTAMPTZ NOT NULL,
  local        TEXT,
  account_id   UUID        NOT NULL REFERENCES public.zapi_accounts(id) ON DELETE CASCADE,
  created_by   UUID        NOT NULL REFERENCES auth.users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índice: ordenação/filtro por conta + data
CREATE INDEX IF NOT EXISTS idx_mandato_events_account
  ON public.mandato_events (account_id, data_evento ASC);

-- ─── 2. Tabela contact_event_rsvps ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.contact_event_rsvps (
  id             UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id       UUID        NOT NULL REFERENCES public.mandato_events(id) ON DELETE CASCADE,
  contact_id     UUID        NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  status         TEXT        NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'confirmado', 'recusado')),
  respondido_em  TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, contact_id)
);

-- Índice: filtro por evento + status
CREATE INDEX IF NOT EXISTS idx_contact_event_rsvps_event
  ON public.contact_event_rsvps (event_id, status);

-- ─── 3. RLS: mandato_events ───────────────────────────────────────────────────

ALTER TABLE public.mandato_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "mandato_events_select_authenticated" ON public.mandato_events;
CREATE POLICY "mandato_events_select_authenticated"
  ON public.mandato_events FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "mandato_events_insert_owner" ON public.mandato_events;
CREATE POLICY "mandato_events_insert_owner"
  ON public.mandato_events FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "mandato_events_update_owner" ON public.mandato_events;
CREATE POLICY "mandato_events_update_owner"
  ON public.mandato_events FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "mandato_events_delete_owner" ON public.mandato_events;
CREATE POLICY "mandato_events_delete_owner"
  ON public.mandato_events FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- ─── 4. RLS: contact_event_rsvps ─────────────────────────────────────────────

ALTER TABLE public.contact_event_rsvps ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contact_event_rsvps_select_authenticated" ON public.contact_event_rsvps;
CREATE POLICY "contact_event_rsvps_select_authenticated"
  ON public.contact_event_rsvps FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "contact_event_rsvps_insert_authenticated" ON public.contact_event_rsvps;
CREATE POLICY "contact_event_rsvps_insert_authenticated"
  ON public.contact_event_rsvps FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "contact_event_rsvps_update_authenticated" ON public.contact_event_rsvps;
CREATE POLICY "contact_event_rsvps_update_authenticated"
  ON public.contact_event_rsvps FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "contact_event_rsvps_delete_authenticated" ON public.contact_event_rsvps;
CREATE POLICY "contact_event_rsvps_delete_authenticated"
  ON public.contact_event_rsvps FOR DELETE
  TO authenticated
  USING (true);

-- ─── Log ──────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  RAISE NOTICE 'Migration 072: '
    'Tabelas mandato_events e contact_event_rsvps criadas com RLS habilitado. '
    'Referência: T69 Fase 6 Onda B.';
END
$$;
