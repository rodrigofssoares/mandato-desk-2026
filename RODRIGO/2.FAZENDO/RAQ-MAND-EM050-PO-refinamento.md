# Relatórios Analíticos de Funis

**Cliente:** Raquel Auxiliadora — Mandato Desk 2026
**Código QG:** RAQ-MAND-EM050
**Prioridade:** alta
**Escrito por:** Agente PO em 2026-05-11

---

## Contexto e problema

O gabinete usa os funis (boards) como instrumento central de mobilização política: cada
contato avança por estágios que representam etapas de engajamento — da abordagem inicial
até o voto declarado ou kit entregue. Hoje o sistema oferece apenas a visão Kanban
(quem está onde) e um widget de funil no Dashboard (contagem bruta por estágio, sem
conversão percentual entre etapas).

O problema: a coordenadora de mobilização não consegue responder perguntas estratégicas
como "de 100 contatos abordados, quantos chegaram à etapa de voto declarado?" ou "qual
é o gargalo de conversão — entre a etapa 1 e 2 ou entre 3 e 4?" sem exportar para Excel
e montar a análise manualmente, o que leva 20 a 40 minutos por ciclo de análise. Sem
essa visão, decisões de campo (reforçar qual etapa, liberar mais articuladores para qual
gargalo) são feitas por percepção, não por dado.

Adicionalmente, não existe forma de exportar esse panorama — nem PDF para apresentação
em reunião de gabinete, nem Excel para análise histórica off-line.

---

## Job-to-be-done

Quando preciso avaliar a eficácia da operação de campo antes de uma reunião de estratégia
ou de um disparo de WhatsApp, quero ver instantaneamente o funil com percentuais de
conversão entre etapas, para que eu possa identificar gargalos, tomar decisões de
reforço de campo e comunicar resultados ao mandatário sem precisar sair do sistema.

---

## Hipótese de solução (alto nível)

Criar a página `/relatorios` (item novo na sidebar, secao `relatorios` já existe no RBAC)
com um único painel de análise de funis. A página exibe: (1) seletor de funil + seletor
de estágios a incluir na análise; (2) visualização em funil com contagem absoluta por
estágio e percentual de conversão em relação ao estágio anterior e em relação ao topo;
(3) toggle de tipo de gráfico (funil/barra-horizontal/barra-vertical/pizza) reaproveitando
o padrão já existente em `BoardFunnelCard`; (4) botão "Exportar" com opções Excel
(dados tabulares) e PDF (imagem do gráfico + tabela de métricas). Não há filtros de
contato nesta v1 — a granularidade é por estágio do funil. Atualização é on-demand
(botão "Atualizar"), não em tempo real.

---

## Decisões de produto resolvidas neste refinamento

### DP1 — Onde mora a feature?

**Decisão: nova rota `/relatorios` com item próprio na sidebar.**

A seção `relatorios` já está declarada em `SECOES`, `SECAO_LABELS` e `usePermissions`
(`can.exportData()`), mas não há página nem item de nav associado — é o slot perfeito.
Uma página dedicada evita poluir o Board (que é ferramenta operacional) com funcionalidade
analítica, e é mais fápida de encontrar por usuários com permissão `viewOnly` em
relatórios (assessores têm esse acesso por padrão).

### DP2 — "Filtros do board" — quais entram nesta v1?

**Decisão: seletor de funil + seletor de estágios a incluir. Nada além disso.**

O Board atual não possui filtros de contato (tag, responsável, data). Adicionar esses
filtros à página de relatórios antes de existirem no Board criaria inconsistência de UX.
Para v1: selecionar qual funil analisar e quais estágios incluir (multi-select com checkboxes,
todos marcados por padrão). Filtros por tag/responsável/data ficam para v2.

### DP3 — Percentual de conversão: relativo ao estágio anterior ou ao topo do funil?

**Decisão: exibir ambos.**

