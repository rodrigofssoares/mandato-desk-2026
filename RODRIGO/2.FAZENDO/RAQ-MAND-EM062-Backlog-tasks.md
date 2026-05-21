# RAQ-MAND-EM062 — Plano de Execução (Backlog)

**Cliente:** Raquel Auxiliadora — Mandato Desk 2026
**Codigo QG:** RAQ-MAND-EM062
**Briefing refinado:** RODRIGO/2.FAZENDO/RAQ-MAND-EM062-PO-refinamento.md
**Backlog escrito por:** Agente Backlog em 2026-05-08

---

## Resumo

- **Total de tasks:** 7
- **Esforço estimado:** ~21h
- **Ordem de execução:** T1 → T2 → T3 → T4 → T5 → T6 → T7
- **Walking skeleton:** T1 (estende interface + hook) + T2 (chips visíveis) — juntos entregam valor observável end-to-end em ~5h

---

## Diagrama de dependências

```
T1 (fundação: interface + query builder)
 ├── T2 (chips de filtros ativos)         [depende T1]
 ├── T3 (localização: cidade + estado)    [depende T1, T2]
 ├── T4 (completude: telefone + email)    [depende T1, T2]
 ├── T5 (origem)                          [depende T1, T2]
 ├── T6 (funil + etapa)                   [depende T1, T2]
 └── T7 (demanda + migration índice)      [depende T1, T2]
```

**Observação de agrupamento:** O orçamentador sugeriu T8 (smoke test favoritos) e T9 (Vitest
unit do query builder) como tasks separadas. Optei por incorporar:
- O smoke test dos favoritos como critério de aceite dentro de cada task que adiciona novos
  campos, pois o `useFiltrosFavoritos` serializa `ContactFilters` inteiro — não há código novo
  a escrever, só validação manual.
- Os Vitest units dentro de T1, pois o projeto tem infra de testes configurada e o query
  builder é a única camada com lógica testável de forma isolada. Manter em task separada
  criaria dependência artificial e atrasaria feedback de qualidade.
Resultado: 7 tasks (dentro do range ideal 3-8), sem perda de cobertura.

---

## Tasks

### T1 — Estender interface ContactFilters e query builder no useContacts

- **Tipo:** técnica (pré-requisito vertical — todas as camadas dependem dos tipos corretos)
- **User stories cobertas:** base para US01, US02, US03, US04, US05, US06
- **Esforço:** 3h
- **Dependências:** nenhuma
- **Sub-agente Fullstack delegado:** hook-writer (lead), action-writer (apoio nos filtros de sub-query)

#### Arquivos esperados

- `src/hooks/useContacts.ts` — estende `interface ContactFilters` + adiciona cláusulas no query builder de `useContacts`
- `src/pages/Contacts.tsx` — atualiza `filtrosAtivosCount` para incluir novos campos (não conta chips ainda — só garante que o número no badge do botão Filtros não ignora os novos campos)

#### Novos campos em ContactFilters

```ts
cidade?: string;
estado?: string;
origem?: string;
has_phone?: 'com' | 'sem';       // IS NOT NULL / IS NULL em contacts.telefone
has_email?: 'com' | 'sem';       // IS NOT NULL / IS NULL em contacts.email
has_demand?: 'com' | 'sem';      // EXISTS em demands com contact_id
board_id?: string;               // UUID do board (funil)
stage_id?: string;               // UUID do stage (etapa — só válido com board_id)
no_funnel?: boolean;             // sem nenhum board_item
```

#### Novas cláusulas no query builder (dentro de useContacts)

