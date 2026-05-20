# Backlog — Filtro de Aceite WhatsApp no Funil e Contatos

**Cliente:** Raquel — Mandato Desk 2026
**Código QG:** RAQ-MAND-EM074
**Briefing:** RODRIGO/4.ARQUIVOS DIVERSOS/EM074-mockups/v1-toolbar-inline-tristate.html
**Backlog escrito por:** Agente Backlog em 2026-05-20

---

## Visão geral

O operador de campanha precisa identificar rapidamente, dentro do board kanban, quais contatos aceitam (ou não) receber mensagens via WhatsApp — sem sair da visão do funil. A solução aprovada é um segmented control tri-state ("Todos / Aceita / Não aceita") na toolbar do funil, com um seletor "a partir de qual etapa" que protege as primeiras colunas de novos leads (mantendo-os sempre visíveis). O filtro é client-side sobre os dados já carregados pelo `useBoardItems`, sem nova query ao servidor. A aba Contatos recebe um chip de atalho tri-state paralelo ao filtro já existente no drawer. Persistência por funil via `localStorage`. O campo `contacts.aceita_whatsapp` já existe no banco — nenhuma migration necessária.

---

## Walking skeleton (entrega valor end-to-end)

**T01** — Expor `aceita_whatsapp` no tipo `BoardItemWithContact` + lógica de filtro client-side em `Board.tsx`

Entrega o valor central da feature: operador abre o funil, ativa "Aceita", e os cards se reorganizam conforme `aceita_whatsapp`. Sem UI polida ainda, mas o comportamento central funciona end-to-end.

---

## Ordem de execução (WSJF + dependências)

| # | Task | Estimativa | Camadas | Depende de | WSJF |
|---|------|-----------|---------|-----------|------|
| 1 | **T01** — Expor `aceita_whatsapp` no tipo e adicionar lógica de filtro client-side em `Board.tsx` | S (2pt) | hook + action | — | (5+4+3)/2 = 6 |
| 2 | **T02** — Componente `WhatsAppFilterControl` (segmented control + seletor de etapa + badge protegida) | M (5pt) | component | T01 | (5+3+2)/5 = 2 |
| 3 | **T03** — Persistência por funil via `localStorage` + fallback de etapa quando funil muda | S (2pt) | action + hook | T02 | (4+3+2)/2 = 4,5 |
| 4 | **T04** — Footer/legenda + contador "Visíveis: X de Y" + responsividade mobile (toolbar wrap) | S (2pt) | component | T02 | (3+2+1)/2 = 3 |
| 5 | **T05** — Chip de atalho tri-state na toolbar da aba Contatos sincronizado com `filters.aceita_whatsapp` | S (2pt) | component | — | (3+2+1)/2 = 3 |

**Total estimado:** 13pt

> T01 desbloqueia T02 e T03. T04 depende de T02 (precisa do componente montado para adicionar o rodapé e ajustar responsividade). T05 é independente de todas as outras — pode rodar em paralelo após T01 ou no fim.

---

## Flag de Security

| Task | Toca auth / dados sensíveis? | Exige Security agent? |
|------|------------------------------|----------------------|
| T01 | Não — leitura de campo existente, client-side | NAO |
| T02 | Não — renderização e estado de UI | NAO |
| T03 | Não — `localStorage` (sem dados pessoais, só preferência de filtro) | NAO |
| T04 | Não — UI pura | NAO |
| T05 | Não — altera `filters.aceita_whatsapp` no estado local da aba Contatos | NAO |

---

## Tasks

---

### T01 — Expor `aceita_whatsapp` no tipo `BoardItemWithContact` e adicionar filtro client-side em `Board.tsx`

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** hook, action (lógica em `Board.tsx`)
**Depende de:** —
**WSJF score:** (5 + 4 + 3) / 2 = 6

#### User story

Como operador de campanha, quero filtrar os cards do funil por aceite de WhatsApp com um clique, para focar minha atenção nas pessoas que posso contatar diretamente.

#### Contexto

O campo `contacts.aceita_whatsapp` existe no banco (`boolean | null`) e já está em `ContactFilters` do hook `useContacts`. No entanto, o hook `useBoardItems` só seleciona um subconjunto das colunas do contato embutido: `id, nome, instagram, twitter, tiktok, youtube, whatsapp, telefone, email, is_favorite, leader_id`. O campo `aceita_whatsapp` não está na query JOIN, então não está disponível em `BoardItemWithContact.contact`.

