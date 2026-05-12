-- ============================================================================
-- Migration 051: Migra RLS de campos_personalizados para seção granular
-- ============================================================================
-- Endereça finding do Security audit do commit 8d642e4:
--   As policies de INSERT/UPDATE/DELETE em `campos_personalizados` ainda
--   referenciam a seção genérica `'configuracoes'` (herdada da 015 quando
--   `configuracoes_geral` ainda não existia). A migration 050 criou a seção
--   granular, mas sem este passo as policies continuam consultando a chave
--   antiga — o que faria qualquer role com `configuracoes=view` poder criar/
--   editar/deletar campos personalizados, ignorando a granularidade da 050.
--
-- Notas:
--   - SELECT continua TRUE (qualquer authenticated lê — definição compartilhada
--     do tenant). Não precisa migrar.
--   - INSERT/UPDATE/DELETE passam a checar `configuracoes_geral` em vez de
--     `configuracoes`.
--   - Mantém fallback `get_current_user_role() = 'admin'` para garantir que
--     admin nunca perde acesso mesmo se a row de permissoes_perfil estiver
--     ausente.
-- ============================================================================

DROP POLICY IF EXISTS "campos_personalizados_insert" ON public.campos_personalizados;
CREATE POLICY "campos_personalizados_insert"
  ON public.campos_personalizados FOR INSERT
  TO authenticated
  WITH CHECK (
    is_user_active(auth.uid())
    AND (
      get_current_user_role() = 'admin'
      OR has_permission(auth.uid(), 'configuracoes_geral', 'criar')
    )
  );

DROP POLICY IF EXISTS "campos_personalizados_update" ON public.campos_personalizados;
CREATE POLICY "campos_personalizados_update"
  ON public.campos_personalizados FOR UPDATE
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'configuracoes_geral', 'editar')
  );

DROP POLICY IF EXISTS "campos_personalizados_delete" ON public.campos_personalizados;
CREATE POLICY "campos_personalizados_delete"
  ON public.campos_personalizados FOR DELETE
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'configuracoes_geral', 'deletar')
  );

-- ============================================================================
-- Verificação:
--   SELECT polname, qual::text FROM pg_policy
--   WHERE polrelid = 'public.campos_personalizados'::regclass
--   ORDER BY polname;
-- → policies de INSERT/UPDATE/DELETE devem mencionar 'configuracoes_geral'.
-- ============================================================================
