# Backlog — Novos filtros de endereço (Bairro, Logradouro, CEP, Complemento)

**Cliente:** Raquel — Mandato Desk 2026
**Codigo QG:** RAQ-MAND-EM069
**Briefing:** RODRIGO/2.FAZENDO/RAQ-MAND-EM069-PO-refinamento.md
**Backlog escrito por:** Agente Backlog em 2026-05-11

---

## Walking skeleton

T01 — cobre todas as camadas de uma vez (interface + query + UI + chips). A feature e pequena, sem slicing natural que justifique 2 tasks: nao ha migration, nao ha nova Edge Function, e o padrao ILIKE+debounce ja existe para Cidade e Origem — e pura replicacao com quatro campos novos.

## Ordem de execucao

1. **T01** — Expandir filtros de localizacao com Bairro, Logradouro, CEP e Complemento

Nao ha T02. Uma unica task cobre todas as tres camadas (hook/tipos, componente, chips) porque sao mudancas atomicas no mesmo contexto, sem dependencias externas e com risco zero de conflito entre elas.

---

## Tasks

### T01 — Expandir filtros de localizacao com Bairro, Logradouro, CEP e Complemento

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** hook (interface + query) | component (drawer UI) | component (chips)
**Depende de:** —
**WSJF score:** (3 + 2 + 1) / 2 = 3,0 — entrega valor imediato, custo de implementacao minimo, sem risco tecnico

#### User story

Como operadora do gabinete, quero filtrar contatos por bairro, logradouro, CEP e complemento diretamente no painel lateral, para segmentar eleitores por microterritorio sem precisar exportar ou usar SQL.

#### Contexto

O segmento "Localizacao" do drawer (`ContactFilters.tsx`) expoe apenas Cidade, Estado e Origem. Os campos `bairro`, `logradouro`, `cep` e `complemento` ja existem na tabela `contacts` e ja estao mapeados na interface `Contact` de `useContacts.ts` — sao dados armazenados mas nao filtravelis. A tarefa e expor esses quatro campos seguindo exatamente o padrao ja implementado para `cidade` (debounce 300 ms, `ilike('%valor%')`), sem nenhuma nova dependencia ou migracao.

Ordem visual decidida pelo PO (nao reabrir): Cidade → Estado → **Bairro → Logradouro → CEP → Complemento** → Origem.

#### Criterios de aceite

- [ ] `ContactFilters` (`useContacts.ts`) contem `bairro?`, `logradouro?`, `cep?`, `complemento?` com JSDoc indicando operador ILIKE.
- [ ] A query Supabase em `useContacts` aplica `.ilike('bairro', ...)`, `.ilike('logradouro', ...)`, `.ilike('cep', ...)`, `.ilike('complemento', ...)` quando cada campo esta presente e nao vazio — mesma condicional usada para `cidade`.
- [ ] Limpar qualquer um dos quatro campos (string vazia) remove o filtro da query (coluna volta a `undefined`).
- [ ] Os quatro campos novos coexistem com todos os filtros ja existentes (AND semantico).
- [ ] O segmento "Localizacao" exibe os campos na ordem: Cidade, Estado, Bairro, Logradouro, CEP, Complemento, Origem.
- [ ] Subtitulo do segmento atualizado de `"Cidade, estado, origem"` para `"Cidade, estado, bairro e mais"`.
- [ ] Cada campo novo e um `<Input>` de texto com debounce de 300 ms (estado local + ref de timeout, identico ao padrao de `cidadeLocal`/`cidadeDebounce`).
- [ ] `countLocalizacao()` conta `f.bairro`, `f.logradouro`, `f.cep`, `f.complemento` alem dos tres existentes — badge do segmento reflete todos os seis campos.
- [ ] `clearAll()` reseta os quatro estados locais novos (alem dos ja existentes `cidadeLocal` e `origemLocal`).
- [ ] `ContactFiltersChips.tsx` gera chip com rotulo legivel (`Bairro: Centro`, `CEP: 30140`, etc.) e botao X que zera so aquele campo, para cada um dos quatro campos novos — inseridos apos o chip de Estado e antes do chip de Origem.
- [ ] `npm run build` e `npm run lint` passam sem erros ou warnings novos.

