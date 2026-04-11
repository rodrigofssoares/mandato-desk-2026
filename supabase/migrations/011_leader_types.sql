-- ========================================================================
-- 011_leader_types.sql
-- Substitui o ENUM leadership_type por uma tabela leader_types dinâmica.
-- Usuários podem criar/editar/excluir tipos customizados (mesmo padrão de
-- tag_groups). Tipos de sistema (is_system = TRUE) não podem ser removidos
-- nem renomeados. Adiciona "Cabo Eleitoral" como novo tipo padrão.
-- ========================================================================

-- 1. Tabela de tipos
CREATE TABLE IF NOT EXISTS leader_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_leader_types_ordem ON leader_types(ordem);

CREATE TRIGGER leader_types_updated_at
  BEFORE UPDATE ON leader_types
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 2. Seed dos tipos de sistema (cabo_eleitoral em ordem 0)
INSERT INTO leader_types (slug, label, ordem, is_system) VALUES
  ('cabo_eleitoral',       'Cabo Eleitoral',       0,  TRUE),
  ('assessor_parlamentar', 'Assessor Parlamentar', 1,  TRUE),
  ('lider_regional',       'Líder Regional',       2,  TRUE),
  ('coordenador_area',     'Coordenador de Área',  3,  TRUE),
  ('mobilizador',          'Mobilizador',          4,  TRUE),
  ('multiplicador',        'Multiplicador',        5,  TRUE),
  ('outro',                'Outro',                99, TRUE)
ON CONFLICT (slug) DO NOTHING;

-- 3. Adicionar coluna leader_type_id em leaders (nullable para o backfill)
ALTER TABLE leaders ADD COLUMN IF NOT EXISTS leader_type_id UUID
  REFERENCES leader_types(id) ON DELETE RESTRICT;

-- 4. Backfill: mapear o enum atual para o novo FK
UPDATE leaders l SET leader_type_id = lt.id
FROM leader_types lt
WHERE l.leader_type_id IS NULL
  AND lt.slug = l.leadership_type::text;

-- Salvaguarda: qualquer registro sem match vai pra 'outro'
UPDATE leaders SET leader_type_id = (SELECT id FROM leader_types WHERE slug = 'outro')
WHERE leader_type_id IS NULL;

-- 5. NOT NULL após o backfill. (Postgres não aceita subquery em DEFAULT —
-- o app sempre envia leader_type_id explicitamente, então o default é
-- resolvido na camada do frontend, apontando para o tipo "cabo_eleitoral".)
ALTER TABLE leaders ALTER COLUMN leader_type_id SET NOT NULL;

-- 6. Drop coluna antiga + índice + enum
DROP INDEX IF EXISTS idx_leaders_leadership_type;
ALTER TABLE leaders DROP COLUMN IF EXISTS leadership_type;
DROP TYPE IF EXISTS leadership_type;

-- 7. Novo índice
CREATE INDEX IF NOT EXISTS idx_leaders_leader_type_id ON leaders(leader_type_id);

-- 8. RLS (mesmo padrão de tag_groups, usando resource 'liderancas')
ALTER TABLE leader_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "leader_types_select"
  ON leader_types FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "leader_types_insert"
  ON leader_types FOR INSERT
  TO authenticated
  WITH CHECK (
    is_user_active(auth.uid())
    AND (
      get_current_user_role() = 'admin'
      OR has_permission(auth.uid(), 'liderancas', 'criar')
    )
  );

CREATE POLICY "leader_types_update"
  ON leader_types FOR UPDATE
  TO authenticated
  USING (
    is_system = FALSE
    AND (
      get_current_user_role() = 'admin'
      OR has_permission(auth.uid(), 'liderancas', 'editar')
    )
  );

CREATE POLICY "leader_types_delete"
  ON leader_types FOR DELETE
  TO authenticated
  USING (
    is_system = FALSE
    AND (
      get_current_user_role() = 'admin'
      OR has_permission(auth.uid(), 'liderancas', 'deletar')
    )
  );