Esta task tem duas partes pequenas e inseparáveis:

1. **Hook** (`useBoardItems.ts`): adicionar `aceita_whatsapp` ao SELECT do join de contatos e ao tipo `BoardItemWithContact.contact`.
2. **Lógica de filtro** (`Board.tsx`): criar estado `whatsappFilter: 'all' | 'yes' | 'no'` e `stageFromIndex: number` (índice no array de `stages`), derivar `filteredItemsForKanban` que compõe o filtro tri-state com proteção de etapas por cima de `filteredItems` (a busca textual já existente).

A lógica de filtro client-side: para cada item, verificar se `item.stage_id` corresponde a um stage com `ordem >= stages[stageFromIndex].ordem`. Se sim, aplicar o filtro de `aceita_whatsapp`; se não (etapa protegida), incluir o item sempre. Quando `whatsappFilter === 'all'`, `filteredItemsForKanban === filteredItems`.

O Kanban recebe `filteredItemsForKanban` em vez de `filteredItems`. Passar também `protectedStageIds: Set<string>` como prop opcional para `BoardKanban` e `BoardColumn` exibirem o badge no futuro (T02).

#### Critérios de aceite

- [ ] `BoardItemWithContact.contact` tem campo `aceita_whatsapp: boolean | null`
- [ ] `useBoardItems` retorna `aceita_whatsapp` populado (não `undefined`) para contatos com valor no banco
- [ ] `typecheck` (`tsc --noEmit`) passa sem erros relacionados ao novo campo
- [ ] Estado `whatsappFilter` e `stageFromIndex` existem em `Board.tsx`
- [ ] Com `whatsappFilter = 'yes'`, apenas cards de stages >= `stageFromIndex` com `aceita_whatsapp = true` aparecem no kanban; etapas antes do índice mostram todos
- [ ] Com `whatsappFilter = 'no'`, apenas cards de stages >= `stageFromIndex` com `aceita_whatsapp = false` aparecem; etapas antes mostram todos
- [ ] Com `whatsappFilter = 'all'`, todos os cards aparecem (comportamento atual intacto)
- [ ] Build produção sem erros

#### Hints técnicos (não-prescritivos)

- **Hook**: `src/hooks/useBoardItems.ts` — adicionar `aceita_whatsapp` à string do `.select()` (linha ~52) e à interface `BoardItemWithContact.contact` (linha ~22)
- **Lógica de filtro**: em `Board.tsx`, criar `filteredItemsForKanban` com `useMemo` que recebe `filteredItems` + `whatsappFilter` + `stageFromIndex` + `stages`. A comparação de etapas via `stage.ordem` é mais robusta do que índice posicional (evita problema se stages não estiverem ordenados por posição no array)
- **Prop ao Kanban**: `BoardKanban` ganha prop opcional `protectedStageIds?: Set<string>` que T02 vai consumir; T01 já passa o Set mesmo sem uso visual ainda (não quebra o componente)
- **Pattern existente**: `filteredItems` em `Board.tsx` (linhas 164-184) usa `useMemo` sobre `items` + `debouncedSearch` — seguir o mesmo idioma, compondo mais um nível de filtragem

#### Test cases

- **Happy path aceita**: funil com 10 items, 4 com `aceita_whatsapp = true`, 6 false/null. `stageFromIndex = 0` (sem proteção). `whatsappFilter = 'yes'` → kanban renderiza 4 items
- **Happy path com proteção**: mesmos 10 items, stages[0] protegido (`stageFromIndex = 1`). Items no stage 0: sempre visíveis. Items nos stages >= 1 com `aceita_whatsapp = true`: visíveis. Resto oculto
- **Edge — aceita_whatsapp null**: item com `aceita_whatsapp = null` nunca aparece em modo "Aceita" nem "Não aceita" — só em "Todos"
- **Edge — todos**: `whatsappFilter = 'all'` → resultado idêntico ao estado sem filtro
- **Edge — funil sem stages**: array `stages` vazio → `stageFromIndex` não tem referência válida; filtro não deve quebrar (fallback para modo "all")

#### Definition of Done

- [ ] Critérios de aceite verificados
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: abrir funil com contatos mistos, inspecionar no DevTools que `aceita_whatsapp` chega no array de items
- [ ] QA aprovou

#### Out of scope

