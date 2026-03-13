-- ============================================================
-- Mandato Desk 2026 — Complete Schema Migration
-- Generated: 2026-03-13
-- ============================================================

-- ============================================================
-- 1. ENUMS
-- ============================================================

CREATE TYPE demand_status AS ENUM ('open', 'in_progress', 'resolved');
CREATE TYPE demand_priority AS ENUM ('low', 'medium', 'high');
CREATE TYPE tag_category AS ENUM ('professionals', 'relationships', 'demands');
CREATE TYPE activity_type AS ENUM ('create', 'update', 'delete', 'status_change', 'assignment', 'import', 'merge', 'bulk_delete');
CREATE TYPE app_role AS ENUM ('admin', 'user');
CREATE TYPE leadership_type AS ENUM ('assessor_parlamentar', 'lider_regional', 'coordenador_area', 'mobilizador', 'outro');
CREATE TYPE sync_status_type AS ENUM ('pending', 'synced', 'error', 'conflict');
CREATE TYPE sync_direction_type AS ENUM ('crm_to_google', 'google_to_crm', 'bidirectional');


-- ============================================================
-- 2. UTILITY FUNCTIONS
-- ============================================================

-- Strip non-digit characters from phone numbers
CREATE OR REPLACE FUNCTION normalize_phone(phone_number TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  RETURN regexp_replace(phone_number, '[^0-9]', '', 'g');
END;
$$;

-- Auto-update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Check if a user is active (status_aprovacao = 'ATIVO')
CREATE OR REPLACE FUNCTION is_user_active(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = user_id
      AND status_aprovacao = 'ATIVO'
  );
END;
$$;

-- Check if user has a specific role (checks profiles table)
CREATE OR REPLACE FUNCTION has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  IF _role::text = 'admin' THEN
    RETURN EXISTS (
      SELECT 1 FROM profiles
      WHERE id = _user_id AND role = 'admin' AND status_aprovacao = 'ATIVO'
    );
  ELSE
    RETURN EXISTS (
      SELECT 1 FROM profiles
      WHERE id = _user_id AND status_aprovacao = 'ATIVO'
    );
  END IF;
END;
$$;

-- Check if user has permission on a module/action via profiles.role + permissoes_perfil
CREATE OR REPLACE FUNCTION has_permission(_user_id UUID, _module TEXT, _action TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  _role TEXT;
  _perm RECORD;
BEGIN
  -- Get the user's role from profiles
  SELECT role INTO _role FROM profiles WHERE id = _user_id;
  IF _role IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Admin always has full access
  IF _role = 'admin' THEN
    RETURN TRUE;
  END IF;

  -- Look up the permission for this role + module (secao)
  SELECT * INTO _perm
  FROM permissoes_perfil
  WHERE permissoes_perfil.role = _role
    AND secao = _module;

  IF _perm IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Check the specific action
  CASE _action
    WHEN 'ver' THEN RETURN _perm.pode_ver;
    WHEN 'criar' THEN RETURN _perm.pode_criar;
    WHEN 'editar' THEN RETURN _perm.pode_editar;
    WHEN 'deletar' THEN RETURN _perm.pode_deletar;
    ELSE RETURN FALSE;
  END CASE;
END;
$$;

-- Get current authenticated user's role from profiles
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  _role TEXT;
BEGIN
  SELECT role INTO _role FROM profiles WHERE id = auth.uid();
  RETURN COALESCE(_role, 'assistente');
END;
$$;

-- Generate a random API token (64 hex chars)
CREATE OR REPLACE FUNCTION generate_api_token()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'hex');
END;
$$;

-- Find duplicate contacts based on name, phone, or email
CREATE OR REPLACE FUNCTION get_duplicate_contacts()
RETURNS TABLE (
  contact_id UUID,
  duplicate_of UUID,
  match_field TEXT,
  match_value TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  -- Duplicates by normalized phone
  RETURN QUERY
  SELECT
    c1.id AS contact_id,
    c2.id AS duplicate_of,
    'phone'::TEXT AS match_field,
    c1.phone AS match_value
  FROM contacts c1
  JOIN contacts c2
    ON normalize_phone(c1.phone) = normalize_phone(c2.phone)
    AND c1.id > c2.id
    AND c1.phone IS NOT NULL
    AND c1.phone != ''
    AND c1.merged_into IS NULL
    AND c2.merged_into IS NULL;

  -- Duplicates by email
  RETURN QUERY
  SELECT
    c1.id AS contact_id,
    c2.id AS duplicate_of,
    'email'::TEXT AS match_field,
    c1.email AS match_value
  FROM contacts c1
  JOIN contacts c2
    ON lower(trim(c1.email)) = lower(trim(c2.email))
    AND c1.id > c2.id
    AND c1.email IS NOT NULL
    AND c1.email != ''
    AND c1.merged_into IS NULL
    AND c2.merged_into IS NULL;

  -- Duplicates by full name
  RETURN QUERY
  SELECT
    c1.id AS contact_id,
    c2.id AS duplicate_of,
    'name'::TEXT AS match_field,
    c1.name AS match_value
  FROM contacts c1
  JOIN contacts c2
    ON lower(trim(c1.name)) = lower(trim(c2.name))
    AND c1.id > c2.id
    AND c1.name IS NOT NULL
    AND c1.name != ''
    AND c1.merged_into IS NULL
    AND c2.merged_into IS NULL;
END;
$$;


-- ============================================================
-- 3. TABLES
-- ============================================================

-- ----- profiles -----
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  name TEXT,
  email TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'assistente',
  status_aprovacao TEXT NOT NULL DEFAULT 'PENDENTE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Auto-create profile on new user signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'name', NEW.raw_user_meta_data ->> 'full_name', ''),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ----- leaders -----
CREATE TABLE leaders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  leadership_type leadership_type NOT NULL DEFAULT 'outro',
  region TEXT,
  city TEXT,
  neighborhoods TEXT[],
  whatsapp TEXT,
  email TEXT,
  phone TEXT,
  birth_date DATE,
  address TEXT,
  instagram TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER leaders_updated_at
  BEFORE UPDATE ON leaders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ----- contacts -----
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  cpf TEXT,
  birth_date DATE,
  gender TEXT,
  -- Address / geo
  zip_code TEXT,
  address TEXT,
  number TEXT,
  complement TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  -- Social
  instagram TEXT,
  facebook TEXT,
  twitter TEXT,
  -- Political fields
  declarou_voto BOOLEAN DEFAULT FALSE,
  is_favorite BOOLEAN DEFAULT FALSE,
  voter_registration TEXT,
  electoral_zone TEXT,
  electoral_section TEXT,
  political_group TEXT,
  notes TEXT,
  -- Google Contacts sync
  google_contact_id TEXT,
  google_resource_name TEXT,
  google_etag TEXT,
  google_last_synced_at TIMESTAMPTZ,
  -- Merge tracking
  merged_into UUID REFERENCES contacts(id) ON DELETE SET NULL,
  merged_from UUID[],
  merge_count INTEGER DEFAULT 0,
  -- Relationships
  leader_id UUID REFERENCES leaders(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- Metadata
  last_contact TIMESTAMPTZ,
  source TEXT,
  occupation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Contacts indexes
CREATE INDEX idx_contacts_is_favorite ON contacts(is_favorite) WHERE is_favorite = TRUE;
CREATE INDEX idx_contacts_declarou_voto ON contacts(declarou_voto) WHERE declarou_voto = TRUE;
CREATE INDEX idx_contacts_google_contact_id ON contacts(google_contact_id) WHERE google_contact_id IS NOT NULL;
CREATE INDEX idx_contacts_birth_date ON contacts(birth_date) WHERE birth_date IS NOT NULL;
CREATE INDEX idx_contacts_leader_id ON contacts(leader_id) WHERE leader_id IS NOT NULL;
CREATE INDEX idx_contacts_lat_lng ON contacts(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
CREATE INDEX idx_contacts_zip_code ON contacts(zip_code) WHERE zip_code IS NOT NULL;
CREATE INDEX idx_contacts_merged_from ON contacts USING gin(merged_from) WHERE merged_from IS NOT NULL;
CREATE INDEX idx_contacts_last_contact ON contacts(last_contact) WHERE last_contact IS NOT NULL;
CREATE INDEX idx_contacts_created_by ON contacts(created_by);
CREATE INDEX idx_contacts_merged_into ON contacts(merged_into) WHERE merged_into IS NOT NULL;

-- Contacts updated_at trigger
CREATE TRIGGER contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Prevent duplicate contacts (same phone OR same email for same created_by)
CREATE OR REPLACE FUNCTION prevent_duplicate_contacts()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Check phone duplicate
  IF NEW.phone IS NOT NULL AND NEW.phone != '' THEN
    IF EXISTS (
      SELECT 1 FROM contacts
      WHERE normalize_phone(phone) = normalize_phone(NEW.phone)
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
        AND merged_into IS NULL
    ) THEN
      RAISE EXCEPTION 'Contato com este telefone já existe'
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

  -- Check email duplicate
  IF NEW.email IS NOT NULL AND NEW.email != '' THEN
    IF EXISTS (
      SELECT 1 FROM contacts
      WHERE lower(trim(email)) = lower(trim(NEW.email))
        AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::UUID)
        AND merged_into IS NULL
    ) THEN
      RAISE EXCEPTION 'Contato com este email já existe'
        USING ERRCODE = 'unique_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_prevent_duplicate_contacts
  BEFORE INSERT OR UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION prevent_duplicate_contacts();

-- ----- tags -----
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category tag_category NOT NULL,
  color TEXT DEFAULT '#6B7280',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (name, category)
);

CREATE INDEX idx_tags_category ON tags(category);

CREATE TRIGGER tags_updated_at
  BEFORE UPDATE ON tags
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ----- contact_tags -----
CREATE TABLE contact_tags (
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (contact_id, tag_id)
);

CREATE INDEX idx_contact_tags_tag_id ON contact_tags(tag_id);

-- ----- demands -----
CREATE TABLE demands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  responsible_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  status demand_status NOT NULL DEFAULT 'open',
  priority demand_priority NOT NULL DEFAULT 'medium',
  neighborhood TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_demands_status ON demands(status);
CREATE INDEX idx_demands_priority ON demands(priority);
CREATE INDEX idx_demands_contact_id ON demands(contact_id);
CREATE INDEX idx_demands_created_by ON demands(created_by);
CREATE INDEX idx_demands_responsible_id ON demands(responsible_id);

CREATE TRIGGER demands_updated_at
  BEFORE UPDATE ON demands
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ----- demand_tags -----
CREATE TABLE demand_tags (
  demand_id UUID NOT NULL REFERENCES demands(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (demand_id, tag_id)
);

CREATE INDEX idx_demand_tags_tag_id ON demand_tags(tag_id);

-- ----- activities -----
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type activity_type NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  entity_name TEXT,
  responsible_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  description TEXT,
  changes JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_activities_entity ON activities(entity_type, entity_id);
CREATE INDEX idx_activities_responsible_id ON activities(responsible_id);
CREATE INDEX idx_activities_created_at ON activities(created_at DESC);
CREATE INDEX idx_activities_type ON activities(type);

-- ----- contact_merges -----
CREATE TABLE contact_merges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kept_contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  deleted_contact_id UUID NOT NULL,
  deleted_contact_snapshot JSONB NOT NULL,
  merged_fields JSONB,
  merged_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  merged_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contact_merges_kept ON contact_merges(kept_contact_id);
CREATE INDEX idx_contact_merges_deleted ON contact_merges(deleted_contact_id);
CREATE INDEX idx_contact_merges_merged_by ON contact_merges(merged_by);

-- ----- cep_coordinates -----
CREATE TABLE cep_coordinates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cep TEXT NOT NULL UNIQUE,
  address TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  is_valid BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cep_coordinates_cep ON cep_coordinates(cep);
CREATE INDEX idx_cep_coordinates_lat_lng ON cep_coordinates(latitude, longitude) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE TRIGGER cep_coordinates_updated_at
  BEFORE UPDATE ON cep_coordinates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ----- webhooks -----
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhooks_user_id ON webhooks(user_id);

CREATE TRIGGER webhooks_updated_at
  BEFORE UPDATE ON webhooks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ----- webhook_logs -----
CREATE TABLE webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID REFERENCES webhooks(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  payload JSONB,
  status_code INTEGER,
  response TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_webhook_logs_webhook_id ON webhook_logs(webhook_id);
CREATE INDEX idx_webhook_logs_created_at ON webhook_logs(created_at DESC);

-- ----- api_tokens -----
CREATE TABLE api_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  token TEXT NOT NULL DEFAULT generate_api_token(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_tokens_user_id ON api_tokens(user_id);
CREATE INDEX idx_api_tokens_token ON api_tokens(token);

CREATE TRIGGER api_tokens_updated_at
  BEFORE UPDATE ON api_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ----- branding_settings -----
CREATE TABLE branding_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mandate_name TEXT NOT NULL DEFAULT 'Meu Mandato',
  primary_color TEXT NOT NULL DEFAULT '#0B63D1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER branding_settings_updated_at
  BEFORE UPDATE ON branding_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ----- team_members -----
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT,
  email TEXT,
  bio TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  social_links JSONB DEFAULT '{}',
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_team_members_active ON team_members(active) WHERE active = TRUE;

-- ----- user_roles -----
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);

CREATE TRIGGER user_roles_updated_at
  BEFORE UPDATE ON user_roles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ----- permissions -----
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, module, action)
);

CREATE INDEX idx_permissions_user_id ON permissions(user_id);

CREATE TRIGGER permissions_updated_at
  BEFORE UPDATE ON permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ----- permissoes_perfil -----
CREATE TABLE permissoes_perfil (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL,
  secao TEXT NOT NULL,
  pode_ver BOOLEAN NOT NULL DEFAULT FALSE,
  pode_criar BOOLEAN NOT NULL DEFAULT FALSE,
  pode_editar BOOLEAN NOT NULL DEFAULT FALSE,
  pode_deletar BOOLEAN NOT NULL DEFAULT FALSE,
  so_proprio BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (role, secao)
);

CREATE INDEX idx_permissoes_perfil_role ON permissoes_perfil(role);

-- ----- google_oauth_tokens -----
CREATE TABLE google_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  google_email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER google_oauth_tokens_updated_at
  BEFORE UPDATE ON google_oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ----- contact_sync -----
CREATE TABLE contact_sync (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  google_resource_name TEXT,
  sync_status sync_status_type NOT NULL DEFAULT 'pending',
  sync_direction sync_direction_type NOT NULL DEFAULT 'crm_to_google',
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (contact_id, user_id)
);

CREATE INDEX idx_contact_sync_user_id ON contact_sync(user_id);
CREATE INDEX idx_contact_sync_status ON contact_sync(sync_status);
CREATE INDEX idx_contact_sync_google_resource ON contact_sync(google_resource_name) WHERE google_resource_name IS NOT NULL;

CREATE TRIGGER contact_sync_updated_at
  BEFORE UPDATE ON contact_sync
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ----- google_sync_settings -----
CREATE TABLE google_sync_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE UNIQUE,
  sync_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  bidirectional_sync BOOLEAN NOT NULL DEFAULT FALSE,
  sync_tags BOOLEAN NOT NULL DEFAULT FALSE,
  keep_on_google_delete BOOLEAN NOT NULL DEFAULT TRUE,
  last_full_sync TIMESTAMPTZ,
  last_sync_token TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER google_sync_settings_updated_at
  BEFORE UPDATE ON google_sync_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ----- google_sync_logs -----
CREATE TABLE google_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  direction sync_direction_type NOT NULL,
  operation TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_google_sync_logs_user_id ON google_sync_logs(user_id);
CREATE INDEX idx_google_sync_logs_contact_id ON google_sync_logs(contact_id) WHERE contact_id IS NOT NULL;
CREATE INDEX idx_google_sync_logs_created_at ON google_sync_logs(created_at DESC);
CREATE INDEX idx_google_sync_logs_status ON google_sync_logs(status);

-- Additional indexes on leaders
CREATE INDEX idx_leaders_created_by ON leaders(created_by);
CREATE INDEX idx_leaders_active ON leaders(active) WHERE active = TRUE;
CREATE INDEX idx_leaders_leadership_type ON leaders(leadership_type);


-- ============================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaders ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE demands ENABLE ROW LEVEL SECURITY;
ALTER TABLE demand_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_merges ENABLE ROW LEVEL SECURITY;
ALTER TABLE cep_coordinates ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE branding_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissoes_perfil ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_oauth_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_sync ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_sync_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE google_sync_logs ENABLE ROW LEVEL SECURITY;

-- ---- profiles ----
CREATE POLICY "profiles_select_all"
  ON profiles FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "profiles_update_own_or_admin"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid()
    OR get_current_user_role() = 'admin'
  );

-- ---- contacts ----
CREATE POLICY "contacts_select"
  ON contacts FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'contatos', 'ver')
    OR id IN (
      SELECT contact_id FROM demands
      WHERE responsible_id = auth.uid()
        AND contact_id IS NOT NULL
    )
  );

