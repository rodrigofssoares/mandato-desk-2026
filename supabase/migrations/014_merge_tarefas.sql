-- ========================================================================
-- 014_merge_tarefas.sql
-- Tarefas agendadas (ligação, reunião, visita, WhatsApp, email, tarefa)
--
-- Parte do merge Nosso CRM → Mandato Desk 2026 (issue 11-func-schema-tarefas).
--
-- ⚠️ NÃO CONFUNDIR com a tabela `activities` existente, que é o audit log
-- do sistema. Aqui estamos criando tarefas agendadas (to-do) vinculadas a
-- contatos, articuladores, demandas ou cards de boards.
-- ========================================================================

-- ------------------------------------------------------------------------
-- 1. Enum de tipo de tarefa
-- ------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE tarefa_tipo AS ENUM (
    'LIGACAO',
    'REUNIAO',
    'VISITA',
    'WHATSAPP',
    'EMAIL',
    'TAREFA'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ------------------------------------------------------------------------
-- 2. Tabela tarefas
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tarefas (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo         TEXT NOT NULL,
  descricao      TEXT,
  tipo           tarefa_tipo NOT NULL DEFAULT 'TAREFA',
  data_agendada  TIMESTAMPTZ,
  concluida      BOOLEAN NOT NULL DEFAULT FALSE,
  concluida_em   TIMESTAMPTZ,
  responsavel_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  contact_id     UUID REFERENCES contacts(id) ON DELETE SET NULL,
  leader_id      UUID REFERENCES leaders(id) ON DELETE SET NULL,
  demand_id      UUID REFERENCES demands(id) ON DELETE SET NULL,
  board_item_id  UUID REFERENCES board_items(id) ON DELETE SET NULL,
  created_by     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para queries comuns
CREATE INDEX IF NOT EXISTS idx_tarefas_data_agendada
  ON tarefas(data_agendada)
  WHERE NOT concluida;

CREATE INDEX IF NOT EXISTS idx_tarefas_responsavel
  ON tarefas(responsavel_id)
  WHERE NOT concluida;

CREATE INDEX IF NOT EXISTS idx_tarefas_contact ON tarefas(contact_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_leader ON tarefas(leader_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_demand ON tarefas(demand_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_board_item ON tarefas(board_item_id);
CREATE INDEX IF NOT EXISTS idx_tarefas_concluida ON tarefas(concluida);

CREATE TRIGGER tarefas_updated_at
  BEFORE UPDATE ON tarefas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------
-- 3. Trigger para setar concluida_em automaticamente
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION tarefas_set_concluida_em()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.concluida = TRUE AND OLD.concluida = FALSE THEN
    NEW.concluida_em := now();
  ELSIF NEW.concluida = FALSE AND OLD.concluida = TRUE THEN
    NEW.concluida_em := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tarefas_concluida_em_trigger
  BEFORE UPDATE ON tarefas
  FOR EACH ROW
  EXECUTE FUNCTION tarefas_set_concluida_em();

-- ------------------------------------------------------------------------
-- 4. RLS em tarefas
-- ------------------------------------------------------------------------
ALTER TABLE tarefas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tarefas_select"
  ON tarefas FOR SELECT
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'tarefas', 'ver')
  );

CREATE POLICY "tarefas_insert"
  ON tarefas FOR INSERT
  TO authenticated
  WITH CHECK (
    is_user_active(auth.uid())
    AND (
      get_current_user_role() = 'admin'
      OR has_permission(auth.uid(), 'tarefas', 'criar')
    )
  );

-- Update: admin, quem tem permissão ampla, ou o próprio responsável
CREATE POLICY "tarefas_update"
  ON tarefas FOR UPDATE
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'tarefas', 'editar')
    OR responsavel_id = auth.uid()
  );

CREATE POLICY "tarefas_delete"
  ON tarefas FOR DELETE
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'tarefas', 'deletar')
    OR (responsavel_id = auth.uid()
        AND has_permission(auth.uid(), 'tarefas', 'editar'))
  );

-- ------------------------------------------------------------------------
-- 5. Seed das permissões padrão para a nova seção 'tarefas'
--    Tarefas são operacionais: todos criam/editam as próprias, apenas
--    admin/proprietário deletam em geral.
-- ------------------------------------------------------------------------
INSERT INTO permissoes_perfil (role, secao, pode_ver, pode_criar, pode_editar, pode_deletar, so_proprio) VALUES
  ('admin',        'tarefas', TRUE, TRUE, TRUE, TRUE,  FALSE),
  ('proprietario', 'tarefas', TRUE, TRUE, TRUE, TRUE,  FALSE),
  ('assessor',     'tarefas', TRUE, TRUE, TRUE, FALSE, FALSE),
  ('assistente',   'tarefas', TRUE, TRUE, TRUE, FALSE, TRUE),
  ('estagiario',   'tarefas', TRUE, TRUE, TRUE, FALSE, TRUE)
ON CONFLICT (role, secao) DO NOTHING;
