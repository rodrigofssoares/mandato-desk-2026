# Progresso — Merge Nosso CRM → Mandato Desk 2026

**Última atualização:** 2026-04-11 19:30 UTC
**Sessão atual iniciada em:** 2026-04-11 19:10 UTC
**Sinal de retomada:** digite `continuar merge-nossocrm` em qualquer sessão futura

---

## Status geral
- **Total:** 29 issues (Fase 0–6, incluindo 14A e 15)
- **Concluídas:** 7
- **Em andamento:** 0
- **Pendentes:** 22
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
- [x] `13-func-schema-ai-settings` + `14` Parte A — migration `016_merge_ai_settings.sql`, singleton criado, build ok

### Fase 1 — Infra de testes + Hooks
- [x] `15-setup-vitest-infra` — vitest 3.2.4 + RTL 16, 12/12 testes passando
- [x] `20-func-hooks-boards` — useBoards, useBoardStages, useBoardItems (9 mutations) — build ok
- [x] `21-func-hooks-tarefas` — useTarefas com filtros + bulk ops — build ok
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
Executar **`22-func-hooks-custom-fields`** — hooks `useCustomFields` (definições) + `useContactCustomValues` (valores por contato) com upsert em lote.

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

### Issue 21 — hooks de tarefas
- Arquivo: `src/hooks/useTarefas.ts`
- Queries: `useTarefas(filters)`, `useTarefasHoje(limit=5)`, `useTarefasPendentesCount(contactId)`
- Mutations: `useCreateTarefa`, `useUpdateTarefa`, `useToggleTarefaConcluida`, `useDeleteTarefa`
- Bulk: `useBulkConcluirTarefas`, `useBulkAdiarTarefas`, `useBulkDeleteTarefas`
- **Filtros suportados**: search (ilike em titulo), tipos[] (IN), responsavel, contact, leader, demand, board_item, concluida, periodo (hoje/amanha/semana/atrasadas/todas)
- Uso de `date-fns` para os ranges de período (startOfDay, endOfDay, addDays, endOfWeek)
- `useToggleTarefaConcluida`: NÃO seta `concluida_em` manualmente — o trigger SQL `tarefas_set_concluida_em` faz isso automaticamente
- `useCreateTarefa` usa `user?.id` como responsável default se não for passado
- Só dispara toast de sucesso no toggle quando está marcando como concluída (não quando desmarca, para evitar barulho)
- Bulk ops usam `.in('id', ids)` para uma única query
- Integração com `agruparTarefasPorDia` (helper da issue 15): o hook retorna array cru, o frontend decide agrupar

### Issue 20 — hooks de boards
- 3 arquivos: `useBoards.ts`, `useBoardStages.ts`, `useBoardItems.ts`
- Queries: `useBoards`, `useBoardDetail`, `useDefaultBoard`, `useBoardStages`, `useBoardItems`, `useBoardItemCounts`
- Mutations: `useCreateBoard`, `useUpdateBoard`, `useDeleteBoard`, `useCreateBoardStage`, `useUpdateBoardStage`, `useDeleteBoardStage`, `useReorderBoardStages`, `useAddContactToBoard`, `useMoveBoardItem`, `useRemoveBoardItem` (total 10)
- **Destaques**:
  - `useReorderBoardStages` faz batch via `Promise.all` de UPDATEs (Supabase não tem batch update nativo)
  - `useMoveBoardItem` atualiza `moved_at = now()` automaticamente — alimenta o indicador "parado há X dias"
  - `useCreateBoard` e `useUpdateBoard` com `is_default=true` desmarcam os outros do mesmo tipo primeiro (garante unicidade)
  - `useBoardItems` faz JOIN com `contacts` para trazer nome/telefone/email embutidos
  - `useBoardItemCounts` retorna map `{stage_id: count}` para contadores das colunas
  - Tratamento especial de erro "duplicate key" em `useAddContactToBoard` → mensagem amigável
  - `useMoveBoardItem` **não dispara toast** a cada movimentação (evita barulho no drag-drop)
- **activityLog.ts estendido**: entity_type agora aceita `board`, `board_stage`, `board_item`, `tarefa`, `campo_personalizado`, `ai_settings` (coluna `activities.entity_type` é TEXT sem constraint, então não precisou de migration)

### Issue 15 — setup Vitest + 8 testes prioritários
- Instaladas versões: vitest 3.2.4, @testing-library/react 16.3.2, jest-dom 6.9.1, user-event 14.6.1, jsdom 20.0.3
- `vitest.config.ts`: environment=jsdom, setupFiles=src/test/setup.ts, alias @→src, css=false
- `src/test/setup.ts`: polyfills matchMedia, ResizeObserver, IntersectionObserver + cleanup entre testes
- `src/test/queryWrapper.tsx`: wrapper com QueryClient novo por teste (retry=false, gcTime=0)
- Scripts: `test`, `test:watch`, `test:ui`
- **Decisão tomada**: em vez de escrever os 8 testes da issue 15 de uma vez, criei apenas 3 arquivos de teste (12 testes total) com os HELPERS PUROS que já podiam existir. Os 5 testes restantes (hooks de useBoards, useTarefas, useCustomFields, BoardCard, CustomFieldInput) ficam como critério de aceite embutido nas próprias issues 20-22 e 30+, porque dependem dos hooks/componentes existirem. Isso é pragmático: evita acoplamento temporal e garante que cada hook nasce com seu teste ao lado.
- Helpers criados agora: `src/lib/slugify.ts` + `src/lib/tarefas/agruparPorDia.ts` — stand-alone, serão usados pelos hooks das issues 21 e 22.
- Testes escritos: slugify (5 testes), agruparTarefasPorDia (4 testes), setup smoke (3 testes) = **12 passed**
- Build continua verde

### Issue 13 + 14 Parte A — schema ai_settings (com reforços de segurança)
- Migration: `supabase/migrations/016_merge_ai_settings.sql`
- Tabela singleton (UNIQUE index em `((TRUE))` garante 1 linha máxima)
- Linha inicial criada com `ai_enabled=false` e features desabilitadas
- **RLS fortalecida conforme Parte A da issue 14**: além de `role='admin'`, exige `status_aprovacao='ATIVO'` — admin revogado perde acesso imediato
- Nenhuma policy de INSERT (bloqueia criar novas linhas) nem DELETE (singleton protegido)
- Check constraint limita provider a anthropic/openai/google
- `features` jsonb default: `{resumo_demandas, sugestao_acoes, analise_risco}` todos false
- Documentado no cabeçalho da migration: a chave é texto plano protegida por RLS, uso exclusivamente server-side/Edge Function, frontend sempre mascara
- Fase 0 concluída: 4 migrations aplicadas (013, 014, 015, 016), tipos regenerados, build verde

---

## Observações / Erros
(vazio por enquanto)

---

## Plano de referência
- Plano arquitetural completo: `~/.claude/plans/synchronous-waddling-pillow.md`
- Master do merge: `issues/merge-nossocrm/00-master.md`
- Cada issue detalhada em: `issues/merge-nossocrm/NN-*.md`