#### Hints tecnicos (nao-prescritivos)

- **Hook — interface:** Adicionar em `ContactFilters` (linha ~126 de `useContacts.ts`) os quatro campos opcionais, seguindo o padrao dos comentarios JSDoc de `cidade`/`estado`/`origem`.
- **Hook — destructuring:** Incluir `bairro`, `logradouro`, `cep`, `complemento` no destructuring de `filters` dentro de `useContacts()` (linha ~204) e no array de deps implicitoem `queryKey: ['contacts', filters]` (ja coberto automaticamente).
- **Hook — query:** Adicionar apos os blocos de `cidade`/`estado`/`origem` (linhas ~457-472 de `useContacts.ts`) quatro blocos identicos com `.ilike('campo', ...)`. Para `complemento`, o ILIKE ja descarta NULLs por padrao no Postgres (NULL nao bate com ILIKE), cobrindo o criterio do PO.
- **Componente — estado local:** Adicionar quatro pares `useRef` + `useState` seguindo o padrao exato de `cidadeDebounce`/`cidadeLocal` (linhas ~256-259). Incluir cleanup no `useEffect` de retorno (linha ~267).
- **Componente — UI:** Dentro do bloco `localizacao: () => (...)` (linha ~1051), inserir os quatro novos `<div>` com `<Label>` + `<Input>` entre o bloco de Estado/Origem. CEP pode ir em grid-cols-2 com Logradouro para economizar espaco vertical. Atualizar o `subtitle` do `SegmentCard` para `"Cidade, estado, bairro e mais"`.
- **Chips:** Inserir quatro blocos `if (filters.bairro)`, `if (filters.logradouro)`, `if (filters.cep)`, `if (filters.complemento)` em `ContactFiltersChips.tsx` apos o chip de Estado (linha ~264) e antes do chip de Origem (linha ~268).

#### Test cases

- **Happy path — Bairro:** Contato com `bairro = "Centro"` aparece ao digitar "centro" (case-insensitive ILIKE).
- **Happy path — CEP prefixo:** Contato com `cep = "30140-071"` aparece ao digitar "30140".
- **Happy path — combinacao:** Filtrar Cidade = "BH" AND Bairro = "Centro" retorna apenas contatos com ambos os campos correspondentes.
- **Edge — campo vazio:** Apagar texto de Logradouro remove o filtro; lista volta ao estado anterior sem logradouro.
- **Edge — complemento NULL:** Contato com `complemento = NULL` nao aparece quando filtro de Complemento esta ativo com qualquer valor.
- **Edge — zero resultados:** Digitar "Rua Inexistente" no campo Logradouro exibe estado vazio padrao da tela (sem crash).
- **Edge — clearAll:** Clicar em "Limpar tudo" zera todos os seis campos de localizacao (incluindo os quatro novos) e remove seus chips.
- **Edge — chip X:** Clicar X no chip "Bairro: Centro" zera apenas o bairro; demais filtros ativos permanecem.
- **Edge — reload:** Recarregar a pagina limpa todos os filtros (sem persistencia em localStorage).

#### Definition of Done

- [ ] Criterios de aceite validados
- [ ] `npm run lint` sem warnings novos
- [ ] `npm run build` sem erros de TypeScript
- [ ] Smoke test manual: abrir drawer → digitar em cada um dos quatro campos → verificar chips → clicar X em cada chip → clicar "Limpar tudo"
- [ ] QA aprovou

#### Out of scope

- Autocomplete ou validacao de CEP via ViaCEP ou API externa.
- Filtro do campo `numero` do cadastro.
- Persistencia dos filtros em localStorage/cookie.
- Busca textual global abrangendo campos de endereco.
- Qualquer alteracao em migrations ou tabela `contacts`.