| Filtro | Estratégia Supabase | Observação |
|---|---|---|
| `cidade` | `.ilike('cidade', '%termo%')` | case-insensitive via ILIKE |
| `estado` | `.eq('estado', valor)` | match exato |
| `origem` | `.ilike('origem', '%termo%').not('origem', 'is', null)` | IS NOT NULL AND ILIKE — origens nulas nunca batem |
| `has_phone = 'com'` | `.not('telefone', 'is', null)` | |
| `has_phone = 'sem'` | `.is('telefone', null)` | |
| `has_email = 'com'` | `.not('email', 'is', null)` | |
| `has_email = 'sem'` | `.is('email', null)` | |
| `has_demand = 'com'` | sub-query em `demands` → `.in('id', contactIds)` | ver nota de URL limit abaixo |
| `has_demand = 'sem'` | sub-query em `demands` → `.not('id', 'in', contactIds)` ou anti-join | ver nota abaixo |
| `board_id` sem `stage_id` | embed `!inner` em `board_items` + `.eq('board_items.board_id', id)` | evita `.in()` com centenas de IDs |
| `board_id` + `stage_id` | embed `!inner` + `.eq('board_items.board_id', bid).eq('board_items.stage_id', sid)` | |
| `no_funnel = true` | sub-query ids em `board_items` → `.not('id', 'in', ids)` | se ids > 0; se vazio, retorna todos |

**Nota sobre has_demand e URL limit:** `demands.contact_id` pode ter muitos registros. Usar sub-query
client-side (buscar contact_ids com demanda, depois `.in('id', ids)`) é seguro se a base de
demandas for pequena. Se ultrapassar ~500 registros únicos por demanda, o `.in()` vai estoura URL.
Fullstack deve avaliar o volume atual e documentar a escolha. Alternativa: RPC (função Postgres
EXISTS) — adicionar como migration se o volume justificar.

**Nota sobre board_items embed !inner:** O padrão já está estabelecido para `contact_tags` no hook
atual (linhas 169-180 de useContacts.ts). Replicar exatamente o mesmo padrão:
`'*, board_items!inner(board_id, stage_id)'` quando `board_id` estiver ativo.
Atenção: se `board_id` e filtro de tags estiverem ativos simultaneamente, o `selectClause`
precisa combinar ambos os `!inner` — Fullstack deve testar esse caso.

#### Critérios de aceite

- [ ] `interface ContactFilters` exporta todos os 9 novos campos com tipos corretos
- [ ] `useContacts` com `filters.cidade = 'Belo Horizonte'` gera query ILIKE `%Belo Horizonte%` (verificável no Network tab do browser)
- [ ] `useContacts` com `filters.estado = 'MG'` retorna só contatos com estado = 'MG'
- [ ] `useContacts` com `filters.origem = 'evento'` não retorna contatos com origem NULL
- [ ] `useContacts` com `filters.has_phone = 'sem'` retorna apenas contatos com telefone NULL
- [ ] `useContacts` com `filters.has_email = 'com'` retorna apenas contatos com email preenchido
- [ ] `useContacts` com `filters.board_id = <uuid>` retorna apenas contatos que têm board_item naquele board (embed !inner — sem estouro de URL)
- [ ] `useContacts` com `filters.board_id + filters.stage_id` filtra por etapa específica
- [ ] `useContacts` com `filters.no_funnel = true` retorna contatos sem nenhum board_item
- [ ] `useContacts` com `filters.has_demand = 'com'` retorna contatos com ao menos 1 demand
- [ ] `Contacts.tsx` atualiza `filtrosAtivosCount` para incluir os novos campos (badge do botão Filtros mostra count correto)
- [ ] TypeScript compila sem erros (`npm run build` limpo)

#### Riscos / notas técnicas

- Combinação de `!inner` para `contact_tags` + `!inner` para `board_items` no mesmo select —
  PostgREST suporta múltiplos `!inner` no mesmo select; Fullstack deve validar.
- Verificar se `demands.contact_id` tem índice no banco antes de implementar sub-query;
  se não tiver, adicionar migration `CREATE INDEX idx_demands_contact_id ON demands(contact_id);`
  antes de ativar o filtro de demanda.

#### Definition of Done

- [ ] Todos os critérios de aceite acima
- [ ] Lint e TypeScript sem erros
- [ ] Build OK
- [ ] Smoke test manual: aplicar cada filtro novo no browser e confirmar que a listagem muda
- [ ] Favorito salvo com filtros antigos continua funcionando (nenhum campo novo é obrigatório)

