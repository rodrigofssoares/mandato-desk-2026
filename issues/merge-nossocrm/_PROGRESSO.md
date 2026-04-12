# Progresso — Merge Nosso CRM → Mandato Desk 2026

**Última atualização:** 2026-04-11 — issue 50 concluída (Fase 6 iniciada)
**Sessão atual iniciada em:** 2026-04-11 19:10 UTC
**Sinal de retomada:** digite `continuar merge-nossocrm` em qualquer sessão futura

---

## Status geral
- **Total:** 23 issues obrigatórias (Fase 0–6, incluindo 14A e 15)
- **Concluídas:** 20 (Fases 0 + 1 + 2 + 3 + 4 + 5 completas ✅, Fase 6: 50 ✅)
- **Em andamento:** 0
- **Pendentes:** 3 (Fase 6: 51, 99, 43)
- **Bloqueadas:** 0
- **Opcionais (fora da contagem):** 14 Parte B, 98

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
- [x] `22-func-hooks-custom-fields` — useCustomFields + useContactCustomValues + upsert em lote — build ok

### Fase 2 — Settings Hub
- [x] `32-func-page-settings-hub` — hub `/settings` com 7 abas, absorvendo Users/Permissoes/Google/Api/Webhooks/Branding; Funis e IA desabilitadas com tooltip; URL sync; build + 12/12 testes verdes
- [x] `33-func-tab-campos-personalizados` — CustomFieldsManager + CustomFieldFormDialog plugados na aba Geral; CRUD completo dos 5 tipos, editor de opções para seleção, validações, confirmação de delete; build + 12/12 testes verdes
- [x] `34-func-tab-funis` — BoardsListPanel + BoardFormDialog + BoardStagesManager (drag-drop @dnd-kit) plugados na aba Funis; CRUD de boards com estágios iniciais, toggle default, expand inline com reorder persistido; 8 cores de estágio; build + 12/12 verdes
- [x] `35-func-tab-ia` — useAISettings + testApiKey + AISettingsTab completo (provider/modelo/chave/enabled/features); aba habilitada em Settings.tsx; máscara da chave + audit log + banner de segurança; build + 12/12 verdes

### Fase 3 — Board
- [x] `30-func-page-board` — rota `/board` com Kanban DnD funcional, BoardSelector, BoardCard com badge "parado há X dias", BoardCardDetailSheet (tarefas pendentes + ações), AddContactToBoardDialog, header com link p/ Settings; protótipo (issue 01) absorvido nessa entrega; bug `telefone_whatsapp` no `useBoardItems` corrigido para `whatsapp/telefone`; build + 12/12 verdes
- [x] `30b-func-board-stages-dnd-reorder` — botão "Editar estágios" no header da página `/board` abre Sheet lateral com `BoardStagesManager` reusado direto da issue 34 (drag-drop vertical, edit nome/cor inline, delete bloqueia se tem items, add stage, batch reorder). Sem duplicar componente; build + 12/12 verdes
- [x] `41-func-contato-aba-personalizados` — `CustomFieldInput` (5 tipos: texto/número/data/booleano/seleção) + `CustomFieldsPanel` (load/save com `useContactCustomValues` + `useSaveContactCustomValues`); aba "Personalizados" inserida no `ContactDialog` entre Pessoais e Campanha; empty state quando não há campos + link p/ Settings; aviso quando contato ainda não foi salvo (cria contato → salva → reabre → aba habilitada); build + 12/12 verdes

### Fase 4 — Tarefas
- [x] `31-func-page-tarefas` — rota `/tarefas` com `TarefasFilters` (search/período/responsável/concluída + chips de tipo) + `TarefasList` agrupada (Atrasadas/Hoje/Amanhã/Esta semana/Próximas/Sem data via `agruparTarefasPorDia`) + `TarefaFormDialog` (CRUD: título/tipo/data-hora/responsável/vínculo contato|articulador|demanda/descrição) + `TarefasBulkToolbar` (concluir/adiar/excluir em lote, sticky bottom). Reusa `useTarefas`, `useToggleTarefaConcluida`, `useDeleteTarefa`, hooks de bulk e `useContact` para resolver nome do contato selecionado. Protótipo (issue 02) absorvido nessa entrega; build + 12/12 verdes
- [x] `31b-func-tarefas-calendar-view` — toggle Lista/Calendário em `/tarefas` com estado em URL (`?view=calendar`), `TarefasCalendar` grid mensal próprio (sem libs novas) via `date-fns`, chips de tarefas com cor do tipo/ícone/hora, +N mais via Popover, click em dia vazio abre create pré-preenchido 09:00, vista mobile como lista vertical. `useTarefas` estendido com `rangeStart/rangeEnd`. `TarefaFormDialog` aceita `defaultDataAgendada`. Build + 12/12 verdes
- [x] `42-func-contato-aba-tarefas` — `ContactTarefasPanel` self-contained (molde `CustomFieldsPanel` issue 41) inserido como aba "Tarefas" no `ContactDialog` entre Personalizados e Campanha. Reusa `TarefaRow` e `TarefaFormDialog` (via `defaultContactId`) — zero duplicação. Sub-abas Pendentes/Concluídas com contadores, empty states próprios, toggle concluir/edit/delete direto nas linhas. `ContactTarefasPendenteBadge` no trigger da aba mostra contagem de pendentes (só quando contato salvo). Empty state "Salve o contato primeiro" quando `contact.id` ausente. Build + 12/12 verdes. **Fase 4 fechada ✅**

