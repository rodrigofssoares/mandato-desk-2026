-- ============================================================================
-- RBAC: 4 seções granulares + RLS de campos_personalizados
-- Equivalente às migrations 050 + 051 (commits 8d642e4 + 12e5dcd)
--
-- Como rodar:
--   1. Abrir Supabase Studio → SQL Editor (projeto Mandato Desk 2026)
--   2. Colar este SQL inteiro, dar Run (Ctrl+Enter)
--   3. Conferir os SELECTs de verificação no fim
--   4. Recarregar o app (F5) → Permission Matrix deve mostrar as 4 seções
--      com checkboxes em vez de "—"
--   5. Mover este arquivo para RODRIGO/3.FEITO/
--
-- Idempotente: pode rodar várias vezes sem efeito colateral (ON CONFLICT
-- DO NOTHING preserva qualquer ajuste manual já feito via UI).
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
-- (antes referenciavam 'configuracoes' genérico — agora honram 'configuracoes_geral')

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
-- VERIFICAÇÃO
-- ============================================================================

-- 1. Cada role deve ter o MESMO número de linhas (= 24 se nada foi removido)
SELECT role, COUNT(*) AS total
FROM public.permissoes_perfil
GROUP BY role
ORDER BY role;

-- 2. Defaults das 4 seções novas — 20 linhas (5 roles × 4 seções)
SELECT secao, role, pode_ver, pode_criar, pode_editar, pode_deletar
FROM public.permissoes_perfil
WHERE secao IN ('configuracoes_geral','configuracoes_funis','configuracoes_ia','design_system')
ORDER BY secao, role;

-- 3. Policies de campos_personalizados — INSERT/UPDATE/DELETE devem mencionar
--    'configuracoes_geral' (não mais 'configuracoes' genérico)
SELECT polname, polcmd
FROM pg_policy
WHERE polrelid = 'public.campos_personalizados'::regclass
ORDER BY polname;
