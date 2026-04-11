-- ========================================================================
-- 009_tag_groups.sql
-- Substitui o ENUM tag_category por uma tabela tag_groups dinâmica
-- com limite máximo de 7 grupos.
--
-- Nota: o schema real usa colunas em português (nome, categoria, cor).
-- ========================================================================

-- 1. Tabela de grupos
CREATE TABLE IF NOT EXISTS tag_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tag_groups_ordem ON tag_groups(ordem);

CREATE TRIGGER tag_groups_updated_at
  BEFORE UPDATE ON tag_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 2. Trigger de limite máximo de 7 grupos
CREATE OR REPLACE FUNCTION enforce_tag_group_limit()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM tag_groups) >= 7 THEN
    RAISE EXCEPTION 'Limite máximo de 7 grupos de etiquetas atingido';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tag_groups_limit_check
  BEFORE INSERT ON tag_groups
  FOR EACH ROW
  EXECUTE FUNCTION enforce_tag_group_limit();

-- 3. Seed dos 4 grupos iniciais (protegidos contra delete/rename)
INSERT INTO tag_groups (slug, label, ordem, is_system) VALUES
  ('geral',           'Geral',           0, TRUE),
  ('profissionais',   'Profissionais',   1, TRUE),
  ('relacionamentos', 'Relacionamentos', 2, TRUE),
  ('demandas',        'Demandas',        3, TRUE)
ON CONFLICT (slug) DO NOTHING;

-- 4. Adicionar coluna group_id em tags (nullable por enquanto para o backfill)
ALTER TABLE tags ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES tag_groups(id) ON DELETE RESTRICT;

-- 5. Backfill: mapeia categoria antigo (ENUM) para o novo group_id
UPDATE tags t SET group_id = g.id
FROM tag_groups g
WHERE t.group_id IS NULL AND (
  (t.categoria::text = 'geral'         AND g.slug = 'geral')           OR
  (t.categoria::text = 'professionals' AND g.slug = 'profissionais')   OR
  (t.categoria::text = 'relationships' AND g.slug = 'relacionamentos') OR
  (t.categoria::text = 'demands'       AND g.slug = 'demandas')
);

-- Salvaguarda: qualquer tag sem match vai para 'geral'
UPDATE tags SET group_id = (SELECT id FROM tag_groups WHERE slug = 'geral')
WHERE group_id IS NULL;

-- 6. Tornar group_id NOT NULL após o backfill
ALTER TABLE tags ALTER COLUMN group_id SET NOT NULL;

-- 7. Remover a constraint antiga UNIQUE (nome, categoria) e recriar por (nome, group_id)
ALTER TABLE tags DROP CONSTRAINT IF EXISTS tags_name_category_key;
ALTER TABLE tags ADD CONSTRAINT tags_nome_group_id_key UNIQUE (nome, group_id);

-- 8. Remover a coluna categoria antiga e o enum
DROP INDEX IF EXISTS idx_tags_category;
ALTER TABLE tags DROP COLUMN IF EXISTS categoria;
DROP TYPE IF EXISTS tag_category;

-- 9. Novo índice
CREATE INDEX IF NOT EXISTS idx_tags_group_id ON tags(group_id);

-- 10. RLS na tabela tag_groups (usa helpers existentes)
ALTER TABLE tag_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tag_groups_select"
  ON tag_groups FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "tag_groups_insert"
  ON tag_groups FOR INSERT
  TO authenticated
  WITH CHECK (
    is_user_active(auth.uid())
    AND (
      get_current_user_role() = 'admin'
      OR has_permission(auth.uid(), 'etiquetas', 'criar')
    )
  );

CREATE POLICY "tag_groups_update"
  ON tag_groups FOR UPDATE
  TO authenticated
  USING (
    is_system = FALSE
    AND (
      get_current_user_role() = 'admin'
      OR has_permission(auth.uid(), 'etiquetas', 'editar')
    )
  );

CREATE POLICY "tag_groups_delete"
  ON tag_groups FOR DELETE
  TO authenticated
  USING (
    is_system = FALSE
    AND (
      get_current_user_role() = 'admin'
      OR has_permission(auth.uid(), 'etiquetas', 'deletar')
    )
  );