CREATE POLICY "contacts_insert"
  ON contacts FOR INSERT
  TO authenticated
  WITH CHECK (
    is_user_active(auth.uid())
  );

CREATE POLICY "contacts_update"
  ON contacts FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'contatos', 'editar')
  );

CREATE POLICY "contacts_delete"
  ON contacts FOR DELETE
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'contatos', 'deletar')
  );

-- ---- demands ----
CREATE POLICY "demands_select"
  ON demands FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR responsible_id = auth.uid()
    OR get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'demandas', 'ver')
  );

CREATE POLICY "demands_insert"
  ON demands FOR INSERT
  TO authenticated
  WITH CHECK (
    is_user_active(auth.uid())
  );

CREATE POLICY "demands_update"
  ON demands FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR responsible_id = auth.uid()
    OR get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'demandas', 'editar')
  );

CREATE POLICY "demands_delete"
  ON demands FOR DELETE
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'demandas', 'deletar')
  );

-- ---- tags ----
CREATE POLICY "tags_select"
  ON tags FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "tags_insert"
  ON tags FOR INSERT
  TO authenticated
  WITH CHECK (
    is_user_active(auth.uid())
    AND (
      get_current_user_role() = 'admin'
      OR has_permission(auth.uid(), 'etiquetas', 'criar')
    )
  );

