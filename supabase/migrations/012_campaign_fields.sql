-- ========================================================================
-- 012_campaign_fields.sql
-- Campos customizáveis de Campanha Eleitoral
--
-- Administradores, proprietários e assessores podem criar checkboxes
-- customizados (ex: "Enviou material físico") que aparecem na aba
-- "Campanha" do cartão de contato para toda a equipe marcar sim/não.
--
-- Os campos podem ser reordenados (coluna `ordem`) e usados como filtro
-- na lista de contatos.
-- ========================================================================

-- ------------------------------------------------------------------------
-- 1. Tabela de definição dos campos
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campaign_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campaign_fields_ordem ON campaign_fields(ordem);

CREATE TRIGGER campaign_fields_updated_at
  BEFORE UPDATE ON campaign_fields
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------
-- 2. Tabela de valores por contato
--    (apenas os campos marcados como true geram linha)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contact_campaign_values (
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  campaign_field_id UUID NOT NULL REFERENCES campaign_fields(id) ON DELETE CASCADE,
  valor BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (contact_id, campaign_field_id)
);

CREATE INDEX IF NOT EXISTS idx_ccv_field ON contact_campaign_values(campaign_field_id);
CREATE INDEX IF NOT EXISTS idx_ccv_contact ON contact_campaign_values(contact_id);

CREATE TRIGGER contact_campaign_values_updated_at
  BEFORE UPDATE ON contact_campaign_values
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------
-- 3. RLS em campaign_fields (mesmo padrão de tag_groups)
-- ------------------------------------------------------------------------
ALTER TABLE campaign_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campaign_fields_select"
  ON campaign_fields FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "campaign_fields_insert"
  ON campaign_fields FOR INSERT
  TO authenticated
  WITH CHECK (
    is_user_active(auth.uid())
    AND (
      get_current_user_role() = 'admin'
      OR has_permission(auth.uid(), 'campanha', 'criar')
    )
  );

CREATE POLICY "campaign_fields_update"
  ON campaign_fields FOR UPDATE
  TO authenticated
  USING (
    is_system = FALSE
    AND (
      get_current_user_role() = 'admin'
      OR has_permission(auth.uid(), 'campanha', 'editar')
    )
  );

CREATE POLICY "campaign_fields_delete"
  ON campaign_fields FOR DELETE
  TO authenticated
  USING (
    is_system = FALSE
    AND (
      get_current_user_role() = 'admin'
      OR has_permission(auth.uid(), 'campanha', 'deletar')
    )
  );

-- ------------------------------------------------------------------------
-- 4. RLS em contact_campaign_values
--    (marca/desmarca depende de permissão de editar contato)
-- ------------------------------------------------------------------------
ALTER TABLE contact_campaign_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ccv_select"
  ON contact_campaign_values FOR SELECT
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'contatos', 'ver')
  );

CREATE POLICY "ccv_insert"
  ON contact_campaign_values FOR INSERT
  TO authenticated
  WITH CHECK (
    is_user_active(auth.uid())
    AND (
      get_current_user_role() = 'admin'
      OR has_permission(auth.uid(), 'contatos', 'editar')
      OR has_permission(auth.uid(), 'contatos', 'criar')
    )
  );

CREATE POLICY "ccv_update"
  ON contact_campaign_values FOR UPDATE
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'contatos', 'editar')
  );

CREATE POLICY "ccv_delete"
  ON contact_campaign_values FOR DELETE
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'contatos', 'editar')
  );

-- ------------------------------------------------------------------------
-- 5. Seed das permissões padrão para a nova seção 'campanha'
--    Alinhado ao padrão da seção 'etiquetas' / 'liderancas'.
-- ------------------------------------------------------------------------
INSERT INTO permissoes_perfil (role, secao, pode_ver, pode_criar, pode_editar, pode_deletar, so_proprio) VALUES
  ('admin',        'campanha', TRUE,  TRUE,  TRUE,  TRUE,  FALSE),
  ('proprietario', 'campanha', TRUE,  TRUE,  TRUE,  TRUE,  FALSE),
  ('assessor',     'campanha', TRUE,  TRUE,  TRUE,  TRUE,  FALSE),
  ('assistente',   'campanha', TRUE,  FALSE, FALSE, FALSE, FALSE),
  ('estagiario',   'campanha', TRUE,  FALSE, FALSE, FALSE, FALSE)
ON CONFLICT (role, secao) DO NOTHING;