- UI do segmented control (T02)
- Persistência em localStorage (T03)
- Footer e contador (T04)
- Chip na aba Contatos (T05)

---

### T02 — Componente `WhatsAppFilterControl` com segmented control tri-state, seletor de etapa e badge "protegida"

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** component
**Depende de:** T01
**WSJF score:** (5 + 3 + 2) / 5 = 2

#### User story

Como operador de campanha, quero ver o filtro de aceite WhatsApp direto na toolbar do funil — sempre visível, sem abrir drawer —, para ativar e desativar a visão em um clique enquanto analiso os cards.

#### Contexto

Com T01, a lógica existe mas não há como o usuário interagir. Esta task constrói o componente visual completo da V1 aprovada no mockup.

**Componente novo** `src/components/board/WhatsAppFilterControl.tsx`:

```
Props:
  value: 'all' | 'yes' | 'no'
  onChange: (v: 'all' | 'yes' | 'no') => void
  stageFromIndex: number
  onStageFromChange: (index: number) => void
  stages: BoardStage[]
```

O componente renderiza inline:
- Label "Aceite WhatsApp:" (texto pequeno, `text-xs font-semibold uppercase tracking-wider`)
- Segmented control com 3 botões: "Todos" / "Aceita" / "Não aceita"
  - Implementar com `<button>` nativos estilizados no padrão shadcn; se `ToggleGroup` de Radix já estiver instalado, usar — mas não instalar nova dependência
  - `role="radiogroup"` no container, `aria-pressed` em cada botão, `aria-label="Filtro de aceite WhatsApp"`
  - Dots coloridos (verde para Aceita, vermelho para Não aceita) como no mockup
- Quando `value !== 'all'`: renderizar inline o seletor "a partir de:" com `<Select>` shadcn listando as etapas do funil. Default: `Math.floor(stages.length / 2)`. Badge inline mostrando quantas etapas estão protegidas (ex: "etapas 1–2 protegidas")

**Integração em `Board.tsx`**: inserir `<WhatsAppFilterControl>` na toolbar, entre o bloco do popover de busca e o botão "Editar estágios". Separar com `<div className="w-px h-6 bg-border" />` (divisor visual, padrão já existente no mockup e na toolbar).

**Badge "protegida" em `BoardColumn`**: receber a prop `isProtected?: boolean` (derivada de `protectedStageIds` passada em T01). Quando `true`, exibir badge amarelo no header da coluna: `<Badge variant="outline" className="text-[10px] px-1.5 text-amber-700 border-amber-300 bg-amber-50">protegida</Badge>`.

#### Critérios de aceite

- [ ] Segmented control aparece na toolbar do funil, sempre visível (não em drawer)
- [ ] Clicar "Aceita" → kanban filtra imediatamente; clicar "Todos" → filtro some
- [ ] Quando filtro ativo (`value !== 'all'`), seletor "a partir de:" aparece inline com lista de etapas do funil
- [ ] Mudar "a partir de:" recalcula quais colunas são protegidas imediatamente
- [ ] Colunas antes do `stageFromIndex` exibem badge amarelo "protegida" no header
- [ ] Colunas protegidas mostram TODOS os cards (ignoram o filtro tri-state)
- [ ] `role="radiogroup"` presente no container do segmented control
- [ ] `aria-pressed="true"` no botão ativo, `aria-pressed="false"` nos demais
- [ ] Tooltip no hover de cada botão explicando o comportamento (ver mockup)
- [ ] Build sem erros TypeScript

#### Hints técnicos (não-prescritivos)

- **Arquivo novo**: `src/components/board/WhatsAppFilterControl.tsx`
- **Integração**: `src/pages/Board.tsx` — inserir na div da toolbar (linha ~310), entre busca e "Editar estágios"
- **Badge coluna**: `src/components/board/BoardColumn.tsx` — prop `isProtected?: boolean`, badge no `<div className="p-3 border-b ...">` ao lado do `<Badge>` de contagem existente
- **Prop chain**: `Board.tsx` → `BoardKanban` → `BoardColumn`. `BoardKanban` já recebe `protectedStageIds` (passado em T01); derivar `isProtected` por stage dentro de `BoardKanban` ao renderizar `<BoardColumn>`
- **Estilo segmented control**: wrapper `inline-flex rounded-lg border border-input overflow-hidden bg-background`; botão ativo `bg-primary text-primary-foreground`; hover inativo `hover:bg-muted`
- **Pattern existente**: botões de toolbar em `Board.tsx` usam `<Button variant="outline" size="sm">` — o segmented control é um padrão diferente (sem shadcn Button), mas o tamanho de fonte e altura devem ser compatíveis (`py-1.5 text-xs`)