CREATE POLICY "tags_update"
  ON tags FOR UPDATE
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'etiquetas', 'editar')
  );

CREATE POLICY "tags_delete"
  ON tags FOR DELETE
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'etiquetas', 'deletar')
  );

-- ---- leaders ----
CREATE POLICY "leaders_select"
  ON leaders FOR SELECT
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'liderancas', 'ver')
  );

CREATE POLICY "leaders_insert"
  ON leaders FOR INSERT
  TO authenticated
  WITH CHECK (
    is_user_active(auth.uid())
    AND (
      get_current_user_role() = 'admin'
      OR has_permission(auth.uid(), 'liderancas', 'criar')
    )
  );

CREATE POLICY "leaders_update"
  ON leaders FOR UPDATE
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'liderancas', 'editar')
  );

CREATE POLICY "leaders_delete"
  ON leaders FOR DELETE
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'liderancas', 'deletar')
  );

-- ---- activities ----
CREATE POLICY "activities_select"
  ON activities FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "activities_insert"
  ON activities FOR INSERT
  TO authenticated
  WITH CHECK (
    is_user_active(auth.uid())
  );

-- ---- contact_tags ----
CREATE POLICY "contact_tags_select"
  ON contact_tags FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "contact_tags_insert"
  ON contact_tags FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

