# Ranking Automático de Engajamento de Contatos

**Cliente:** Raquel Auxiliadora — Mandato Desk 2026
**Código QG:** RAQ-MAND-EM049
**Prioridade:** alta
**Escrito por:** Agente PO em 2026-05-08

---

## Contexto e problema

O gabinete gerencia uma base de 6.000+ contatos e precisa priorizar esforços de campo
e mobilização. Hoje o campo `ranking` (INTEGER 0-10) é preenchido manualmente pelo
assessor clicando em botões na aba Campanha. Na prática, isso significa que o ranking
reflete a percepção subjetiva de quem editou o contato por último — e contatos nunca
editados ficam em 0, independente de terem WhatsApp confirmado, declarado voto e
endereço completo. O resultado: o filtro de ranking não serve para priorização real
porque o dado não é confiável. Rodrigo/assessores perdem tempo avaliando contato a
contato quem merece atenção, sem conseguir ordenar a base por critérios objetivos.

O cliente listou explicitamente os campos que devem influenciar o ranking e confia no
critério do time para definir os pesos. A solução precisa ser automática (calculada
sempre que o contato é salvo) e não pode quebrar os fluxos existentes de importação
CSV, exportação XLSX e merge de duplicatas.

---

## Job-to-be-done

Quando preciso priorizar contatos para uma ação de campo ou disparo de WhatsApp,
quero ver uma pontuação calculada automaticamente com base nos dados que já estão
preenchidos, para que eu possa ordenar e filtrar a base por engajamento real sem
gastar tempo avaliando cada contato manualmente.

---

## Hipótese de solução (alto nível)

Substituir o campo `ranking` manual por um campo `ranking` calculado automaticamente
via trigger PostgreSQL que roda a cada UPDATE/INSERT em `contacts` e em
`contact_campaign_values`. O trigger soma pontos de acordo com uma tabela de pesos
hardcoded na v1 e grava o resultado (0-10, derivado de uma escala 0-100) de volta
em `contacts.ranking`. A UI da aba Campanha substitui os botões 0-10 por um indicador
read-only com breakdown visual (tooltip mostrando de onde vieram os pontos). O filtro
de range existente (ranking_min/ranking_max) continua funcionando sem alteração.

---

## Tabela de pesos sugerida

Escala interna: 0-100 pontos. Derivação para escala 0-10: `FLOOR(pontos_brutos / 10)`,
capped em 10. Exemplo: 73 pontos → ranking 7; 100 pontos → ranking 10.

### Categoria A — Status de campanha (50 pontos máx)

| Campo | Pontos | Justificativa |
|---|---|---|
| `declarou_voto = true` | 20 | Maior sinal de engajamento político — listado primeiro pelo cliente |
| `e_multiplicador = true` | 15 | Multiplicadores têm valor exponencial: alcançam outros contatos |
| `aceita_whatsapp = true` | 10 | Canal primário de comunicação do gabinete; sem isso, não alcança |
| `em_canal_whatsapp = true` | 5 | Reforça o anterior; canal ativo tem mais valor que simples aceite |

Subtotal máximo: 50 pontos. Categoria recebe maior peso porque o cliente a listou
explicitamente como prioritária e são os únicos campos com significado político direto.

### Categoria B — Dados de contato e pessoais (25 pontos máx)

| Campo | Pontos | Justificativa |
|---|---|---|
| `whatsapp` preenchido | 8 | Canal primário; sem número, aceite_whatsapp não tem utilidade |
| `leader_id` preenchido | 7 | Vínculo com articulador indica integração na rede política |
| `email` preenchido | 4 | Canal secundário; útil para comunicações formais |
| `data_nascimento` preenchida | 3 | Viabiliza ação de relacionamento (aniversário); dado relevante |
| `telefone` preenchido | 3 | Canal de backup; diferente do whatsapp |

Subtotal máximo: 25 pontos. Dados de contato validam que o cadastro é acionável.

### Categoria C — Endereço (15 pontos máx)