---

### T2 — Criar componente ContactFiltersChips (chips de filtros ativos)

- **Tipo:** feature vertical (P0 — maior valor por custo)
- **User stories cobertas:** US01 completa
- **Esforço:** 3h
- **Dependências:** T1 (interface ContactFilters com novos campos)
- **Sub-agente Fullstack delegado:** component-writer (lead)

#### Arquivos esperados

- `src/components/contacts/ContactFiltersChips.tsx` — novo componente
- `src/pages/Contacts.tsx` — renderiza `<ContactFiltersChips>` entre a barra de busca e o `<ContactFilters>`
- `src/hooks/useContacts.ts` — adicionar `useLeaders` (já existe), `useBoards`, `useContactTags` como dependências opcionais para resolver labels dos chips

#### Lógica do componente

O componente recebe `filters: ContactFilters`, `search: string`, `onChange: (filters: ContactFilters) => void`
e `allTags`, `leaders`, `boards` (passados como prop ou buscados internamente via hooks) para resolver
IDs em labels legíveis.

Mapeamento de cada campo para chip:

| Campo | Label do chip | Valor exibido | Remove |
|---|---|---|---|
| `search` | "Busca" | `"${search}"` | `onChange({...filters, search: undefined})` + limpa input |
| `tags[]` | nome da tag | busca em allTags | remove tag do array |
| `is_favorite` | "Favoritos" | — | set undefined |
| `declarou_voto` | "Voto declarado" | "Sim" / "Não" | set null |
| `birthday_filter` | "Aniversário" | label traduzido | set null |
| `last_contact_filter` | "Último contato" | label traduzido | set null |
| `leader_id` | "Liderança" | nome do leader | set undefined |
| `campaign_field_ids[]` | label do campo | — | remove do array |
| `date_from` | "Criado a partir de" | data formatada | set undefined |
| `date_to` | "Criado até" | data formatada | set undefined |
| `cidade` | "Cidade" | valor | set undefined |
| `estado` | "Estado" | valor | set undefined |
| `origem` | "Origem" | valor | set undefined |
| `has_phone` | "Telefone" | "Com telefone" / "Sem telefone" | set undefined |
| `has_email` | "E-mail" | "Com e-mail" / "Sem e-mail" | set undefined |
| `has_demand` | "Demanda" | "Com demanda" / "Sem demanda" | set undefined |
| `board_id` | "Funil" | nome do board | set undefined + limpa stage_id |
| `stage_id` | "Etapa" | nome da stage | set undefined |
| `no_funnel` | "Fora de funis" | — | set undefined |

Se nenhum filtro ativo → componente retorna `null` (sem espaço em branco).

#### Critérios de aceite

- [ ] Linha de chips aparece abaixo da barra de busca quando há pelo menos 1 filtro ativo, mesmo com o painel Collapsible recolhido
- [ ] Quando nenhum filtro está ativo, a linha de chips não renderiza (sem div vazia com padding)
- [ ] Chip de busca textual aparece com label "Busca: 'joao'" e X remove o filtro de search
- [ ] Chip de tag exibe o nome da tag (não o UUID)
- [ ] Chip de liderança exibe o nome do líder (não o UUID)
- [ ] Chip de funil exibe o nome do board (não o UUID)
- [ ] Ao clicar no X do chip board_id, o chip de stage_id também some (stage depende do board)
- [ ] Chip de has_phone exibe "Telefone: Sem telefone" ou "Telefone: Com telefone"
- [ ] Clicar no X de qualquer chip remove apenas aquele filtro e a listagem atualiza em menos de 600ms
- [ ] O botão "Limpar filtros" existente remove todos os chips de uma vez

#### Riscos / notas técnicas

- Para resolver labels de board_id e stage_id, o componente pode importar `useBoards` (já existe
  em `src/hooks/useBoards.ts`) e adicionar um hook `useBoardStages` se não existir ainda, ou
  receber as listas como prop de `Contacts.tsx`. Preferir prop para evitar queries duplicadas.
