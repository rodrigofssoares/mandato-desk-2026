-- Migration 030: Checklist orientativo + templates de mensagem por etapa do funil
-- ===========================================================================
-- Adiciona 3 tabelas relacionadas a board_stages para que admins possam
-- configurar passo a passo (tarefas, anexos, links) e templates de mensagem
-- WhatsApp que o atendente verá num popup ao consultar a etapa no Kanban.
--
-- RLS espelha board_stages: SELECT exige board.ver, mutações exigem board.editar.
-- ===========================================================================

-- ------------------------------------------------------------------------
-- 1. Tabela: stage_checklist_items (tarefas do passo a passo)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stage_checklist_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id    UUID NOT NULL REFERENCES board_stages(id) ON DELETE CASCADE,
  texto       TEXT NOT NULL,
  descricao   TEXT,
  ordem       INTEGER NOT NULL DEFAULT 0,
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stage_checklist_items_stage_ordem
  ON stage_checklist_items(stage_id, ordem);

CREATE TRIGGER trg_stage_checklist_items_updated_at
  BEFORE UPDATE ON stage_checklist_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------
-- 2. Tabela: stage_checklist_attachments (anexos polimórficos por tarefa)
--    tipo IN ('imagem','video','link')
--    storage_path => para imagem/video; url_externa => para link
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stage_checklist_attachments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id         UUID NOT NULL REFERENCES stage_checklist_items(id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL,
  storage_path    TEXT,
  url_externa     TEXT,
  nome_original   TEXT,
  mime_type       TEXT,
  tamanho_bytes   BIGINT,
  rotulo          TEXT,
  ordem           INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT scl_att_tipo_check CHECK (tipo IN ('imagem','video','link')),
  CONSTRAINT scl_att_payload_check CHECK (
    (tipo IN ('imagem','video') AND storage_path IS NOT NULL AND url_externa IS NULL)
    OR (tipo = 'link' AND url_externa IS NOT NULL AND storage_path IS NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_scl_attachments_item_ordem
  ON stage_checklist_attachments(item_id, ordem);

-- ------------------------------------------------------------------------
-- 3. Tabela: stage_message_templates (templates ligados à etapa)
--    conteudo é texto literal — preserva *_~ do WhatsApp; nunca render markdown.
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS stage_message_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stage_id    UUID NOT NULL REFERENCES board_stages(id) ON DELETE CASCADE,
  titulo      TEXT NOT NULL,
  conteudo    TEXT NOT NULL,
  ordem       INTEGER NOT NULL DEFAULT 0,
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stage_message_templates_stage_ordem
  ON stage_message_templates(stage_id, ordem);

CREATE TRIGGER trg_stage_message_templates_updated_at
  BEFORE UPDATE ON stage_message_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------
-- 4. RLS: stage_checklist_items
-- ------------------------------------------------------------------------
ALTER TABLE stage_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stage_checklist_items_select"
  ON stage_checklist_items FOR SELECT
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'board', 'ver')
  );

CREATE POLICY "stage_checklist_items_insert"
  ON stage_checklist_items FOR INSERT
  TO authenticated
  WITH CHECK (
    is_user_active(auth.uid())
    AND (
      get_current_user_role() = 'admin'
      OR has_permission(auth.uid(), 'board', 'editar')
    )
  );

CREATE POLICY "stage_checklist_items_update"
  ON stage_checklist_items FOR UPDATE
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'board', 'editar')
  );

CREATE POLICY "stage_checklist_items_delete"
  ON stage_checklist_items FOR DELETE
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'board', 'editar')
  );

-- ------------------------------------------------------------------------
-- 5. RLS: stage_checklist_attachments
--    Herda permissão via item_id (subquery em board_stages não é necessária:
--    o próprio papel 'board' já gate o item).
-- ------------------------------------------------------------------------
ALTER TABLE stage_checklist_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "scl_att_select"
  ON stage_checklist_attachments FOR SELECT
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'board', 'ver')
  );

CREATE POLICY "scl_att_insert"
  ON stage_checklist_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    is_user_active(auth.uid())
    AND (
      get_current_user_role() = 'admin'
      OR has_permission(auth.uid(), 'board', 'editar')
    )
  );

CREATE POLICY "scl_att_update"
  ON stage_checklist_attachments FOR UPDATE
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'board', 'editar')
  );

CREATE POLICY "scl_att_delete"
  ON stage_checklist_attachments FOR DELETE
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'board', 'editar')
  );

-- ------------------------------------------------------------------------
-- 6. RLS: stage_message_templates
-- ------------------------------------------------------------------------
ALTER TABLE stage_message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stage_message_templates_select"
  ON stage_message_templates FOR SELECT
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'board', 'ver')
  );

CREATE POLICY "stage_message_templates_insert"
  ON stage_message_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    is_user_active(auth.uid())
    AND (
      get_current_user_role() = 'admin'
      OR has_permission(auth.uid(), 'board', 'editar')
    )
  );

CREATE POLICY "stage_message_templates_update"
  ON stage_message_templates FOR UPDATE
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'board', 'editar')
  );

CREATE POLICY "stage_message_templates_delete"
  ON stage_message_templates FOR DELETE
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'board', 'editar')
  );

-- ------------------------------------------------------------------------
-- 7. Storage bucket: stage-checklist (privado, signed URLs)
--    Limite 50 MB por arquivo. MIME types liberados via client-side (Zod).
-- ------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'stage-checklist',
  'stage-checklist',
  FALSE,
  52428800, -- 50 MB
  ARRAY['image/jpeg','image/png','image/webp','video/mp4','video/webm']::TEXT[]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Policies do bucket
DROP POLICY IF EXISTS "stage_checklist_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "stage_checklist_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "stage_checklist_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "stage_checklist_storage_delete" ON storage.objects;

CREATE POLICY "stage_checklist_storage_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'stage-checklist'
    AND (
      get_current_user_role() = 'admin'
      OR has_permission(auth.uid(), 'board', 'ver')
    )
  );

CREATE POLICY "stage_checklist_storage_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'stage-checklist'
    AND is_user_active(auth.uid())
    AND (
      get_current_user_role() = 'admin'
      OR has_permission(auth.uid(), 'board', 'editar')
    )
  );

CREATE POLICY "stage_checklist_storage_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'stage-checklist'
    AND (
      get_current_user_role() = 'admin'
      OR has_permission(auth.uid(), 'board', 'editar')
    )
  );

CREATE POLICY "stage_checklist_storage_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'stage-checklist'
    AND (
      get_current_user_role() = 'admin'
      OR has_permission(auth.uid(), 'board', 'editar')
    )
  );

-- ------------------------------------------------------------------------
-- 8. Comentários (documentação inline para as tabelas)
-- ------------------------------------------------------------------------
COMMENT ON TABLE  stage_checklist_items
  IS 'Tarefas do passo a passo orientativo de uma etapa do funil';
COMMENT ON TABLE  stage_checklist_attachments
  IS 'Anexos das tarefas: imagem/video em storage ou link externo';
COMMENT ON TABLE  stage_message_templates
  IS 'Templates de mensagem WhatsApp por etapa — texto literal preservado';

COMMENT ON COLUMN stage_message_templates.conteudo
  IS 'Texto literal — preservar *_~ do padrão WhatsApp; nunca render markdown';
COMMENT ON COLUMN stage_checklist_attachments.tipo
  IS 'imagem | video | link';