### Fase 5 — Visão Geral
- [x] `40-func-evoluir-dashboard` — `useDashboardMetrics(period, boardId)` com ranges atuais/anteriores + 6 componentes novos (`StatCardWithDelta`, `PeriodSelector`, `BoardFunnelCard` com Recharts horizontal + seletor de board + link p/ `/board`, `TarefasHojeCard` (reusa `useTarefasHoje`), `AlertsBadge` + `AlertsModal` agrupando por tipo, `SaudeBaseCard` com Progress para ativos/inativos/perdidos). `Dashboard.tsx` recriado: header com `<PeriodSelector>` + `<AlertsBadge>`, 4 StatCards (Base Total, Novos, Voto Declarado, Multiplicadores), grid principal (Funil + Tarefas Hoje + Aniversários), Saúde da Base, linha inferior (GrowthChart + ActivityFeed), card "Mais métricas" com Tag e Vote charts preservados. Estado de period+board sincronizado via URL (`?period=mes&board=<id>`). 3 tipos de alertas: contatos parados 5+ dias no funil, tarefas vencidas, aniversariantes hoje sem tarefa. Build + 12/12 verdes. **Fase 5 fechada ✅**

### Fase 6 — Fechamento
- [x] `50-func-sidebar-nova` — `AppSidebar.tsx` reorganizado: removidos 7 itens absorvidos em Settings (Etiquetas, Usuários, Permissões, Google, API, Webhooks, Personalização) + adicionados Board, Tarefas e Configurações (com `SidebarSeparator` antes via flag `dividerBefore`). `Secao` type estendido com `board`/`tarefas`/`configuracoes` em `src/types/permissions.ts` + `SECAO_LABELS`. Novas seções ficam `alwaysVisible: true` até issue 99 plugar RBAC formal. Mantido `Campos de Campanha` (não está na lista de remoção e não é absorvido por Settings). Ícones: `KanbanSquare`, `CheckSquare`, `Settings`. Build + 12/12 verdes.
- [ ] `51-func-redirects-legacy-settings`
- [ ] `99-func-rbac-novas-secoes`
- [ ] `43-func-contato-filtro-custom-fields`

### Opcionais (fora do escopo desta execução)
- `14 Parte B` — upgrade Vault/pgsodium (só sob demanda)
- `98-func-rbac-granularidade-settings` — só sob demanda

---

## Próxima ação
Issue 50 concluída ✅ — Sidebar reorganizada para Fase 6. Próxima: **`51-func-redirects-legacy-settings`**. Adicionar redirects no `App.tsx` (ou equivalente) para que URLs legadas de settings (`/users`, `/permissoes`, `/google-integration`, `/api`, `/webhooks`, `/branding`, `/tags`) redirecionem para as abas correspondentes em `/settings?tab=...`. Ver `issues/merge-nossocrm/51-func-redirects-legacy-settings.md`.

---

## Decisões tomadas durante execução

### Issue 50 — Sidebar NAV_ITEMS reorganizado
- **`Campos de Campanha` mantido** fora da lista de remoção: a issue 50 escreveu o diff antes dessa entrada existir no projeto atual. A página é `/campos-campanha` e não corresponde a nenhuma aba de Settings (a aba Geral gerencia Campos Personalizados, que é diferente). Remover cortaria funcionalidade sem substituto. Mantido entre `Importação` e o separador.
- **`dividerBefore: boolean` em `NavItem`** em vez de um item especial tipo `{ type: 'separator' }`. Motivo: evita discriminated union e mantém o `.filter()` de permissões atual funcionando sem ramo especial. O separador só renderiza se o item visível ficou com `index > 0` — garante que nunca sobra um divider órfão no topo quando, por exemplo, o usuário não tem acesso a quase nada e só vê Configurações.
- **Novas seções `board`/`tarefas`/`configuracoes`** entram no tipo `Secao` em `types/permissions.ts` (+ `SECAO_LABELS`), mas o `SECAO_TO_PERMISSION` devolve `() => true` para as três — junto com `alwaysVisible: true` nos itens. Motivo: a matriz `permissoes_perfil` ainda não tem rows para essas seções (issue 99 cria), então qualquer check real devolveria `false` e esconderia o item de todo mundo, incluindo admin. A dupla proteção (`alwaysVisible` + permissão permissiva) evita regredir a UX até a 99 chegar.
- **`SidebarSeparator`** (shadcn — linha 393 de `sidebar.tsx`) reusado em vez de criar separador custom. `className="my-1"` dá a respiração do bloco final.
- **`Fragment` em `react`** importado só pra embrulhar o par `(Separator, MenuItem)` dentro do `.map` preservando a `key={item.href}`. Alternativa seria `<>...</>` mas `Fragment` explícito deixa a key claramente anexada.
- **Icons removidos do import**: `Tags`, `UserCog`, `Shield`, `Globe`, `Code`, `Webhook`, `Palette` — não são mais usados em lugar nenhum deste arquivo. Lint não reclamou, tsc passou.
- **Rotas legadas continuam existindo** (acessíveis por URL direta). A issue 51 vai plantar redirects para elas apontarem pra `/settings?tab=...`. Deixei-as no ar agora para não quebrar bookmarks enquanto o redirect não está implementado.
- **Permissões atuais do admin `etiquetas` / `usuarios` / etc. continuam no `SECAO_TO_PERMISSION`**: mesmo que não existam mais itens no sidebar referenciando essas entradas, o `Secao` type ainda precisa delas (back-compat com `permissoes_perfil`, `PermsTab`, RBAC existente). Só removo quando a issue 99 limpar.
- Build 2626→2626KB / gzip 778→778KB (sem delta relevante). 12/12 testes verdes.