- Para tags múltiplas, cada tag_id gera um chip separado (não "Etiquetas: 3").
- Para campaign_field_ids, cada campo gera um chip separado com o label do campo.
- Custom fields (campos personalizados) também devem gerar chips, mas podem ser ignorados
  nesta entrega se aumentar a complexidade (PO não mencionou explicitamente — out of scope desta task).

#### Definition of Done

- [ ] Todos os critérios de aceite acima
- [ ] Lint e TypeScript sem erros
- [ ] Build OK
- [ ] Smoke test manual: aplicar combinação de 3+ filtros, recolher painel, confirmar chips visíveis

---

### T3 — Adicionar filtros de localização ao painel (Cidade + Estado)

- **Tipo:** feature vertical (P1 — US02)
- **User stories cobertas:** US02 completa
- **Esforço:** 2h
- **Dependências:** T1 (query builder), T2 (chips)
- **Sub-agente Fullstack delegado:** component-writer (lead)

#### Arquivos esperados

- `src/components/contacts/ContactFilters.tsx` — adiciona seção "Localização" com Input cidade e Select estado
- `src/components/contacts/ContactFiltersChips.tsx` — chips de cidade/estado já mapeados em T2 (sem mudança adicional)

#### Lista de estados brasileiros (constante interna)

Array de objetos `{ value: string; label: string }` com as 27 UFs (AC, AL, AP, AM, BA, CE, DF,
ES, GO, MA, MT, MS, MG, PA, PB, PR, PE, PI, RJ, RN, RS, RO, RR, SC, SP, SE, TO) + opção "Todos".
Declarar como constante no arquivo do componente — não precisa de arquivo separado.

#### Critérios de aceite

- [ ] Painel exibe campo "Cidade" (Input tipo texto) na seção/subsecção "Localização"
- [ ] Painel exibe Select "Estado" com as 27 UF + "Todos"
- [ ] Digitar "belo" em Cidade filtra contatos com cidade contendo "belo" (case-insensitive)
- [ ] Selecionar "MG" em Estado filtra apenas contatos com `contacts.estado = 'MG'`
- [ ] Combinar Cidade="Belo Horizonte" + Estado="MG" retorna apenas contatos com ambas as condições
- [ ] Estado com valor nulo no banco não aparece quando um estado está selecionado
- [ ] Chip "Cidade: Belo Horizonte" e "Estado: MG" aparecem na barra de chips (T2)
- [ ] Limpar filtro de cidade via chip preserva o filtro de estado (e vice-versa)
- [ ] Favorito salvo com cidade/estado pode ser reaplicado corretamente

#### Riscos / notas técnicas

- Input cidade deve usar debounce (300ms) idêntico ao campo de busca principal, para não
  disparar query a cada keystroke.
- O Select de estado pode usar o componente shadcn `Select` já importado no arquivo.

#### Definition of Done

- [ ] Critérios de aceite acima
- [ ] Lint e TypeScript sem erros
- [ ] Build OK
- [ ] Smoke test manual: filtrar por cidade "Belo Horizonte" e confirmar chips + resultado

---

### T4 — Adicionar filtros de completude ao painel (Com/Sem Telefone + Com/Sem E-mail)

- **Tipo:** feature vertical (P1 — US05)
- **User stories cobertas:** US05 completa
- **Esforço:** 2h
- **Dependências:** T1, T2
- **Sub-agente Fullstack delegado:** component-writer (lead)

#### Arquivos esperados

- `src/components/contacts/ContactFilters.tsx` — adiciona seção "Completude do cadastro" com dois selects tri-state

#### UI: select tri-state para cada campo

Usar `Select` shadcn com 3 valores: `'todos'` (default), `'com'`, `'sem'`. Mapeia para
`has_phone?: 'com' | 'sem'` e `has_email?: 'com' | 'sem'` na interface.

#### Critérios de aceite

