-- ============================================================================
-- Migration 078: Corrige unique index de votos de enquete (ALTA-6)
-- ============================================================================
-- Problema (migration 075): unique index era (broadcast_id, phone, option_voted),
-- permitindo que 1 pessoa vote em múltiplas opções ou vote múltiplas vezes
-- em opções distintas. Semanticamente, 1 pessoa = 1 voto por enquete.
--
-- Correção:
--   a) Remove o índice (broadcast_id, phone, option_voted) da 075.
--   b) Cria novo índice único (broadcast_id, phone) — 1 registro por pessoa.
--   c) O webhook fará upsert com onConflict='broadcast_id,phone', atualizando
--      option_voted (último voto vence, conforme especificação).
--
-- Nota: linhas duplicadas existentes (improvável em ambiente fresh, mas possível)
-- são removidas mantendo o registro mais recente (received_at DESC) antes do DROP.
--
-- Referência: RAQ-MAND-EM073 — Hardening Fase 6 / ALTA-6
-- ============================================================================

-- ─── 1. Remove duplicatas antes de criar constraint mais restritiva ───────────
-- Mantém o voto mais recente de cada (broadcast_id, phone) — último voto vence.
DELETE FROM public.zapi_broadcast_poll_votes
WHERE id NOT IN (
  SELECT DISTINCT ON (broadcast_id, phone) id
  FROM public.zapi_broadcast_poll_votes
  ORDER BY broadcast_id, phone, received_at DESC
);

-- ─── 2. Remove índice antigo (broadcast_id, phone, option_voted) ──────────────
DROP INDEX IF EXISTS public.idx_poll_votes_unique_contact_option;

-- ─── 3. Cria novo índice único (broadcast_id, phone) — 1 voto por pessoa ──────
CREATE UNIQUE INDEX IF NOT EXISTS idx_poll_votes_unique_per_person
  ON public.zapi_broadcast_poll_votes (broadcast_id, phone);

COMMENT ON INDEX public.idx_poll_votes_unique_per_person IS
  '1 voto por pessoa por broadcast de enquete. '
  'Upsert com onConflict=broadcast_id,phone atualiza option_voted (último voto vence). '
  'Substitui idx_poll_votes_unique_contact_option (migration 075). '
  'Referência: RAQ-MAND-EM073 ALTA-6.';

-- ─── Log ──────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  RAISE NOTICE 'Migration 078: '
    'Unique index de poll_votes alterado de (broadcast_id,phone,option_voted) '
    'para (broadcast_id,phone). '
    '1 voto por pessoa por enquete. Último voto vence (upsert). '
    'Referência: RAQ-MAND-EM073 ALTA-6.';
END
$$;
