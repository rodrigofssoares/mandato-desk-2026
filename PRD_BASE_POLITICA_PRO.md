# PRD — Base Política Pro (CRM Mandato Desk)

**Versão:** 1.0
**Data:** 2026-03-13
**Projeto:** CRM político para gestão de mandato parlamentar
**Stack:** React 18 + TypeScript + Vite 5 + Supabase + Tailwind CSS + shadcn/ui

---

## Índice

1. [Visão Geral](#1-visão-geral)
2. [Banco de Dados Supabase (Schema Completo)](#2-banco-de-dados-supabase)
3. [Autenticação e Controle de Acesso](#3-autenticação-e-controle-de-acesso)
4. [Módulos e Funcionalidades](#4-módulos-e-funcionalidades)
5. [Edge Functions (API Backend)](#5-edge-functions)
6. [Integrações Externas](#6-integrações-externas)
7. [Infraestrutura e Configuração](#7-infraestrutura-e-configuração)

---

## 1. Visão Geral

### 1.1 Propósito
CRM político para gestão de mandato parlamentar. Permite gerenciar contatos, demandas de cidadãos, lideranças regionais, visualização geográfica em mapa, importação em massa, integração com Google Contacts, webhooks para automações externas, e sistema RBAC completo com 5 níveis de acesso.

### 1.2 Público-Alvo
- Gabinetes parlamentares (vereadores, deputados)
- Assessores parlamentares
- Lideranças comunitárias e regionais

### 1.3 Stack Tecnológico

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React 18.3 + TypeScript 5.8 + Vite 5.4 (SWC) |
| UI | shadcn/ui (Radix) + Tailwind CSS 3.4 |
| Estado servidor | @tanstack/react-query v5 |
| Formulários | react-hook-form + zod |
| Rotas | react-router-dom 6.30 |
| Backend | Supabase (Auth + PostgreSQL + Edge Functions + Realtime) |
| Mapas | Leaflet + react-leaflet |
| Gráficos | Recharts |
| PDF | jsPDF |
| Planilhas | xlsx (SheetJS) |
| Notificações | Sonner |
| Ícones | lucide-react |

---

## 2. Banco de Dados Supabase

### 2.1 Enums (Tipos Customizados)

```sql
-- Status de demandas
CREATE TYPE demand_status AS ENUM ('open', 'in_progress', 'resolved');

-- Prioridade de demandas
CREATE TYPE demand_priority AS ENUM ('low', 'medium', 'high');

-- Categorias de etiquetas
CREATE TYPE tag_category AS ENUM ('professionals', 'relationships', 'demands');

-- Tipos de atividade (log de auditoria)
CREATE TYPE activity_type AS ENUM (
  'create', 'update', 'delete', 'status_change',
  'assignment', 'import', 'merge', 'bulk_delete'
);

-- Papel do app (legado, mantido para compatibilidade)
CREATE TYPE app_role AS ENUM ('admin', 'user');

-- Tipos de liderança
CREATE TYPE leadership_type AS ENUM (
  'assessor_parlamentar', 'lider_regional',
  'coordenador_area', 'mobilizador', 'outro'
);

-- Status de sincronização Google
CREATE TYPE sync_status_type AS ENUM ('pending', 'synced', 'error', 'conflict');

-- Direção de sincronização
CREATE TYPE sync_direction_type AS ENUM ('crm_to_google', 'google_to_crm', 'bidirectional');
```

### 2.2 Tabelas — Schema Completo

#### 2.2.1 `profiles` — Perfis de Usuários

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'assistente',  -- admin | proprietario | assessor | assistente | estagiario
  status_aprovacao TEXT NOT NULL DEFAULT 'PENDENTE',  -- PENDENTE | ATIVO | INATIVO
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_profiles_status_aprovacao ON profiles(status_aprovacao);

-- Trigger: cria profile automaticamente no signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, name, email, status_aprovacao)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    'PENDENTE'
  );
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

#### 2.2.2 `contacts` — Contatos (Tabela Principal)

```sql
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,

  -- Comunicação
  whatsapp TEXT,
  whatsapp_name TEXT,
  whatsapp_enabled BOOLEAN DEFAULT false,
  email TEXT,
  phone TEXT,

  -- Dados pessoais
  birth_date DATE,
  gender TEXT,  -- masculino | feminino | outro | prefiro_nao_informar

  -- Endereço
  address TEXT,
  address_number TEXT,
  complement TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,

  -- Geolocalização
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  cep_validated_at TIMESTAMPTZ,
  pin_color TEXT,  -- Cor do pin no mapa

  -- Redes sociais
  instagram TEXT,
  twitter TEXT,
  tiktok TEXT,
  youtube TEXT,

  -- Integração Google
  google_contact_id TEXT,

  -- Político
  declarou_voto BOOLEAN NOT NULL DEFAULT false,
  ranking INTEGER DEFAULT 0 CHECK (ranking >= 0 AND ranking <= 10),

  -- Relacionamentos
  leader_id UUID REFERENCES leaders(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES profiles(id),

  -- Observações
  origin TEXT,
  observations TEXT,
  assessor_notes TEXT,

  -- Status
  is_favorite BOOLEAN DEFAULT false,
  last_contact_at TIMESTAMPTZ,

  -- Merge tracking
  merged_at TIMESTAMPTZ,
  merged_by UUID REFERENCES profiles(id),
  merged_from_contact_id UUID,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX idx_contacts_is_favorite ON contacts(is_favorite);
CREATE INDEX idx_contacts_declarou_voto ON contacts(declarou_voto);
CREATE INDEX idx_contacts_google_contact_id ON contacts(google_contact_id);
CREATE INDEX idx_contacts_birth_date ON contacts(birth_date);
CREATE INDEX idx_contacts_leader_id ON contacts(leader_id);
CREATE INDEX idx_contacts_lat_lng ON contacts(lat, lng);
CREATE INDEX idx_contacts_zip_code ON contacts(zip_code);
CREATE INDEX idx_contacts_merged_from ON contacts(merged_from_contact_id);
CREATE INDEX idx_contacts_last_contact ON contacts(last_contact_at);

-- Trigger: atualizar updated_at
CREATE TRIGGER update_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger: prevenir duplicatas por WhatsApp normalizado
CREATE OR REPLACE FUNCTION prevent_duplicate_contacts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_normalized TEXT;
  v_existing UUID;
BEGIN
  IF NEW.whatsapp IS NOT NULL AND NEW.whatsapp != '' THEN
    v_normalized := normalize_phone(NEW.whatsapp);
    SELECT id INTO v_existing FROM contacts
    WHERE normalize_phone(whatsapp) = v_normalized
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND merged_from_contact_id IS NULL
    LIMIT 1;

    IF v_existing IS NOT NULL AND TG_OP = 'INSERT' THEN
      -- Upsert: atualiza o existente ao invés de duplicar
      UPDATE contacts SET
        name = COALESCE(NULLIF(NEW.name, ''), name),
        email = COALESCE(NULLIF(NEW.email, ''), email),
        updated_at = now()
      WHERE id = v_existing;
      RETURN NULL;  -- cancela o INSERT
    END IF;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER trigger_prevent_duplicate_contacts
  BEFORE INSERT ON contacts
  FOR EACH ROW EXECUTE FUNCTION prevent_duplicate_contacts();
```

#### 2.2.3 `leaders` — Lideranças

```sql
CREATE TABLE leaders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  leadership_type leadership_type NOT NULL,
  region TEXT NOT NULL,
  city TEXT,
  neighborhoods TEXT[],  -- Array de bairros
  whatsapp TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  birth_date DATE,
  address TEXT,
  instagram TEXT,
  active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_leaders_region ON leaders(region);
CREATE INDEX idx_leaders_type ON leaders(leadership_type);
CREATE INDEX idx_leaders_active ON leaders(active);
```

#### 2.2.4 `demands` — Demandas

```sql
CREATE TABLE demands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES profiles(id),
  responsible_id UUID REFERENCES profiles(id),
  status demand_status DEFAULT 'open',
  priority demand_priority DEFAULT 'medium',
  neighborhood TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TRIGGER update_demands_updated_at
  BEFORE UPDATE ON demands
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

#### 2.2.5 `tags` — Etiquetas

```sql
CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category tag_category NOT NULL,
  color TEXT,  -- Hex color (#FF5733)
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(name, category)
);

CREATE INDEX idx_tags_name_category ON tags(name, category);
```

#### 2.2.6 `contact_tags` — Contatos ↔ Etiquetas (Junction)

```sql
CREATE TABLE contact_tags (
  contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (contact_id, tag_id)
);
```

#### 2.2.7 `demand_tags` — Demandas ↔ Etiquetas (Junction)

```sql
CREATE TABLE demand_tags (
  demand_id UUID REFERENCES demands(id) ON DELETE CASCADE,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (demand_id, tag_id)
);
```

#### 2.2.8 `activities` — Log de Auditoria

```sql
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type activity_type NOT NULL,
  entity_type TEXT NOT NULL,  -- contact | demand | leader | tag | user | permission | role
  entity_id UUID,  -- Nullable para operações em massa
  entity_name TEXT,
  responsible_id UUID REFERENCES profiles(id),
  description TEXT,
  changes JSONB,  -- { campo: { from: valor_antigo, to: valor_novo } }
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### 2.2.9 `contact_merges` — Histórico de Merges

```sql
CREATE TABLE contact_merges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kept_contact_id UUID NOT NULL,
  deleted_contact_id UUID NOT NULL,
  deleted_contact_snapshot JSONB NOT NULL,
  merged_fields JSONB NOT NULL,
  merged_by UUID NOT NULL REFERENCES profiles(id),
  merged_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_contact_merges_kept ON contact_merges(kept_contact_id);
CREATE INDEX idx_contact_merges_merged_by ON contact_merges(merged_by);
```

#### 2.2.10 `cep_coordinates` — Cache de Geocodificação

```sql
CREATE TABLE cep_coordinates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cep TEXT UNIQUE NOT NULL,
  address TEXT,
  neighborhood TEXT,
  city TEXT,
  state TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  is_valid BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_updated TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cep_coordinates_cep ON cep_coordinates(cep);
```

#### 2.2.11 `webhooks` — Configuração de Webhooks

```sql
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL,  -- ['contact.created', 'demand.updated', ...]
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Eventos disponíveis:**
- `contact.created`, `contact.updated`, `contact.deleted`, `contact.merged`
- `demand.created`, `demand.updated`, `demand.deleted`
- `tag.created`, `tag.updated`, `tag.deleted`
- `leader.created`, `leader.updated`, `leader.deleted`
- `branding.updated`

#### 2.2.12 `webhook_logs` — Log de Execução de Webhooks

```sql
CREATE TABLE webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID REFERENCES webhooks(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status_code INTEGER,
  response TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### 2.2.13 `api_tokens` — Tokens de API

```sql
CREATE TABLE api_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  token TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### 2.2.14 `branding_settings` — Personalização Visual

```sql
CREATE TABLE branding_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mandate_name TEXT NOT NULL DEFAULT 'Meu Mandato',
  primary_color TEXT NOT NULL DEFAULT '#0B63D1',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed padrão
INSERT INTO branding_settings (mandate_name, primary_color)
VALUES ('Meu Mandato', '#0B63D1');
```

#### 2.2.15 `team_members` — Membros da Equipe

```sql
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  email TEXT,
  bio TEXT,
  active BOOLEAN DEFAULT true,
  social_links JSONB,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
```

#### 2.2.16 `user_roles` — Papéis de Usuário (Legado)

```sql
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);
```

#### 2.2.17 `permissions` — Permissões Granulares por Usuário

```sql
CREATE TABLE permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, module, action)
);
```

#### 2.2.18 `permissoes_perfil` — Matriz de Permissões por Role (RBAC Principal)

```sql
CREATE TABLE permissoes_perfil (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL,            -- admin | proprietario | assessor | assistente | estagiario
  secao TEXT NOT NULL,           -- Nome do módulo/seção
  pode_ver BOOLEAN DEFAULT false,
  pode_criar BOOLEAN DEFAULT false,
  pode_editar BOOLEAN DEFAULT false,
  pode_deletar BOOLEAN DEFAULT false,
  so_proprio BOOLEAN DEFAULT false,  -- Restringe acesso apenas a registros próprios
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(role, secao)
);
```

**Seções do sistema (14):**
| Seção | Descrição |
|-------|-----------|
| `dashboard` | Painel principal com estatísticas |
| `contatos` | Gestão de contatos |
| `liderancas` | Gestão de lideranças |
| `demandas` | Gestão de demandas |
| `etiquetas` | Sistema de etiquetas/tags |
| `mapa` | Mapa de leads geolocalizado |
| `importacao` | Importação em massa |
| `usuarios` | Gestão de usuários |
| `google` | Integração Google Contacts |
| `api` | Documentação e tokens de API |
| `webhooks` | Configuração de webhooks |
| `personalizacao` | Branding e personalização |
| `permissoes` | Gestão de permissões |
| `relatorios` | Relatórios e exportações |

**Permissões padrão por role:**

| Seção | Admin | Proprietário | Assessor | Assistente | Estagiário |
|-------|-------|-------------|----------|------------|------------|
| dashboard | ✅ ver/criar/editar/deletar | ✅ ver/criar/editar/deletar | ✅ ver | ✅ ver | ✅ ver |
| contatos | ✅ tudo | ✅ tudo | ✅ ver/criar/editar | ✅ ver/criar (só próprio) | ✅ ver (só próprio) |
| liderancas | ✅ tudo | ✅ tudo | ✅ ver/criar/editar | ✅ ver | ✅ ver |
| demandas | ✅ tudo | ✅ tudo | ✅ ver/criar/editar | ✅ ver/criar (só próprio) | ✅ ver (só próprio) |
| etiquetas | ✅ tudo | ✅ tudo | ✅ ver/criar | ✅ ver | ✅ ver |
| mapa | ✅ tudo | ✅ tudo | ✅ ver | ✅ ver | ❌ |
| importacao | ✅ tudo | ✅ tudo | ✅ ver/criar | ❌ | ❌ |
| usuarios | ✅ tudo | ✅ ver/criar/editar | ❌ | ❌ | ❌ |
| google | ✅ tudo | ✅ tudo | ✅ ver | ❌ | ❌ |
| api | ✅ tudo | ✅ tudo | ❌ | ❌ | ❌ |
| webhooks | ✅ tudo | ✅ tudo | ❌ | ❌ | ❌ |
| personalizacao | ✅ tudo | ✅ tudo | ❌ | ❌ | ❌ |
| permissoes | ✅ tudo | ✅ ver | ❌ | ❌ | ❌ |
| relatorios | ✅ tudo | ✅ tudo | ✅ ver | ✅ ver | ❌ |

#### 2.2.19 `google_oauth_tokens` — Tokens OAuth do Google

```sql
CREATE TABLE google_oauth_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) UNIQUE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  google_email TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### 2.2.20 `contact_sync` — Status de Sincronização por Contato

```sql
CREATE TABLE contact_sync (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  google_resource_name TEXT NOT NULL,
  sync_status sync_status_type DEFAULT 'pending',
  sync_direction sync_direction_type DEFAULT 'crm_to_google',
  last_synced_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(contact_id, user_id)
);

CREATE INDEX idx_contact_sync_contact ON contact_sync(contact_id);
CREATE INDEX idx_contact_sync_user ON contact_sync(user_id);
CREATE INDEX idx_contact_sync_google ON contact_sync(google_resource_name);
```

#### 2.2.21 `google_sync_settings` — Configurações de Sincronização

```sql
CREATE TABLE google_sync_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) UNIQUE,
  sync_enabled BOOLEAN DEFAULT false,
  bidirectional_sync BOOLEAN DEFAULT false,
  sync_tags BOOLEAN DEFAULT true,
  keep_on_google_delete BOOLEAN DEFAULT true,
  last_full_sync TIMESTAMPTZ,
  last_sync_token TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

#### 2.2.22 `google_sync_logs` — Logs de Sincronização Google

```sql
CREATE TABLE google_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  direction sync_direction_type NOT NULL,
  operation TEXT NOT NULL,  -- create | update | delete | import
  status TEXT NOT NULL,     -- success | error
  error_message TEXT,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_google_sync_logs_user ON google_sync_logs(user_id);
CREATE INDEX idx_google_sync_logs_created ON google_sync_logs(created_at DESC);
```

### 2.3 Funções do Banco

```sql
-- Normalizar telefone (remover não-dígitos)
CREATE OR REPLACE FUNCTION normalize_phone(phone_number TEXT)
RETURNS TEXT LANGUAGE plpgsql IMMUTABLE AS $$
BEGIN
  RETURN regexp_replace(COALESCE(phone_number, ''), '[^0-9]', '', 'g');
END; $$;

-- Verificar se usuário está ativo
CREATE OR REPLACE FUNCTION is_user_active(user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles WHERE id = user_id AND status_aprovacao = 'ATIVO'
  );
END; $$;

-- Verificar role (compatibilidade com app_role enum)
CREATE OR REPLACE FUNCTION has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF _role::text = 'admin' THEN
    RETURN EXISTS (
      SELECT 1 FROM profiles WHERE id = _user_id AND role = 'admin' AND status_aprovacao = 'ATIVO'
    );
  ELSE
    RETURN EXISTS (
      SELECT 1 FROM profiles WHERE id = _user_id AND status_aprovacao = 'ATIVO'
    );
  END IF;
END; $$;

-- Verificar permissão por módulo/ação (usa permissoes_perfil)
CREATE OR REPLACE FUNCTION has_permission(_user_id UUID, _module TEXT, _action TEXT)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_role TEXT;
  v_result BOOLEAN;
BEGIN
  SELECT role INTO v_role FROM profiles
  WHERE id = _user_id AND status_aprovacao = 'ATIVO';

  IF v_role IS NULL THEN RETURN false; END IF;
  IF v_role = 'admin' THEN RETURN true; END IF;

  -- Mapear action para campo da permissoes_perfil
  SELECT CASE _action
    WHEN 'view' THEN pode_ver
    WHEN 'create' THEN pode_criar
    WHEN 'edit' THEN pode_editar
    WHEN 'delete' THEN pode_deletar
    ELSE false
  END INTO v_result
  FROM permissoes_perfil
  WHERE role = v_role AND secao = _module;

  RETURN COALESCE(v_result, false);
END; $$;

-- Obter role do usuário atual
CREATE OR REPLACE FUNCTION get_current_user_role()
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN (SELECT role FROM profiles WHERE id = auth.uid());
END; $$;

-- Gerar token de API
CREATE OR REPLACE FUNCTION generate_api_token()
RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  RETURN encode(gen_random_bytes(32), 'hex');
END; $$;

-- Buscar contatos duplicados (por telefone normalizado)
CREATE OR REPLACE FUNCTION get_duplicate_contacts()
RETURNS TABLE(normalized_phone TEXT, contact_count BIGINT, contacts JSONB)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN QUERY
  SELECT
    normalize_phone(c.whatsapp) as normalized_phone,
    count(*) as contact_count,
    jsonb_agg(jsonb_build_object(
      'id', c.id, 'name', c.name, 'whatsapp', c.whatsapp,
      'email', c.email, 'created_at', c.created_at
    )) as contacts
  FROM contacts c
  WHERE c.whatsapp IS NOT NULL AND c.whatsapp != ''
    AND c.merged_from_contact_id IS NULL
  GROUP BY normalize_phone(c.whatsapp)
  HAVING count(*) > 1
  ORDER BY count(*) DESC;
END; $$;

-- Auto-update timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END; $$;
```

### 2.4 RLS (Row Level Security)

Todas as tabelas têm RLS habilitado. Resumo das políticas principais:

```sql
-- PROFILES
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
-- Qualquer autenticado pode ver profiles ativos
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated
  USING (true);
-- Usuário pode atualizar próprio profile
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());
-- Admin pode atualizar qualquer profile
CREATE POLICY "profiles_update_admin" ON profiles FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- CONTACTS
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
-- Ver: criou OU é responsável por demanda OU tem permissão
CREATE POLICY "contacts_select" ON contacts FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR has_role(auth.uid(), 'admin')
    OR has_permission(auth.uid(), 'contatos', 'view')
    OR EXISTS (
      SELECT 1 FROM demands WHERE demands.contact_id = contacts.id
      AND demands.responsible_id = auth.uid()
    )
  );