- [ ] Painel exibe Select "Telefone" com opções: Todos / Com telefone / Sem telefone
- [ ] Painel exibe Select "E-mail" com opções: Todos / Com e-mail / Sem e-mail
- [ ] Selecionar "Sem telefone" retorna contatos onde `contacts.telefone IS NULL`
- [ ] Selecionar "Com telefone" retorna contatos onde `contacts.telefone IS NOT NULL`
- [ ] Idem para e-mail
- [ ] Os dois filtros são independentes (combinar "Sem telefone" + "Com e-mail" funciona)
- [ ] Chips aparecem: "Telefone: Sem telefone", "E-mail: Com e-mail"
- [ ] Favorito salvo com esses filtros pode ser reaplicado

#### Definition of Done

- [ ] Critérios de aceite acima
- [ ] Lint e TypeScript sem erros
- [ ] Build OK
- [ ] Smoke test manual: selecionar "Sem telefone", confirmar que lista só mostra cadastros sem telefone

---

### T5 — Adicionar filtro de Origem ao painel

- **Tipo:** feature vertical (P1 — US06)
- **User stories cobertas:** US06 completa
- **Esforço:** 1h
- **Dependências:** T1, T2
- **Sub-agente Fullstack delegado:** component-writer (lead)

#### Arquivos esperados

- `src/components/contacts/ContactFilters.tsx` — adiciona Input "Origem" com debounce

#### Critérios de aceite

- [ ] Painel exibe campo Input "Origem" (texto livre)
- [ ] Digitar "evento" filtra contatos com `contacts.origem ILIKE '%evento%'`
- [ ] Contatos com `origem IS NULL` não aparecem quando o campo está preenchido
- [ ] Chip "Origem: evento" aparece na barra de chips
- [ ] Limpar o campo (string vazia) remove o filtro e retorna todos
- [ ] Debounce de 300ms (não dispara query a cada keystroke)
- [ ] Favorito salvo com origem pode ser reaplicado

#### Definition of Done

- [ ] Critérios de aceite acima
- [ ] Lint e TypeScript sem erros
- [ ] Build OK
- [ ] Smoke test manual: digitar "indica" e confirmar que só contatos com origem contendo "indica" aparecem

---

### T6 — Adicionar filtros de Funil e Etapa ao painel

- **Tipo:** feature vertical (P1 — US03, complexidade média-alta)
- **User stories cobertas:** US03 completa
- **Esforço:** 5h
- **Dependências:** T1, T2
- **Sub-agente Fullstack delegado:** hook-writer (apoio — `useBoardStages`), component-writer (lead)

#### Arquivos esperados

- `src/hooks/useBoards.ts` — adicionar (ou verificar se já existe) hook `useBoardStages(boardId)`
- `src/components/contacts/ContactFilters.tsx` — adiciona subsecção "Funil" com Select de board + Select condicional de stage + Toggle "Fora de qualquer funil"
- `src/components/contacts/ContactFiltersChips.tsx` — garantir que chips de board_id e stage_id resolvem labels (ajuste se necessário)
- `src/pages/Contacts.tsx` — passar lista de boards e stages como props para chips se necessário

#### Lógica do filtro de funil

1. Select "Funil" — query `useBoards('contact')` (já existe), mostra todos os boards de tipo contact
2. Ao selecionar um funil, Select "Etapa" aparece condicionalmente — query `useBoardStages(board_id)`
3. Ao limpar o funil (volta para "Todos"), limpar também a etapa selecionada
4. Toggle/Checkbox "Fora de qualquer funil" — exclusivo com a seleção de funil (ativar um desmarca o outro)

Hook `useBoardStages(boardId: string | null)`:
- query em `board_stages` filtrada por `board_id`, ordenada por `ordem`
- enabled apenas quando `boardId` não é null
- retorna `{ data: BoardStage[] }`

#### Estratégia de query no hook useContacts (já definida em T1)

