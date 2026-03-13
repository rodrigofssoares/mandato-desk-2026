-- Adicionar campos de personalização: foto e nome do político
ALTER TABLE branding_settings ADD COLUMN IF NOT EXISTS politician_name TEXT NOT NULL DEFAULT '';
ALTER TABLE branding_settings ADD COLUMN IF NOT EXISTS politician_photo_url TEXT;

-- Permitir assessor (além de admin) editar branding
DROP POLICY IF EXISTS "branding_settings_update" ON branding_settings;
CREATE POLICY "branding_settings_update"
  ON branding_settings FOR UPDATE
  TO authenticated
  USING (
    get_current_user_role() IN ('admin', 'assessor')
  );

-- Permitir assessor inserir branding (caso a tabela esteja vazia)
DROP POLICY IF EXISTS "branding_settings_insert" ON branding_settings;
CREATE POLICY "branding_settings_insert"
  ON branding_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    get_current_user_role() IN ('admin', 'assessor')
  );

-- Criar bucket de storage para branding (logos, fotos)
INSERT INTO storage.buckets (id, name, public)
VALUES ('branding', 'branding', true)
ON CONFLICT (id) DO NOTHING;

-- Política: qualquer autenticado pode ver arquivos do bucket branding
CREATE POLICY "branding_storage_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'branding');

-- Política: admin e assessor podem fazer upload
CREATE POLICY "branding_storage_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'branding'
    AND (SELECT get_current_user_role()) IN ('admin', 'assessor')
  );

-- Política: admin e assessor podem atualizar (substituir foto)
CREATE POLICY "branding_storage_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'branding'
    AND (SELECT get_current_user_role()) IN ('admin', 'assessor')
  );

-- Política: admin e assessor podem deletar
CREATE POLICY "branding_storage_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'branding'
    AND (SELECT get_current_user_role()) IN ('admin', 'assessor')
  );