-- Inserir: usuário ativo
CREATE POLICY "contacts_insert" ON contacts FOR INSERT TO authenticated
  WITH CHECK (is_user_active(auth.uid()));
-- Atualizar: criou OU admin OU tem permissão
CREATE POLICY "contacts_update" ON contacts FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR has_role(auth.uid(), 'admin')
    OR has_permission(auth.uid(), 'contatos', 'edit')
  );
-- Deletar: admin OU tem permissão
CREATE POLICY "contacts_delete" ON contacts FOR DELETE TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    OR has_permission(auth.uid(), 'contatos', 'delete')
  );

-- DEMANDS
ALTER TABLE demands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "demands_select" ON demands FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR responsible_id = auth.uid()
    OR has_role(auth.uid(), 'admin')
    OR has_permission(auth.uid(), 'demandas', 'view')
  );
CREATE POLICY "demands_insert" ON demands FOR INSERT TO authenticated
  WITH CHECK (is_user_active(auth.uid()));
CREATE POLICY "demands_update" ON demands FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR responsible_id = auth.uid()
    OR has_role(auth.uid(), 'admin')
  );
CREATE POLICY "demands_delete" ON demands FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_permission(auth.uid(), 'demandas', 'delete'));

-- TAGS, LEADERS, ACTIVITIES, etc. seguem padrão similar:
-- SELECT: autenticado com permissão de view
-- INSERT: autenticado ativo
-- UPDATE/DELETE: admin ou com permissão específica