- Funil sem etapa: `select('*, board_items!inner(board_id)').eq('board_items.board_id', board_id)`
- Funil + etapa: adicionar `.eq('board_items.stage_id', stage_id)`
- Fora de funis: sub-query client-side dos ids em board_items, depois `.not('id', 'in', ids)` — se base de board_items for grande, Fullstack avalia e documenta

#### Critérios de aceite

- [ ] Painel exibe Select "Funil" com todos os boards de tipo 'contact' em ordem alfabética
- [ ] Ao selecionar um funil, Select "Etapa" aparece com as stages daquele board ordenadas por `ordem`
- [ ] Funil sem etapa: retorna todos os contatos com ao menos 1 board_item naquele board
- [ ] Funil + etapa: retorna apenas contatos cujo board_item.stage_id = etapa selecionada
- [ ] Ao limpar o select de funil, o select de etapa desaparece e stage_id é limpo
- [ ] Toggle "Fora de qualquer funil" retorna contatos sem nenhum board_item em nenhum board
- [ ] Toggle "Fora de qualquer funil" e select de funil são mutuamente exclusivos
- [ ] Funil sem stages: Select de Etapa aparece com mensagem "Nenhuma etapa neste funil"
- [ ] Chips aparecem: "Funil: Mobilizacao 2026" e/ou "Etapa: Contato feito"
- [ ] Ao remover chip do funil, chip de etapa também é removido
- [ ] Favorito salvo com board_id + stage_id reidrata corretamente (board_id carregado antes de stage_id — garante que o Select de etapa já tem as stages quando tenta selecionar)

#### Riscos / notas técnicas

- **Hidratação de favorito com funil+etapa:** ao aplicar um favorito que tem board_id e stage_id,
  o Select de etapa só aparece quando board_id está no estado. Como o estado é setado via
  `setFilters` em lote (um único `aplicarFiltroFavorito`), isso é automático — o Select de etapa
  renderiza em resposta ao board_id no estado. Fullstack deve verificar que a query de stages é
  ativada imediatamente para que o Select mostre as opções antes que o usuário interaja.
- **Embed !inner combinado:** se o usuário ativar funil + tags simultaneamente, o `selectClause`
  no hook deve combinar ambos os `!inner`. Testar explicitamente esse caso.
- **`useBoardStages`:** verificar se já existe em `src/hooks/useBoards.ts` antes de criar.

#### Definition of Done

- [ ] Critérios de aceite acima
- [ ] Lint e TypeScript sem erros
- [ ] Build OK
- [ ] Smoke test manual: selecionar funil, depois etapa, confirmar listagem + chips
- [ ] Testar favorito com funil+etapa: salvar, limpar filtros, reaplicar favorito

---

### T7 — Adicionar filtro "Tem Demanda" ao painel + verificar índice em demands.contact_id

- **Tipo:** feature vertical (P1 — US04) + possível migration (model)
- **User stories cobertas:** US04 completa
- **Esforço:** 5h (inclui investigação do índice e possível migration)
- **Dependências:** T1, T2
- **Sub-agente Fullstack delegado:** model-writer (migration se necessário), hook-writer (sub-query), component-writer (UI)

#### Arquivos esperados

- `supabase/migrations/<timestamp>_idx_demands_contact_id.sql` — somente se índice não existir
- `src/hooks/useContacts.ts` — sub-query de demands já implementada em T1; esta task verifica performance e documenta
- `src/components/contacts/ContactFilters.tsx` — adiciona Select "Demandas" tri-state

#### Passo 1 — Verificar índice (model-writer)