#### Test cases

- **Happy path tri-state**: clicar "Aceita" → filtro ativa; clicar "Aceita" de novo (ou "Todos") → volta pra todos
- **Happy path proteção**: seletor em etapa 3 → colunas 1 e 2 com badge; colunas 1 e 2 mostram todos os cards; colunas 3+ filtradas
- **Edge — funil com 1 etapa**: seletor "a partir de:" mostra só 1 opção; badge "protegida" nunca aparece se a única etapa é a ativa
- **Edge — funil com 0 etapas**: componente não deve renderizar (ou renderizar desabilitado); `Board.tsx` já tem guard para `stages.length === 0` que esconde o kanban
- **Edge — acessibilidade keyboard**: Tab navega entre botões do segmented control; Enter/Space seleciona; seletor de etapa acessível via teclado (shadcn Select já cobre)

#### Definition of Done

- [ ] Critérios de aceite verificados
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test visual: abrir funil real, ativar "Aceita", confirmar que colunas antes do ponto exibem badge e todos os cards
- [ ] QA aprovou

#### Out of scope

- Animação de transição dos cards ao filtrar (pode tremer levemente — aceitável)
- Contador "Visíveis: X de Y" (T04)
- Persistência em localStorage (T03)
- Responsividade mobile detalhada (T04)

---

### T03 — Persistência do filtro por funil via `localStorage` e fallback de etapa

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** action (lógica em `Board.tsx` ou hook custom), component
**Depende de:** T02
**WSJF score:** (4 + 3 + 2) / 2 = 4,5

#### User story

Como operador de campanha, quero que minha preferência de filtro WhatsApp seja lembrada por funil entre sessões, para não ter que reconfigurar cada vez que acesso o painel.

#### Contexto

Extrair ou encapsular em `Board.tsx` a lógica de leitura/escrita do `localStorage` para a chave `em074:funnelFilter:<board_id>`. O objeto armazenado: `{ mode: 'all' | 'yes' | 'no', stageFromId: string }` (usar o `id` da etapa, não o índice posicional — índice muda se etapas forem reordenadas).

**Comportamento esperado:**
- Ao carregar o funil: ler localStorage. Se existir valor salvo e o `stageFromId` ainda existir nas `stages` atuais → restaurar mode + stageFromIndex correspondente. Se não existir ou o stage não for encontrado → default: `mode = 'all'`, `stageFromIndex = Math.floor(stages.length / 2)`.
- Ao mudar de funil (`activeBoardId` muda): salvar o estado atual do funil saído; carregar o estado do novo funil.
- Ao mudar mode ou stageFromIndex: persistir imediatamente (sem debounce — é uma ação do usuário, não digitação).
- Quando o usuário troca o seletor de etapa, armazenar o `id` da etapa selecionada (não o índice), para robustez quando etapas são reordenadas.

**Implementação sugerida (não-prescritiva):** hook custom `useWhatsAppFilter(boardId, stages)` que encapsula o estado + localStorage. Retorna `{ mode, stageFromIndex, setMode, setStageFromIndex }`. Ou fazer inline em `Board.tsx` com `useEffect` para load/save.

O `useEffect` que hoje limpa busca ao mudar de funil (linha ~131-136 em `Board.tsx`) deve ser ampliado (ou um novo `useEffect` criado) para resetar pro estado do novo funil.

#### Critérios de aceite

- [ ] Ativar "Aceita" + selecionar etapa 3, navegar para outro funil e voltar: o filtro está exatamente como foi deixado
- [ ] Dois funис diferentes têm preferências independentes (chave inclui `board_id`)
- [ ] Primeira visita a um funil (sem entrada no localStorage): `mode = 'all'`, `stageFromIndex = metade do funil`
- [ ] Se etapa salva não existe mais no funil (foi deletada): fallback para `Math.floor(stages.length / 2)`
- [ ] Mudar de funil: limpa e recarrega filtro do novo funil corretamente
- [ ] localStorage usa chave `em074:funnelFilter:<board_id>` (sem conflito com outras features)

#### Hints técnicos (não-prescritivos)