-- WEBHOOKS: somente admin
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "webhooks_admin_only" ON webhooks FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- BRANDING_SETTINGS: todos podem ver, admin pode editar
ALTER TABLE branding_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "branding_select" ON branding_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "branding_update" ON branding_settings FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- CEP_COORDINATES: todos podem ler/escrever (cache compartilhado)
ALTER TABLE cep_coordinates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cep_all" ON cep_coordinates FOR ALL TO authenticated USING (true);
```

---

## 3. Autenticação e Controle de Acesso

### 3.1 Fluxo de Autenticação

```
1. Usuário faz signup → auth.users criado
2. Trigger handle_new_user() → profile criado com status_aprovacao = 'PENDENTE'
3. Admin aprova → status_aprovacao = 'ATIVO'
4. Login só funciona com status ATIVO
5. PENDENTE → mensagem "Aguardando aprovação"
6. INATIVO → mensagem "Conta desativada"
```

### 3.2 Hierarquia de Roles

| Role | Nível | Descrição |
|------|-------|-----------|
| `admin` | 100 | Acesso total ao sistema |
| `proprietario` | 80 | Dono do mandato, quase tudo |
| `assessor` | 50 | Assessor parlamentar, operacional |
| `assistente` | 30 | Suporte, acesso limitado |
| `estagiario` | 20 | Visualização mínima |

### 3.3 Sistema de Permissões (Frontend)

```typescript
// Hook usePermissoes.ts consulta permissoes_perfil
const { canView, canCreate, canEdit, canDelete, isOwnOnly } = usePermissoes();

