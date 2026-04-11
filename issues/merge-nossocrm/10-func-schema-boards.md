# 10 — Schema: Boards + Stages + Items

**Tipo:** Funcional (Supabase)
**Fase:** 0
**Depende de:** —
**Desbloqueia:** 20-func-hooks-boards

## Objetivo
Criar as tabelas `boards`, `board_stages` e `board_items` com RLS e seeds de exemplo.

## Arquivos a criar
- `supabase/migrations/NN_boards.sql`

## SQL alvo
```sql
CREATE TABLE boards (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome           text NOT NULL,
  descricao      text,
  tipo_entidade  text NOT NULL DEFAULT 'contact',
  is_default     boolean NOT NULL DEFAULT false,
  created_by     uuid REFERENCES profiles(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE board_stages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id    uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  nome        text NOT NULL,
  ordem       int  NOT NULL,
  cor         text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_board_stages_board ON board_stages(board_id, ordem);

CREATE TABLE board_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id    uuid NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  stage_id    uuid NOT NULL REFERENCES board_stages(id) ON DELETE CASCADE,
  contact_id  uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  ordem       int,
  moved_at    timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (board_id, contact_id)
);
CREATE INDEX idx_board_items_stage ON board_items(stage_id, ordem);
```

## RLS Policies
```sql
ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE board_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated read" ON boards FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated read" ON board_stages FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated read" ON board_items FOR SELECT TO authenticated USING (true);
-- INSERT/UPDATE/DELETE via função helper que checa permissoes_perfil.board
```

## Critérios de Aceite
- [ ] Migration criada em `supabase/migrations/`
- [ ] `npx supabase db push` aplica sem erro
- [ ] RLS ativo nas 3 tabelas
- [ ] Seed: 1 board "Seguidores" com 6 estágios
- [ ] `src/integrations/supabase/types.ts` regenerado
- [ ] Tabelas aparecem no Studio do Supabase

## Verificação
```bash
npx supabase db query --linked "SELECT nome FROM boards;"
npx supabase db query --linked "SELECT count(*) FROM board_stages;"
```
