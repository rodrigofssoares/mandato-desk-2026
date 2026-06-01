# Backlog — RAQ-MAND-EM050

**Cliente:** Raquel Auxiliadora — Mandato Desk 2026
**Código QG:** RAQ-MAND-EM050
**Briefing:** RODRIGO/2.FAZENDO/RAQ-MAND-EM050-PO-refinamento.md
**Backlog escrito por:** Agente Backlog em 2026-05-11

---

## Walking skeleton (entrega valor end-to-end)

- **T1** — Rota + página + sidebar + guard RBAC (esqueleto navegável)
- **T2** — Hook `useFunnelReport` com cálculo de conversão (dado bruto disponível)

Juntos, T1+T2 provam o valor central: coordenadora acessa `/relatorios`, seleciona um funil e vê os percentuais calculados — sem gráfico final, mas o dado está lá.

---

## Ordem de execução (WSJF + dependências)

1. **T1** — Rota `/relatorios`, página esqueleto, item sidebar, guard RBAC `[walking skeleton — fundação]`
2. **T2** — Hook `useFunnelReport(boardId, selectedStageIds)` com cálculo de conversão `[walking skeleton — dado]`
3. **T3** — Componente seletor de funil + multi-select de estágios (UI de controle)
4. **T4** — Componente tabela de métricas (Estágio / Contatos / % vs. Anterior / % vs. Topo)
5. **T5** — Componente gráfico com toggle de visualização (funil/barra-h/barra-v/pizza)
6. **T6** — Exportação Excel via `xlsx`
7. **T7** — Exportação PDF via jsPDF + jspdf-autotable (+ tentativa de captura SVG)
8. **T8** — Impressão via CSS `@media print`
9. **T9** — Edge cases + polish (divisão por zero, funil vazio, sem estágios, `useNavOrder`)

---

## Tasks

### T1 — Criar rota `/relatorios`, página esqueleto e item na sidebar com guard RBAC

**User stories cobertas:** US05
**Estimativa:** S (2pt)
**Sub-agente principal:** component-writer + route-writer
**Arquivos:**
- `src/App.tsx` — adicionar `<Route path="/relatorios" ...>`
- `src/pages/Relatorios.tsx` — criar (novo)
- `src/components/layout/AppSidebar.tsx` — adicionar item `{ label: 'Relatórios', icon: BarChart2, href: '/relatorios', secao: 'relatorios' }`
- `src/hooks/useNavOrder.ts` — adicionar `'relatorios'` em `NAV_ITEM_KEYS`, `DEFAULT_NAV_ORDER` e `NAV_ITEM_LABELS`
**Dependências:** nenhuma

**Critérios de aceite (subset US05):**
- [ ] Rota `/relatorios` registrada em `App.tsx` dentro de `<ProtectedRoute>`
- [ ] Página `Relatorios.tsx` renderiza sem erros (pode ser título + spinner/placeholder)
- [ ] Item "Relatórios" aparece na sidebar com ícone `BarChart2` (lucide-react), após "Funil" na ordem default (position após `'board'` em `DEFAULT_NAV_ORDER`)
- [ ] Item só aparece para usuários com `can.exportData()` retornando `true` (mapeado em `SECAO_TO_PERMISSION['relatorios']` que já existe no `AppSidebar`)
- [ ] Usuário sem permissão `relatorios` que acessa `/relatorios` diretamente recebe redirect ou mensagem de acesso negado — usar o mesmo padrão de outras páginas (verificar se há `PermissionGuard` ou se é inline `if (!can.exportData()) return <AccessDenied />`; adotar padrão vigente no projeto)
- [ ] `useNavOrder` reconhece a chave `'relatorios'` sem quebrar ordenação salva em localStorage

**Notas técnicas:**
- `relatorios` já está em `SECOES`, `SECAO_LABELS` e `SECAO_TO_PERMISSION` — não criar nada novo nessas estruturas, apenas verificar que estão corretas (leitura confirmou que sim)
- `can.exportData()` = `canView('relatorios')` (linha 44 de `usePermissions.tsx`)
- Assessor tem `viewOnly: ['relatorios']` por padrão — aparece na sidebar e acessa a página
- `useNavOrder` tem comentário explícito ("ao adicionar item em NAV_ITEMS, adicione também aqui") — T1 deve atualizar `NAV_ITEM_KEYS`, `DEFAULT_NAV_ORDER` e `NAV_ITEM_LABELS` nesse hook
- WhatsApp usa `dividerBefore: true` — não colocar divider em Relatórios (ficará após Funil na ordem natural)