- **Util de localStorage**: criar helper em `src/lib/boardFilterStorage.ts` com `getFilter(boardId)` e `setFilter(boardId, state)` — facilita testes e evita strings espalhadas
- **Hook custom**: `src/hooks/useWhatsAppBoardFilter.ts` — padrão igual a outros hooks de estado com persistência no projeto
- **Integração**: `Board.tsx` substitui os `useState` simples de T01/T02 pelo hook, sem mudar a assinatura de props passadas ao Kanban
- **Ref para evitar save no mount**: usar `useRef<boolean>` para controlar que o save em localStorage só roda após a primeira renderização (evitar sobrescrever dado salvo ao montar)

#### Test cases

- **Happy path persistência**: ativar filtro "Não aceita" + etapa 2 → recarregar página → filtro restaurado exatamente
- **Happy path dois funис**: funil A com "Aceita" + etapa 3; funil B com "Todos" → alternar entre eles → cada um mantém seu estado
- **Edge — stage deletado**: board tem 5 stages, salvar stageFromId do stage 4; deletar stage 4; reabrir board → fallback para `Math.floor(stages.length / 2)`
- **Edge — localStorage desabilitado** (modo privado estrito): capturar exceção do `localStorage.setItem`/`getItem` com try/catch; filtro funciona sem persistência (sem quebrar a página)

#### Definition of Done

- [ ] Critérios de aceite verificados
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: verificar no DevTools → Application → Local Storage que a chave `em074:funnelFilter:<id>` é criada e atualizada ao interagir
- [ ] QA aprovou

#### Out of scope

- Sincronização cross-tab (dois tabs com o mesmo funil abertos) — não necessário
- Migração de dados de outros filtros salvos (essa chave é nova, não há colisão)

---

### T04 — Contador "Visíveis: X de Y", legenda no rodapé do board e responsividade mobile da toolbar

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** component
**Depende de:** T02
**WSJF score:** (3 + 2 + 1) / 2 = 3

#### User story

Como operador de campanha, quero ver quantos leads estão visíveis após o filtro e entender o que o badge "protegida" significa, para ter confiança de que não estou perdendo leads importantes por acidente.

#### Contexto

Dois complementos visuais da feature:

**Contador inline na toolbar:** quando `whatsappFilter !== 'all'`, exibir ao lado direito da toolbar (ou dentro de `WhatsAppFilterControl`) o texto "Visíveis: X de Y" onde X = total de cards no kanban após filtro, Y = total de items do funil. Derivar esses valores em `Board.tsx` a partir de `filteredItemsForKanban.length` (X) e `items.length` (Y). Mostrar apenas quando filtro ativo — quando "Todos" não tem sentido exibir.

**Legenda no rodapé do board:** adicionar abaixo do `<BoardKanban>`, apenas quando `whatsappFilter !== 'all'`, um rodapé discreto com a legenda de três itens (igual ao mockup):
- Ponto verde: "Aceita WhatsApp"
- Ponto vermelho: "Não aceita"
- Ponto amarelo com borda: "Etapa protegida (filtro não se aplica)"
- Texto italic: "Etapas antes do ponto escolhido mostram todos os contatos — novos leads não ficam ocultos."

**Responsividade mobile:** a div de toolbar em `Board.tsx` já tem `flex-wrap`. Garantir que `WhatsAppFilterControl` também tenha `flex-wrap` interno — quando a tela é estreita, o seletor "a partir de:" quebra para a linha de baixo. Testar em viewport 375px.

#### Critérios de aceite

- [ ] Quando `whatsappFilter !== 'all'`, contador "Visíveis: X de Y" aparece na toolbar
- [ ] Contador atualiza imediatamente ao mudar o filtro ou o seletor de etapa
- [ ] Quando `whatsappFilter === 'all'`, contador não aparece (toolbar não fica larga demais)
- [ ] Rodapé com legenda aparece abaixo do kanban somente quando filtro ativo
- [ ] Legenda tem os 3 itens: Aceita (verde), Não aceita (vermelho), Protegida (amarelo)
- [ ] Em viewport 375px, toolbar quebra em 2 linhas sem overflow horizontal
- [ ] Em desktop, toolbar cabe em uma linha (testar com funil de nome curto e longo)

#### Hints técnicos (não-prescritivos)