CREATE POLICY "contact_tags_delete"
  ON contact_tags FOR DELETE
  TO authenticated
  USING (TRUE);

-- ---- demand_tags ----
CREATE POLICY "demand_tags_select"
  ON demand_tags FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "demand_tags_insert"
  ON demand_tags FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

CREATE POLICY "demand_tags_delete"
  ON demand_tags FOR DELETE
  TO authenticated
  USING (TRUE);

-- ---- contact_merges ----
CREATE POLICY "contact_merges_select"
  ON contact_merges FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "contact_merges_insert"
  ON contact_merges FOR INSERT
  TO authenticated
  WITH CHECK (
    is_user_active(auth.uid())
    AND (
      get_current_user_role() = 'admin'
      OR has_permission(auth.uid(), 'contatos', 'editar')
    )
  );

-- ---- cep_coordinates ----
CREATE POLICY "cep_coordinates_select"
  ON cep_coordinates FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "cep_coordinates_insert"
  ON cep_coordinates FOR INSERT
  TO authenticated
  WITH CHECK (TRUE);

CREATE POLICY "cep_coordinates_update"
  ON cep_coordinates FOR UPDATE
  TO authenticated
  USING (TRUE);

CREATE POLICY "cep_coordinates_delete"
  ON cep_coordinates FOR DELETE
  TO authenticated
  USING (TRUE);