---

### T2 — Criar hook `useFunnelReport` com cálculo de contagem e conversão

**User stories cobertas:** US01, US02 (lógica de cálculo)
**Estimativa:** M (5pt)
**Sub-agente principal:** hook-writer
**Arquivos:**
- `src/hooks/useFunnelReport.ts` — criar (novo)
**Dependências:** T1 (página existe para consumir o hook)

**Critérios de aceite (subset US01, US02):**
- [ ] Hook exporta `useFunnelReport(boardId: string | null, selectedStageIds: string[])` retornando `{ data: FunnelReportStage[], isLoading, error }`
- [ ] `FunnelReportStage` tem campos: `stage_id`, `nome`, `cor`, `count`, `pctVsAnterior: number | null`, `pctVsTopo: number | null`
- [ ] `pctVsAnterior` do primeiro estágio selecionado é `null` (renderizar como "—")
- [ ] `pctVsTopo` = `(count / topoCount) * 100`; quando `topoCount === 0`, retorna `null` para todos os estágios (edge case: divisão por zero)
- [ ] `pctVsAnterior` = `(count / countAnterior) * 100`; quando `countAnterior === 0`, retorna `null` (não `NaN`, não erro)
- [ ] Quando `selectedStageIds` muda, `data` retorna apenas os estágios selecionados na ordem original do board, conversão recalculada sobre o subconjunto
- [ ] Quando `boardId` é `null`, retorna `data: []`
- [ ] Fonte de dados: reusar o padrão de `useDashboardMetrics` — queries a `board_stages` (ordem por `ordem asc`) + `board_items` (contagem por `stage_id`) via Supabase; **NÃO** criar Edge Function — client-side é suficiente
- [ ] `queryKey`: `['funnel-report', boardId, selectedStageIds]` — invalidação automática quando board muda
- [ ] Hook integra com `useBoards('contact')` e `useBoardStages(boardId)` indiretamente (a página passa os dados) OU o hook os busca internamente — decisão do Fullstack, mas a página deve funcionar com seleção reativa

**Notas técnicas:**
- `FunilStage` em `useDashboardMetrics.ts` tem `{ stage_id, nome, cor, count }` — estender com os campos de conversão ou criar tipo novo em `useFunnelReport.ts`
- Padrão de contagem: `board_stages` filtrado por `board_id` + `board_items` filtrado por `board_id` para contar por `stage_id` — idêntico ao bloco "funil" de `useDashboardMetrics` (linhas 218-238)
- `selectedStageIds` como dep do `queryKey` garante reatividade quando checkbox muda

---

### T3 — Criar componente seletor de funil + multi-select de estágios

**User stories cobertas:** US02
**Estimativa:** M (5pt)
**Sub-agente principal:** component-writer
**Arquivos:**
- `src/components/relatorios/FunnelSelector.tsx` — criar (novo); pasta `src/components/relatorios/` (nova)
**Dependências:** T1 (página), T2 (hook para saber quais estágios existem)

**Critérios de aceite (subset US02):**
- [ ] Dropdown/Select de funil lista todos os boards do tipo `contact` via `useBoards('contact')`; usa componente `Select` do shadcn/ui (padrão do projeto)
- [ ] Quando nenhum funil existe, exibe CTA "Nenhum funil criado — crie em Configurações → Funis"
- [ ] Multi-select de estágios: lista os estágios do funil selecionado via `useBoardStages(boardId)` como checkboxes; todos marcados por padrão ao carregar/trocar funil
- [ ] Quando funil muda (Select), estágios são resetados (todos marcados do novo funil)
- [ ] Quando todos os estágios são desmarcados, o componente exibe mensagem inline "Selecione pelo menos um estágio" e não chama `useFunnelReport` com array vazio (ou o hook retorna `[]` graciosamente)
- [ ] Funil sem estágios exibe: "Este funil não tem estágios configurados — acesse Configurações → Funis para adicionar estágios"
- [ ] Estado (`selectedBoardId`, `selectedStageIds`) é controlado por `useState` na página pai (`Relatorios.tsx`) e passado como props — sem persistência