| Campo | Pontos | Justificativa |
|---|---|---|
| `bairro` + `cidade` preenchidos | 7 | Permite ação de campo geograficamente segmentada |
| `cep` preenchido | 4 | Endereço completo: viabiliza geolocalização e envio de material físico |
| `estado` preenchido | 2 | Complementa localização; menos crítico que cidade/bairro |
| `logradouro` preenchido | 2 | Endereço completo; complementa os acima |

Subtotal máximo: 15 pontos. Endereço é importante para ações de campo mas menos
crítico que dados de contato e status político.

### Categoria D — Redes sociais (5 pontos máx)

| Campo | Pontos | Justificativa |
|---|---|---|
| `instagram` preenchido | 3 | Principal rede do contexto político brasileiro |
| Qualquer outra rede (facebook/twitter/tiktok/youtube) | +1 cada (máx 2) | Diversidade de canais; peso baixo porque o alcance é indireto |

Subtotal máximo: 5 pontos. Redes sociais são dado de completude, não de engajamento.

### Categoria E — Campos de campanha customizáveis (até 5 pontos, distribuídos)

Cada campo boolean de campanha ativo (`contact_campaign_values`) contribui com
`FLOOR(5 / total_campos_ativos_no_tenant)` pontos, capped em 5 no total da categoria.
Raciocínio: campos customizáveis variam por gabinete; não dá para atribuir peso fixo
sem conhecer o significado de cada um. Distribuição proporcional evita que um tenant
com 1 campo dê vantagem desproporcional e outro com 10 campos dê quase nada.