- `% vs. anterior`: conversão entre estágios consecutivos (ex: "Etapa 2 → Etapa 3: 64%")
- `% vs. topo`: conversão acumulada desde o primeiro estágio (ex: "38% dos abordados chegaram à Etapa 3")
Exibir só um gera perguntas do gestor. Exibir ambos resolve de uma vez.

### DP4 — "PDF como imagem com gráfico" vs. PDF formal com tabela?

**Decisão: PDF híbrido via jsPDF (já instalado).**

Cabeçalho com nome do funil + data geração. Tabela de métricas (jspdf-autotable, já
instalado). Gráfico como imagem PNG capturada via `canvas.toDataURL()` do recharts
(recharts usa SVG, converter via `html2canvas` não é necessário — recharts expõe
`ref` para o container SVG que pode ser serializado). Se a captura de SVG revelar
complexidade no Fullstack, fallback: omitir gráfico do PDF e incluir apenas tabela +
nota "Ver gráfico no sistema". Essa decisão técnica é delegada ao Fullstack.

### DP5 — "Kits entregues" e "Contatos realizados" — campos reais ou exemplos?

**Decisão: são exemplos de nomes de estágio, não campos do banco.**

O funil do gabinete é configurável — os estágios têm os nomes que a operadora definiu.
"Kits entregues" e "Contatos realizados" são exemplos de nomes de estágio que a equipe
pode ter criado. A feature não precisa tratar esses como campos especiais.

### DP6 — "Comparativo entrada/saída de leads" — inclui v1?

**Decisão: fora do escopo v1.**

Requer rastreamento de `moved_at` histórico por estágio — análise temporal que precisa
de um hook novo não trivial. Fica como v2 ("Evolução do funil ao longo do tempo").

### DP7 — Salvar configuração do relatório?

**Decisão: NÃO em v1. Sessão efêmera.**

A seleção de funil/estágios/tipo-de-gráfico é mantida apenas durante a sessão via
`useState`. Persistência (salvar relatório com nome) é v2.

---

## User stories

**US01 — Análise de conversão do funil**
Como coordenadora de mobilização revisando a operação de campo, quero ver na página de
Relatórios a contagem de contatos por estágio do funil selecionado com percentual de
conversão em relação ao estágio anterior e em relação ao topo, para identificar em qual
etapa estamos perdendo mais contatos sem precisar montar a análise manualmente.

**US02 — Seleção de estágios a incluir na análise**
Como coordenadora filtrando a visão do funil, quero selecionar quais estágios entram na
análise (incluir/excluir estágios intermediários ou finais), para gerar um funil parcial
relevante para uma ação específica sem precisar alterar a configuração real do funil.

**US03 — Alternância entre tipos de visualização**
Como coordenadora interpretando os dados, quero alternar entre funil, barra horizontal,
barra vertical e pizza no mesmo conjunto de dados filtrados, para escolher a visualização
mais adequada ao contexto (apresentação vs. análise própria).

**US04 — Exportação dos dados**
Como coordenadora preparando uma reunião de estratégia, quero exportar o relatório em
Excel (dados tabulares) e em PDF (tabela de métricas + gráfico), para apresentar os
resultados ao mandatário em reunião ou arquivar o histórico de uma ação de campo.

**US05 — Acesso controlado por permissão RBAC**
Como proprietário configurando acessos, quero que a página de Relatórios fique visível
apenas para usuários com permissão `relatorios` ativada, para que assessores de campo
que não precisam de visão analítica não vejam a funcionalidade.

---

## Critérios de aceite

### US01 — Análise de conversão

- [ ] Dado que existem estágios com contatos no funil selecionado, quando a página
  carrega, então cada estágio exibe: nome, contagem absoluta, `% vs. anterior`
  (exceto o primeiro estágio, que exibe "—") e `% vs. topo`
- [ ] Dado que o primeiro estágio tem 100 contatos e o segundo tem 60, quando o
  usuário visualiza o relatório, então o segundo estágio exibe "60% vs. anterior" e
  "60% vs. topo"
