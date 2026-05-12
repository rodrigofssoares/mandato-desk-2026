-- ============================================================================
-- /rbac-atualizar — 2026-05-12 — Mandato Desk 2026
-- ============================================================================
-- ATENÇÃO: este arquivo é EQUIVALENTE às migrations:
--   - supabase/migrations/050_rbac_secoes_configuracoes_granular.sql
--   - supabase/migrations/051_rls_campos_personalizados_granular.sql
--
-- Use APENAS se `npx supabase db push` não estiver disponível.
-- Fonte canônica = arquivos em supabase/migrations/.
--
-- ----------------------------------------------------------------------------
-- Seções novas (migration 050):
--   1. configuracoes_geral  — Configurações › Geral (Campos Personalizados)
--   2. configuracoes_funis  — Configurações › Funis
--   3. configuracoes_ia     — Configurações › IA (chaves sensíveis = só admin)
--   4. design_system        — Design System (catálogo dev, read-only)
--
-- Sub-abas descartadas (preferências pessoais — não RBAC):
--   - nav-ordem (localStorage), alertas (dispensas por usuário)
--
-- Migração de policies (migration 051):
--   - campos_personalizados.{INSERT,UPDATE,DELETE} passam de `configuracoes`
--     genérico → `configuracoes_geral` (honra granularidade da 050)
-- ============================================================================

-- ===== PARTE 1 — Plantar as 4 seções novas em permissoes_perfil =====
INSERT INTO public.permissoes_perfil
  (role, secao, pode_ver, pode_criar, pode_editar, pode_deletar, pode_deletar_em_massa, so_proprio) VALUES
  ('admin',        'configuracoes_geral', TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  FALSE),
  ('proprietario', 'configuracoes_geral', TRUE,  FALSE, FALSE, FALSE, FALSE, FALSE),
  ('assessor',     'configuracoes_geral', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('assistente',   'configuracoes_geral', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('estagiario',   'configuracoes_geral', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),

  ('admin',        'configuracoes_funis', TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  FALSE),
  ('proprietario', 'configuracoes_funis', TRUE,  FALSE, FALSE, FALSE, FALSE, FALSE),
  ('assessor',     'configuracoes_funis', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('assistente',   'configuracoes_funis', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('estagiario',   'configuracoes_funis', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),

  ('admin',        'configuracoes_ia',    TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  FALSE),
  ('proprietario', 'configuracoes_ia',    FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('assessor',     'configuracoes_ia',    FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('assistente',   'configuracoes_ia',    FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('estagiario',   'configuracoes_ia',    FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),

  ('admin',        'design_system',       TRUE,  FALSE, FALSE, FALSE, FALSE, FALSE),
  ('proprietario', 'design_system',       TRUE,  FALSE, FALSE, FALSE, FALSE, FALSE),
  ('assessor',     'design_system',       FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('assistente',   'design_system',       FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('estagiario',   'design_system',       FALSE, FALSE, FALSE, FALSE, FALSE, FALSE)

ON CONFLICT (role, secao) DO NOTHING;

-- ===== PARTE 2 — Migrar policies de campos_personalizados =====
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

-- ===== Verificação =====
SELECT role, COUNT(*) AS total FROM public.permissoes_perfil GROUP BY role ORDER BY role;
SELECT polname FROM pg_policy
WHERE polrelid = 'public.campos_personalizados'::regclass
ORDER BY polname;