-- ---- webhooks (admin only) ----
CREATE POLICY "webhooks_select"
  ON webhooks FOR SELECT
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
    OR user_id = auth.uid()
  );

CREATE POLICY "webhooks_insert"
  ON webhooks FOR INSERT
  TO authenticated
  WITH CHECK (
    get_current_user_role() = 'admin'
  );

CREATE POLICY "webhooks_update"
  ON webhooks FOR UPDATE
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
  );

CREATE POLICY "webhooks_delete"
  ON webhooks FOR DELETE
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
  );

-- ---- webhook_logs ----
CREATE POLICY "webhook_logs_select"
  ON webhook_logs FOR SELECT
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
  );

-- ---- api_tokens ----
CREATE POLICY "api_tokens_select"
  ON api_tokens FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR get_current_user_role() = 'admin'
  );

CREATE POLICY "api_tokens_insert"
  ON api_tokens FOR INSERT
  TO authenticated
  WITH CHECK (
    get_current_user_role() = 'admin'
  );

CREATE POLICY "api_tokens_delete"
  ON api_tokens FOR DELETE
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
  );

-- ---- branding_settings ----
CREATE POLICY "branding_settings_select"
  ON branding_settings FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "branding_settings_update"
  ON branding_settings FOR UPDATE
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
  );