- [ ] Dado que um estágio tem 0 contatos, quando o usuário visualiza o relatório,
  então a conversão para esse estágio exibe "0%" (não divide por zero — não causa erro)
- [ ] Dado que o funil selecionado está vazio, quando a página carrega, então é exibida
  mensagem "Funil sem contatos — adicione contatos no Board para visualizar o relatório"

### US02 — Seleção de estágios

- [ ] Dado que um funil tem 5 estágios, quando a página carrega, então todos os 5
  estágios estão marcados por padrão no seletor multi-select
- [ ] Dado que o usuário desmarca o estágio 3, quando visualiza o relatório, então os
  estágios 1, 2, 4 e 5 aparecem no gráfico e a conversão é recalculada considerando
  apenas os estágios marcados
- [ ] Dado que o usuário desmarca todos os estágios, quando tenta visualizar, então o
  gráfico exibe estado vazio com mensagem "Selecione pelo menos um estágio"
- [ ] Dado que o usuário troca de funil, quando a seleção muda, então os estágios do
  novo funil são carregados com todos marcados por padrão (reset da seleção anterior)

### US03 — Alternância de visualização

- [ ] Dado que o relatório está carregado, quando o usuário clica no toggle de tipo de
  gráfico, então a visualização muda para o tipo selecionado (funil/barra-h/barra-v/pizza)
  sem recarregar os dados
- [ ] Dado que o tipo selecionado é "funil", quando o usuário visualiza, então as barras
  têm largura decrescente da esquerda para a direita (ou de cima para baixo), refletindo
  a redução do volume entre etapas — diferente da barra horizontal padrão que tem largura
  uniforme

### US04 — Exportação

- [ ] Dado que o relatório está carregado, quando o usuário clica em "Exportar Excel",
  então um arquivo `.xlsx` é baixado com colunas: Estágio, Contatos, % vs. Anterior,
  % vs. Topo; o nome do arquivo inclui o nome do funil e a data (ex:
  `relatorio-funil-mobilizacao-2026-05-11.xlsx`)
- [ ] Dado que o relatório está carregado, quando o usuário clica em "Exportar PDF",
  então um arquivo `.pdf` é gerado com cabeçalho (nome do funil, data), tabela de
  métricas e, se tecnicamente viável, imagem do gráfico; o nome do arquivo segue o
  mesmo padrão do xlsx
- [ ] Dado que o usuário clica em "Imprimir", quando o diálogo de impressão do
  navegador abre, então apenas o gráfico e a tabela de métricas são impressos (sem
  sidebar, header nem controles da página) via CSS `@media print`
- [ ] Dado que a exportação Excel está em andamento, quando o download inicia, então
  um toast de sucesso é exibido; se ocorrer erro, um toast de erro é exibido com
  mensagem descritiva

### US05 — RBAC

- [ ] Dado que um usuário tem perfil assessor (permissão `relatorios = viewOnly`),
  quando acessa `/relatorios`, então a página é exibida com os dados mas sem o botão
  de exportação (exportação requer `can.exportData()` = `canView('relatorios')`) —
  **NOTA:** verificar se a intenção do cliente é bloquear exportação para assessores ou
  apenas visualização; por padrão, exportData = canView, portanto assessores com viewOnly
  podem exportar. Manter esse comportamento a menos que decisão explícita contrária
- [ ] Dado que um usuário não tem permissão `relatorios`, quando tenta acessar
  `/relatorios` diretamente pela URL, então vê mensagem de acesso negado (mesmo padrão
  dos outros guards de permissão no sistema)
- [ ] O item "Relatórios" na sidebar aparece apenas para usuários com `can.exportData()`
  retornando `true`

### CRUD — regra Rodrigo