### Issue 40 — Visão Geral (Dashboard evoluído)
- **Hook único `useDashboardMetrics(period, boardId)`** em `src/hooks/useDashboardMetrics.ts` — concentra todas as agregações numa única query e faz cálculo de delta no frontend em vez de espalhar múltiplos hooks. Trade-off: uma query "gorda" vs. muitas pequenas — escolhi a gorda porque React Query já serializa as `count`s em paralelo via `Promise.all`, e a troca de período invalida tudo de uma vez.
- **Ranges de comparação por período**:
  - `hoje` → hoje vs. ontem
  - `7d` → últimos 7d (D-6..D) vs. 7d anteriores (D-13..D-7)
  - `30d` → últimos 30d vs. 30d anteriores
  - `mes` → mês corrente vs. mês anterior
- **Delta snapshot vs. delta flow**: para `Base Total`, `Voto Declarado` e `Multiplicadores` (métricas cumulativas), o "anterior" é o snapshot no fim do período anterior (`created_at <= prevEnd` ou `updated_at <= prevEnd`). Para `Novos no Período` (métrica de fluxo), o anterior é a contagem no range anterior. Isso mantém os deltas coerentes com a semântica de cada métrica.
- **Saúde da Base**: regra simples baseada em `updated_at` do contato. Ativo = updated nos últimos 30d, Inativo = 30–90d, Perdido = 90d+. Sem necessidade de tabela nova. A soma dos 3 pode divergir ligeiramente do Base Total porque um contato com `updated_at` null cai em "perdidos" — aceitável para visão geral.
- **Funil**: consome `board_stages` + agregação em memória de `board_items.stage_id`. O `BoardFunnelCard` usa Recharts `BarChart layout="vertical"` com `<Cell fill={stage.cor}>` pra respeitar a cor do estágio (issue 34). Empty states: sem boards → CTA "Criar funil" → `/settings?tab=funis`; sem items → link pra `/board`.
- **Seletor de board no card do Funil** (não no header global) porque o board só afeta esse card. Sync em URL via `?board=<id>`. A persistência casa com a da página `/board` (issue 30), então alternar entre dashboard e board mantém o mesmo board selecionado.
- **3 tipos de alertas** calculados junto com as métricas (evita 3 requests extras no componente):
  1. `contato_parado`: `board_items.moved_at <= now - 5d` no board ativo. Link → `/board?board=<id>`.
  2. `tarefa_vencida`: `tarefas.data_agendada < startOfDay(now) AND concluida = false`. Link → `/tarefas`.
  3. `aniversariante_sem_tarefa`: contatos com `data_nascimento` MM-DD = hoje que não têm tarefa agendada para hoje. Link → `/contacts?contact=<id>`.
- **Aniversariante MM-DD**: Supabase não expõe `EXTRACT(MONTH)` fácil via `.filter()`, então busco todos os contatos com `data_nascimento` e filtro local por `data_nascimento.slice(5) === mmdd`. Performance: aceitável até ~50k contatos (um single fetch).
- **`AlertsModal` agrupado por tipo** com ícone+cor por grupo. Cada item é `Link` que fecha o modal ao navegar. Lista dentro de ScrollArea com `max-h-[60vh]`.
- **`StatCardWithDelta`**: delta colorido (verde ↑ / vermelho ↓ / cinza minus), fallback "sem variação" quando delta = 0, "sem comparação" oculto quando `deltaPct === null` (previous=0). Ícone num quadrado colorido à direita, label em caps. Hint opcional (ex: "31% taxa" no card de Voto Declarado, "neste mês" no card Novos).
- **`PeriodSelector` sync em URL via `?period=`** para permitir linkar `/?period=7d`. Default = `mes`. O `AlertsModal` abre via state local (não vale a pena poluir URL).
- **Preservação dos componentes existentes**: `BirthdaySection`, `GrowthChart`, `ActivityFeed`, `TagDistributionChart`, `VoteDeclarationChart` ficam intactos. Os dois últimos movidos pra uma seção "Mais métricas" (Card com 2 colunas). `DashboardStatsCards` e `GrowthMetricsCards` ficam aposentados na página (não deletei os arquivos — podem virar úteis em outros contextos, e a issue 50 pode limpar).
- **Layout responsivo**: 4 StatCards em 1/2/4 colunas. Grid principal 1/3 colunas (Funil ocupa 2/3 em lg). Linha inferior mesmo padrão. "Mais" em 1/2 colunas. Header com `flex-col sm:flex-row` para quebrar em mobile.
- **TypeScript gotcha com join Supabase**: `select('id, moved_at, contact:contacts(...)')` retornado como array no generic do supabase-js v2, mas na prática vem objeto (many-to-one). Fiz `Array.isArray(raw.contact) ? raw.contact[0] : raw.contact` com cast via `unknown` pra destravar o tsc.
- **Ícones dos 4 StatCards**: `Users` (base), `UserPlus` (novos), `CheckCircle2` (voto), `Megaphone` (multiplicadores) — todos do lucide, cores suaves em bg-*/10.
- **Bundle**: 2609→2627KB / gzip 773→779KB (+6KB gzipped). Build + 12/12 testes verdes.