// Hook usePermissions.tsx traduz para métodos de negócio
const { can } = usePermissions();
can.viewContacts()     // canView('contatos')
can.createContact()    // canCreate('contatos')
can.editContact()      // canEdit('contatos')
can.deleteContact()    // canDelete('contatos')
can.importContacts()   // canView('importacao')
can.exportContacts()   // canView('relatorios')
can.mergeContacts()    // canEdit('contatos') + canDelete('contatos')
can.accessUsers()      // canView('usuarios')
can.accessApi()        // canView('api')
can.accessWebhooks()   // canView('webhooks')
can.accessBranding()   // canView('personalizacao')
can.accessGoogle()     // canView('google')
```

### 3.4 Impersonação (Admin Only)

Admins podem temporariamente assumir o papel de outro role para testar permissões na UI, sem afetar o banco. O `ImpersonationContext` troca o role usado nas consultas de `permissoes_perfil`.

---

## 4. Módulos e Funcionalidades

### 4.1 Dashboard (`/`)

**Descrição:** Painel principal com visão geral do mandato.

**Componentes:**
- `DashboardStatsCards` — 4 cards: total contatos, declararam voto, favoritos, com endereço
- `GrowthMetricsCards` — 5 métricas: novos hoje, ontem, últimos 7 dias, este mês, mês passado
- `GrowthChart` — Gráfico de linha com evolução de contatos ao longo do tempo
- `BirthdaySection` — Aniversariantes do dia/semana
- `TagDistributionChart` — Gráfico de pizza com distribuição de etiquetas
- `VoteDeclarationChart` — Gráfico de declaração de voto
- Feed de atividades recentes com paginação e filtro por usuário/tipo

**Consultas:**
- `contacts`: count com filtros variados
- `activities`: join com profiles, paginado, filtrável
- `profiles`: lista para dropdown de filtro

---

### 4.2 Contatos (`/contacts`)

**Descrição:** Módulo principal de gestão de contatos do mandato.

**Funcionalidades:**
- **CRUD completo** de contatos com formulário detalhado
- **Busca** por nome, email, telefone, bairro
- **Filtros avançados:**
  - Por etiquetas (múltiplas)
  - Favoritos
  - WhatsApp habilitado
  - Declarou voto (sim/não/todos)
  - Aniversário (hoje, 7 dias, 30 dias, este mês)
  - Último contato (hoje, 7d, 30d, 30d+, 60d+, nunca)
  - Por liderança vinculada
  - Por status de demanda
  - Faixa de data de criação
- **Ordenação:** favoritos primeiro, nome (A-Z/Z-A), data criação, por criador
- **Visualização:** grid de cards ou lista
- **Paginação:** 50, 100, 250, 500, 1000 itens por página
- **Favoritos:** toggle rápido com seção dedicada
- **Detecção de duplicatas:** por WhatsApp normalizado
- **Merge de contatos:** comparação lado a lado, seleção campo a campo
- **Importação em massa:** CSV/XLSX com validação
- **Exportação:** CSV e XLSX com filtros aplicados
- **Impressão de etiquetas:** PDF com endereços (jsPDF)
- **Campos do contato:**
  - Nome, WhatsApp, email, telefone, gênero
  - Endereço completo (logradouro, número, complemento, bairro, cidade, estado, CEP)
  - Data de nascimento
  - Redes sociais (Instagram, Twitter, TikTok, YouTube)
  - Liderança vinculada
  - Origem, observações, notas do assessor
  - Declarou voto (checkbox), ranking (0-10)
  - É favorito, data do último contato
  - Google Contact ID (sincronização)

---

### 4.3 Lideranças (`/leaders`)

**Descrição:** Gestão de líderes regionais e comunitários vinculados ao mandato.

**Funcionalidades:**
- **CRUD completo** de lideranças
- **Cards com métricas:** total de contatos vinculados, taxa de conversão (declarou voto)
- **Busca** por nome ou região
- **Filtros:** tipo de liderança, status (ativo/inativo)
- **Tipos de liderança:**
  - Assessor Parlamentar
  - Líder Regional
  - Coordenador de Área
  - Mobilizador
  - Outro
- **Campos:** nome, tipo, WhatsApp, email, telefone, região, cidade, bairros (lista), data nascimento, endereço, Instagram, status ativo/inativo

---

### 4.4 Demandas (`/demands`)

**Descrição:** Pipeline Kanban para gestão de demandas dos cidadãos.

**Funcionalidades:**
- **Kanban Board** com 3 colunas:
  - `open` — Aberta
  - `in_progress` — Em Andamento
  - `resolved` — Resolvida
- **Drag-and-drop** para mover entre colunas (mudança de status)
- **CRUD completo** de demandas
- **Vinculação a contato** (dropdown buscável)
- **Atribuição de responsável** (membro da equipe)
- **Prioridades:** baixa, média, alta
- **Exportação** de demandas
- **Campos:** título, descrição, contato vinculado, responsável, status, prioridade, bairro

---

### 4.5 Etiquetas (`/tags`)

**Descrição:** Sistema de categorização com etiquetas coloridas.

**Funcionalidades:**
- **3 categorias fixas:**
  - `professionals` — Perfil profissional (ex: professor, médico)
  - `relationships` — Tipo de relacionamento (ex: apoiador, liderança)
  - `demands` — Classificação de demandas (ex: saúde, educação)
- **CRUD completo** com nome, cor (hex) e categoria
- **Exportação** de etiquetas
- **Uso:** vinculação a contatos e demandas via junction tables

---

### 4.6 Mapa de Leads (`/leads-map`)

**Descrição:** Visualização geográfica dos contatos em mapa interativo.

**Funcionalidades:**
- **Mapa Leaflet** com tiles OpenStreetMap
- **Geocodificação automática** de CEPs via BrasilAPI + Nominatim
- **Cache de coordenadas** na tabela `cep_coordinates`
- **Processamento progressivo** com barra de progresso
- **Dois modos de visualização:**
  - Padrão: pins coloridos por cor customizada
  - Temporal: Verde (≤30d), Amarelo (≤90d), Vermelho (>90d)
- **Filtros:** período, tags, bairro, status de voto
- **Stats:** total, com coordenadas, sem coordenadas, pendentes
- **Popup** com informações do contato ao clicar no pin
- **Lista de leads** abaixo do mapa com hover highlighting
- **Geocodificação manual** para contatos sem coordenadas

---

### 4.7 Importação em Massa (`/bulk-import`)

**Descrição:** Importação e operações em lote sobre contatos.

**Funcionalidades:**
- **4 modos de operação:**
  - `add` — Adicionar novos contatos
  - `delete` — Deletar contatos existentes
  - `edit` — Editar contatos em massa
  - `tag` — Aplicar etiquetas em massa
- **Input:** textarea para colar dados (parsing automático)
- **Preview:** lista de contatos parseados com validação
- **Importação CSV/XLSX** via `ContactImportDialog`
- **Detecção de duplicatas** durante importação
- **Normalização automática** (telefone, nome, email)
- **Resultado detalhado:** sucesso/falha por registro
- **Template para download** (formato esperado)

---

### 4.8 Gestão de Usuários (`/users`)

**Descrição:** Administração de usuários do sistema e workflow de aprovação.

**Funcionalidades:**
- **Criação de usuários** com email, senha, nome e role
- **Workflow de aprovação:**
  - Novos usuários → `PENDENTE`
  - Admin aprova → `ATIVO`
  - Admin rejeita/desativa → `INATIVO`
- **Alteração de role** via dropdown
- **Reset de senha** via Edge Function
- **Gestão de permissões** individuais (PermissionsDialog)
- **Exclusão de usuários** (cascade: user_roles + permissions)
- **Proteção hierárquica:** não pode editar usuários de nível superior

---

### 4.9 Permissões (`/permissoes`)

**Descrição:** Matriz visual de permissões RBAC.

**Funcionalidades:**
- **Tabela/grid** com seções × roles
- **Checkboxes** para cada permissão (ver/criar/editar/deletar)
- **Toggle "só próprio"** para restringir acesso a registros do próprio usuário
- **Filtro por role**
- **Admin:** permissões bloqueadas (sempre tudo permitido)
- **Seed inicial:** botão para popular permissões padrão
- **Impersonação:** admin pode testar UI como outro role
- **Legendas** explicativas para cada tipo de permissão

---

### 4.10 Integração Google Contacts (`/google-integration`)

**Descrição:** Sincronização bidirecional com Google Contacts.

**Funcionalidades:**
- **Conexão OAuth** com conta Google
- **Sincronização CRM → Google** e **Google → CRM**
- **Configurações:**
  - Sincronização habilitada/desabilitada
  - Bidirecional ou unidirecional
  - Sincronizar etiquetas
  - Manter contato no Google ao deletar no CRM
- **Métricas:** contatos sincronizados, pendentes, com erro
- **Sync manual** via botão
- **Logs de sincronização** com detalhes de operação
- **Desconexão** com remoção de tokens

---

### 4.11 API (`/api`)

**Descrição:** Documentação interativa da API REST e gestão de tokens.

**Funcionalidades:**
- **Token de API** fixo (não expira) com regeneração
- **Documentação de endpoints:**
  - Contacts: CRUD + merge + duplicates
  - Demands: CRUD com filtros
  - Tags: CRUD
  - Users: listagem
- **Exemplos curl** copiáveis para cada endpoint
- **Base URL** do projeto Supabase
- **Endpoint de webhook** de entrada para automações externas

---

### 4.12 Webhooks (`/webhooks`)

**Descrição:** Sistema de notificações via HTTP para integrações externas.

**Funcionalidades:**
- **CRUD de webhooks** com nome, URL e eventos
- **Seleção múltipla de eventos** (contact.created, demand.updated, etc.)
- **Toggle ativo/inativo** por webhook
- **Disparo automático** via Edge Function quando eventos ocorrem
- **Log de execução** com status code e resposta

---

### 4.13 Personalização (`/branding`)

**Descrição:** Customização visual do sistema para o mandato.

**Funcionalidades:**
- **Nome do mandato** (exibido no sidebar e cabeçalhos)
- **Cor primária** com color picker visual + input hex
- **Preview em tempo real** das alterações
- **Aplicação via CSS variables** no tema
- **Reset para padrão** ("Meu Mandato", #0B63D1)

---

### 4.14 Autenticação (`/auth`)

**Funcionalidades:**
- **Login** com email e senha
- **Cadastro** com nome, email e senha
- **Recuperação de senha** via email
- **Reset de senha** (`/reset-password`) para links de redefinição

---

## 5. Edge Functions (API Backend)

### 5.1 Listagem Completa

| Função | Método(s) | Descrição |
|--------|-----------|-----------|
| `contacts` | GET, POST, PATCH, DELETE | CRUD de contatos + merge + duplicatas |
| `demands` | GET, POST, PUT, PATCH, DELETE | CRUD de demandas com filtros |
| `tags` | GET, POST, PATCH, DELETE | CRUD de etiquetas |
| `leaders` | GET, POST, PATCH, DELETE | CRUD de lideranças |
| `users` | GET | Listagem de usuários |
| `geocode` | GET, POST | Geocodificação de CEP (unitário e batch) |
| `google-auth` | POST | Fluxo OAuth do Google |
| `google-contacts-sync` | POST | Sincronização com Google Contacts |
| `trigger-webhooks` | POST | Disparo de webhooks por evento |
| `webhook-entrada` | POST | Receptor de webhooks externos |
| `export-data` | GET | Exportação de dados |
| `manage-user-password` | POST | Reset de senha de usuário (admin) |

### 5.2 Autenticação das Edge Functions

Duas formas:
1. **JWT Session** — Token do Supabase Auth (via header `Authorization: Bearer <token>`)
2. **API Token fixo** — Token da tabela `api_tokens` (via header `x-api-token: <token>`)

### 5.3 Padrão de Permissões nas Edge Functions

```typescript
// Verifica permissão consultando profiles.role + permissoes_perfil
async function checkPermission(userId: string, secao: string, acao: string): Promise<boolean> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (profile?.role === 'admin') return true;

  const { data: perm } = await supabase
    .from('permissoes_perfil')
    .select('*')
    .eq('role', profile.role)
    .eq('secao', secao)
    .single();

  return perm?.[`pode_${acao}`] ?? false;
}
```

---

## 6. Integrações Externas

### 6.1 Google Contacts

- **Protocolo:** OAuth 2.0
- **Edge Functions:** `google-auth` (obtenção de tokens), `google-contacts-sync` (sincronização)
- **Tabelas:** `google_oauth_tokens`, `contact_sync`, `google_sync_settings`, `google_sync_logs`
- **Fluxo:**
  1. Usuário clica "Conectar" → popup OAuth do Google
  2. Token armazenado em `google_oauth_tokens`
  3. Sincronização manual ou automática
  4. Logs salvos em `google_sync_logs`

### 6.2 Geocodificação (BrasilAPI + Nominatim)

- **Fonte primária:** `https://brasilapi.com.br/api/cep/v2/{cep}` — dados de endereço e coordenadas
- **Fallback:** Nominatim (OpenStreetMap) — para quando BrasilAPI não tem coordenadas
- **Cache:** tabela `cep_coordinates` — evita chamadas repetidas
- **Processamento:** progressivo com AbortSignal para cancelamento

