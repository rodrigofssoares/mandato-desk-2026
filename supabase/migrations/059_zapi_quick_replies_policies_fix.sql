-- ============================================================================
-- Migration 059: correção das policies de escrita de zapi_quick_replies (FASE 0)
-- ============================================================================
-- Objetivo:
--   A migration 057 criou zapi_quick_replies com escrita liberada a qualquer
--   usuário ATIVO (has_role(uid,'user')), permitindo que um atendente editasse
--   ou apagasse respostas rápidas de outros. O Security audit (FASE 0) apontou
--   o problema. As policies corretas foram escritas no arquivo 057, mas como a
--   057 já estava aplicada no banco, a correção precisa de uma migration própria.
--
-- Regra correta:
--   SELECT  — qualquer autenticado (inalterado)
--   INSERT  — created_by deve ser o próprio usuário (WITH CHECK)
--   UPDATE  — somente o criador do registro ou admin
--   DELETE  — somente o criador do registro ou admin
--
-- Idempotência: DROP POLICY IF EXISTS antes de cada CREATE.
--
-- Referência: RAQ-MAND — FASE 0 (correção pós-security audit)
-- ============================================================================

DROP POLICY IF EXISTS "zapi_quick_replies_insert" ON public.zapi_quick_replies;
DROP POLICY IF EXISTS "zapi_quick_replies_update" ON public.zapi_quick_replies;
DROP POLICY IF EXISTS "zapi_quick_replies_delete" ON public.zapi_quick_replies;

-- INSERT: o criador registrado deve ser o usuário autenticado
CREATE POLICY "zapi_quick_replies_insert"
  ON public.zapi_quick_replies
  FOR INSERT
  WITH CHECK (created_by = auth.uid());

-- UPDATE: somente o criador ou um admin
CREATE POLICY "zapi_quick_replies_update"
  ON public.zapi_quick_replies
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin') OR created_by = auth.uid())
  WITH CHECK (has_role(auth.uid(), 'admin') OR created_by = auth.uid());

-- DELETE: somente o criador ou um admin
CREATE POLICY "zapi_quick_replies_delete"
  ON public.zapi_quick_replies
  FOR DELETE
  USING (has_role(auth.uid(), 'admin') OR created_by = auth.uid());

DO $$
BEGIN
  RAISE NOTICE 'Migration 059: policies de escrita de zapi_quick_replies corrigidas (criador/admin).';
END
$$;