- **Contador**: pode ficar dentro de `WhatsAppFilterControl` como prop `visibleCount` e `totalCount`, ou em `Board.tsx` renderizado junto à toolbar — ambos aceitáveis
- **Rodapé**: renderizar condicional abaixo de `<BoardKanban>`, encapsulado em `src/components/board/WhatsAppFilterLegend.tsx` ou inline em `Board.tsx` (é simples o suficiente)
- **Wrap interno**: `WhatsAppFilterControl` usa `flex-wrap gap-2` no container raiz; seletor "a partir de:" está em `flex-shrink-0` pra não ser comprimido
- **Cores legenda**: `bg-green-500`, `bg-red-400`, `bg-amber-100 border border-amber-300` — consistentes com as classes já usadas no mockup

#### Test cases

- **Happy path contador**: funil com 20 items, filtro "Aceita" retorna 8 → exibe "Visíveis: 8 de 20"
- **Happy path legenda**: ativar filtro → legenda aparece; desativar ("Todos") → legenda some
- **Edge — todos os items aceita**: funil onde todos têm `aceita_whatsapp = true`, filtro "Aceita" → "Visíveis: 20 de 20"
- **Edge — nenhum item com aceite**: filtro "Aceita" → "Visíveis: 0 de 20"; kanban mostra colunas vazias com mensagem "Nenhum contato neste estágio"
- **Edge mobile**: em 375px, segmented control e seletor de etapa ficam em linhas separadas sem scroll horizontal

#### Definition of Done

- [ ] Critérios de aceite verificados
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: testar em DevTools Mobile 375px
- [ ] QA aprovou

#### Out of scope

- Exibir contador por coluna (os badges de contagem individuais nas colunas já existem e já refletem os items filtrados passados via prop)
- Animação de counter (não necessário)

---

### T05 — Chip de atalho tri-state na toolbar da aba Contatos

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** component
**Depende de:** — (independente; pode ser feita em paralelo)
**WSJF score:** (3 + 2 + 1) / 2 = 3

#### User story

Como operador de campanha, quero filtrar rapidamente a lista de contatos por aceite de WhatsApp sem abrir o drawer de filtros, para ganhar tempo em fluxos repetitivos de qualificação.

#### Contexto

A aba Contatos (`src/pages/Contacts.tsx`) já tem `filters.aceita_whatsapp?: boolean | null` em `ContactFilters` e o hook `useContacts` já envia esse filtro para o servidor via `contactsFilters.ts`. O drawer "Engajamento Político" já expõe o campo. Esta task adiciona um chip de atalho inline na toolbar (a div `flex flex-col sm:flex-row gap-3` nas linhas ~330-379), sem tocar no drawer.

**Chip tri-state** "Aceite WA:" com 3 estados: "Todos" / "Aceita" / "Não aceita". Mesmo estilo visual de `WhatsAppFilterControl` de T02 (reutilizar o componente ou extrair a parte do segmented control como sub-componente `WhatsAppSegmentedControl` independente de stages).

**Sincronização bidirecional:** quando o chip muda → `setFilters(prev => ({ ...prev, aceita_whatsapp: novoValor, page: 1 }))`. Quando o drawer muda `aceita_whatsapp` → o chip reflete o estado atual de `filters.aceita_whatsapp`. Não há estado local separado — o chip lê e escreve diretamente em `filters`.

**Posição na toolbar:** logo após a busca textual e antes do `<Select>` de ordenação. Em mobile, quebra para nova linha normalmente via `flex-wrap`.

**Mapeamento de valores:**
- Chip "Todos" → `filters.aceita_whatsapp = undefined` (remover o filtro)
- Chip "Aceita" → `filters.aceita_whatsapp = true`
- Chip "Não aceita" → `filters.aceita_whatsapp = false`

Quando `filters.aceita_whatsapp === null` (valor "indeterminado" que o drawer pode gerar): chip exibe "Todos" (tratar `undefined | null` como "sem filtro").

#### Critérios de aceite

- [ ] Chip "Aceite WA:" aparece na toolbar da aba Contatos, sempre visível
- [ ] Clicar "Aceita" → lista filtra para contatos com `aceita_whatsapp = true`; URL não muda (é estado de filtro, não URL param)
- [ ] Clicar "Todos" → filtro `aceita_whatsapp` removido dos filtros ativos
- [ ] Ativar filtro pelo drawer "Engajamento Político" → chip reflete o estado correto
- [ ] Ativar filtro pelo chip → drawer já abre com campo correto pré-selecionado (sincronização bidirecional via estado compartilhado)
- [ ] Chip funciona junto com outros filtros (não reseta tags, cidade, etc.)
- [ ] Filtro `aceita_whatsapp` é incluído nos chips ativos de `ContactFiltersChips` com label legível (verificar se já há label para esse filtro — se não houver, adicionar)
- [ ] Em mobile 375px, chip fica numa linha separada sem overflow

