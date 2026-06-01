# Novos filtros de endereço no painel lateral de Contatos

**Cliente:** Raquel — Mandato Desk 2026
**Código QG:** RAQ-MAND-EM069
**Prioridade:** média
**Escrito por:** Agente PO em 2026-05-11

---

## Contexto e problema

O painel lateral de filtros da tela de Contatos (`ContactFilters.tsx`) expõe no segmento
"Localização" apenas três campos: Cidade (ILIKE), Estado (seletor de UF) e Origem (ILIKE).
Entretanto, o cadastro de contato já persiste bairro, logradouro, complemento e CEP na
tabela `contacts` — e o tipo `Contact` em `useContacts.ts` mapeia todos esses campos.

O gap causa fricção quando o gabinete precisa segmentar contatos por microterritório
(ex.: "todos os eleitores do bairro Centro que cadastramos neste mês"). O operador é
forçado a exportar e filtrar manualmente fora da ferramenta, ou a usar a busca textual
global, que busca apenas em nome/whatsapp/e-mail e não nos campos de endereço.

## Job-to-be-done

Quando preciso segmentar contatos por endereço mais granular (bairro, rua, CEP), quero
aplicar filtros diretamente no painel lateral, para que eu possa gerar listas territoriais
sem exportação manual e sem precisar conhecer SQL.

## Hipótese de solução (alto nível)

Expandir o segmento "Localização" do drawer com quatro novos campos de texto livre —
Bairro, Logradouro, CEP e Complemento — todos com o mesmo padrão de debounce 300 ms e
ILIKE já usado por Cidade e Origem. A ordem visual dentro do segmento segue a hierarquia
natural de endereço: Cidade → Estado → Bairro → Logradouro → CEP → Complemento → Origem.
Cada campo novo gera um chip removível no topo do drawer e incrementa a contagem do
segmento "Localização". Nenhuma API externa é consultada.

---

## User stories

- **US01** — Como operadora do gabinete, quero filtrar contatos pelo bairro cadastrado,
  para identificar rapidamente eleitores de uma região específica sem exportação manual.

- **US02** — Como operadora do gabinete, quero filtrar contatos por logradouro ou CEP,
  para segmentar endereços quando preciso planejar visitas ou distribuição de material.

- **US03** — Como operadora do gabinete, quero ver chips individuais para cada filtro de
  endereço ativo e poder removê-los separadamente, para ajustar a busca sem perder os
  demais filtros aplicados.

---

## Critérios de aceite

### Filtros no painel

- [ ] O segmento "Localização" exibe, nesta ordem: Cidade, Estado, Bairro, Logradouro, CEP, Complemento, Origem.
- [ ] Cada campo novo (bairro, logradouro, cep, complemento) é um `<Input>` de texto com debounce de 300 ms, idêntico ao comportamento atual de Cidade.
- [ ] Digitar em qualquer campo novo dispara a query com ILIKE case-insensitive (`%valor%`) na coluna correspondente da tabela `contacts`.
- [ ] Limpar o campo (string vazia) remove o filtro da query (coluna volta a `undefined`).
- [ ] Todos os quatro campos novos convivem e se combinam com Cidade, Estado e Origem (AND semântico, todos os filtros ativos devem ser satisfeitos).

### Contagem e chips

- [ ] `countLocalizacao()` passa a contar `f.bairro`, `f.logradouro`, `f.cep`, `f.complemento` além dos três existentes — o badge numérico do segmento reflete todos os seis campos.
- [ ] `totalActiveCount()` reflete a contagem correta (nenhum campo novo fica de fora).
- [ ] Cada campo novo ativo gera um chip individualizado no topo do drawer com rótulo legível (ex.: `Bairro: Centro`) e botão X funcional que zera só aquele campo.
- [ ] `clearAll()` limpa os quatro campos novos junto com os demais (estado local e valor do filtro).

### Comportamento de busca

- [ ] GIVEN um contato com `bairro = "Centro"`, WHEN o operador digita "centro" no filtro Bairro, THEN esse contato aparece na listagem (case-insensitive).
- [ ] GIVEN um contato com `cep = "30140-071"`, WHEN o operador digita "30140", THEN esse contato aparece (busca por prefixo via ILIKE).
- [ ] GIVEN nenhum contato com `logradouro` contendo "Rua X", WHEN o operador digita "Rua X", THEN a lista retorna zero resultados e exibe o estado vazio padrão da tela.
- [ ] GIVEN contato com `complemento = NULL`, WHEN filtro de Complemento está ativo com qualquer valor, THEN esse contato NÃO aparece no resultado.

### Integridade de estado

- [ ] Recarregar a página limpa todos os filtros (comportamento atual mantido — sem persistência em localStorage).
- [ ] Os novos filtros resetam `page: 1` ao serem aplicados, igual aos demais.

---

## Decisões UX (tomadas neste refinamento — não reabrir)

| Questão | Decisão |
|---|---|
| Operador de busca para CEP | ILIKE (`%valor%`) — consistente com os demais campos de texto; busca parcial é mais útil que match exato |
| Complemento no filtro | Incluído — está no escopo do briefing; raramente usado mas custo de implementação é zero |
| Ordem dos campos | Cidade → Estado → Bairro → Logradouro → CEP → Complemento → Origem (hierarquia geográfica, Origem fica última por ser metadata de captação, não de endereço) |
| Subtítulo do segmento | Atualizar de "Cidade, estado, origem" para "Cidade, estado, bairro e mais" |
| Persistência de estado | Não persistir em localStorage nesta entrega |
| Autocomplete de CEP via ViaCEP | Fora de escopo nesta entrega |

---

## Não-objetivos (fora de escopo)

- Autocomplete ou validação de CEP via ViaCEP ou qualquer API externa.
- Filtro de "Número" (campo `numero` do cadastro — baixíssima utilidade para segmentação).
- Busca textual global abrangendo campos de endereço (feature separada, maior impacto na query de search).
- Reordenação dos segmentos do drawer.
- Persistência de filtros entre sessões (localStorage/cookie).
- Qualquer alteração no cadastro de contato ou nas migrações de banco — os campos já existem.

---

## Definition of Done

- [ ] `npm run build` passa sem erros de TypeScript.
- [ ] `npm run lint` passa sem warnings novos.
- [ ] Interface `ContactFilters` em `useContacts.ts` contém `bairro?`, `logradouro?`, `cep?`, `complemento?` com JSDoc de operador (ILIKE).
- [ ] A query Supabase em `useContacts` aplica os quatro filtros novos quando presentes.
- [ ] `countLocalizacao()` contabiliza os quatro campos novos.
- [ ] `ContactFiltersChips` gera chip com rótulo e remoção para cada campo novo.
- [ ] `clearAll()` em `ContactFilters` reseta os quatro estados locais novos.
- [ ] QA visual: segmento "Localização" exibe os seis campos na ordem definida, chips aparecem e somem corretamente, contagem no badge bate com o número de campos preenchidos.

---

## Riscos identificados

- **Valor:** Baixo risco — os campos já existem no banco; é exposição de dado já armazenado. Usuário que não usa simplesmente ignora os campos novos.
- **Usabilidade:** Segmento Localização fica mais longo. Mitigado pelo padrão collapsible existente — o segmento fecha quando não há filtros ativos.
- **Feasibility:** Nenhum risco técnico. Padrão ILIKE com debounce já implementado; é replicar o mesmo para quatro campos.
- **Business:** Nenhum conflito identificado com PRD ou features em andamento.

---

## Perguntas em aberto

Nenhuma. Briefing pronto para Backlog.