### 6.3 Webhooks (Saída)

- **Configuração:** tabela `webhooks` com URL, eventos e status
- **Disparo:** Edge Function `trigger-webhooks` faz POST para cada URL ativa que escuta o evento
- **Payload:** `{ event, data, user_id, timestamp }`
- **Log:** tabela `webhook_logs` com status code e resposta

### 6.4 Webhook de Entrada

- **Edge Function:** `webhook-entrada`
- **Uso:** automações externas (n8n, Zapier, Make) enviam dados para o CRM
- **Autenticação:** API Token no header

---

## 7. Infraestrutura e Configuração

### 7.1 Variáveis de Ambiente

```env
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGci...
```

### 7.2 Estrutura de Diretórios

```
src/
├── pages/              # 17 páginas (rotas)
├── components/
│   ├── ui/             # 43 componentes shadcn/ui
│   ├── contacts/       # 15 componentes de contatos
│   ├── demands/        # 4 componentes de demandas
│   ├── dashboard/      # 6 componentes do dashboard
│   ├── leaders/        # 2 componentes de lideranças
│   ├── map/            # 6 componentes do mapa
│   ├── tags/           # 2 componentes de etiquetas
│   ├── users/          # 4 componentes de usuários
│   ├── auth/           # 2 componentes de auth
│   ├── layout/         # 3 componentes de layout
│   └── activities/     # 1 componente de atividades
├── hooks/              # 5 hooks customizados
├── context/            # 2 contextos (Auth, Impersonation)
├── lib/                # 8 utilitários
├── types/              # 1 arquivo de tipos
└── integrations/
    └── supabase/       # Client + Types (auto-gerado)

supabase/
├── config.toml         # Config do Supabase CLI
├── migrations/         # 42 arquivos SQL
└── functions/          # 12 Edge Functions (Deno/TypeScript)
```