-- ---- team_members ----
CREATE POLICY "team_members_select"
  ON team_members FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "team_members_insert"
  ON team_members FOR INSERT
  TO authenticated
  WITH CHECK (
    get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'usuarios', 'criar')
  );

CREATE POLICY "team_members_update"
  ON team_members FOR UPDATE
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'usuarios', 'editar')
  );

CREATE POLICY "team_members_delete"
  ON team_members FOR DELETE
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'usuarios', 'deletar')
  );

-- ---- user_roles ----
CREATE POLICY "user_roles_select"
  ON user_roles FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "user_roles_manage"
  ON user_roles FOR ALL
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
  );

-- ---- permissions ----
CREATE POLICY "permissions_select"
  ON permissions FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "permissions_manage"
  ON permissions FOR ALL
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
  );

-- ---- permissoes_perfil ----
CREATE POLICY "permissoes_perfil_select"
  ON permissoes_perfil FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "permissoes_perfil_insert"
  ON permissoes_perfil FOR INSERT
  TO authenticated
  WITH CHECK (
    get_current_user_role() = 'admin'
  );

CREATE POLICY "permissoes_perfil_update"
  ON permissoes_perfil FOR UPDATE
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
  );

CREATE POLICY "permissoes_perfil_delete"
  ON permissoes_perfil FOR DELETE
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
  );

-- ---- google_oauth_tokens ----
CREATE POLICY "google_oauth_tokens_select"
  ON google_oauth_tokens FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR get_current_user_role() = 'admin'
  );

CREATE POLICY "google_oauth_tokens_insert"
  ON google_oauth_tokens FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
  );

CREATE POLICY "google_oauth_tokens_update"
  ON google_oauth_tokens FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR get_current_user_role() = 'admin'
  );

CREATE POLICY "google_oauth_tokens_delete"
  ON google_oauth_tokens FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR get_current_user_role() = 'admin'
  );

-- ---- contact_sync ----
CREATE POLICY "contact_sync_select"
  ON contact_sync FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR get_current_user_role() = 'admin'
  );

CREATE POLICY "contact_sync_insert"
  ON contact_sync FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
  );

CREATE POLICY "contact_sync_update"
  ON contact_sync FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR get_current_user_role() = 'admin'
  );

CREATE POLICY "contact_sync_delete"
  ON contact_sync FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR get_current_user_role() = 'admin'
  );

-- ---- google_sync_settings ----
CREATE POLICY "google_sync_settings_select"
  ON google_sync_settings FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR get_current_user_role() = 'admin'
  );