Rodar via Supabase CLI:
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'demands' AND indexdef ILIKE '%contact_id%';
```
- Se índice existir: prosseguir sem migration
- Se não existir: criar migration `CREATE INDEX CONCURRENTLY idx_demands_contact_id ON demands(contact_id);`

#### Passo 2 — Implementar UI (component-writer)

Select shadcn com 3 opções: "Todos" (valor `undefined`), "Com demanda" (valor `'com'`), "Sem demanda" (valor `'sem'`).
Mapeia para `has_demand?: 'com' | 'sem'` na interface (já adicionado em T1).

#### Estratégia de sub-query client-side para has_demand

```ts
if (has_demand) {
  const { data: demandRows } = await supabase
    .from('demands')
    .select('contact_id')
    .not('contact_id', 'is', null);

  const idsComDemanda = [...new Set((demandRows ?? []).map(r => r.contact_id))];

  if (has_demand === 'com') {
    if (idsComDemanda.length === 0) return { data: [], count: 0 };
    query = query.in('id', idsComDemanda);
  } else {
    // 'sem' — usa .not().in() se o array não for gigante
    if (idsComDemanda.length > 0) {
      query = query.not('id', 'in', `(${idsComDemanda.join(',')})`);
    }
    // se vazio (nenhuma demanda no sistema), retorna todos
  }
}
```

**Alerta de URL limit:** se `idsComDemanda.length > 300`, a abordagem `.in()` pode estoura URL.
Fullstack deve medir o tamanho atual da tabela `demands` e, se necessário, substituir por RPC:
```sql
-- Para RPC futura (P2):
CREATE OR REPLACE FUNCTION contacts_com_demanda()
RETURNS SETOF uuid AS $$
  SELECT DISTINCT contact_id FROM demands WHERE contact_id IS NOT NULL;
$$ LANGUAGE sql STABLE;
```
Documentar a decisão no comentário do PR.

#### Critérios de aceite

- [ ] Índice em `demands.contact_id` existe no banco (criado via migration ou já existente)
- [ ] Painel exibe Select "Demandas" com opções: Todos / Com demanda / Sem demanda
- [ ] "Com demanda" retorna apenas contatos com ao menos 1 linha em demands com esse contact_id
- [ ] "Sem demanda" retorna apenas contatos sem nenhuma linha em demands
- [ ] Chip aparece: "Demanda: Com demanda" ou "Demanda: Sem demanda"
- [ ] Favorito salvo com has_demand pode ser reaplicado
- [ ] Fullstack documenta no PR a escolha da estratégia (sub-query client-side vs RPC) com base no volume atual

#### Definition of Done

- [ ] Índice verificado/criado
- [ ] Critérios de aceite acima
- [ ] Lint e TypeScript sem erros
- [ ] Build OK
- [ ] Smoke test manual: selecionar "Com demanda", confirmar que só aparecem contatos com demandas registradas
- [ ] Volume de demands documentado no comentário do PR

---

## Considerações finais para o Fullstack

### Ordem de grupos no painel de filtros (ContactFilters.tsx)

O PO orientou agrupar os novos campos em subsecções. Sugestão de estrutura dentro do grid:

1. **Etiquetas** (já existe)
2. **Favoritos / Declarou voto** (já existe)
3. **Liderança** (já existe)
4. **Localização** — Cidade + Estado (T3 — novos)
5. **Presença no sistema** — Funil + Etapa + Fora de funis (T6 — novos)
6. **Atendimento** — Demandas (T7 — novo)
7. **Completude do cadastro** — Telefone + E-mail (T4 — novos)
8. **Origem** (T5 — novo)
9. **Campos de Campanha** (já existe)
10. **Campos Personalizados** (já existe)
11. **Data criação range** (já existe)

Fullstack tem autonomia para ajustar o layout — isto é uma sugestão.

### activeCount em ContactFilters.tsx

O cálculo de `activeCount` no componente `ContactFilters` (linha 41-51) deve ser atualizado
para incluir os novos campos:

```ts
filters.cidade,
filters.estado,
filters.origem,
filters.has_phone,
filters.has_email,
filters.has_demand,
filters.board_id,
filters.no_funnel,
```

`stage_id` não conta separadamente — já está coberto por `board_id`.

### filtrosAtivosCount em Contacts.tsx

O useMemo `filtrosAtivosCount` (linha 89-103 de Contacts.tsx) também deve ser atualizado com
os mesmos campos novos para que a barra de favoritos e a seleção em massa continuem funcionando
corretamente.