**Nota importante:** Se o cliente criar campos com peso político alto (ex: "Confirmou
presença na plenária"), o sistema de pesos fixos da v1 não captura isso adequadamente.
Isso é reconhecido como limitação explícita da v1 — ver DP3 abaixo.

### Resumo da escala derivada

| Pontos brutos | Ranking (0-10) | Perfil típico |
|---|---|---|
| 0-9 | 0 | Contato sem dados |
| 10-19 | 1 | Só nome + 1 dado básico |
| 20-29 | 2 | Tem WhatsApp, sem status político |
| 30-39 | 3 | Dados básicos completos |
| 40-49 | 4 | Dados + endereço parcial |
| 50-59 | 5 | Declarou voto ou é multiplicador + dados |
| 60-69 | 6 | Declarou voto + dados completos |
| 70-79 | 7 | Alto engajamento + cadastro completo |
| 80-89 | 8 | Declarou voto + multiplicador + quase tudo |
| 90-99 | 9 | Quase tudo preenchido |
| 100 | 10 | Tudo preenchido + declarou voto + multiplicador |

---

## User stories

**US01 — Cálculo automático ao salvar**
Como assessora de gabinete atualizando o cadastro de um contato, quero que o ranking
seja recalculado automaticamente ao salvar qualquer alteração no contato ou nos campos
de campanha, para que a pontuação sempre reflita o estado atual dos dados sem que eu
precise calcular manualmente.

**US02 — Visualização do ranking com breakdown na aba Campanha**
Como assessora revisando o perfil de um contato, quero ver o ranking calculado
com um tooltip ou popover explicando de onde vieram os pontos (ex: "+20 Declarou
voto, +15 Multiplicador, +8 WhatsApp..."), para entender o que falta preencher para
aumentar a pontuação.

**US03 — Filtro por ranking continua funcionando**
Como coordenadora de mobilização filtrando os contatos mais engajados, quero usar o
filtro de range de ranking (min/max) na listagem de contatos, para identificar o topo
da base sem exportar e ordenar manualmente.

**US04 — Recálculo em massa pós-migration**
Como gestora da base de dados, quero que todos os contatos existentes tenham o ranking
recalculado automaticamente após a ativação da funcionalidade, para que a base inteira
reflita os pesos novos sem requerer edição manual de cada contato.

**US05 — Exportação e importação preservam o dado calculado**
Como assessora exportando a base, quero que o XLSX exportado mostre o ranking
calculado (não o manual antigo), e quero que um import CSV com coluna `ranking`
preserve o valor importado sem sobreescrever com o calculado automaticamente.

---

## Critérios de aceite

### US01 — Cálculo automático

- [ ] Ao salvar um contato com `declarou_voto = true`, o campo `contacts.ranking`
  é atualizado para o valor correto conforme a tabela de pesos, sem intervenção manual
- [ ] Ao marcar/desmarcar qualquer campo boolean de campanha em `contact_campaign_values`,
  o ranking do contato é recalculado e o novo valor aparece na UI dentro de 2 segundos
  (sem reload manual da página)
- [ ] Ao criar um novo contato com apenas nome preenchido, o ranking gravado é 0
- [ ] Ao criar um novo contato com nome + whatsapp + declarou_voto + e_multiplicador,
  o ranking gravado é no mínimo 4 (correspondente a ≥ 43 pontos brutos)

### US02 — Visualização com breakdown

- [ ] A seção de Ranking na aba Campanha exibe o número calculado (0-10) em modo
  read-only — os botões manuais 0-10 são removidos
- [ ] Um ícone de informação (tooltip ou popover) ao lado do número exibe a lista de
  campos que contribuíram com pontos, com label e valor individual (ex: "+20 Declarou
  voto", "+10 Aceita WhatsApp")
- [ ] O tooltip também exibe campos que poderiam contribuir mas estão vazios (ex:
  "E-mail: não preenchido — +4 disponíveis"), incentivando completar o cadastro
- [ ] Contato com ranking 0 exibe mensagem "Preencha mais dados para aumentar a
  pontuação" no lugar do tooltip vazio

### US03 — Filtro de range

- [ ] O filtro `ranking_min` / `ranking_max` na listagem de contatos retorna apenas
  contatos cujo `contacts.ranking` está dentro do range selecionado (inclusive)
- [ ] Aplicar filtro ranking_min=7 retorna contatos com ranking >= 7, em ordem
  decrescente de ranking quando `sort_by = 'ranking_desc'` for selecionado
- [ ] O chip "Ranking: 7 a 10" aparece na barra de chips quando esse filtro está ativo
- [ ] Filtro de ordenação `sort_by` aceita novo valor `ranking_desc` (mais engajados
  primeiro) — deve aparecer no select de ordenação da listagem

### US04 — Recálculo em massa

- [ ] Uma migration SQL aplica a função de cálculo a todos os registros existentes em
  `contacts` em uma única operação UPDATE (sem loop no frontend)
- [ ] Após rodar a migration, consulta `SELECT COUNT(*) FROM contacts WHERE ranking > 0`
  retorna número maior que zero (confirma que recálculo atualizou registros)
- [ ] Migration completa em menos de 60 segundos para uma base de até 10.000 contatos
  (validar com EXPLAIN ANALYZE antes de rodar em prod)

### US05 — Exportação e importação

- [ ] XLSX exportado pela `ExportMenu.tsx` inclui coluna "Ranking" com o valor
  calculado (não mais o valor manual defasado)
- [ ] Import CSV com coluna `ranking` preenchida (0-10) grava o valor importado
  no campo `ranking` sem sobreescrever com o cálculo automático — o trigger NÃO
  dispara no evento de import (ou ignora a coluna e o import passa o valor diretamente)
- [ ] Merge de duplicatas (`useDuplicates.ts`) continua usando `MAX(ranking)` dos
  registros mesclados; após o merge, o trigger recalcula e pode ajustar o valor se
  o MAX manual for menor que o calculado

### CRUD — regra Rodrigo

- [ ] A tela de Configurações que já existe continua com todas as operações de campos
  de campanha (criar, editar, excluir campo customizável) — ao excluir um campo, o
  ranking de todos os contatos é recalculado automaticamente (trigger em
  `contact_campaign_values` já cobre isso se a exclusão deletar as linhas associadas)

---

## Decisões de produto críticas

### DP1 — Substituir o campo `ranking` existente OU criar campo novo `ranking_auto`

**Recomendação: substituir o campo `ranking` existente.**

Prós de substituir: zero mudança nos filtros existentes (`ranking_min`/`ranking_max`),
nos chips, no export XLSX, na tipagem TypeScript, no merge de duplicatas — tudo já
usa `contacts.ranking`. Mudança mínima no frontend.

Contras: perde o valor manual histórico. Mitigação: a migration pode salvar o valor
manual antigo em coluna `ranking_manual_legado` antes de sobreescrever, para auditoria.

Prós de campo novo: preserva o manual intacto como override. Contras: dobra a
complexidade (dois campos de ranking, dois filtros, dois chips, dois exports) sem
benefício real — o manual nunca foi confiável.

**Decisão final: substituir. Salvar backup em `ranking_manual_legado` (nullable)
antes da migration para auditoria; remover UI dos botões manuais.**

### DP2 — Trigger SQL no banco OU cálculo no frontend

**Recomendação: trigger PostgreSQL.**

Prós: fonte de verdade única, funciona para imports CSV (que bypassam o frontend),
para atualizações via Supabase Studio, para webhooks e integrações futuras. Sem
drift entre ambientes.

Contras: lógica de pesos fica no banco (SQL), mais difícil de alterar sem migration.
Mitigação da v1: pesos hardcoded são aceitos pelo cliente, então a rigidez é aceitável.

Cálculo no frontend: cria drift imediato — import CSV não recalcula, dashboard pode
mostrar ranking desatualizado, merge de duplicatas é inconsistente.

**Decisão final: trigger PostgreSQL + recálculo em massa via migration.**

O trigger dispara em `AFTER INSERT OR UPDATE ON contacts` e em
`AFTER INSERT OR UPDATE OR DELETE ON contact_campaign_values`.

### DP3 — Pesos hardcoded na v1 OU configuráveis via UI desde o início

**Recomendação: hardcoded na v1.**

Cliente delegou a definição dos pesos ao time. Configurabilidade via UI exige tela
de admin, validação de soma, experiência de UI não trivial — custo 3x maior sem
benefício imediato. Se o cliente pedir ajuste de peso, fazer uma nova migration
leva 15 minutos. O verdadeiro gatilho para configurabilidade UI é quando diferentes
gabinetes usarem o mesmo sistema com pesos distintos (SaaS multi-tenant) — ainda
não é o caso.

**Decisão final: hardcoded na v1. Criar issue P2 para configurabilidade.**

### DP4 — Mostrar breakdown ao usuário OU só o número

**Recomendação: mostrar breakdown via tooltip/popover.**

O número isolado (ex: "ranking 6") não instrui o assessor sobre o que preencher para
subir a pontuação. O breakdown transforma o ranking de métrica passiva em ferramenta
ativa de completude de dados. Custo de implementação: moderado (componente de tooltip
com lista de itens). Impacto: assessor sabe exatamente o que falta preencher.

**Decisão final: breakdown obrigatório no popover da aba Campanha.**
Formato: lista de campos contribuindo (com pontos ganhos) + lista de campos faltando
(com pontos potenciais). Máximo 12 linhas para não ficar verboso.

### DP5 — Filtro novo "Top N contatos" OU manter range existente

**Recomendação: adicionar opção de ordenação `ranking_desc` ao sort_by existente.**

"Top N" exige input numérico e lógica de paginação diferenciada. O range existente
(min/max) já cobre o caso de uso "quero ver ranking >= 7". Adicionar `sort_by =
'ranking_desc'` ao select de ordenação existente cobre o caso "quero ver do mais
engajado pro menos" com custo mínimo de implementação.

**Decisão final: adicionar `ranking_desc` ao sort_by. "Top N" fica como P2.**

### DP6 — Imports CSV com coluna `ranking` manual: recalcular ou preservar?

**Recomendação: preservar o valor importado, sem sobreescrever com o cálculo.**

Raciocínio: quem importa um CSV com `ranking` preenchido está trazendo dado
intencional. Forçar recálculo imediato invalidaria planilhas históricas. A solução
técnica é fazer o trigger verificar se a coluna foi atualizada via um flag de sessão
ou simplesmente não incluir o campo `ranking` na lista de colunas que disparam o
recálculo — o trigger só recalcula quando qualquer outro campo (que não `ranking`
em si) é modificado.

Alternativa mais simples: trigger sempre recalcula, e o import ignora a coluna
`ranking` (não mapeia para o DB). O template de import CSV atualiza para remover
a coluna `ranking` ou documentar que ela é ignorada.

**Decisão final: trigger sempre recalcula ao salvar; import CSV para de aceitar
coluna `ranking` como input (a coluna vira output-only). Atualizar template de
import e documentação. Ranking legado do CSV é perdido — aceitável porque o cálculo
automático substituirá com valor mais confiável.**

---

## MVP (escopo mínimo — v1)

**Entra na v1:**
- Migration SQL: backup de `ranking` em `ranking_manual_legado`, função de cálculo,
  trigger em `contacts` e `contact_campaign_values`, UPDATE em massa de todos os registros
- UI: remover botões 0-10 da aba Campanha, substituir por badge read-only + popover
  de breakdown
- Sort: adicionar `ranking_desc` ao select de ordenação na listagem de contatos
- Import CSV: remover mapeamento de `ranking` como campo editável; atualizar template
  e descrição da coluna
- Export XLSX: sem mudança (já exporta `contacts.ranking`, que agora é calculado)
- Merge de duplicatas: sem mudança (MAX(ranking) continua; trigger recalcula após merge)

**Fica para v2 (P2):**
- Interface admin para configurar pesos (sliders por categoria)
- Filtro "Top N contatos mais engajados" (quick filter pré-definido)
- Campos de campanha com peso individual configurável (hoje distribuição proporcional)
- Histórico de ranking ao longo do tempo (snapshot mensal)
- Ranking por segmento (ex: "top engajados do bairro X")

---

## Métricas de sucesso

- **Cobertura (quantitativa):** Após a migration, menos de 2% dos contatos mantêm
  `ranking = 0` — indicando que o cálculo chegou à base toda. Medido com
  `SELECT COUNT(*) FROM contacts WHERE ranking = 0`.
- **Consistência (quantitativa):** Contatos com `declarou_voto = true` AND
  `e_multiplicador = true` têm `ranking >= 3` (≥ 35 pontos brutos apenas desses dois
  campos). Validável com query simples pós-migration.
- **Performance (quantitativa):** Update individual de contato (trigger) completa em
  menos de 50ms em média — medível via `EXPLAIN ANALYZE UPDATE contacts SET nome = nome
  WHERE id = '...'` no Supabase SQL editor.
- **Adoção (qualitativa):** Na primeira semana após entrega, Rodrigo ou assessora usa
  o sort `ranking_desc` ou o filtro `ranking_min >= 7` pelo menos 3 vezes em sessões
  distintas — observável pelos logs de query ou por relato direto.
- **Breakeven de tempo (qualitativa):** Tarefa de "listar os 50 contatos mais engajados"
  cai de ~15 minutos (export + ordenação manual em planilha) para menos de 1 minuto
  dentro do sistema.

---

## Riscos identificados

**Valor:** Risco baixo. Cliente listou os critérios explicitamente e confia nos pesos.
O único risco de valor é os pesos não refletirem a intuição do assessor — mitigado pelo
breakdown visual que torna os critérios transparentes e permite ajuste via migration se
necessário.

**Usabilidade:** Risco médio. Remover os botões manuais pode surpreender usuários que
confiavam neles para override subjetivo. Mitigação: breakdown no popover mostra
claramente que o ranking é calculado, e o campo `observacoes` existe para notas
subjetivas. Se cliente pedir override manual no futuro, é extensão de v2.

**Feasibility — performance em massa:** Risco médio. UPDATE em massa de 8.000+ registros
em uma migration pode causar lock table ou timeout no Supabase. Mitigação obrigatória:
fazer o UPDATE em lotes de 500 registros com `pg_sleep(0.1)` entre lotes, ou usar
`UPDATE contacts SET ranking = calc_ranking(id) WHERE id IN (SELECT id FROM contacts
ORDER BY id LIMIT 500 OFFSET $n)` em loop no SQL da migration. Fullstack deve testar
com EXPLAIN ANALYZE antes de rodar em prod.

**Feasibility — trigger em `contact_campaign_values`:** Risco baixo-médio. O trigger
precisa buscar todos os campos de campanha do contato para calcular a categoria E.
Se o tenant tiver muitos campos customizáveis, a query interna do trigger pode ser
lenta. Mitigação: usar `COUNT` ao invés de SELECT de todos os valores; a lógica de
distribuição proporcional só precisa saber quantos campos existem e quantos estão
ativos para o contato.

**Feasibility — import CSV:** Risco baixo. Remover o mapeamento de `ranking` do import
quebra CSVs antigos que tinham a coluna. Mitigação: atualizar o template de download
e exibir aviso no passo de mapeamento quando o usuário tentar mapear uma coluna
chamada "ranking" ("Esta coluna será ignorada — o ranking agora é calculado
automaticamente").

**Business:** Risco baixo. Nenhum conflito com outros módulos. O campo `ranking` na
tabela continua existindo com mesmo nome e tipo — zero breaking change em filtros,
chips e export.

---

## Edge cases conhecidos

- **Contato sem nenhum dado além do nome:** ranking = 0, popover mostra todos os
  campos como "disponíveis para pontuar"
- **Trigger em loop:** UPDATE dentro do trigger que atualiza `contacts.ranking` não
  deve disparar o próprio trigger novamente — usar `IF NEW.ranking IS DISTINCT FROM
  calculated_value THEN` antes de fazer o UPDATE para evitar recursão
- **Campos de campanha excluídos:** ao deletar um `campaign_field`, as linhas em
  `contact_campaign_values` associadas devem ser deletadas em cascata (verificar FK
  existente) — o trigger em `contact_campaign_values` recalcula automaticamente
- **Merge de duplicatas:** após o merge, `useDuplicates.ts` grava `MAX(ranking)` dos
  registros originais; o trigger então recalcula e pode reduzir o valor se o MAX
  manual era inflado. Comportamento esperado e correto — documentar no PR
- **Contato com ranking_manual_legado alto:** coluna de backup; não tem efeito no
  cálculo. É apenas auditoria
- **Tenant com zero campos de campanha:** categoria E contribui 0 pontos;
  `FLOOR(5 / 0)` — divisão por zero no trigger. Fullstack deve usar
  `CASE WHEN total_campos = 0 THEN 0 ELSE FLOOR(5 / total_campos) END`
- **Concorrência:** dois updates simultâneos no mesmo contato (raro mas possível em
  import + edição manual paralela) — PostgreSQL garante serialização por linha; o
  último trigger a rodar ganha. Aceitável.

---

## Não-objetivos (out of scope)

- Interface admin para configurar pesos por campo — v2
- Ranking por segmento geográfico (top da cidade X) — v2
- Histórico/timeline de evolução do ranking por contato — v2
- Campos de campanha com peso individual (hoje todos valem o mesmo dentro da categoria E) — v2
- Notificação ao assessor quando ranking de um contato muda — v2
- Ranking comparativo entre contatos do mesmo articulador — v2
- Qualquer alteração no módulo de Demandas, Funis ou Mapa
- Refactor visual da aba Campanha além da remoção dos botões e adição do badge/popover

---

## Perguntas em aberto

Nenhuma decisão crítica pendente. Todas as ambiguidades foram resolvidas nas DPs acima
com recomendação explícita. Backlog pode quebrar em tasks atômicas.

---

## Definition of Ready — atendida?

- [x] Persona específica identificada (assessora/coordenadora de mobilização)
- [x] Job-to-be-done articulado
- [x] Critérios de aceite testáveis (sem "rápido"/"intuitivo" — todos observáveis ou mensuráveis)
- [x] Pelo menos uma métrica quantitativa (cobertura, consistência, performance do trigger)
- [x] Não-objetivos listados (reduz scope creep na v1)
- [x] Hipótese de solução em alto nível (sem código — trigger SQL é arquitetura, não implementação)
- [x] 6 decisões de produto resolvidas com recomendação e prós/contras
- [x] Tabela de pesos completa com justificativa por categoria
- [x] MVP delimitado (v1 vs v2 explícitos)
- [x] Riscos de feasibility identificados (lote na migration, divisão por zero, trigger loop)
- [x] CRUD de campos de campanha mencionado (regra Rodrigo — já existente, continua funcionando)

**DoR: ATENDIDA. Backlog pode quebrar em tasks atomizadas.**