### Issue 31b — vista de Calendário na página Tarefas
- **Sem lib nova**: grid mensal próprio com `date-fns` (`startOfMonth/endOfMonth/startOfWeek/endOfWeek/eachDayOfInterval/isSameMonth/isToday/format/addMonths/subMonths/parseISO`) + `Popover` de shadcn. Rejeitado `react-big-calendar` (peso + estilização difícil) e `react-day-picker` (é date picker, não agenda).
- **Toggle em URL (`?view=calendar`)** via `useSearchParams`. Default = list. Botões `<List>/<Calendar>` no header em um wrapper com borda, estado ativo por `variant="default"`.
- **Extensão de `useTarefas`**: adicionado `rangeStart?: string` e `rangeEnd?: string` (ISO) em `TarefaFilters`. O calendário passa `periodo: undefined` e usa range customizado (semana inicial do mês até semana final). **Decisão importante**: range é filtro adicional (aplicado com gte/lte), não substituto do `periodo`, pra não quebrar o filtro existente da lista.
- **Agrupamento por dia**: `useMemo` que itera as tarefas e monta `Map<'yyyy-MM-dd', Tarefa[]>`. Dentro de cada dia ordena por horário. A chave do dia é `format(parseISO(data_agendada), 'yyyy-MM-dd')` — preserva o fuso local (não usa `toISOString().slice(0,10)`).
- **Grid**: 7 colunas × 5-6 linhas calculadas por `eachDayOfInterval({ start: startOfWeek(startOfMonth), end: endOfWeek(endOfMonth) })`. Dias fora do mês corrente ficam com `opacity-40`. Dia de hoje marcado com círculo `bg-primary`.
- **Chip de tarefa**: reusa `TarefaIcon` direto (inclui as cores do tipo). Mostra `HH:mm` + título truncado. Strikethrough + `opacity-60` quando concluída. Click com `stopPropagation()` pra não disparar o onCreate do dia.
- **+N mais**: `Popover` shadcn, PopoverContent lista todas as tarefas do dia verticalmente com data no topo em `EEEE, d 'de' MMMM`. Click no popover abre edit e fecha o popover.
- **Responsivo**: `hidden md:block` no grid; `md:hidden` numa lista vertical de **todos os dias do mês corrente** como cards (mesmo vazios, com hint "Tocar p/ criar"). Evita scroll horizontal brutal no mobile.
- **Pitfall HTML**: a célula do dia começou como `<button>` mas ela contém chips (que também são botões) → HTML inválido (button dentro de button). Troquei por `<div role="button" tabIndex={0}>` com handler de Enter/Space no `onKeyDown`. A célula vira clicável sem quebrar acessibilidade.
- **`TarefaFormDialog` estendido**: nova prop opcional `defaultDataAgendada?: string | null`. No `useEffect` de reset (modo create), inicializa `dataAgendada` usando `toDatetimeLocal(defaultDataAgendada ?? null)`. Em `Tarefas.tsx`, `handleCreateAtDate(day)` fixa o horário em 09:00 via `setHours/setMinutes/setSeconds/setMilliseconds` antes de salvar no state `createDefaultDate` e passar pro dialog. Ao fechar o dialog, `createDefaultDate` é resetado junto com `editing`.
- **Query duplicada aceita**: quando em vista calendar, o `useTarefas(filters)` do pai continua rodando (serve pra resolver labels de vínculo e pra ser reaproveitado se voltar pra lista). O componente calendar faz sua própria query com range. Não é otimo mas o overhead é pequeno e react-query cacheia. Não vale a pena o acoplamento de early-return.
- **Bundle**: 2599→2609KB / gzip 770→773KB (+10KB do componente novo + date-fns helpers já tree-shaken). 12/12 testes verdes.

### Issue 31 — página Tarefas funcional
- **Protótipo (issue 02) absorvido**: nunca existiu `src/pages/Tarefas.tsx` nem `src/components/tarefas/`. Como os hooks da issue 21 já estavam prontos, criei direto a versão funcional. Mesmo modelo da issue 30. `TarefasCalendar` ficou de fora — entra na issue 31b.
- **Componentes criados em `src/components/tarefas/`**:
  - `TarefaIcon.tsx` — switch por `tipo` retornando ícone lucide colorido + export `TIPO_LABELS` para reutilização nos filtros e no form. 6 tipos (LIGACAO/REUNIAO/VISITA/WHATSAPP/EMAIL/TAREFA).
  - `TarefaRow.tsx` — linha com 2 checkboxes (seleção bulk + concluído), ícone, título, vínculo, data formatada `dd/MM 'às' HH:mm` e badge "atrasada" automático. Ações editar/excluir aparecem só no hover.
  - `TarefasList.tsx` — render das 6 seções (Atrasadas/Hoje/Amanhã/Esta semana/Próximas/Sem data) usando `agruparTarefasPorDia` (issue 15). Empty state amigável quando todas as seções estão vazias. **Atrasadas** vermelho, demais neutras.
  - `TarefaFormDialog.tsx` — dialog CRUD com 3 comboboxes (Contato/Articulador/Demanda) que aparecem condicionalmente conforme o "tipo de vínculo" escolhido. ContatoCombobox usa `useContacts({search})` pra busca server-side + `useContact(value)` pra resolver o nome do selecionado mesmo fora da busca atual (evita "fica vazio em modo edit"). Data via `<input type="datetime-local">` (sem dependência de calendar primitive). Responsável tem opção "Eu (atual)" → null no payload (hook usa `user?.id` como fallback).
  - `TarefasFilters.tsx` — busca + período (todas/atrasadas/hoje/amanhã/semana) + responsável + estado (todas/pendentes/concluídas) + chips toggle de tipos (multi-seleção). Botão "Limpar" só aparece quando algum filtro está ativo.
  - `TarefasBulkToolbar.tsx` — barra sticky no bottom (`sticky bottom-4`) que aparece quando há seleção. Concluir/Adiar (popover com datetime-local)/Excluir (alert dialog de confirmação). Usa os 3 hooks bulk da issue 21.