**Notas técnicas:**
- Reusar `Select`/`SelectItem` do shadcn/ui (mesma UI usada em `BoardFunnelCard`)
- Checkboxes de estágio: `Checkbox` do shadcn/ui em lista scrollável com `ScrollArea` se necessário
- `useBoards` está em `src/hooks/useBoards.ts` — retorna `Board[]` com `tipo_entidade`
- `useBoardStages` em `src/hooks/useBoardStages.ts` — retorna `BoardStage[]` por `boardId`

---

### T4 — Criar componente tabela de métricas

**User stories cobertas:** US01
**Estimativa:** S (2pt)
**Sub-agente principal:** component-writer
**Arquivos:**
- `src/components/relatorios/FunnelMetricsTable.tsx` — criar (novo)
**Dependências:** T2 (tipo `FunnelReportStage`), T3 (seleção determina quais linhas mostrar)

**Critérios de aceite (subset US01):**
- [ ] Tabela renderiza colunas: **Estágio** | **Contatos** | **% vs. Anterior** | **% vs. Topo**
- [ ] Cabeçalho de "% vs. Anterior" e "% vs. Topo" tem ícone de tooltip com texto explicativo (ex: `Tooltip` shadcn/ui; texto: "Percentual de contatos desta etapa em relação à etapa anterior" e "Percentual acumulado desde o primeiro estágio selecionado")
- [ ] Primeiro estágio: coluna "% vs. Anterior" exibe "—" (não número)
- [ ] Quando `count === 0` em qualquer estágio e `countAnterior === 0`, exibe "N/A" nas células de percentual (não divide por zero)
- [ ] Quando `pctVsAnterior` ou `pctVsTopo` é `null`, exibe "—" ou "N/A" conforme semântica
- [ ] Tabela usa componente `Table`/`TableRow`/`TableCell` do shadcn/ui
- [ ] Estado de loading exibe skeleton (`Skeleton` do shadcn/ui) nas linhas
- [ ] Estado vazio (array vazio) exibe mensagem "Funil sem contatos — adicione contatos no Board para visualizar o relatório"

**Notas técnicas:**
- Componente recebe `stages: FunnelReportStage[]` e `isLoading: boolean` como props
- `Tooltip` do shadcn/ui está disponível via `@radix-ui/react-tooltip` (já usa em outros componentes)
- Para exibir cor do estágio: pequeno dot colorido com `s.cor ?? 'hsl(var(--primary))'` antes do nome (padrão visual do `BoardFunnelCard`)

---

### T5 — Criar componente gráfico com toggle de tipo de visualização

**User stories cobertas:** US03
**Estimativa:** M (5pt)
**Sub-agente principal:** component-writer
**Arquivos:**
- `src/components/relatorios/FunnelChart.tsx` — criar (novo)
- `src/lib/dashboardLayout.ts` — avaliar se precisa estender `CHART_VIEW_TYPES` para incluir `'funnel'`; se sim, adicionar lá
**Dependências:** T2 (dados), T3 (seleção)

**Critérios de aceite (subset US03):**
- [ ] Toggle de tipo de gráfico oferece 4 opções: funil / barra-horizontal / barra-vertical / pizza
- [ ] Componente `ChartViewToggle` existente (`src/components/dashboard/ChartViewToggle.tsx`) é reutilizado ou estendido; se estendido, `CHART_VIEW_TYPES` recebe `'funnel'` como quarta opção E `CHART_VIEW_LABELS` recebe label "Funil"; se não for estendido (toggle inline novo), documentar razão
- [ ] Visualização "funil": recharts `^2.15.4` — verificar se `FunnelChart` existe no bundle instalado; se sim, usar; se não, implementar como `BarChart` layout horizontal com barras de largura decrescente via `Cell` customizado (larguras proporcionais ao `count`)
- [ ] Visualização "barra-horizontal": reusar exatamente o padrão do `BoardFunnelCard` (layout vertical do `BarChart` com `dataKey="nome"`)
- [ ] Visualização "barra-vertical": reusar exatamente o padrão do `BoardFunnelCard` (`BarChart` normal com `XAxis dataKey="nome"`)
- [ ] Visualização "pizza": reusar exatamente o padrão do `BoardFunnelCard` (`PieChart` com `innerRadius/outerRadius` e `Legend`)
- [ ] Troca de visualização não recarrega dados — apenas re-renderiza o gráfico
- [ ] Estado de loading exibe `Skeleton` (min-height 240px, padrão `BoardFunnelCard`)
- [ ] Estado vazio (sem estágios / sem dados) exibe mensagem dentro do `ResponsiveContainer`