### 7.3 Rotas da Aplicação

| Rota | Proteção | Módulo |
|------|----------|--------|
| `/auth` | Pública | Login/Cadastro |
| `/reset-password` | Pública | Reset de senha |
| `/` | Autenticado + ATIVO | Dashboard |
| `/contacts` | Autenticado + ATIVO | Contatos |
| `/leaders` | Autenticado + ATIVO | Lideranças |
| `/demands` | Autenticado + ATIVO | Demandas |
| `/tags` | Autenticado + ATIVO | Etiquetas |
| `/leads-map` | Autenticado + ATIVO | Mapa |
| `/bulk-import` | Autenticado + ATIVO | Importação |
| `/users` | Autenticado + ATIVO | Usuários |
| `/permissoes` | Autenticado + ATIVO | Permissões |
| `/google-integration` | Autenticado + ATIVO | Google Contacts |
| `/api` | Autenticado + ATIVO | API/Tokens |
| `/webhooks` | Autenticado + ATIVO | Webhooks |
| `/branding` | Autenticado + ATIVO | Personalização |

### 7.4 Scripts Disponíveis

```bash
npm run dev              # Servidor de desenvolvimento (porta 8080)
npm run build            # Build de produção
npm run build:dev        # Build de desenvolvimento
npm run lint             # ESLint
npm run preview          # Preview do build
npm run migration:export # Exportar dados do Lovable
npm run migration:import # Importar para Supabase
npm run migration:validate # Validar migração
```