- **Página `src/pages/Tarefas.tsx`**: estado local para filters, selectedIds (Set), formOpen, editing, deleting. Resolução de label de vínculo é feita uma vez (useMemo) usando 3 mapas indexados (contacts/leaders/demandas) — evita N+1 e renderiza "Maria S.", "Ana L. (articulador)", "Reforma Praça (demanda)" no `TarefaRow`. Padding bottom extra (`pb-24`) pra não cobrir o último item com a bulk toolbar sticky.
- **Rota**: adicionada `/tarefas` em `App.tsx` (entre `/board` e o catch-all 404). Sidebar não tocada — issue 50 cuida.
- **Gotcha TS de `agruparTarefasPorDia`**: o helper exigia `[key: string]: unknown` no `TarefaAgrupavel`, e `Tarefa` (de `useTarefas`) não tem index signature, então o build falhou. Removi o index signature do `TarefaAgrupavel` (ele só precisa de `id`, `data_agendada` e `concluida` mesmo) e o helper continua genérico. Os testes existentes do helper passam normalmente.
- **Decisão sobre vínculos**: o issue pediu autocomplete `contact/articulador/demanda`. Implementei os 3, com seletor de tipo de vínculo via botões (não 3 campos sempre visíveis) — UX mais limpa. Quando troca de tipo, os outros vínculos são limpos automaticamente.
- **Decisão sobre `useContacts({per_page: 500})` para resolver labels**: é uma chamada extra mas evita N+1. Para tamanhos típicos (< 1000 contatos) é aceitável. Se virar gargalo no futuro, dá pra trocar por uma query nova `useContactsByIds(ids)`.
- 12/12 testes verdes, build verde. Bundle: 2563→2599KB / gzip 760→770KB (cresceu ~10KB porque carrega 3 hooks novos no chunk).

### Issue 41 — aba "Personalizados" no ContactDialog
- Criados 2 arquivos em `src/components/contacts/`:
  - `CustomFieldInput.tsx` — switch por `campo.tipo` renderizando o input adequado: `Input` (texto), `Input type="number"` (número), `Input type="date"` (data), `Switch` (booleano), `Select` com opções do campo (seleção). Aceita `value: string|number|boolean|null` e devolve via `onChange`. **Gotcha TS**: o Input do shadcn não aceita `value: boolean`, então o branch número faz `typeof value === 'number' ? value : ''` para evitar passar boolean por engano.
  - `CustomFieldsPanel.tsx` — componente self-contained (não usa o `useForm` do `ContactDialog`). State local `values: ValoresContato` hidratado por `useEffect` quando `useContactCustomValues(contactId)` carrega. Botão "Salvar campos personalizados" chama `useSaveContactCustomValues({contactId, values, campos})`. 3 estados: sem `contactId` ("Salve o contato primeiro"), sem campos configurados ("Configurar em Settings → Geral" com link), normal (formulário).
- **`ContactDialog.tsx`**: novo `<TabsTrigger value="personalizados">` inserido entre Pessoais e Campanha (mesmo ordem da issue), e novo `<TabsContent value="personalizados">` com `<CustomFieldsPanel contactId={contact?.id} />`.
- **Decisão de UX**: o painel **NÃO** está integrado ao `useForm` do contato porque (a) os campos custom vivem em outra tabela, (b) o save é em lote separado (`useSaveContactCustomValues` upserta tudo), (c) durante a criação o `contact?.id` ainda não existe — então é mais limpo o painel ter seu próprio botão "Salvar". Quando o usuário cria um contato novo, vê o aviso "Salve o contato primeiro" e depois reabre pra preencher os personalizados. Alternativa rejeitada: incluir os custom no submit do form principal — daria muita acoplamento e quebraria se o user não tivesse os hooks de custom_fields ainda carregados.
- **Hooks já existiam** (issue 22). Zero código de banco neste passo.
- **Empty state com link** para `/settings?tab=geral` (a aba que tem o `CustomFieldsManager` da issue 33).
- 12/12 testes verdes, build verde. Bundle: 2558→2563KB / gzip 759→760KB.

