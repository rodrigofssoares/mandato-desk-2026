-- ========================================================================
-- 015_merge_custom_fields.sql
-- Campos personalizados genéricos para contatos
--
-- Parte do merge Nosso CRM → Mandato Desk 2026 (issue 12).
--
-- Diferente de `campaign_fields` (booleanos da aba Campanha), aqui o
-- usuário cria campos de tipos variados (texto, numero, data, booleano,
-- selecao) que aparecem em uma aba "Personalizados" no cartão do contato
-- e ficam disponíveis como filtro na listagem.
--
-- Os campos fixos do contato (nome, email, telefone, etc.) NÃO são
-- tocados — todo o trabalho é em tabelas à parte.
-- ========================================================================

-- ------------------------------------------------------------------------
-- 1. Habilitar extensão unaccent (para slugify normalizado sem acentos)
-- ------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS unaccent;

-- ------------------------------------------------------------------------
-- 2. Função slugify_campo (usada no trigger de insert)
-- ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION slugify_campo(label TEXT)
RETURNS TEXT AS $$
  SELECT trim(both '_' from regexp_replace(
    lower(unaccent(label)),
    '[^a-z0-9]+',
    '_',
    'g'
  ));
$$ LANGUAGE sql IMMUTABLE;

-- ------------------------------------------------------------------------
-- 3. Enum de tipo de campo
-- ------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE campo_personalizado_tipo AS ENUM (
    'texto',
    'numero',
    'data',
    'booleano',
    'selecao'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ------------------------------------------------------------------------
-- 4. Tabela de definição dos campos
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campos_personalizados (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade    TEXT NOT NULL DEFAULT 'contact',
  chave       TEXT NOT NULL,
  rotulo      TEXT NOT NULL,
  tipo        campo_personalizado_tipo NOT NULL,
  opcoes      JSONB,
  filtravel   BOOLEAN NOT NULL DEFAULT TRUE,
  ordem       INTEGER NOT NULL DEFAULT 0,
  created_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT campos_personalizados_entidade_check
    CHECK (entidade IN ('contact')),
  CONSTRAINT campos_personalizados_unique_chave
    UNIQUE (entidade, chave)
);

CREATE INDEX IF NOT EXISTS idx_campos_personalizados_entidade_ordem
  ON campos_personalizados(entidade, ordem);

CREATE TRIGGER campos_personalizados_updated_at
  BEFORE UPDATE ON campos_personalizados
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------
-- 5. Tabela de valores por contato
--    Usa coluna separada por tipo (patrão EAV moderado)
-- ------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS campos_personalizados_valores (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campo_id       UUID NOT NULL REFERENCES campos_personalizados(id) ON DELETE CASCADE,
  contact_id     UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  valor_texto    TEXT,
  valor_numero   NUMERIC,
  valor_data     DATE,
  valor_bool     BOOLEAN,
  valor_selecao  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT campos_personalizados_valores_unique
    UNIQUE (campo_id, contact_id)
);

CREATE INDEX IF NOT EXISTS idx_cpv_contact ON campos_personalizados_valores(contact_id);
CREATE INDEX IF NOT EXISTS idx_cpv_campo ON campos_personalizados_valores(campo_id);
-- Indices parciais por tipo para filtros mais rapidos
CREATE INDEX IF NOT EXISTS idx_cpv_texto ON campos_personalizados_valores(campo_id, valor_texto) WHERE valor_texto IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cpv_selecao ON campos_personalizados_valores(campo_id, valor_selecao) WHERE valor_selecao IS NOT NULL;

CREATE TRIGGER campos_personalizados_valores_updated_at
  BEFORE UPDATE ON campos_personalizados_valores
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ------------------------------------------------------------------------
-- 6. RLS em campos_personalizados (definição — gerenciada por admin/config)
-- ------------------------------------------------------------------------
ALTER TABLE campos_personalizados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "campos_personalizados_select"
  ON campos_personalizados FOR SELECT
  TO authenticated
  USING (TRUE);

CREATE POLICY "campos_personalizados_insert"
  ON campos_personalizados FOR INSERT
  TO authenticated
  WITH CHECK (
    is_user_active(auth.uid())
    AND (
      get_current_user_role() = 'admin'
      OR has_permission(auth.uid(), 'configuracoes', 'criar')
    )
  );

CREATE POLICY "campos_personalizados_update"
  ON campos_personalizados FOR UPDATE
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'configuracoes', 'editar')
  );

CREATE POLICY "campos_personalizados_delete"
  ON campos_personalizados FOR DELETE
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'configuracoes', 'deletar')
  );

-- ------------------------------------------------------------------------
-- 7. RLS em campos_personalizados_valores (valores — liga em contato)
-- ------------------------------------------------------------------------
ALTER TABLE campos_personalizados_valores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cpv_select"
  ON campos_personalizados_valores FOR SELECT
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'contatos', 'ver')
  );

CREATE POLICY "cpv_insert"
  ON campos_personalizados_valores FOR INSERT
  TO authenticated
  WITH CHECK (
    is_user_active(auth.uid())
    AND (
      get_current_user_role() = 'admin'
      OR has_permission(auth.uid(), 'contatos', 'editar')
      OR has_permission(auth.uid(), 'contatos', 'criar')
    )
  );

CREATE POLICY "cpv_update"
  ON campos_personalizados_valores FOR UPDATE
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'contatos', 'editar')
  );

CREATE POLICY "cpv_delete"
  ON campos_personalizados_valores FOR DELETE
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'contatos', 'editar')
  );

-- ------------------------------------------------------------------------
-- Nota: a seção RBAC 'configuracoes' será criada na issue 99. Aqui as
-- policies já referenciam ela antecipadamente — antes da 99 rodar, só
-- admin consegue mexer em campos_personalizados (o que é o comportamento
-- desejado para o início).
-- ------------------------------------------------------------------------