#### Hints técnicos (não-prescritivos)

- **Reutilização**: se `WhatsAppFilterControl` de T02 for polimórfico (sem a parte de stages), pode ser importado aqui. Alternativa: extrair `WhatsAppSegmentedControl` (apenas os 3 botões, sem seletor de etapa) para `src/components/common/WhatsAppSegmentedControl.tsx` e usar em ambos os locais
- **Integração**: `src/pages/Contacts.tsx` — inserir na div da toolbar (linha ~330), logo após o `<Input>` de busca
- **Valor derivado**: `const chipValue = filters.aceita_whatsapp === true ? 'yes' : filters.aceita_whatsapp === false ? 'no' : 'all'`
- **ContactFiltersChips**: `src/components/contacts/ContactFiltersChips.tsx` — verificar se já renderiza chip para `aceita_whatsapp`; se não, adicionar entry com label "Aceita WhatsApp: Sim/Não"
- **Pattern de filtro em Contacts**: seguir o mesmo pattern dos outros filtros quick da página — setter via `setFilters(prev => ({ ...prev, campo: valor, page: 1 }))`

#### Test cases

- **Happy path**: clicar "Aceita" → lista mostra apenas contatos com `aceita_whatsapp = true`; clicar "Todos" → lista volta ao normal
- **Happy path drawer sync**: abrir drawer, selecionar "Não aceita", fechar drawer → chip mostra "Não aceita"
- **Edge — chip sync → drawer**: ativar "Aceita" pelo chip → abrir drawer → campo "Aceita WhatsApp" deve refletir "Sim"
- **Edge — aceita_whatsapp null no filtro**: `filters.aceita_whatsapp = null` → chip mostra "Todos" (não quebra)
- **Edge — combinação de filtros**: ativar chip "Aceita" + filtro de tag "Liderança" → lista mostra apenas contatos que satisfazem AMBOS

#### Definition of Done

- [ ] Critérios de aceite verificados
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test: acessar aba Contatos, ativar chip "Aceita", verificar que total muda e é consistente com o filtro do drawer
- [ ] QA aprovou

#### Out of scope

- Persistência do filtro de Contatos em localStorage (a aba Contatos não persiste nenhum filtro atualmente — manter consistência)
- Seletor "a partir de etapa" na aba Contatos (não faz sentido sem kanban)
- Modificar o drawer (não tocar)

---

## Riscos e edge cases globais

| Risco | Mitigação |
|-------|-----------|
| `aceita_whatsapp = null` nos items do funil | Tratar `null` como "sem informação" — nunca aparece em "Aceita" nem "Não aceita"; só em "Todos". Documentar no código. |
| Funil muda enquanto filtro está ativo | `useEffect` de limpeza de T03 já reseta para o estado salvo do novo funil |
| Stage deletado cujo `id` estava no localStorage | Fallback para `Math.floor(stages.length / 2)` em T03 |
| Board sem stages (0 etapas) | `Board.tsx` já renderiza um estado vazio antes do kanban; `WhatsAppFilterControl` não deve renderizar nesse caso |
| localStorage inacessível (privado/restrito) | Wrap com try/catch em T03; filtro funciona sem persistência |
| Contagem "Visíveis: X de Y" dessincronizada com busca textual | `filteredItemsForKanban` é derivado de `filteredItems` (que já aplica a busca), não de `items` diretamente — manter essa composição em T01 |
| Drag-and-drop de card em modo "filtro ativo" | Card movido para coluna protegida ou coluna filtrada: o card continuará visível após o move porque o `useMoveBoardItem` invalida `board_items` → refetch → `filteredItemsForKanban` recalcula. Comportamento correto sem intervenção. |
| Prop chain `protectedStageIds` atravessa `BoardKanban` → `BoardColumn` | Passagem de prop simples (não context); aceitável dado que o kanban tem apenas 2 níveis de depth. Se crescer, considerar context em T02 como refactor opcional. |