**Notas técnicas:**
- `TOOLTIP_STYLE` do `BoardFunnelCard` deve ser replicado ou extraído para `src/lib/chartTheme.ts` — Fullstack decide
- Estender `CHART_VIEW_TYPES` em `dashboardLayout.ts` requer atualizar `CHART_VIEW_LABELS`, `ICONS` em `ChartViewToggle`, e verificar se widgets do dashboard não quebram (eles usam `CHART_VIEW_TYPES` para validar `chartType` salvo — `'funnel'` seria nova opção que widgets existentes não usam, mas não deveria quebrar)
- Alternativa mais segura: criar `REPORT_CHART_VIEW_TYPES` específico para relatórios, evitando tocar na configuração do dashboard — Fullstack decide conforme custo de mudança
- Cor de cada barra: `s.cor ?? 'hsl(var(--primary))'` (mesmo padrão `tinted` do `BoardFunnelCard`)

---

### T6 — Exportação Excel via xlsx

**User stories cobertas:** US04 (Excel)
**Estimativa:** S (2pt)
**Sub-agente principal:** component-writer (botão) + action-writer (lógica de exportação)
**Arquivos:**
- `src/lib/exportRelatorio.ts` — criar (novo); função `exportFunnelToXlsx(stages, boardNome)`
- `src/components/relatorios/ExportMenu.tsx` — criar (novo); dropdown "Exportar" com opções Excel/PDF/Imprimir
**Dependências:** T2 (dados), T4 (saber colunas)

