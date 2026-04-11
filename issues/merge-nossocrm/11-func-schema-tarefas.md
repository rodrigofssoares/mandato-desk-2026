# 11 — Schema: Tarefas

**Tipo:** Funcional (Supabase)
**Fase:** 0
**Depende de:** 10-func-schema-boards (para FK em `board_item_id`)
**Desbloqueia:** 21-func-hooks-tarefas

## Objetivo
Criar a tabela `tarefas`. **NÃO MEXER** na tabela `activities` existente (que é audit log).

## Arquivos a criar
- `supabase/migrations/NN_tarefas.sql`

## SQL alvo
```sql
CREATE TYPE tarefa_tipo AS ENUM (
  'LIGACAO','REUNIAO','VISITA','WHATSAPP','EMAIL','TAREFA'
);

CREATE TABLE tarefas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo          text NOT NULL,
  descricao       text,
  tipo            tarefa_tipo NOT NULL DEFAULT 'TAREFA',
  data_agendada   timestamptz,
  concluida       boolean NOT NULL DEFAULT false,
  concluida_em    timestamptz,
  responsavel_id  uuid REFERENCES profiles(id),
  contact_id      uuid REFERENCES contacts(id) ON DELETE SET NULL,
  leader_id       uuid REFERENCES leaders(id) ON DELETE SET NULL,
  demand_id       uuid REFERENCES demands(id) ON DELETE SET NULL,
  board_item_id   uuid REFERENCES board_items(id) ON DELETE SET NULL,
  created_by      uuid REFERENCES profiles(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_tarefas_data ON tarefas(data_agendada) WHERE NOT concluida;
CREATE INDEX idx_tarefas_responsavel ON tarefas(responsavel_id) WHERE NOT concluida;
CREATE INDEX idx_tarefas_contact ON tarefas(contact_id);
```

## RLS Policies
```sql
ALTER TABLE tarefas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read" ON tarefas FOR SELECT TO authenticated USING (true);
-- INSERT: só usuários com perfil que tem pode_criar na secao 'tarefas'
-- UPDATE/DELETE: responsavel_id = auth.uid() OU admin
```

## Critérios de Aceite
- [ ] Migration aplicada sem erro
- [ ] Enum `tarefa_tipo` criado
- [ ] RLS ativo
- [ ] **Tabela `activities` intocada** (verificar com `\d activities` no psql)
- [ ] `types.ts` regenerado
- [ ] Seed opcional: 3 tarefas de exemplo vinculadas a contatos existentes

## Verificação
```bash
npx supabase db query --linked "SELECT typname FROM pg_type WHERE typname = 'tarefa_tipo';"
npx supabase db query --linked "SELECT count(*) FROM tarefas;"
npx supabase db query --linked "SELECT count(*) FROM activities;" # não pode ter diminuído
```