- [ ] A feature em v1 é somente leitura/exportação — não há entidades criadas pelo
  usuário que precisem de edição/exclusão. A configuração de quais estágios incluir é
  efêmera (sessão). Regra CRUD não se aplica a esta feature.

---

## Edge cases conhecidos

- **Funil sem estágios:** exibir estado vazio "Este funil não tem estágios configurados —
  acesse Configurações → Funis para adicionar estágios"
- **Funil com 1 único estágio:** funil com uma única linha; `% vs. anterior` = "—" e
  `% vs. topo` = "100%" (trivialmente)
- **Divisão por zero:** primeiro estágio tem 0 contatos e há estágios seguintes com
  contagem positiva — percentuais dos estágios seguintes exibem "N/A" (não divide por zero)
- **Nenhum funil cadastrado:** exibir CTA "Nenhum funil criado — crie seu primeiro funil
  em Configurações → Funis"
- **Exportação com estágio desmarcado:** o Excel/PDF exporta apenas os estágios marcados
  no seletor, não todos os estágios do funil
- **PDF com gráfico inviável:** se a captura SVG/canvas falhar, PDF é gerado apenas com
  tabela e exibe nota "Gráfico disponível apenas no sistema"
- **Nome do funil com caracteres especiais:** o nome do arquivo de exportação deve ser
  sanitizado (remover `/`, `\`, `?`, `*`, etc.) para não quebrar o download em Windows

---

## Não-objetivos (out of scope v1)

- Filtros por tag, responsável, articulador ou data dentro da página de Relatórios
- "Evolução do funil ao longo do tempo" (requer histórico de `moved_at` — v2)
- "Comparativo entre dois funis" (v2)
- Salvar configurações de relatório com nome (v2)
- Relatório de Tarefas, Demandas ou Articuladores — apenas funis nesta task
- Gráfico de funil com "largura escalonada real" (estilo mapa de Sankey) — barra
  decrescente simples é suficiente para v1
- Dashboard personalizável com widgets de relatório (já existe em `useDashboardLayout` —
  não tocar)
- Integração com WhatsApp ou qualquer outro módulo

---

## Métricas de sucesso

- **Adoção (qualitativa):** Rodrigo ou a coordenadora usa a página de Relatórios pelo
  menos 3 vezes na primeira semana após entrega, em sessões distintas — verificável via
  observação direta ou relato
- **Tempo de análise (quantitativa):** tempo para responder "qual é a taxa de conversão
  do estágio 1 ao estágio 3?" cai de ~25 minutos (export manual + Excel) para menos de
  2 minutos dentro do sistema — medível com cronômetro em teste de usabilidade informal
- **Exportação funcional (quantitativa):** arquivo Excel gerado tem todas as colunas
  corretas em 100% das tentativas (sem erros de encoding ou valores NaN) — validável
  pelo QA abrindo o arquivo em Excel/LibreOffice após exportação
- **Performance de carregamento (quantitativa):** dados do relatório para um funil com
  até 500 itens carregam em menos de 3 segundos em rede padrão — medível com DevTools
  Network tab

---

## Riscos identificados

- **Valor:** Baixo. A necessidade foi articulada explicitamente com exemplos concretos
  (conversão entre etapas, gargalos de campo). A única incerteza é se o usuário adotará
  a página ou continuará exportando para Excel por hábito — mitigado pela visibilidade
  do item na sidebar e pela exportação nativa (remove a necessidade do workflow antigo).

- **Usabilidade:** Médio. O conceito de "% vs. anterior" e "% vs. topo" pode confundir
  usuários não familiarizados com análise de funil. Mitigação: tooltip explicando cada
  percentual no cabeçalho da coluna (ex: "Percentual de contatos desta etapa em relação
  à etapa anterior").

- **Feasibility — captura do gráfico para PDF:** Médio. recharts renderiza em SVG;
  converter SVG para imagem PNG embutível em jsPDF pode exigir `canvg` ou serialização
  manual. Fullstack deve avaliar e usar o fallback (só tabela) se a captura for
  problemática — o critério de aceite já prevê esse fallback.

- **Feasibility — tipo "funil" em recharts:** Baixo-médio. recharts não tem componente
  `FunnelChart` na v2 (apenas em versões recentes). Verificar se a versão instalada
  (`^2.15.4`) inclui `FunnelChart` — se não, implementar como `BarChart` layout horizontal
  com barras de larguras proporcionais via `Cell` customizado. Fullstack decide na
  implementação.

- **Business:** Baixo. Não conflita com nenhum outro módulo. A seção `relatorios` no
  RBAC já existe e está configurada corretamente para proprietário (fullAccess) e
  assessor (viewOnly).

---

## Perguntas em aberto

1. **Tipo "funil" com largura escalonada:** recharts 2.15.x tem `FunnelChart` nativo.
   Se sim, usar. Se não, o fallback de barra horizontal com larguras decrescentes via
   `Cell` é aceitável para v1? **Default sugerido: sim, fallback é aceitável.**

2. **Assessores podem exportar ou só visualizar?** Hoje `can.exportData()` =
   `canView('relatorios')`, portanto assessores com viewOnly já podem exportar.
   Manter esse comportamento ou restringir exportação a proprietário/admin?
   **Default sugerido: manter comportamento atual — assessores podem visualizar e exportar.**

3. **Item "Relatórios" na sidebar — posição?** Atualmente a sidebar não tem item para
   essa seção. Sugestão: posicionar após "Funil" (board), antes de "Tarefas".
   **Default sugerido: após "Funil", com ícone `BarChart2` (lucide-react).**

---

## MVP (escopo mínimo — v1)

**Entra na v1:**
- Nova rota `/relatorios` com `src/pages/Relatorios.tsx`
- Item "Relatórios" na sidebar com ícone `BarChart2`, secao `relatorios`
- Seletor de funil (todos os boards tipo `contact`)
- Seletor de estágios multi-select (checkboxes, todos marcados por padrão)
- Tabela de métricas: Estágio / Contatos / % vs. Anterior / % vs. Topo
- Toggle de tipo de gráfico: funil / barra horizontal / barra vertical / pizza
  (reaproveitando lógica de `ChartViewToggle` e `BoardFunnelCard`)
- Botão "Exportar Excel" via `xlsx` (já instalado)
- Botão "Exportar PDF" via `jsPDF` + `jspdf-autotable` (já instalados)
- Botão "Imprimir" com CSS `@media print`
- Guard de permissão: redireciona se `!can.exportData()`

**Fica para v2 (P2):**
- Filtros por tag, responsável, data
- Evolução temporal do funil (série histórica)
- Comparativo entre dois funis
- Salvar configurações de relatório
- Relatórios de Tarefas, Demandas, Articuladores

---

## Definition of Ready — atendida?

- [x] Persona específica identificada (coordenadora de mobilização / proprietário do gabinete)
- [x] Job-to-be-done articulado
- [x] 5 user stories no formato Connextra
- [x] Critérios de aceite testáveis (sem "rápido"/"intuitivo" — todos observáveis via QA)
- [x] Pelo menos uma métrica quantitativa (tempo de análise <2min, carregamento <3s)
- [x] Não-objetivos listados (reduz scope creep)
- [x] Hipótese de solução em alto nível (sem código)
- [x] 7 decisões de produto resolvidas com padrão explícito
- [x] Edge cases mapeados (divisão por zero, funil vazio, PDF fallback)
- [x] Riscos de feasibility identificados (recharts FunnelChart, captura SVG/PDF)
- [x] RBAC mapeado (seção relatorios já existe no sistema de permissões)
- [x] Dependências técnicas confirmadas (xlsx, jsPDF, jspdf-autotable já instalados)
- [x] CRUD não se aplica (feature somente leitura/exportação — justificado)

**DoR: ATENDIDA. Backlog pode quebrar em tasks atomizadas.**