CREATE POLICY "google_sync_settings_insert"
  ON google_sync_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
  );

CREATE POLICY "google_sync_settings_update"
  ON google_sync_settings FOR UPDATE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR get_current_user_role() = 'admin'
  );

CREATE POLICY "google_sync_settings_delete"
  ON google_sync_settings FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR get_current_user_role() = 'admin'
  );

-- ---- google_sync_logs ----
CREATE POLICY "google_sync_logs_select"
  ON google_sync_logs FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR get_current_user_role() = 'admin'
  );

CREATE POLICY "google_sync_logs_insert"
  ON google_sync_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
  );


-- ============================================================
-- 6. SEED DATA
-- ============================================================

-- Default branding row
INSERT INTO branding_settings (mandate_name, primary_color)
VALUES ('Meu Mandato', '#0B63D1');

-- permissoes_perfil: 5 roles × 14 sections = 70 rows
-- Roles: admin, proprietario, assessor, assistente, estagiario
-- Sections: dashboard, contatos, liderancas, demandas, etiquetas, mapa,
--           importacao, usuarios, google, api, webhooks, personalizacao, permissoes, relatorios

INSERT INTO permissoes_perfil (role, secao, pode_ver, pode_criar, pode_editar, pode_deletar, so_proprio) VALUES
-- ==================== ADMIN ====================
('admin', 'dashboard',       TRUE, TRUE, TRUE, TRUE, FALSE),
('admin', 'contatos',        TRUE, TRUE, TRUE, TRUE, FALSE),
('admin', 'liderancas',      TRUE, TRUE, TRUE, TRUE, FALSE),
('admin', 'demandas',        TRUE, TRUE, TRUE, TRUE, FALSE),
('admin', 'etiquetas',       TRUE, TRUE, TRUE, TRUE, FALSE),
('admin', 'mapa',            TRUE, TRUE, TRUE, TRUE, FALSE),
('admin', 'importacao',      TRUE, TRUE, TRUE, TRUE, FALSE),
('admin', 'usuarios',        TRUE, TRUE, TRUE, TRUE, FALSE),
('admin', 'google',          TRUE, TRUE, TRUE, TRUE, FALSE),
('admin', 'api',             TRUE, TRUE, TRUE, TRUE, FALSE),
('admin', 'webhooks',        TRUE, TRUE, TRUE, TRUE, FALSE),
('admin', 'personalizacao',  TRUE, TRUE, TRUE, TRUE, FALSE),
('admin', 'permissoes',      TRUE, TRUE, TRUE, TRUE, FALSE),
('admin', 'relatorios',      TRUE, TRUE, TRUE, TRUE, FALSE),

-- ==================== PROPRIETÁRIO ====================
('proprietario', 'dashboard',       TRUE, TRUE, TRUE, TRUE, FALSE),
('proprietario', 'contatos',        TRUE, TRUE, TRUE, TRUE, FALSE),
('proprietario', 'liderancas',      TRUE, TRUE, TRUE, TRUE, FALSE),
('proprietario', 'demandas',        TRUE, TRUE, TRUE, TRUE, FALSE),
('proprietario', 'etiquetas',       TRUE, TRUE, TRUE, TRUE, FALSE),
('proprietario', 'mapa',            TRUE, TRUE, TRUE, TRUE, FALSE),
('proprietario', 'importacao',      TRUE, TRUE, TRUE, TRUE, FALSE),
('proprietario', 'usuarios',        TRUE, TRUE, TRUE, FALSE, FALSE),
('proprietario', 'google',          TRUE, TRUE, TRUE, TRUE, FALSE),
('proprietario', 'api',             TRUE, TRUE, TRUE, TRUE, FALSE),
('proprietario', 'webhooks',        TRUE, TRUE, TRUE, TRUE, FALSE),
('proprietario', 'personalizacao',  TRUE, TRUE, TRUE, TRUE, FALSE),
('proprietario', 'permissoes',      TRUE, FALSE, FALSE, FALSE, FALSE),
('proprietario', 'relatorios',      TRUE, TRUE, TRUE, TRUE, FALSE),

