-- ========================================================================
-- 113_em085_demand_columns.sql  (RAQ-MAND-EM085)
-- Colunas configuráveis no kanban de Demandas + permissões dedicadas.
--
-- Reaproveita a infra de boards/board_stages (tipo_entidade='demand'):
--   - 1 board singleton "Demandas" + 3 estágios iniciais (Aberta/Em Andamento/Resolvida)
--   - demands.stage_id passa a ser a posição no kanban (status enum vira legado)
--   - controle de colunas vai pra matriz de permissão na seção 'demandas_colunas'
--     (criar/editar/excluir coluna) — distinta do CRUD da demanda ('demandas').
--
-- Aplicar com:  npx supabase db query --linked --file "RODRIGO/1.FAZER/113_em085_demand_columns.sql"
-- (NÃO usar db push — arrastaria migrations não registradas no schema_migrations)
-- Idempotente: pode rodar mais de uma vez sem efeito colateral.
-- Atômica: tudo dentro de BEGIN/COMMIT — falha no meio faz rollback total
-- (protege a RLS compartilhada do Funil de ficar em estado inconsistente).
-- ========================================================================

BEGIN;

-- ------------------------------------------------------------------------
-- 1. Nova seção de permissão: controle de colunas do kanban de demandas
--    Default conservador: só admin/proprietário gerenciam (criar/editar/excluir);
--    assessor/assistente/estagiário só visualizam. (Todos veem as colunas
--    renderizadas no kanban via permissão 'demandas','ver'.)
-- ------------------------------------------------------------------------
INSERT INTO permissoes_perfil (role, secao, pode_ver, pode_criar, pode_editar, pode_deletar, so_proprio) VALUES
  ('admin',        'demandas_colunas', TRUE,  TRUE,  TRUE,  TRUE,  FALSE),
  ('proprietario', 'demandas_colunas', TRUE,  TRUE,  TRUE,  TRUE,  FALSE),
  ('assessor',     'demandas_colunas', TRUE,  FALSE, FALSE, FALSE, FALSE),
  ('assistente',   'demandas_colunas', TRUE,  FALSE, FALSE, FALSE, FALSE),
  ('estagiario',   'demandas_colunas', TRUE,  FALSE, FALSE, FALSE, FALSE)
ON CONFLICT (role, secao) DO NOTHING;

-- ------------------------------------------------------------------------
-- 2. Board singleton "Demandas" + estágios iniciais (só cria se não existir)
-- ------------------------------------------------------------------------
DO $$
DECLARE
  v_board_id UUID;
BEGIN
  SELECT id INTO v_board_id
    FROM boards
    WHERE tipo_entidade = 'demand'
    ORDER BY created_at
    LIMIT 1;

  IF v_board_id IS NULL THEN
    INSERT INTO boards (nome, descricao, tipo_entidade, is_default)
    VALUES ('Demandas', 'Colunas do kanban de demandas', 'demand', TRUE)
    RETURNING id INTO v_board_id;

    INSERT INTO board_stages (board_id, nome, ordem, cor) VALUES
      (v_board_id, 'Aberta',       0, '#F59E0B'),
      (v_board_id, 'Em Andamento', 1, '#3B82F6'),
      (v_board_id, 'Resolvida',    2, '#22C55E');
  END IF;
END $$;