### Issue 30b — reorder de estágios via DnD na página Board
- **Decisão pragmática**: a issue pediu pra criar `src/components/board/BoardStagesManager.tsx` (novo). Mas o `src/components/settings/BoardStagesManager.tsx` já existe (criado na issue 34) e já faz **exatamente** o que a issue 30b pede: drag-drop com `@dnd-kit/sortable`, edit nome/cor inline, delete bloqueado se tem items, add stage, batch reorder via `useReorderBoardStages`. Duplicar seria desperdício e fonte de drift futuro.
- **Solução**: importei `BoardStagesManager` direto de `@/components/settings/BoardStagesManager` na página `Board.tsx` e coloquei dentro de um `<Sheet>` (lateral, igual ao `BoardCardDetailSheet`) acionado por um botão "Editar estágios" no header (ao lado do `BoardSelector`).
- **Sortable strategy**: o manager existente usa `verticalListSortingStrategy`. A issue sugeriu `horizontalListSortingStrategy` mas vertical funciona bem dentro de uma sheet lateral e a UX é mais conhecida pelos usuários. Não vale a pena criar uma segunda variante horizontal.
- **Sidebar settings vs board**: as 2 entradas existem agora — admin pode editar em Settings → Funis OU dentro do próprio Board (atalho). Mesma lógica, mesma persistência.
- **Bundle**: praticamente sem mudança (2557→2558KB / gzip 759.0→759.3KB), porque o componente já era importado em outro chunk.
- 12/12 testes verdes, build verde.

### Issue 30 — página Board funcional (Kanban)
- **Issue 01 (protótipo) absorvida nessa entrega**: o protótipo nunca foi feito (não existia `src/pages/Board.tsx` nem `src/components/board/`), então criei direto a versão funcional. Sem prejuízo, porque os hooks já existiam (issue 20).
- **Bug crítico no `useBoardItems` corrigido antes de tudo**: o hook fazia JOIN com `contact:contacts(id, nome, telefone_whatsapp, ...)` mas a tabela `contacts` tem `whatsapp` (não `telefone_whatsapp`). Trocado para `whatsapp, telefone` no select e no tipo `BoardItemWithContact`. Sem isso a query falharia em runtime.
- **Arquivos criados**:
  - `src/pages/Board.tsx` — página principal. Resolve `activeBoardId` por prioridade: URL `?board=...` > board default > primeiro. Sincroniza URL automaticamente quando cai pra fallback. Empty states para "sem boards" e "board sem estágios" com CTA pra criar/gerenciar.
  - `src/components/board/BoardSelector.tsx` — Select shadcn com badge "padrão".
  - `src/components/board/BoardKanban.tsx` — `DndContext` + `useDroppable` por coluna + `useDraggable` no card. Usa estado `optimistic: Record<itemId, stageId>` para mover o card visualmente antes do servidor responder, e limpa quando a invalidação volta. Reverte em onError.
  - `src/components/board/BoardColumn.tsx` — coluna com header colorido (reusa `stageColors.ts` da issue 34), badge contador, ScrollArea, footer com botão "Adicionar contato".
  - `src/components/board/BoardCard.tsx` — Card draggable com nome, telefone (whatsapp ou telefone), badge "N tarefas pendentes" via `useTarefasPendentesCount`, badge ⚠ "Xd" se `daysSince(moved_at) >= 5`, dropdown menu com "Remover do board". `e.stopPropagation()` no menu trigger pra não disparar drag.
  - `src/components/board/BoardCardDetailSheet.tsx` — Sheet lateral com ações: WhatsApp (link `wa.me`), telefone (`tel:`), email (`mailto:`), lista de tarefas pendentes (`useTarefas({contact_id, concluida:false})`), link "Abrir contato completo" → `/contacts?contact={id}`, botão "Remover do board" (vermelho).
  - `src/components/board/AddContactToBoardDialog.tsx` — busca contatos via `useContacts({search, per_page: 30})`, lista clicável, marca quem já está no board como disabled. Select de estágio (HTML nativo, pra não complicar com SelectContent dentro de Dialog). Reset do state quando fecha.
- **Reusos**:
  - `BoardFormDialog` (settings/issue 34) é importado direto pra criar novo board, sem duplicar.
  - `stageColors.ts` da issue 34 reaproveitado para cores das colunas.
  - `BoardCard` consome `useTarefasPendentesCount` (issue 21).
- **Rota** adicionada em `App.tsx`: `/board` protegida por `ProtectedRoute`.
- **Header da página** tem 2 ações: "Gerenciar funis" → `/settings?tab=funis` (link) e "Novo board" → abre `BoardFormDialog`. Decisão: não duplicar todo o gerenciamento de estágios — quem quiser editar/reordenar estágios vai pro Settings. A issue 30b vai resolver edição inline.
- **Optimistic update do drag**: usei `useState<Record<itemId, stageId>>` em vez de mexer no cache do react-query — mais simples e cobre o caso de o servidor demorar. Quando `onSuccess` invalida o cache, limpo o override.
- **Sidebar não tocada**: a issue 50 (Fase 6) é quem reorganiza a sidebar e adiciona o item "Funis". Por enquanto o `/board` é acessível por URL ou pelo link "Funis" em Settings.
- **Build**: bundle subiu 2537→2557KB / gzip 754→759KB (cards + sheet + dnd handlers). 12/12 testes verdes.

