# 13 — Schema: AI Settings

**Tipo:** Funcional (Supabase)
**Fase:** 0
**Depende de:** —
**Desbloqueia:** 35-func-tab-ia

## Objetivo
Criar a tabela `ai_settings` (single row — single-tenant) para armazenar provider, modelo, chave API e feature flags de IA.

## Arquivos a criar
- `supabase/migrations/NN_ai_settings.sql`

## SQL alvo
```sql
CREATE TABLE ai_settings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider    text CHECK (provider IN ('anthropic','openai','google')),
  model       text,
  api_key     text,
  ai_enabled  boolean NOT NULL DEFAULT false,
  features    jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by  uuid REFERENCES profiles(id),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Garante apenas 1 linha
CREATE UNIQUE INDEX ai_settings_singleton ON ai_settings((true));

-- Insert inicial
INSERT INTO ai_settings (ai_enabled, features)
VALUES (false, '{"resumo_demandas": false, "sugestao_acoes": false}'::jsonb);
```

## RLS Policies
```sql
ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin read" ON ai_settings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "admin write" ON ai_settings FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));
```

## Nota de segurança
A `api_key` fica em texto plano por simplicidade do MVP. **TODO futuro**: usar Supabase Vault (`vault.secrets`) ou criptografia pgcrypto. A leitura só é permitida a admins via RLS.

## Critérios de Aceite
- [ ] Migration aplicada
- [ ] Index único garante só 1 linha
- [ ] Row inicial criada com `ai_enabled=false`
- [ ] RLS ativo: apenas admin lê e escreve
- [ ] `types.ts` regenerado

## Verificação
```bash
npx supabase db query --linked "SELECT count(*) FROM ai_settings;" # deve ser 1
```
