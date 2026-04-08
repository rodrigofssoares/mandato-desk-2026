# Bibliotecas de Componentes e UI Kits para CRM

Pesquisa realizada em 07/04/2026 para evolucao do Mandato Desk 2026.

---

## 1. shadcn/ui (Ja no Projeto)

| Item | Detalhe |
|------|---------|
| **URL** | https://ui.shadcn.com |
| **Status** | Ja instalado e utilizado no projeto |
| **Base** | Radix UI primitives + Tailwind CSS |
| **Estilo** | Copy-paste (nao biblioteca npm) |

### Componentes relevantes para CRM:
- `Button` (7 variantes x 4 tamanhos)
- `Card` (Header, Title, Description, Content, Footer)
- `Table` (data display)
- `Tabs` (navegacao)
- `CommandDialog` (Cmd+K command palette)
- `Sheet` (side panels)
- `Dialog` (modais)
- `Form` (react-hook-form integration)
- `Select`, `Combobox`, `DatePicker`
- `Badge`, `Avatar`, `Tooltip`
- `Sidebar` (navegacao lateral)
- `Chart` (recharts wrapper)

### Temas CRM para shadcn:
- **tweakcn.com** — Gerador visual de temas CSS
- Temas community no GitHub
- Dark mode nativo via CSS variables

---

## 2. Tremor

| Item | Detalhe |
|------|---------|
| **URL** | https://tremor.so |
| **Instalacao** | `npm install @tremor/react` |
| **Componentes** | 35+ para analytics dashboards |
| **Compatibilidade** | React + Tailwind (compativel com nosso stack) |

### Componentes-chave para CRM:
- **KPI Cards** — AreaChart, BarChart, DonutChart sparklines
- **BarList** — Listas horizontais ranqueadas (ex: demandas por bairro)
- **Tracker** — Status tracker visual
- **CategoryBar** — Barra de categorias proporcional
- **ProgressBar** — Barras de progresso
- **Table** — Tabelas com sorting e filtering
- **NumberInput** — Inputs numericos formatados
- **DateRangePicker** — Seletor de periodo

### Por que considerar:
- Componentes de dashboard prontos que complementam shadcn/ui
- Visual clean e profissional out-of-the-box
- Otimizado para dashboards de dados (nosso caso de uso)

---

## 3. Radix UI

| Item | Detalhe |
|------|---------|
| **URL** | https://www.radix-ui.com |
| **Status** | Ja instalado (base do shadcn/ui) |
| **Tipo** | Primitivos headless (sem estilo) |

### Primitivos ja instalados no projeto:
- `@radix-ui/react-accordion`
- `@radix-ui/react-avatar`
- `@radix-ui/react-checkbox`
- `@radix-ui/react-dialog`
- `@radix-ui/react-dropdown-menu`
- `@radix-ui/react-label`
- `@radix-ui/react-popover`
- `@radix-ui/react-scroll-area`
- `@radix-ui/react-select`
- `@radix-ui/react-separator`
- `@radix-ui/react-slider`
- `@radix-ui/react-switch`
- `@radix-ui/react-tabs`
- `@radix-ui/react-tooltip`

### Vantagens:
- Acessibilidade ARIA automatica
- Navegacao por teclado built-in
- Focus management
- Sem estilos impostos (total controle visual)

---

## 4. TanStack Table v8

| Item | Detalhe |
|------|---------|
| **URL** | https://tanstack.com/table |
| **Instalacao** | `npm install @tanstack/react-table` |
| **Tipo** | Headless table utility |

### Features para CRM:
- Sorting multi-coluna
- Filtering global e por coluna
- Paginacao server-side
- Row selection (checkbox)
- Column resizing
- Column pinning (fixar colunas)
- Row expansion (detalhes inline)
- Virtualizacao (performance com 10K+ rows)
- Export (preparacao de dados para xlsx/csv)

### Por que usar:
- Tabelas sao o componente CENTRAL de qualquer CRM
- Headless = controle total do visual (integra com shadcn/ui)
- Performance com grandes volumes de dados

---

## 5. Recharts 3 (Ja no Projeto)

| Item | Detalhe |
|------|---------|
| **URL** | https://recharts.org |
| **Status** | Ja instalado (`recharts ^3.5.1`) |
| **Tipo** | Graficos React baseados em D3 |

