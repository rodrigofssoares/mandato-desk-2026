# 12 — Schema: Campos Personalizados

**Tipo:** Funcional (Supabase)
**Fase:** 0
**Depende de:** —
**Desbloqueia:** 22-func-hooks-custom-fields

## Objetivo
Criar as tabelas `campos_personalizados` e `campos_personalizados_valores`. **Campos fixos dos contatos NÃO são tocados** — essa é uma tabela à parte.

## Arquivos a criar
- `supabase/migrations/NN_custom_fields.sql`

## SQL alvo
```sql
CREATE TYPE campo_personalizado_tipo AS ENUM (
  'texto','numero','data','booleano','selecao'
);

CREATE TABLE campos_personalizados (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade    text NOT NULL DEFAULT 'contact',
  chave       text NOT NULL,
  rotulo      text NOT NULL,
  tipo        campo_personalizado_tipo NOT NULL,
  opcoes      jsonb,
  filtravel   boolean NOT NULL DEFAULT true,
  ordem       int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entidade, chave)
);

CREATE TABLE campos_personalizados_valores (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campo_id       uuid NOT NULL REFERENCES campos_personalizados(id) ON DELETE CASCADE,
  contact_id     uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  valor_texto    text,
  valor_numero   numeric,
  valor_data     date,
  valor_bool     boolean,
  valor_selecao  text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (campo_id, contact_id)
);
CREATE INDEX idx_cpv_contact ON campos_personalizados_valores(contact_id);
CREATE INDEX idx_cpv_campo ON campos_personalizados_valores(campo_id);
```

## RLS Policies
```sql
ALTER TABLE campos_personalizados ENABLE ROW LEVEL SECURITY;
ALTER TABLE campos_personalizados_valores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read" ON campos_personalizados FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated read" ON campos_personalizados_valores FOR SELECT TO authenticated USING (true);
-- INSERT/UPDATE/DELETE em campos_personalizados: apenas admin
-- INSERT/UPDATE em valores: usuários com pode_editar em 'contatos'
```

## Função helper (slug normalizado)
```sql
CREATE OR REPLACE FUNCTION slugify_campo(label text) RETURNS text AS $$
  SELECT regexp_replace(
    lower(unaccent(label)),
    '[^a-z0-9]+', '_', 'g'
  );
$$ LANGUAGE sql IMMUTABLE;
```
(Requer extensão `unaccent` — verificar se já está ativa.)

## Critérios de Aceite
- [ ] Migration aplicada sem erro
- [ ] Enum `campo_personalizado_tipo` criado
- [ ] Extensão `unaccent` disponível
- [ ] RLS ativo nas 2 tabelas
- [ ] `types.ts` regenerado
- [ ] Tabelas fixas de `contacts` **não foram alteradas** (verificar `\d contacts`)

## Verificação
```bash
npx supabase db query --linked "SELECT typname FROM pg_type WHERE typname = 'campo_personalizado_tipo';"
npx supabase db query --linked "SELECT slugify_campo('Cargo Liderança');" # → cargo_lideranca
```