**Critérios de aceite (subset US04 — Excel):**
- [ ] Função `exportFunnelToXlsx(stages: FunnelReportStage[], boardNome: string)` gera arquivo `.xlsx` com colunas: Estágio, Contatos, % vs. Anterior, % vs. Topo
- [ ] Arquivo exporta apenas os estágios passados (já filtrados pelos selecionados)
- [ ] Nome do arquivo: `relatorio-funil-<boardNome>-<YYYY-MM-DD>.xlsx` com `boardNome` sanitizado (remover `/`, `\`, `?`, `*`, `:`, `|`, `<`, `>`, `"` e espaços substituídos por `-`)
- [ ] Percentuais formatados como string com símbolo `%` (ex: "64%", não 0.64) e "—" quando `null`
- [ ] Toast `toast.success("Excel exportado com sucesso")` quando download inicia
- [ ] Toast `toast.error("Erro ao exportar Excel: <mensagem>")` em caso de exceção
- [ ] Botão de exportação Excel fica desabilitado (disabled) quando `stages` está vazio ou `isLoading` é `true`

**Notas técnicas:**
- `xlsx` já instalado no `package.json` — verificar import correto (`import * as XLSX from 'xlsx'`)
- Padrão de uso: `XLSX.utils.aoa_to_sheet`, `XLSX.utils.book_append_sheet`, `XLSX.writeFile` — idêntico ao padrão em `paraobra-dashboard/` (verificar se há pattern em `historico.md`)
- `ExportMenu` pode ser um `DropdownMenu` do shadcn/ui com `DropdownMenuTrigger` num `Button` com ícone `Download` (lucide-react)

---

### T7 — Exportação PDF via jsPDF + jspdf-autotable (+ tentativa de captura SVG)

**User stories cobertas:** US04 (PDF)
**Estimativa:** L (8pt)
**Sub-agente principal:** action-writer
**Arquivos:**
- `src/lib/exportRelatorio.ts` — adicionar função `exportFunnelToPdf(stages, boardNome, chartContainerRef?)`
**Dependências:** T2 (dados), T4 (colunas), T5 (ref do gráfico para captura SVG — opcional)

**Critérios de aceite (subset US04 — PDF):**
- [ ] Função `exportFunnelToPdf` gera arquivo `.pdf` com: cabeçalho (nome do funil + data de geração), tabela de métricas (jspdf-autotable) com as mesmas colunas do Excel
- [ ] Nome do arquivo segue mesmo padrão sanitizado do Excel (`.pdf`)
- [ ] Fullstack tenta capturar o gráfico como imagem PNG: `recharts` renderiza em SVG dentro do container — serializar o `<svg>` via `new XMLSerializer().serializeToString(svgEl)`, converter para Blob/DataURL via `new Image()` + `<canvas>`, então `canvas.toDataURL('image/png')`, embutir no PDF via `doc.addImage()`
- [ ] Se a captura SVG falhar (ou Fullstack avaliar como impraticável), omitir imagem e incluir nota: "Gráfico disponível apenas no sistema" — critério de aceite prevê fallback explícito
- [ ] Toast `toast.success("PDF exportado")` / `toast.error("Erro ao exportar PDF: ...")` nos respectivos casos
- [ ] Botão PDF fica desabilitado quando `stages` está vazio ou `isLoading` é `true`

**Notas técnicas:**
- `jsPDF` e `jspdf-autotable` já instalados — importar: `import jsPDF from 'jspdf'` + `import autoTable from 'jspdf-autotable'`
- A captura SVG pode exigir que `FunnelChart.tsx` exponha um `ref` via `forwardRef` ou que o container SVG tenha um `id` acessível — Fullstack decide
- L (8pt) justificado pela complexidade da captura SVG + tratamento de fallback + formatação do PDF; se a captura for descartada de início (só tabela), reclassificar para M (5pt)
- A lógica de exportação em `src/lib/exportRelatorio.ts` centraliza Excel e PDF — mesma abordagem de `DemandsExportMenu` e `ExportMenu` existentes (verificar padrão)

---

### T8 — Impressão via CSS `@media print`

**User stories cobertas:** US04 (Imprimir)
**Estimativa:** S (2pt)
**Sub-agente principal:** component-writer
**Arquivos:**
- `src/pages/Relatorios.tsx` — adicionar classes Tailwind `print:hidden` nos controles e sidebar
- `src/components/relatorios/FunnelMetricsTable.tsx` — verificar se precisa de ajuste de espaçamento para impressão
- (Opcional) `src/index.css` — adicionar regra `@media print` se Tailwind não cobrir todos os casos
**Dependências:** T4 (tabela a imprimir), T5 (gráfico a imprimir), T3 (seletor a esconder)

**Critérios de aceite (subset US04 — Impressão):**
- [ ] Botão "Imprimir" chama `window.print()` ao ser clicado
- [ ] Ao imprimir: sidebar (`AppSidebar`), header de página, seletor de funil/estágios, botões de exportação, toggle de tipo de gráfico e `SidebarTrigger` ficam escondidos (`print:hidden` em Tailwind v3 ou `@media print { display: none }`)
- [ ] Ao imprimir: tabela de métricas e gráfico permanecem visíveis e ocupam a largura da página
- [ ] Teste manual: `Ctrl+P` no navegador mostra apenas gráfico + tabela

**Notas técnicas:**
- `AppSidebar` e `AppLayout` envolvem todas as páginas — adicionar `print:hidden` no wrapper da sidebar em `AppLayout` ou via CSS global é suficiente (verificar se `AppLayout` já tem esse estilo; se não, adicionar `@media print { [data-sidebar] { display: none !important; } }` em `index.css`)
- Tailwind 3 suporta `print:hidden` nativamente — preferir classes Tailwind a CSS manual
- `SidebarTrigger` também deve sumir na impressão

---

### T9 — Edge cases, polish e integração final na página `Relatorios.tsx`

**User stories cobertas:** US01, US02, US03, US04, US05 (polish)
**Estimativa:** M (5pt)
**Sub-agente principal:** component-writer
**Arquivos:**
- `src/pages/Relatorios.tsx` — composição final dos componentes T3+T4+T5+T6+T7+T8
- `src/components/relatorios/` — revisão de estados vazios e edge cases em cada componente
**Dependências:** T1 – T8 (todos)

**Critérios de aceite (edge cases e polish):**
- [ ] Funil sem contatos: exibe "Funil sem contatos — adicione contatos no Board para visualizar o relatório" no lugar do gráfico e da tabela
- [ ] Funil sem estágios: exibe "Este funil não tem estágios configurados — acesse Configurações → Funis para adicionar estágios"
- [ ] Nenhum funil cadastrado: exibe CTA "Nenhum funil criado — crie seu primeiro funil em Configurações → Funis" com link para `/settings?tab=funis`
- [ ] Todos os estágios desmarcados: gráfico e tabela exibem "Selecione pelo menos um estágio"; botões de exportação ficam desabilitados
- [ ] Funil com 1 único estágio: `% vs. anterior` = "—", `% vs. topo` = "100%"
- [ ] Primeiro estágio com 0 contatos e estágios seguintes com contagem positiva: `% vs. anterior` dos estágios seguintes exibe "N/A" (divisão por zero tratada no hook T2)
- [ ] Estado de loading global: enquanto `useBoardStages` ou `useFunnelReport` carregam, exibir skeleton cobrindo gráfico+tabela
- [ ] Botão "Atualizar" chama `queryClient.invalidateQueries(['funnel-report', ...])` para forçar refetch on-demand (UX conforme briefing: "atualização é on-demand, não real-time")
- [ ] Página tem `<PageHeader>` com título "Relatórios" e ícone `BarChart2` (padrão `PageHeader` do projeto — verificar `src/components/ui-system`)
- [ ] Build sem erros de TypeScript (`npm run build` passa)
- [ ] Lint sem warnings (`npm run lint` limpo)

**Notas técnicas:**
- `PageHeader` está em `src/components/ui-system` (importado em `Board.tsx`)
- `queryClient` disponível via `useQueryClient()` do react-query v5
- T9 é a task de integração e polish — os componentes individuais (T3–T8) devem ser independentes o suficiente para T9 apenas compô-los em `Relatorios.tsx`

---

## Resumo de arquivos novos

| Arquivo | Criado em |
|---------|-----------|
| `src/pages/Relatorios.tsx` | T1 |
| `src/hooks/useFunnelReport.ts` | T2 |
| `src/components/relatorios/FunnelSelector.tsx` | T3 |
| `src/components/relatorios/FunnelMetricsTable.tsx` | T4 |
| `src/components/relatorios/FunnelChart.tsx` | T5 |
| `src/lib/exportRelatorio.ts` | T6 (xlsx) + T7 (pdf) |
| `src/components/relatorios/ExportMenu.tsx` | T6 |

## Resumo de arquivos modificados

| Arquivo | Modificado em | Mudança |
|---------|---------------|---------|
| `src/App.tsx` | T1 | Adicionar `<Route path="/relatorios">` |
| `src/components/layout/AppSidebar.tsx` | T1 | Adicionar item `{ label: 'Relatórios', icon: BarChart2, ... }` em `NAV_ITEMS` |
| `src/hooks/useNavOrder.ts` | T1 | Adicionar `'relatorios'` em `NAV_ITEM_KEYS`, `DEFAULT_NAV_ORDER`, `NAV_ITEM_LABELS` |
| `src/lib/dashboardLayout.ts` | T5 | Potencialmente estender `CHART_VIEW_TYPES` com `'funnel'` (Fullstack decide) |
| `src/index.css` ou `AppLayout` | T8 | Adicionar regra `@media print` para esconder sidebar |

---

## Mapa de dependências

```
T1 (fundação)
 └─► T2 (hook) ──────────────────────────────────────────────────┐
      └─► T3 (seletor) ─────────────────────────────────────────►│
           └─► T4 (tabela) ─────────────────────────────────────►│
           └─► T5 (gráfico) ────────────────────────────────────►│
                └─► T6 (xlsx) ──────────────────────────────────►│
                └─► T7 (pdf, depende T5 para ref SVG) ──────────►│
                └─► T8 (print) ──────────────────────────────────►│
                                                                   ▼
                                                               T9 (integração)
```

---

## Estimativa total

| Task | Estimativa |
|------|-----------|
| T1 | S (2pt) |
| T2 | M (5pt) |
| T3 | M (5pt) |
| T4 | S (2pt) |
| T5 | M (5pt) |
| T6 | S (2pt) |
| T7 | L (8pt) |
| T8 | S (2pt) |
| T9 | M (5pt) |
| **Total** | **36pt** |

Referência de velocidade: XS=1, S=2, M=5, L=8, XL=13. Velocidade típica de 1 dev por sprint de 1 semana ~ 20-30pt. T7 é o maior risco técnico (PDF+SVG) — fallback já mapeado no DoR.

---

## Definition of Done (todas as tasks)

- [ ] Critérios de aceite da task validados
- [ ] `npm run build` sem erros
- [ ] `npm run lint` sem warnings novos
- [ ] `npm run typecheck` (se disponível) ou TypeScript sem erros no build
- [ ] Smoke test manual: fluxo completo (selecionar funil → ver gráfico → exportar Excel) executado em dev
- [ ] Commit semântico pt-BR com `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`
