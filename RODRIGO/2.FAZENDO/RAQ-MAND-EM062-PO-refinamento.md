# Filtros Avançados na Aba de Contatos

**Cliente:** Raquel Auxiliadora — Mandato Desk 2026
**Codigo QG:** RAQ-MAND-EM062
**Prioridade:** alta
**Escrito por:** Agente PO em 2026-05-08

---

## Contexto e problema

O gabinete opera uma base de contatos que hoje supera vários milhares de registros (6.379+
contatos prontos para sync Google, conforme memory). A equipe usa a aba Contatos para
segmentar eleitores antes de ações de campo: disparos via WhatsApp, mobilizacao por bairro,
identificação de quem declarou voto, acompanhamento de demandas abertas.

O painel de filtros atual (Collapsible com grade de selects) cobre 9 dimensoes, o que e
razoavel para um começo, mas deixa de fora dimensoes criticas para o contexto politico:
origem do contato, localização geografica (cidade/estado), presença no funil de mobilizacao
(board/stage) e existencia de demandas abertas. Alem disso, filtros ativos sao invisiveis
apos recolher o painel — o assessor nao sabe o que esta filtrando sem reabrir o collapsible.
Resultado: analises que levam 10+ minutos de scroll manual e export, e risco de acao sobre
lista errada (ex: disparo WhatsApp sem perceber que filtro "Lideranca X" estava ativo).