### Graficos essenciais para CRM politico:
- **AreaChart** — Volume de demandas ao longo do tempo
- **BarChart** — Demandas por categoria/bairro
- **PieChart/DonutChart** — Distribuicao de status
- **LineChart** — Tendencias de atendimento
- **FunnelChart** — Pipeline de demandas
- **RadarChart** — Comparacao multi-dimensional

### Dicas de design:
- Usar cores semanticas consistentes (success, warning, error)
- Tooltips com background dark e texto claro
- Grid sutil (`rgba(148, 163, 184, 0.1)`)
- Responsive: esconder labels em mobile, manter em desktop

---

## 6. @dnd-kit/sortable (Ja no Projeto)

| Item | Detalhe |
|------|---------|
| **URL** | https://dndkit.com |
| **Status** | Ja instalado |
| **Tipo** | Drag and drop para React |

### Uso no CRM:
- Kanban board (arrastar cards entre colunas)
- Reordenacao de listas
- Drag entre containers

---

## 7. Framer Motion (Ja no Projeto)

| Item | Detalhe |
|------|---------|
| **URL** | https://www.framer.com/motion |
| **Status** | Ja instalado (`framer-motion ^12.23.26`) |
| **Tipo** | Animacoes React |

### Padroes de animacao para CRM:
- Entrada de modais/sheets (zoom-in + blur)
- Transicao de paginas
- Micro-interacoes (hover, click feedback)
- Skeleton loading
- Toast notifications (slide-in/out)
- Accordions e expand/collapse

---

## 8. Bibliotecas a Considerar (Nao Instaladas)

### cmdk (Command Palette)
| Item | Detalhe |
|------|---------|
| **URL** | https://cmdk.paco.me |
| **Status** | Ja incluido no shadcn/ui como `CommandDialog` |
| **Uso** | Cmd+K / Ctrl+K command palette |

### react-hot-toast / sonner
| Item | Detalhe |
|------|---------|
| **URL** | https://sonner.emilkowal.dev |
| **Status** | Verificar se ja esta no projeto (comum em projetos Lovable) |
| **Uso** | Toast notifications elegantes |

### Vaul (Drawer/Bottom Sheet)
| Item | Detalhe |
|------|---------|
| **URL** | https://vaul.emilkowal.dev |
| **Uso** | Bottom sheet mobile-first (melhor UX que Dialog no mobile) |

### react-day-picker
| Item | Detalhe |
|------|---------|
| **URL** | https://react-day-picker.js.org |
| **Uso** | Date picker avancado (periodos, ranges) |

---

## 9. Templates e Kits CRM-Specific

| Template | URL | Descricao | Preco |
|----------|-----|-----------|-------|
| TailAdmin | https://www.tailadmin.com | Admin dashboard Tailwind | Free + Pro |
| Tremor Dashboard | https://tremor.so | Dashboard React + Tailwind | Free |
| shadcn Admin | Figma Community | Admin template shadcn/ui | Free |
| Tailwind UI | https://tailwindui.com | Templates premium | $299 |

---

## Matriz de Decisao: O que Ja Temos vs O que Falta

| Componente | Status | Acao |
|------------|--------|------|
| shadcn/ui (base) | Instalado | Manter, customizar tema |
| Radix UI (primitivos) | Instalado | Manter |
| Recharts (graficos) | Instalado | Manter, melhorar design |
| @dnd-kit (drag) | Instalado | Manter |
| Framer Motion (animacoes) | Instalado | Manter, adicionar micro-interacoes |
| TanStack Table | **NAO instalado** | **Considerar** para tabelas avancadas |
| Tremor (dashboard) | **NAO instalado** | **Considerar** para KPIs e analytics |
| Command Palette | Disponivel via shadcn | **Implementar** Cmd+K |
| Bottom Sheet mobile | Verificar | **Considerar** Vaul para mobile UX |

### Recomendacao:
1. **Prioridade 1:** Implementar Command Palette (ja disponivel no shadcn/ui)
2. **Prioridade 2:** Avaliar TanStack Table para tabelas complexas
3. **Prioridade 3:** Avaliar Tremor para componentes de dashboard/KPI
4. **Manter:** shadcn/ui + Radix + Recharts + dnd-kit + Framer Motion