-- ==================== ASSESSOR ====================
('assessor', 'dashboard',       TRUE, FALSE, FALSE, FALSE, FALSE),
('assessor', 'contatos',        TRUE, TRUE, TRUE, FALSE, FALSE),
('assessor', 'liderancas',      TRUE, TRUE, TRUE, FALSE, FALSE),
('assessor', 'demandas',        TRUE, TRUE, TRUE, FALSE, FALSE),
('assessor', 'etiquetas',       TRUE, TRUE, FALSE, FALSE, FALSE),
('assessor', 'mapa',            TRUE, FALSE, FALSE, FALSE, FALSE),
('assessor', 'importacao',      TRUE, TRUE, FALSE, FALSE, FALSE),
('assessor', 'usuarios',        FALSE, FALSE, FALSE, FALSE, FALSE),
('assessor', 'google',          TRUE, FALSE, FALSE, FALSE, FALSE),
('assessor', 'api',             FALSE, FALSE, FALSE, FALSE, FALSE),
('assessor', 'webhooks',        FALSE, FALSE, FALSE, FALSE, FALSE),
('assessor', 'personalizacao',  FALSE, FALSE, FALSE, FALSE, FALSE),
('assessor', 'permissoes',      FALSE, FALSE, FALSE, FALSE, FALSE),
('assessor', 'relatorios',      TRUE, FALSE, FALSE, FALSE, FALSE),

-- ==================== ASSISTENTE ====================
('assistente', 'dashboard',       TRUE, FALSE, FALSE, FALSE, FALSE),
('assistente', 'contatos',        TRUE, TRUE, FALSE, FALSE, TRUE),
('assistente', 'liderancas',      TRUE, FALSE, FALSE, FALSE, FALSE),
('assistente', 'demandas',        TRUE, TRUE, FALSE, FALSE, TRUE),
('assistente', 'etiquetas',       TRUE, FALSE, FALSE, FALSE, FALSE),
('assistente', 'mapa',            TRUE, FALSE, FALSE, FALSE, FALSE),
('assistente', 'importacao',      FALSE, FALSE, FALSE, FALSE, FALSE),
('assistente', 'usuarios',        FALSE, FALSE, FALSE, FALSE, FALSE),
('assistente', 'google',          FALSE, FALSE, FALSE, FALSE, FALSE),
('assistente', 'api',             FALSE, FALSE, FALSE, FALSE, FALSE),
('assistente', 'webhooks',        FALSE, FALSE, FALSE, FALSE, FALSE),
('assistente', 'personalizacao',  FALSE, FALSE, FALSE, FALSE, FALSE),
('assistente', 'permissoes',      FALSE, FALSE, FALSE, FALSE, FALSE),
('assistente', 'relatorios',      TRUE, FALSE, FALSE, FALSE, FALSE),

-- ==================== ESTAGIÁRIO ====================
('estagiario', 'dashboard',       TRUE, FALSE, FALSE, FALSE, FALSE),
('estagiario', 'contatos',        TRUE, FALSE, FALSE, FALSE, TRUE),
('estagiario', 'liderancas',      TRUE, FALSE, FALSE, FALSE, FALSE),
('estagiario', 'demandas',        TRUE, FALSE, FALSE, FALSE, TRUE),
('estagiario', 'etiquetas',       TRUE, FALSE, FALSE, FALSE, FALSE),
('estagiario', 'mapa',            FALSE, FALSE, FALSE, FALSE, FALSE),
('estagiario', 'importacao',      FALSE, FALSE, FALSE, FALSE, FALSE),
('estagiario', 'usuarios',        FALSE, FALSE, FALSE, FALSE, FALSE),
('estagiario', 'google',          FALSE, FALSE, FALSE, FALSE, FALSE),
('estagiario', 'api',             FALSE, FALSE, FALSE, FALSE, FALSE),
('estagiario', 'webhooks',        FALSE, FALSE, FALSE, FALSE, FALSE),
('estagiario', 'personalizacao',  FALSE, FALSE, FALSE, FALSE, FALSE),
('estagiario', 'permissoes',      FALSE, FALSE, FALSE, FALSE, FALSE),
('estagiario', 'relatorios',      FALSE, FALSE, FALSE, FALSE, FALSE);
