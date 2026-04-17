-- RAQ-MAND-EM025: Personalização de layout do dashboard por usuário
--
-- Contexto:
--   Usuários com permissão podem mover e redimensionar widgets do dashboard.
--   O layout customizado precisa ser persistido por usuário.
--
-- O que esta migration faz:
--   1. Cria tabela `user_dashboard_layouts` — um registro por usuário com o
--      layout customizado serializado em JSONB (compatível com react-grid-layout).
--   2. Habilita RLS restringindo leitura e escrita ao próprio registro.
--   3. Atualiza `permissoes_perfil` para liberar `pode_editar` na seção
--      `dashboard` para o perfil `assessor` (admin e proprietário já têm).

-- ==================== TABELA ====================
CREATE TABLE IF NOT EXISTS user_dashboard_layouts (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  layout JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_dashboard_layouts_updated_at
  ON user_dashboard_layouts (updated_at DESC);

-- ==================== RLS ====================
ALTER TABLE user_dashboard_layouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_dashboard_layouts_select_own" ON user_dashboard_layouts;
CREATE POLICY "user_dashboard_layouts_select_own"
  ON user_dashboard_layouts
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_dashboard_layouts_insert_own" ON user_dashboard_layouts;
CREATE POLICY "user_dashboard_layouts_insert_own"
  ON user_dashboard_layouts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_dashboard_layouts_update_own" ON user_dashboard_layouts;
CREATE POLICY "user_dashboard_layouts_update_own"
  ON user_dashboard_layouts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_dashboard_layouts_delete_own" ON user_dashboard_layouts;
CREATE POLICY "user_dashboard_layouts_delete_own"
  ON user_dashboard_layouts
  FOR DELETE
  USING (auth.uid() = user_id);

-- ==================== TRIGGER updated_at ====================
CREATE OR REPLACE FUNCTION set_user_dashboard_layouts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_dashboard_layouts_updated_at ON user_dashboard_layouts;
CREATE TRIGGER trg_user_dashboard_layouts_updated_at
  BEFORE UPDATE ON user_dashboard_layouts
  FOR EACH ROW
  EXECUTE FUNCTION set_user_dashboard_layouts_updated_at();

-- ==================== RBAC: assessor pode editar layout do dashboard ====================
UPDATE permissoes_perfil
SET pode_editar = TRUE
WHERE secao = 'dashboard' AND role = 'assessor';