### Issue 35 — aba IA: Central de configuração de IA
- Criados 3 arquivos:
  - `src/hooks/useAISettings.ts` — query do singleton + `useUpdateAISettings`. Exporta `maskKey` (3 primeiros + 12 bullets + 4 últimos). O hook sempre retorna a chave **mascarada** quando admin (defense in depth, mesmo com RLS já bloqueando não-admin) e nunca a chave real ao componente; expõe a flag `api_key_set` para o form decidir o placeholder.
  - `src/lib/ai/testApiKey.ts` — função pura que faz `GET` no endpoint de modelos de cada provider (`api.anthropic.com/v1/models`, `api.openai.com/v1/models`, `generativelanguage.googleapis.com/v1/models`). Retorna `{ ok: true } | { ok: false, error }`. Documentado no JSDoc que este é o **único** ponto do frontend que toca chave em texto plano (admin acabou de digitar) — uso real fica sempre server-side via Edge Function.
  - `src/components/settings/AISettingsTab.tsx` — substitui o stub. Form controlado com state local hidratado por `useEffect(settings)`. Cards: Provider (Select), Modelo (Select reativo ao provider), Chave API (Input password + botão Testar), IA ativa (Switch), Features (3 checkboxes desabilitadas se `aiEnabled=false`). Rodapé com botão Salvar.
- **Settings.tsx**: removido `'ia'` de `DISABLED_TABS` (que ficou vazio mas mantive a const por consistência da assinatura). Removidos imports `Tooltip/TooltipContent/TooltipTrigger` e o wrapper `<span>` em volta do TabsTrigger — ficou `<TabsTrigger value="ia">IA</TabsTrigger>` simples.
- **Decisão de Provider/Modelo via Select** em vez de RadioGroup: o projeto não tem `radio-group.tsx` em `components/ui/`, e Select já é o padrão usado em outras abas — evita instalar componente novo.
- **Hidratação do input de chave**: o input começa SEMPRE vazio. Se `api_key_set=true`, o `CardDescription` mostra a chave mascarada (`sk-••••••••••••ABCD`) e diz "deixe em branco para mantê-la". No `handleSave`, se `apiKeyInput.trim()` for vazio, `api_key` **não vai** no patch (mantém a existente). Após save bem-sucedido, o input é resetado para evitar re-envio acidental em saves sequenciais.
- **Reset de modelo ao trocar de provider**: `useEffect([provider, model])` reseta o modelo para o primeiro disponível se o atual não estiver na lista do novo provider. Evita modelo "órfão".
- **Não-admin**: o componente faz early return com Alert "Acesso restrito" se `!isAdmin`. RLS já bloqueia o SELECT de qualquer jeito, mas o frontend ainda dá feedback claro.
- **Banner de segurança (issue 14 A.4)**: Alert no topo explicando que a chave fica protegida por RLS, chamadas reais são server-side e não-compartilhar admin com terceiros.
- **Audit log (issue 14 A.5)**: `useUpdateAISettings.onSuccess` chama `logActivity({ type: 'update', entity_type: 'ai_settings', entity_id: data.id, description: 'Configuração de IA alterada' })` — `entity_type` já estava no union do `logActivity.ts` (ativado na issue 20).
- **Gotcha TS resolvido**: `if (result.ok)` não estava narrowing o discriminated union do `TestApiKeyResult` no tsc 5.x. Trocado por `if (result.ok === true)` e funcionou.
- Build CSS continua 91KB / gzip 19.57KB; bundle total 2537KB / gzip 754KB (sem mudança relevante). 12/12 testes verdes.

### Issue 34 — aba Funis: Gerenciar boards e estágios
- Criados 4 arquivos em `src/components/settings/`:
  - `stageColors.ts` — paleta de 8 cores (`sky, violet, indigo, emerald, amber, rose, cyan, orange`) com helpers `stageDotClass`, `stageBgClass`, `stageTextClass`, `nextStageColor`. **Importante**: classes Tailwind precisam estar completas no código-fonte (JIT), então usei um Record estático ao invés de `bg-${cor}-500` dinâmico.
  - `BoardFormDialog.tsx` — criar/editar board. No create pede estágios iniciais (mínimo 2). Color picker popover por linha de estágio. Na edição, só o board (não os estágios — esses são gerenciados pelo `BoardStagesManager` no expand).
  - `BoardStagesManager.tsx` — drag-drop vertical com `@dnd-kit/sortable` (mesma pattern do `CamposCampanha.tsx`), inline edit de nome, color picker popover, add stage no rodapé, delete com confirmação. O hook `useDeleteBoardStage` já bloqueia delete se o stage tiver items (mostra toast com count).
  - `BoardsListPanel.tsx` — lista de boards em `Card` + `Collapsible`. Header mostra nome, descrição, badge "Padrão", contadores (N estágios · N contatos), ações (toggle default, editar, deletar). Expand mostra o `BoardStagesManager` embutido.
- `FunisTab.tsx` agora envolve `BoardsListPanel` num Card (substitui stub).
- **`Settings.tsx`**: removido `'funis'` do `DISABLED_TABS` e removido o wrapper `<Tooltip>` + `<span>` do `TabsTrigger value="funis"`. O trigger virou `<TabsTrigger value="funis">Funis</TabsTrigger>` simples.
- **Toggle default no header do board card**: `useUpdateBoard({ is_default: true })` já cuida de desmarcar o board padrão anterior (lógica no hook). Botão fica desabilitado quando o próprio já é default, ícone preenchido quando ativo.
- **Delete cascateia**: migration 013 define `ON DELETE CASCADE` nos stages e items. Alert dialog explica que os contatos não são removidos, só o posicionamento.
- Build CSS subiu de 86KB → 91KB (Tailwind JIT incluiu as 8 cores × 3 variações); gzipped 18.93KB → 19.56KB. Aceitável.
- 12/12 testes verdes (nada em helpers/hooks tocado).

