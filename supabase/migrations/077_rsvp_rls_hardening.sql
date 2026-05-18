-- ============================================================================
-- Migration 077: Hardening RLS em contact_event_rsvps (ALTA-3)
-- ============================================================================
-- Problema: migration 072 criou as policies INSERT/UPDATE/DELETE com
-- WITH CHECK (true) / USING (true) — qualquer usuário autenticado poderia
-- criar, alterar ou excluir RSVPs de eventos de outros usuários.
--
-- Correção: INSERT/UPDATE/DELETE só permitidos quando o evento (event_id)
-- pertence a mandato_events com created_by = auth.uid() OU o usuário é admin.
--
-- Nota: SELECT permanece aberto (USING true) — leitura não é um vetor de ataque.
-- O evento em si já protege visibilidade por ser de mandato único (single-tenant).
--
-- Referência: RAQ-MAND-EM073 — Hardening Fase 6 / ALTA-3
-- ============================================================================

-- ─── Recriar policies INSERT/UPDATE/DELETE com verificação de ownership ───────

-- INSERT: apenas para eventos criados pelo próprio usuário (ou admin)
DROP POLICY IF EXISTS "contact_event_rsvps_insert_authenticated" ON public.contact_event_rsvps;
CREATE POLICY "contact_event_rsvps_insert_owner_event"
  ON public.contact_event_rsvps FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.mandato_events e
      WHERE e.id = event_id
        AND (
          e.created_by = auth.uid()
          OR has_role(auth.uid(), 'admin')
        )
    )
  );

COMMENT ON POLICY "contact_event_rsvps_insert_owner_event" ON public.contact_event_rsvps IS
  'INSERT de RSVP permitido apenas quando o evento pertence ao usuário autenticado ou admin. '
  'Substitui a policy WITH CHECK (true) da migration 072. '
  'Referência: RAQ-MAND-EM073 ALTA-3.';

-- UPDATE: mesma restrição de ownership no evento
DROP POLICY IF EXISTS "contact_event_rsvps_update_authenticated" ON public.contact_event_rsvps;
CREATE POLICY "contact_event_rsvps_update_owner_event"
  ON public.contact_event_rsvps FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.mandato_events e
      WHERE e.id = event_id
        AND (
          e.created_by = auth.uid()
          OR has_role(auth.uid(), 'admin')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.mandato_events e
      WHERE e.id = event_id
        AND (
          e.created_by = auth.uid()
          OR has_role(auth.uid(), 'admin')
        )
    )
  );

COMMENT ON POLICY "contact_event_rsvps_update_owner_event" ON public.contact_event_rsvps IS
  'UPDATE de RSVP permitido apenas quando o evento pertence ao usuário autenticado ou admin. '
  'Substitui a policy USING (true)/WITH CHECK (true) da migration 072. '
  'Referência: RAQ-MAND-EM073 ALTA-3.';

-- DELETE: mesma restrição de ownership no evento
DROP POLICY IF EXISTS "contact_event_rsvps_delete_authenticated" ON public.contact_event_rsvps;
CREATE POLICY "contact_event_rsvps_delete_owner_event"
  ON public.contact_event_rsvps FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.mandato_events e
      WHERE e.id = event_id
        AND (
          e.created_by = auth.uid()
          OR has_role(auth.uid(), 'admin')
        )
    )
  );

COMMENT ON POLICY "contact_event_rsvps_delete_owner_event" ON public.contact_event_rsvps IS
  'DELETE de RSVP permitido apenas quando o evento pertence ao usuário autenticado ou admin. '
  'Substitui a policy USING (true) da migration 072. '
  'Referência: RAQ-MAND-EM073 ALTA-3.';

-- ─── Log ──────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  RAISE NOTICE 'Migration 077: '
    'RLS de contact_event_rsvps corrigido. '
    'INSERT/UPDATE/DELETE agora exigem que event_id pertença ao auth.uid() ou admin. '
    'Policies WITH CHECK(true)/USING(true) removidas. '
    'Referência: RAQ-MAND-EM073 ALTA-3.';
END
$$;