-- ------------------------------------------------------------------------
-- 3. Coluna demands.stage_id (posição no kanban). ON DELETE SET NULL:
--    excluir uma coluna não apaga demandas — elas ficam "sem coluna".
-- ------------------------------------------------------------------------
ALTER TABLE demands
  ADD COLUMN IF NOT EXISTS stage_id UUID REFERENCES board_stages(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_demands_stage_id ON demands(stage_id);

-- ------------------------------------------------------------------------
-- 4. Backfill: posiciona demandas existentes na coluna equivalente ao status
-- ------------------------------------------------------------------------
UPDATE demands d
SET stage_id = s.id
FROM board_stages s
JOIN boards b ON b.id = s.board_id AND b.tipo_entidade = 'demand'
WHERE d.stage_id IS NULL
  AND s.nome = CASE d.status
    WHEN 'open'        THEN 'Aberta'
    WHEN 'in_progress' THEN 'Em Andamento'
    WHEN 'resolved'    THEN 'Resolvida'
  END;

-- ------------------------------------------------------------------------
-- 5. RLS — board_stages e boards passam a ramificar por tipo_entidade:
--    * boards/stages de DEMANDA  → gated pela seção 'demandas'/'demandas_colunas'
--    * demais (contact/leader)   → mantém exatamente a regra atual ('board')
--    Ver coluna   = quem vê demandas ('demandas','ver')
--    Criar coluna = 'demandas_colunas','criar'
--    Editar coluna= 'demandas_colunas','editar'  (renomear/cor/reordenar)
--    Excluir col. = 'demandas_colunas','deletar'
-- ------------------------------------------------------------------------

-- ---- boards ----
DROP POLICY IF EXISTS "boards_select" ON boards;
CREATE POLICY "boards_select" ON boards FOR SELECT TO authenticated
USING (
  get_current_user_role() = 'admin'
  OR (tipo_entidade =  'demand' AND has_permission(auth.uid(), 'demandas', 'ver'))
  OR (tipo_entidade <> 'demand' AND has_permission(auth.uid(), 'board', 'ver'))
);

DROP POLICY IF EXISTS "boards_insert" ON boards;
CREATE POLICY "boards_insert" ON boards FOR INSERT TO authenticated
WITH CHECK (
  is_user_active(auth.uid())
  AND (
    get_current_user_role() = 'admin'
    OR (tipo_entidade =  'demand' AND has_permission(auth.uid(), 'demandas_colunas', 'criar'))
    OR (tipo_entidade <> 'demand' AND has_permission(auth.uid(), 'board', 'criar'))
  )
);

DROP POLICY IF EXISTS "boards_update" ON boards;
CREATE POLICY "boards_update" ON boards FOR UPDATE TO authenticated
USING (
  get_current_user_role() = 'admin'
  OR (tipo_entidade =  'demand' AND has_permission(auth.uid(), 'demandas_colunas', 'editar'))
  OR (tipo_entidade <> 'demand' AND has_permission(auth.uid(), 'board', 'editar'))
);

DROP POLICY IF EXISTS "boards_delete" ON boards;
CREATE POLICY "boards_delete" ON boards FOR DELETE TO authenticated
USING (
  get_current_user_role() = 'admin'
  OR (tipo_entidade =  'demand' AND has_permission(auth.uid(), 'demandas_colunas', 'deletar'))
  OR (tipo_entidade <> 'demand' AND has_permission(auth.uid(), 'board', 'deletar'))
);

-- ---- board_stages (ramifica pelo board pai) ----
DROP POLICY IF EXISTS "board_stages_select" ON board_stages;
CREATE POLICY "board_stages_select" ON board_stages FOR SELECT TO authenticated
USING (
  get_current_user_role() = 'admin'
  OR EXISTS (
    SELECT 1 FROM boards b WHERE b.id = board_stages.board_id AND (
      (b.tipo_entidade =  'demand' AND has_permission(auth.uid(), 'demandas', 'ver'))
      OR (b.tipo_entidade <> 'demand' AND has_permission(auth.uid(), 'board', 'ver'))
    )
  )
);

DROP POLICY IF EXISTS "board_stages_insert" ON board_stages;
-- Nota: para boards não-demanda mantém-se 'board','editar' (comportamento legado
-- de 013_merge_boards.sql — criar estágio em board existente = editar o board).
CREATE POLICY "board_stages_insert" ON board_stages FOR INSERT TO authenticated
WITH CHECK (
  is_user_active(auth.uid())
  AND (
    get_current_user_role() = 'admin'
    OR EXISTS (
      SELECT 1 FROM boards b WHERE b.id = board_stages.board_id AND (
        (b.tipo_entidade =  'demand' AND has_permission(auth.uid(), 'demandas_colunas', 'criar'))
        OR (b.tipo_entidade <> 'demand' AND has_permission(auth.uid(), 'board', 'editar'))
      )
    )
  )
);

DROP POLICY IF EXISTS "board_stages_update" ON board_stages;
CREATE POLICY "board_stages_update" ON board_stages FOR UPDATE TO authenticated
USING (
  get_current_user_role() = 'admin'
  OR EXISTS (
    SELECT 1 FROM boards b WHERE b.id = board_stages.board_id AND (
      (b.tipo_entidade =  'demand' AND has_permission(auth.uid(), 'demandas_colunas', 'editar'))
      OR (b.tipo_entidade <> 'demand' AND has_permission(auth.uid(), 'board', 'editar'))
    )
  )
);

DROP POLICY IF EXISTS "board_stages_delete" ON board_stages;
CREATE POLICY "board_stages_delete" ON board_stages FOR DELETE TO authenticated
USING (
  get_current_user_role() = 'admin'
  OR EXISTS (
    SELECT 1 FROM boards b WHERE b.id = board_stages.board_id AND (
      (b.tipo_entidade =  'demand' AND has_permission(auth.uid(), 'demandas_colunas', 'deletar'))
      OR (b.tipo_entidade <> 'demand' AND has_permission(auth.uid(), 'board', 'editar'))
    )
  )
);

COMMIT;

-- ========================================================================
-- FIM 113_em085_demand_columns.sql
-- Pós-aplicação: regenerar src/integrations/supabase/types.ts
--   npx supabase gen types typescript --linked > src/integrations/supabase/types.ts
-- ========================================================================