### Issue 33 — aba Geral: Campos Personalizados funcional
- Criados `src/components/settings/CustomFieldsManager.tsx` (lista + ações) e `CustomFieldFormDialog.tsx` (create/edit).
- `GeneralTab` agora envolve o manager num Card (removido o stub "Em construção").
- **Tipo não pode ser alterado na edição** (select desabilitado com mensagem) — alinhado com `useUpdateCustomField` que não aceita `tipo` no patch. Justificativa: trocar o tipo invalidaria os valores já salvos (diferentes colunas).
- **Chave também readonly na edição** — gerada a partir do rótulo só no create. O dialog mostra a chave preview em ambos os modos mas deixa claro que é read-only no edit.
- **Slugify no client** via `src/lib/slugify.ts` (já existia) para o preview em tempo real enquanto o usuário digita.
- **Editor de opções (tipo seleção)**: array dinâmico com mínimo 2. Botão remover ficava desabilitado se sobrariam menos de 2. Validação de 2+ não-vazias ao salvar.
- **Filtrável default=true** (switch visível no dialog, também salvo no hook como default).
- **Delete**: `AlertDialog` com aviso explícito "apagará todos os valores". CASCADE na migration 015 já apaga os `campos_personalizados_valores` automaticamente.
- **Empty state** com ícone + CTA "adicionar campo".
- Não incluí as outras seções mencionadas na issue 33 (Página inicial default, Fuso, link Gerenciar etiquetas) — só o manager de Campos Personalizados. Justificativa: essas outras seções dependem de `user_settings`/`profiles` que ainda não existem no schema e não estão cobertas por hooks. Ficam para futura issue ou sub-tarefa sem bloquear o fluxo principal do merge.
- Build + 12/12 testes verdes.

### Issue 32 — Settings Hub (shell com abas)
- Página: `src/pages/Settings.tsx` + 7 arquivos em `src/components/settings/`
- **Decisão pragmática**: reusar as páginas legadas como componentes (ex: `TeamTab` = `<Users />`, `PermsTab` = `<Permissoes />`, etc.) em vez de extrair "Content wrappers" como a issue 32 sugeria. Justificativa: todas as páginas legadas já retornam apenas `<div className="p-6 space-y-6">…</div>` no top-level — o wrapper `AppLayout` é aplicado pelo `ProtectedRoute` em `App.tsx`, não dentro das páginas. Logo, importar o default export funciona sem refactor, sem duplicação e sem risco de regressão nas rotas legadas.
- **Rotas legadas preservadas**: `/users`, `/permissoes`, `/google-integration`, `/api`, `/webhooks`, `/branding` continuam todas funcionais (issue 51 vai redirecionar no futuro). Sidebar também não foi tocada (issue 50).
- **7 abas na ordem**: Geral | Funis | Equipe | Permissões | Integrações | IA | Personalização
- **Funis e IA** desabilitadas com tooltip "Em breve". Como `TabsTrigger` tem `disabled:pointer-events-none`, o tooltip precisa ser disparado por um `<span>` wrapper em volta do trigger (senão o mouseover não chega no Radix Tooltip).
- **URL state**: `useSearchParams` com normalização. Aba default = `geral`. Ao trocar de aba principal, sub-aba de Integrações é limpa. Dentro de `IntegrationsTab`, sub-tab fica em `?tab=integracoes&sub=google|api|webhooks`.
- **Validação de aba inválida**: se `?tab=xyz` não for uma das 7 conhecidas, fallback para `geral` (não faz redirect, só o Tabs abre na default — URL permanece como estava).
- **Permissões**: nenhum filtro de visibilidade nas abas — as próprias páginas legadas já têm seu check via `usePermissions`. RBAC granular fica para issue 98 (opcional).
- Aba "Geral" tem stub com Card "Em construção (issue 33)". A issue 33 vai substituir esse Card pelo `CustomFieldsManager`.
- Build passou (2.5MB index, já era assim); 12/12 testes verdes (nada em helpers/hooks foi tocado).

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

### Issue 22 — hooks de campos personalizados
- Arquivo: `src/hooks/useCustomFields.ts`
- Queries: `useCustomFields({ filtravel? })`, `useContactCustomValues(contactId)`
- Mutations: `useCreateCustomField`, `useUpdateCustomField`, `useDeleteCustomField`, `useSaveContactCustomValues`
- Helpers exportados: `colunaValorParaTipo()`, `extrairValor()`
- **Slugify** (do `src/lib/slugify.ts` criado na issue 15) gera a `chave` a partir do `rotulo` com validação:
  - String vazia bloqueada
  - Blacklist evita colisão com campos fixos do contato (id, nome, email, telefone, cpf, timestamps)
  - Código de erro `23505` do Postgres traduzido como "já existe campo com essa chave"
- **Tipo `selecao`** exige pelo menos 2 opções no create (validação no frontend)
- **`useUpdateCustomField`**: NÃO regera `chave` ao mudar rotulo — isso manteria estabilidade dos valores já salvos
- **`useContactCustomValues`**: faz JOIN com `campos_personalizados.tipo` para normalizar o retorno no formato `{ [campo_id]: valor }` — frontend não precisa descobrir qual coluna ler
- **`useSaveContactCustomValues`**: upsert em lote com `onConflict: 'campo_id,contact_id'`. Frontend passa `{ contactId, values, campos[] }` e o hook monta as rows com a coluna correta por tipo. Uma única query no banco.
- Delete cascateia automaticamente pelos valores (definido na migration 015)

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