### 7.5 Dependências Principais

| Pacote | Versão | Uso |
|--------|--------|-----|
| react | 18.3.1 | UI Framework |
| @supabase/supabase-js | 2.95.3 | Cliente Supabase |
| @tanstack/react-query | 5.83.0 | Estado do servidor |
| react-router-dom | 6.30.1 | Roteamento |
| react-hook-form | 7.61.1 | Formulários |
| zod | 3.25.76 | Validação |
| leaflet + react-leaflet | 1.9.4 / 4.2.1 | Mapas |
| recharts | 2.15.4 | Gráficos |
| jspdf | 4.0.0 | Geração de PDF |
| xlsx | 0.18.5 | Import/Export Excel |
| sonner | 1.7.4 | Notificações toast |
| lucide-react | 0.462.0 | Ícones |
| date-fns | 3.6.0 | Manipulação de datas |

---

## Apêndice A: Diagrama de Relacionamentos

```
auth.users (Supabase Auth)
    │
    ├── 1:1 ── profiles (role, status_aprovacao)
    │              │
    │              ├── 1:N ── contacts (created_by)
    │              │              │
    │              │              ├── N:M ── tags (via contact_tags)
    │              │              ├── 1:N ── demands (contact_id)
    │              │              ├── 1:N ── contact_sync
    │              │              └── N:1 ── leaders (leader_id)
    │              │
    │              ├── 1:N ── demands (created_by, responsible_id)
    │              │              └── N:M ── tags (via demand_tags)
    │              │
    │              ├── 1:N ── activities (responsible_id)
    │              ├── 1:N ── leaders (created_by)
    │              ├── 1:N ── tags (created_by)
    │              └── 1:N ── contact_merges (merged_by)
    │
    ├── 1:N ── user_roles (legado)
    ├── 1:N ── permissions (granular)
    ├── 1:N ── api_tokens
    ├── 1:N ── webhooks
    │              └── 1:N ── webhook_logs
    ├── 1:1 ── google_oauth_tokens
    ├── 1:1 ── google_sync_settings
    └── 1:N ── google_sync_logs

permissoes_perfil (role × secao) ── Matriz RBAC independente
branding_settings ── Configuração global (1 registro)
cep_coordinates ── Cache de geocodificação (compartilhado)
team_members ── Membros da equipe (independente)
```

