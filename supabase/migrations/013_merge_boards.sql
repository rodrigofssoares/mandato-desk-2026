-- ========================================================================
-- 013_merge_boards.sql
-- Boards (funis) configuráveis de contatos
--
-- Parte do merge Nosso CRM → Mandato Desk 2026 (issue 10-func-schema-boards).
--
-- O usuário pode criar múltiplos boards (ex: "Seguidores", "Ação de Rua")
-- com estágios customizáveis. Cada contato pode ser posicionado em um
-- estágio específico de cada board (um contato pode aparecer em boards
-- diferentes ao mesmo tempo).
--
-- 3 tabelas:
--   boards         → definição do funil
--   board_stages   → colunas/etapas do funil (ordenáveis)
--   board_items    → contato × estágio × board (junção)
-- ========================================================================

-- ------------------------------------------------------------------------
-- 1. Tabela boards
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS boards (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          TEXT NOT NULL,
  descricao     TEXT,
  tipo_entidade TEXT NOT NULL DEFAULT 'contact',
  is_default    BOOLEAN NOT NULL DEFAULT FALSE,
  created_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT boards_tipo_entidade_check
    CHECK (tipo_entidade IN ('contact', 'demand', 'leader'))
);

CREATE INDEX IF NOT EXISTS idx_boards_tipo_entidade ON boards(tipo_entidade);
CREATE INDEX IF NOT EXISTS idx_boards_is_default ON boards(is_default) WHERE is_default = TRUE;

CREATE TRIGGER boards_updated_at
  BEFORE UPDATE ON boards
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------
-- 2. Tabela board_stages
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS board_stages (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id   UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  nome       TEXT NOT NULL,
  ordem      INTEGER NOT NULL,
  cor        TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_board_stages_board_ordem ON board_stages(board_id, ordem);

CREATE TRIGGER board_stages_updated_at
  BEFORE UPDATE ON board_stages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------
-- 3. Tabela board_items (junção)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS board_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id   UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  stage_id   UUID NOT NULL REFERENCES board_stages(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  ordem      INTEGER NOT NULL DEFAULT 0,
  moved_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT board_items_unique_contact_board UNIQUE (board_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_board_items_stage_ordem ON board_items(stage_id, ordem);
CREATE INDEX IF NOT EXISTS idx_board_items_contact ON board_items(contact_id);
CREATE INDEX IF NOT EXISTS idx_board_items_moved_at ON board_items(moved_at);

-- ------------------------------------------------------------------------
-- 4. RLS em boards
-- ------------------------------------------------------------------------
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "boards_select"
  ON boards FOR SELECT
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'board', 'ver')
  );

CREATE POLICY "boards_insert"
  ON boards FOR INSERT
  TO authenticated
  WITH CHECK (
    is_user_active(auth.uid())
    AND (
      get_current_user_role() = 'admin'
      OR has_permission(auth.uid(), 'board', 'criar')
    )
  );

CREATE POLICY "boards_update"
  ON boards FOR UPDATE
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'board', 'editar')
  );

CREATE POLICY "boards_delete"
  ON boards FOR DELETE
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'board', 'deletar')
  );

-- ------------------------------------------------------------------------
-- 5. RLS em board_stages (mesma permissão do board pai)
-- ------------------------------------------------------------------------
ALTER TABLE board_stages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "board_stages_select"
  ON board_stages FOR SELECT
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'board', 'ver')
  );

CREATE POLICY "board_stages_insert"
  ON board_stages FOR INSERT
  TO authenticated
  WITH CHECK (
    is_user_active(auth.uid())
    AND (
      get_current_user_role() = 'admin'
      OR has_permission(auth.uid(), 'board', 'editar')
    )
  );

CREATE POLICY "board_stages_update"
  ON board_stages FOR UPDATE
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'board', 'editar')
  );

CREATE POLICY "board_stages_delete"
  ON board_stages FOR DELETE
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'board', 'editar')
  );

-- ------------------------------------------------------------------------
-- 6. RLS em board_items (movimentação = editar contato)
-- ------------------------------------------------------------------------
ALTER TABLE board_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "board_items_select"
  ON board_items FOR SELECT
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'board', 'ver')
  );

CREATE POLICY "board_items_insert"
  ON board_items FOR INSERT
  TO authenticated
  WITH CHECK (
    is_user_active(auth.uid())
    AND (
      get_current_user_role() = 'admin'
      OR has_permission(auth.uid(), 'board', 'editar')
      OR has_permission(auth.uid(), 'board', 'criar')
    )
  );

CREATE POLICY "board_items_update"
  ON board_items FOR UPDATE
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'board', 'editar')
  );

CREATE POLICY "board_items_delete"
  ON board_items FOR DELETE
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'board', 'editar')
    OR has_permission(auth.uid(), 'board', 'deletar')
  );

-- ------------------------------------------------------------------------
-- 7. Seed das permissões padrão para a nova seção 'board'
--    Alinhado ao padrão de 'campanha' (012) e 'etiquetas'.
-- ------------------------------------------------------------------------
INSERT INTO permissoes_perfil (role, secao, pode_ver, pode_criar, pode_editar, pode_deletar, so_proprio) VALUES
  ('admin',        'board', TRUE,  TRUE,  TRUE,  TRUE,  FALSE),
  ('proprietario', 'board', TRUE,  TRUE,  TRUE,  TRUE,  FALSE),
  ('assessor',     'board', TRUE,  TRUE,  TRUE,  FALSE, FALSE),
  ('assistente',   'board', TRUE,  FALSE, TRUE,  FALSE, FALSE),
  ('estagiario',   'board', TRUE,  FALSE, FALSE, FALSE, FALSE)
ON CONFLICT (role, secao) DO NOTHING;

-- ------------------------------------------------------------------------
-- 8. Seed inicial: board padrão "Seguidores" com 6 estágios
-- ------------------------------------------------------------------------
DO $$
DECLARE
  v_board_id UUID;
BEGIN
  -- Só cria se ainda não existir nenhum board
  IF NOT EXISTS (SELECT 1 FROM boards LIMIT 1) THEN
    INSERT INTO boards (nome, descricao, tipo_entidade, is_default)
    VALUES ('Seguidores', 'Jornada do eleitor — do primeiro contato ao multiplicador', 'contact', TRUE)
    RETURNING id INTO v_board_id;

    INSERT INTO board_stages (board_id, nome, ordem, cor) VALUES
      (v_board_id, 'Novo Seguidor',       0, 'sky'),
      (v_board_id, 'Pediu Formulário',    1, 'violet'),
      (v_board_id, 'Preencheu Formulário',2, 'indigo'),
      (v_board_id, 'Contato Feito',       3, 'emerald'),
      (v_board_id, 'Declarou Voto',       4, 'amber'),
      (v_board_id, 'Multiplicador',       5, 'rose');
  END IF;
END $$;