O briefing original usa linguagem de CRM comercial ("vendas", "atendimento", "Responsavel
como conceito novo") que nao mapeia diretamente para o dominio politico. As decisoes de
mapeamento estao na secao dedicada abaixo.

---

## Job-to-be-done

Quando preciso segmentar a base para uma acao especifica (campo, disparo, relatorio),
quero combinar multiplos criterios de filtro e ver exatamente quem esta nessa segmentacao,
para que eu possa agir sobre a lista certa sem perder tempo ajustando exportacoes manuais.

---

## Decisoes sobre ambiguidades

| Termo do briefing | Decisao | Justificativa |
|---|---|---|
| "Status do contato" | Mapeado como "No funil" — filtro booleano (esta em algum board_item / nao esta) + opcionalmente qual board | Mandato Desk nao tem "status" formal de contato; o equivalente funcional e estar ou nao em um funil de mobilizacao |
| "Vendas" | Descartado | Mandato Desk e CRM politico. Nao existe entidade de vendas. O equivalente funcional seria demandas, mas filtrar "tem demanda" ja esta coberto abaixo |
| "Atendimento" | Mapeado como "Tem demanda registrada" — filtro IS NOT NULL em `demands.contact_id` | Tabela `demands` existe no DB com relacao a contacts; e o conceito mais proximo de "atendimento" no dominio do mandato |
| "Responsavel" | Mantido como "Lideranca" (leader_id, ja existe no filtro) | Adicionar created_by como filtro e P2 — util mas nao critico para esta entrega |
| "Pipeline" | Mapeado como "Funil" — select de boards (tabela `boards`) | Nomenclatura do sistema; contact_board_memberships liga contato a board |
| "Etapa do funil" | Dependente do filtro de funil — select de board_stages filtrado pelo board escolhido | So aparece se um funil especifico estiver selecionado |
| "Operadores AND/OR entre grupos" | Escopo reduzido: dentro de cada categoria o operador existente e mantido (tags = OR, campaign_fields = AND); operador global entre categorias fica como AND implicito | OR global entre grupos de filtros distintos exige query extremamente complexa e aumenta risco de performance com a base atual. Fica como P2 futuro |
| "Chips de filtros ativos" | Incluido no escopo — linha de chips abaixo da barra de busca, cada chip com X para remover | Resolve o maior ponto de dor de visibilidade sem custo de refactor do painel |
| "Cidade / Estado" | Incluido — colunas `contacts.cidade` e `contacts.estado` existem no DB, sem filtro de UI hoje | Filtro de texto simples (contains) para cidade; select com estados BR para estado |
| "Origem do lead" | Incluido — coluna `contacts.origem` existe no DB | Input texto livre (contains), pois origem e campo aberto |
| "Com/sem telefone" | Incluido — IS NULL / IS NOT NULL na coluna `telefone` | Simples e util para identificar contatos para completar cadastro |
| "Com/sem e-mail" | Incluido — IS NULL / IS NOT NULL na coluna `email` | Idem |

---

## Hipotese de solucao (alto nivel)

**P0 — Chips de filtros ativos:** Exibir linha de chips/pills logo abaixo da barra de busca,
listando cada filtro ativo com label descritivo e botao X para remover individualmente.
Substitui o badge de contagem atual por visibilidade real.

**P1 — Novos filtros geograficos e de presenca:** Adicionar ao painel existente: Cidade
(input texto), Estado (select com UF), Origem (input texto), "No funil" (select de boards),
Etapa (select de stages — aparece condicionalmente), "Tem demanda" (toggle sim/nao/todos),
"Com telefone" (toggle), "Com e-mail" (toggle).

**P2 — Filtros favoritos migram para DB:** Hoje persistidos em localStorage; vulneravel a
limpeza de browser. Migrar para tabela `filtros_favoritos_contatos` (Supabase) com created_by.
Escopo P2 — nao bloqueia P0/P1.

O painel de filtros mantem a estrutura Collapsible existente — nao ha refactor de layout.
Os chips de filtros ativos sao o grande ganho de UX sem custo estrutural alto.

---

## User stories

**US01 (P0) — Chips de filtros ativos**
Como assessora de gabinete revisando listas de contatos, quero ver chips visuais de cada
filtro ativo mesmo com o painel de filtros recolhido, para saber exatamente qual segmentacao
esta aplicada sem reabrir o painel — e remover filtros individuais com um clique.

**US02 (P1) — Filtros de localizacao**
Como assessora preparando acao de campo em um bairro ou cidade, quero filtrar contatos por
Cidade e Estado, para gerar a lista geografica sem exportar tudo e filtrar na planilha.

**US03 (P1) — Filtro por funil e etapa**
Como coordenadora de mobilizacao acompanhando o funil, quero filtrar contatos que estao em
um funil especifico (e opcionalmente em uma etapa especifica), para saber quem ainda nao
entrou no processo e quem ja esta em qual fase.

**US04 (P1) — Filtro "Tem demanda registrada"**
Como assessor de atendimento identificando contatos sem acompanhamento, quero filtrar
contatos que tem ou nao tem demandas registradas, para priorizar quem nunca foi atendido
ou quem tem demanda aberta.

**US05 (P1) — Filtros de completude do cadastro**
Como responsavel pela qualidade da base, quero filtrar contatos sem telefone ou sem e-mail,
para identificar cadastros incompletos e acionar a equipe para completar os dados.

**US06 (P1) — Filtro por Origem**
Como analista de aquisicao de contatos, quero filtrar por origem do contato (ex: "evento",
"indicacao", "plenaria"), para mensurar quais canais geram mais contatos na base.

---

## Criterios de aceite

### US01 — Chips de filtros ativos

- [ ] Quando pelo menos 1 filtro estiver ativo, uma linha de chips aparece abaixo da barra de busca (acima da listagem), mesmo com o painel de filtros recolhido
- [ ] Cada chip exibe o label do filtro e seu valor (ex: "Lideranca: Maria Silva", "Etiqueta: Apoiador", "Cidade: Belo Horizonte")
- [ ] Clicar no X de um chip remove apenas aquele filtro e a listagem atualiza em menos de 600ms
- [ ] Quando nenhum filtro estiver ativo, a linha de chips nao aparece (sem espaco em branco)
- [ ] O botao "Limpar filtros" existente remove todos os chips de uma vez
- [ ] Chips de busca textual tambem aparecem ("Busca: 'joao'") e sao removiveis

### US02 — Localizacao

- [ ] Painel de filtros exibe campo "Cidade" (input texto) e "Estado" (select com 27 UF brasileiras)
- [ ] Filtro Cidade faz match case-insensitive parcial (ex: "belo" retorna "Belo Horizonte" e "Belo Campo")
- [ ] Filtro Estado retorna apenas contatos com `contacts.estado` igual ao valor selecionado
- [ ] Aplicar filtro Cidade="Belo Horizonte" + Estado="MG" retorna apenas contatos com ambas as condicoes satisfeitas (AND implicito)
- [ ] Chip correspondente aparece (ex: "Estado: MG")

### US03 — Funil e etapa

- [ ] Painel exibe select "Funil" com lista de boards ativos (query na tabela `boards`)
- [ ] Ao selecionar um funil, select "Etapa" aparece com as stages daquele board (query `board_stages` filtrada por board_id)
- [ ] Filtro "Funil" sem etapa retorna todos os contatos que tem pelo menos 1 registro em `board_items` para aquele board
- [ ] Filtro "Funil" + "Etapa" retorna contatos cujo `board_items.stage_id` bate com a etapa selecionada
- [ ] Toggle "Fora de qualquer funil" retorna contatos sem nenhum registro em `board_items`
- [ ] Chips aparecem (ex: "Funil: Mobilizacao 2026", "Etapa: Contato feito")

### US04 — Tem demanda

- [ ] Painel exibe toggle/select "Demandas" com opcoes: Todos / Com demanda / Sem demanda
- [ ] "Com demanda" retorna contatos que possuem ao menos 1 linha em `demands` com `contact_id` igual ao id do contato
- [ ] "Sem demanda" retorna contatos sem nenhuma linha em `demands` com esse contact_id
- [ ] Chip aparece ("Demanda: Com demanda")

### US05 — Completude de cadastro

- [ ] Painel exibe toggles "Com telefone" e "Com e-mail" (cada um independente)
- [ ] Toggle "Com telefone" ativado filtra contatos onde `contacts.telefone IS NOT NULL`
- [ ] Toggle "Sem telefone" (alternativa no mesmo toggle) filtra contatos onde `contacts.telefone IS NULL`
- [ ] Idem para e-mail
- [ ] Chips aparecem ("Telefone: Sem telefone")

### US06 — Origem

- [ ] Painel exibe campo "Origem" (input texto)
- [ ] Filtro faz match case-insensitive parcial na coluna `contacts.origem`
- [ ] Chip aparece ("Origem: evento")

### Criterio transversal (CRUD — regra Rodrigo)

- [ ] Filtros favoritos (ja existentes) continuam funcionando: salvar, aplicar e excluir um filtro favorito que inclua qualquer um dos novos campos (cidade, estado, funil, etapa, demanda, telefone, email, origem)

---

## Edge cases conhecidos

- **Funil sem stages cadastrados:** select de etapa aparece vazio com mensagem "Nenhuma etapa neste funil"
- **Filtro funil + !inner pode estoura URL:** se o filtro de board_items retornar centenas de IDs, usar a tecnica embed !inner (ja adotada para tags) em vez de `.in('id', [...])` — Fullstack deve verificar o limite de URL (~16KB)
- **Filtro Cidade com acento:** match ilike ja e case-insensitive no Postgres; testar "belo horizonte" vs "Belo Horizonte" — deve retornar ambos
- **Estado com valor nulo:** contatos sem estado preenchido nao devem aparecer quando um estado estiver selecionado
- **Origem nula:** idem — `IS NULL` nao bate com ilike; filtro de origem so deve retornar contatos com `origem IS NOT NULL AND origem ILIKE '%termo%'`
- **Listagem vazia apos filtros combinados:** estado de empty state existente ja cobre; nao precisa novo componente
- **Favorito salvo com filtro de funil:** ao aplicar o favorito, o select de etapa deve carregar as stages do board salvo antes de tentar selecionar a stage — Fullstack deve garantir que a hydration do estado de filtro respeita a ordem (board_id antes de stage_id)
- **Performance com filtro de demanda:** sub-query em `demands` pode ser lenta se a tabela crescer; usar `.select('id').eq('contact_id', ...)` com `.in()` no limite de IDs ou EXISTS via RPC se a base de demandas ultrapassar 10k linhas — Fullstack avalia e documenta a escolha

---

## Nao-objetivos (out of scope)

- Operadores OR explicitos entre grupos de filtros distintos (ex: "cidade = RJ OU etapa = Contato feito") — complexidade de query alta, fica como P2 futuro
- Migracao dos filtros favoritos de localStorage para DB — e P2 independente
- Filtro por "Responsavel (created_by)" — leader_id ja cobre o caso de uso primario; created_by e P2
- Refactor visual do painel de filtros (layout, cores, tipografia) — nao pertence a esta task
- Filtro por campos de campanha com operador OR — logica existente (AND) e mantida
- Qualquer mudanca na tela de Demandas ou Funil — esta task e somente aba Contatos
- Novo painel de filtros em modal/drawer separado — Collapsible existente e mantido
- "Contatos com ou sem vendas" — termo de CRM comercial, sem equivalente no dominio politico; descartado

---

## Metricas de sucesso

- **Primaria (quantitativa):** Tempo medio para montar uma segmentacao geografica (cidade + etapa de funil) cai de estimativa de ~12 minutos (export + filtro planilha) para menos de 2 minutos dentro do proprio sistema — medivel por observacao direta na primeira semana de uso
- **Secundaria (qualitativa):** Rodrigo/assessora consegue identificar o filtro ativo sem reabrir o painel — validado se chips aparecem corretamente em 100% dos cenarios testados no QA
- **Terciaria (adocao):** Pelo menos 2 filtros novos (funil, cidade ou demanda) sao usados em pelo menos 1 sessao na primeira semana apos entrega

---

## Riscos identificados

- **Valor:** Risco baixo — filtros geograficos e de funil sao pedidos recorrentes em CRMs politicos; a base ja tem os dados (colunas existem)
- **Usabilidade:** Risco medio — chips de filtros ativos resolvem o maior ponto de invisibilidade, mas o painel Collapsible com muitos novos campos pode ficar denso; Fullstack deve agrupar os novos campos em subsecao "Localizacao" e "Presenca no sistema" dentro do painel existente
- **Feasibility:** Risco medio no filtro de funil/etapa — a query de `board_items` pode retornar muitos IDs; usar embed !inner como padrao estabelecido para tags (ver lesson em memory.md: "Supabase .in() URL limit")
- **Feasibility — filtro de demanda:** `demands` nao tem indice em `contact_id` documentado — Fullstack deve verificar antes de implementar a sub-query; se necessario, adicionar indice via migration
- **Business:** Risco baixo — nenhum conflito com outros modulos; mudancas sao aditivas no painel ja existente

---

## Priorizacao RICE simplificada

| Story | Reach | Impact | Confidence | Effort | Score |
|---|---|---|---|---|---|
| US01 Chips ativos | Alto (100% dos usuarios) | Alto | Alta | Baixo | **Muito alto** |
| US02 Localizacao | Alto (acoes de campo frequentes) | Alto | Alta | Baixo | **Alto** |
| US03 Funil/etapa | Medio (coordenadores de mobilizacao) | Alto | Media | Medio | **Alto** |
| US04 Tem demanda | Medio (assessores de atendimento) | Medio | Alta | Baixo | **Medio-alto** |
| US05 Completude cadastro | Medio (gestor de base) | Medio | Alta | Muito baixo | **Medio** |
| US06 Origem | Baixo (analistas) | Baixo | Alta | Muito baixo | **Baixo** |

Ordem de implementacao recomendada: US01 → US02 → US05 → US06 → US03 → US04
(US01 tem o maior retorno visual imediato; US03 e US04 tem maior custo de implementacao)

---

## Definition of Ready — atendida?

- [x] Persona especifica identificada (assessora/coordenadora de mobilizacao)
- [x] Job-to-be-done articulado
- [x] Criterios de aceite testáveis (sem "rapido"/"intuitivo")
- [x] Pelo menos uma metrica quantitativa
- [x] Nao-objetivos listados
- [x] Ambiguidades resolvidas com justificativa
- [x] Hipotese de solucao em alto nivel (sem codigo)
- [x] Riscos de feasibility identificados (URL limit, indice em demands)
- [x] CRUD de filtros favoritos mencionado (Regra Rodrigo)

**DoR: ATENDIDA.** Backlog pode quebrar em tasks atomizadas.