---

## Apêndice B: Checklist de Replicação

Para replicar este projeto do zero:

1. **Supabase:**
   - [ ] Criar projeto no Supabase
   - [ ] Executar todos os enums (Seção 2.1)
   - [ ] Criar todas as tabelas (Seção 2.2) na ordem correta (profiles → leaders → contacts → tags → demands → junction tables → demais)
   - [ ] Criar todas as funções (Seção 2.3)
   - [ ] Habilitar RLS e criar policies (Seção 2.4)
   - [ ] Popular `permissoes_perfil` com permissões padrão
   - [ ] Inserir registro padrão em `branding_settings`
   - [ ] Deploy das 12 Edge Functions

2. **Frontend:**
   - [ ] Scaffold com Vite + React + TypeScript + SWC
   - [ ] Instalar todas as dependências (Seção 7.5)
   - [ ] Configurar shadcn/ui
   - [ ] Configurar Supabase client com types geradas
   - [ ] Implementar AuthContext + ImpersonationContext
   - [ ] Implementar hooks de permissão (usePermissoes + usePermissions)
   - [ ] Implementar rotas protegidas
   - [ ] Implementar cada módulo (Seção 4)

3. **Configuração:**
   - [ ] Configurar variáveis de ambiente (.env)
   - [ ] Configurar Google OAuth (se usar integração)
   - [ ] Criar primeiro usuário admin manualmente
   - [ ] Popular permissões padrão via seed
