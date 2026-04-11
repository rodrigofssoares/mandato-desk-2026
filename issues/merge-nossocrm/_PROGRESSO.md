# Progresso — Merge Nosso CRM → Mandato Desk 2026

**Última atualização:** 2026-04-11 19:30 UTC
**Sessão atual iniciada em:** 2026-04-11 19:10 UTC
**Sinal de retomada:** digite `continuar merge-nossocrm` em qualquer sessão futura

---

## Status geral
- **Total:** 29 issues (Fase 0–6, incluindo 14A e 15)
- **Concluídas:** 3
- **Em andamento:** 0
- **Pendentes:** 26
- **Bloqueadas:** 0

## Bootstrap (setup inicial — concluído)
- [x] `.env` atualizado com novo `SUPABASE_ACCESS_TOKEN`
- [x] `npx supabase link --project-ref nevgnvrwqaoztefnyqdj` OK
- [x] Conectividade Supabase verificada (`SELECT current_database(), now();` retornou `postgres`)
- [x] `_PROGRESSO.md` criado

---

## Checklist de issues

### Fase 0 — Fundação (migrations)
- [x] `10-func-schema-boards` — migration `013_merge_boards.sql`, build ok
- [x] `11-func-schema-tarefas` — migration `014_merge_tarefas.sql`, build ok
- [x] `12-func-schema-custom-fields` — migration `015_merge_custom_fields.sql`, slugify testado, build ok
- [ ] `13-func-schema-ai-settings` + Parte A da `14-func-ai-key-security-upgrade`

### Fase 1 — Infra de testes + Hooks
- [ ] `15-setup-vitest-infra`
- [ ] `20-func-hooks-boards`
- [ ] `21-func-hooks-tarefas`
- [ ] `22-func-hooks-custom-fields`

### Fase 2 — Settings Hub
- [ ] `32-func-page-settings-hub`
- [ ] `33-func-tab-campos-personalizados`
- [ ] `34-func-tab-funis`
- [ ] `35-func-tab-ia`

### Fase 3 — Board
- [ ] `30-func-page-board`
- [ ] `30b-func-board-stages-dnd-reorder`
- [ ] `41-func-contato-aba-personalizados`

### Fase 4 — Tarefas
- [ ] `31-func-page-tarefas`
- [ ] `31b-func-tarefas-calendar-view`
- [ ] `42-func-contato-aba-tarefas`

### Fase 5 — Visão Geral
- [ ] `40-func-evoluir-dashboard`

### Fase 6 — Fechamento
- [ ] `50-func-sidebar-nova`
- [ ] `51-func-redirects-legacy-settings`
- [ ] `99-func-rbac-novas-secoes`
- [ ] `43-func-contato-filtro-custom-fields`

### Opcionais (fora do escopo desta execução)
- `14 Parte B` — upgrade Vault/pgsodium (só sob demanda)
- `98-func-rbac-granularidade-settings` — só sob demanda

---

## Próxima ação
Executar **`13-func-schema-ai-settings` + Parte A da `14`** — criar tabela singleton `ai_settings` com RLS admin-only + `status_aprovacao='ATIVO'`.

---

## Decisões tomadas durante execução

### Issue 10 — schema boards
- Migration: `supabase/migrations/013_merge_boards.sql`
- Seed criou 1 board padrão "Seguidores" com 6 estágios: Novo Seguidor, Pediu Formulário, Preencheu Formulário, Contato Feito, Declarou Voto, Multiplicador
- Cores dos estágios (Tailwind): `sky`, `violet`, `indigo`, `emerald`, `amber`, `rose` (seguindo Sky Blue do DESIGN_SYSTEM.md)
- Guardo apenas o nome da cor (ex: `'sky'`), frontend interpola com `bg-sky-500` etc.
- Constraint `boards_tipo_entidade_check` aceita 'contact', 'demand', 'leader' (futuro)
- Unique constraint `board_items_unique_contact_board`: 1 contato por board (mas pode em vários boards diferentes)
- Seção RBAC 'board' criada no seed de permissoes_perfil: admin/proprietario/assessor têm tudo; assistente só editar; estagiário só ver
- Reusei helpers existentes: `update_updated_at_column()`, `get_current_user_role()`, `has_permission()`, `is_user_active()`
- `board_stages.cor` é TEXT simples (nome Tailwind), não um enum — permite flexibilidade no frontend

### Issue 11 — schema tarefas
- Migration: `supabase/migrations/014_merge_tarefas.sql`
- Enum `tarefa_tipo`: LIGACAO, REUNIAO, VISITA, WHATSAPP, EMAIL, TAREFA
- FKs opcionais: contact_id, leader_id, demand_id, board_item_id (ON DELETE SET NULL — tarefa sobrevive à remoção do vínculo)
- **Trigger `tarefas_set_concluida_em`**: seta `concluida_em = now()` automaticamente quando `concluida` vira TRUE, e reseta para NULL se voltar a FALSE. Mantém integridade sem depender do frontend.
- Índices parciais `WHERE NOT concluida` para queries comuns (tarefas pendentes por responsavel/data)
- RLS permite o próprio responsável editar sua tarefa mesmo sem permissão de `editar` na seção (política pragmática)
- Seção RBAC 'tarefas' no seed: todos os roles podem criar/editar tarefas (operacional), só admin/proprietário deletam. Assistente e estagiário têm `so_proprio=TRUE`.
- Tabela `activities` NÃO foi tocada (continua sendo audit log puro)

### Issue 12 — schema campos personalizados
- Migration: `supabase/migrations/015_merge_custom_fields.sql`
- Habilitada extensão `unaccent` (antes só tinha pgcrypto e uuid-ossp)
- Função SQL `slugify_campo(label)` testada: "Cargo Liderança" → "cargo_lideranca", "Nº Dependentes" → "n_dependentes"
- Enum `campo_personalizado_tipo`: texto, numero, data, booleano, selecao
- Duas tabelas: `campos_personalizados` (definições, UNIQUE entidade+chave) e `campos_personalizados_valores` (EAV moderado — 5 colunas tipadas em vez de JSONB)
- Índices parciais por `valor_texto` e `valor_selecao` para acelerar filtros
- **Campos fixos do contato permanecem intocados** — toda a estrutura é em tabelas à parte, conforme combinado
- RLS referencia seção `configuracoes` que ainda não existe (será criada na issue 99). Enquanto isso, só admin gerencia — comportamento desejado.
- Valores (cpv) dependem da permissão `contatos.editar` — quem edita contato edita os campos custom dele

---

## Observações / Erros
(vazio por enquanto)

---

## Plano de referência
- Plano arquitetural completo: `~/.claude/plans/synchronous-waddling-pillow.md`
- Master do merge: `issues/merge-nossocrm/00-master.md`
- Cada issue detalhada em: `issues/merge-nossocrm/NN-*.md`
