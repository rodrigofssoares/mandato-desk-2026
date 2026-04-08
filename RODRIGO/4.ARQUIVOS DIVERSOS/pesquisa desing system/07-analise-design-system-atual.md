# Analise do Design System Atual vs Referencias

Pesquisa realizada em 07/04/2026.
Comparacao do `DESIGN_SYSTEM.md` do Mandato Desk 2026 com as melhores praticas de mercado.

---

## O que Ja Temos de Bom

### 1. OKLCH Color Space
- Ja implementamos OKLCH para cores semanticas (light + dark mode)
- Alinhado com Tailwind v4 e tendencia 2026
- Poucos CRMs no mercado usam OKLCH (Folk CRM e Close sao referencias)
- **Nota: 9/10** — Estamos a frente do mercado nesse aspecto

### 2. Dark Mode Completo
- Light e Dark mode com tokens dedicados
- Glassmorphism implementado (background + blur + border)
- Camadas de superficie (bg, surface, muted, border) bem definidas
- **Nota: 8/10** — Falta opcao "System" (sincronizar com OS) como Pipedrive faz

### 3. Tipografia Bem Definida
- Inter (corpo) — escolha comprovada e universal
- Space Grotesk (display) — boa personalidade
- Cinzel (serif) — para destaques especiais
- Escala tipografica documentada com contextos de uso
- **Nota: 7/10** — Inter esta se tornando generica; Space Grotesk e boa mas nao transmite "institucional"

### 4. Componentes shadcn/ui
- Biblioteca completa de componentes core
- Modais, sheets, formularios, badges, tabs
- Componentes customizados (AudioPlayer, ContactSearchCombobox)
- FormField com validacao e estados
- **Nota: 8/10** — Solido, falta Command Palette e tabelas avancadas

### 5. Acessibilidade
- Focus rings customizados (padrao + alto contraste)
- ARIA attributes documentados
- Focus trap em modais
- Screen reader support (sr-only, live regions)
- Reduced motion support
- **Nota: 9/10** — Excelente, acima da maioria dos CRMs

### 6. Performance
- `content-visibility: auto` para listas longas
- Scrollbar customizada
- CSS variables eficientes
- **Nota: 7/10** — Bom, mas poderia usar virtualizacao (TanStack Virtual)

### 7. Responsividade
- Mobile-first com breakpoints padrao
- Safe area support
- Padding/sizing escalavel
- **Nota: 7/10** — Estrutura boa, falta bottom navigation mobile e offline

---

## Gaps Identificados

### Gap 1: Paleta de Cores Nao Transmite "Institucional"
**Problema:** Sky Blue (`#0ea5e9`) e uma cor tech/startup, nao governo/institucional.
**Referencia:** USWDS usa `#005ea2` (navy), GOV.BR usa escalas de azul escuro.
**Recomendacao:** Migrar para Navy Blue (Paleta A do arquivo 04) como cor principal.

### Gap 2: Sem Command Palette (Cmd+K)
**Problema:** Power users nao tem acesso rapido a acoes.
**Referencia:** Linear, Superhuman, Notion — todos tem Cmd+K.
**Recomendacao:** Implementar usando `CommandDialog` do shadcn/ui (ja disponivel).

### Gap 3: Sem Tokens Semanticos para Componentes
**Problema:** Tokens sao genericos (`--color-bg`, `--color-border`). Nao ha tokens por componente.
**Referencia:** Close CRM usa `--color[Element][Component][Variant][State]` (ex: `--colorBgTableCellHighlighted`).
**Recomendacao:** Criar camada de tokens semanticos por componente sobre os tokens base.

### Gap 4: Sem Design Tokens para Status de Demanda
**Problema:** Cores de status (open, progress, resolved) existem no tailwind.config mas nao no design system doc.
**Referencia:** Monday.com mapeia "Done" → verde, "Working" → amarelo, "Stuck" → vermelho com nomes semanticos.
**Recomendacao:** Definir cores nomeadas para cada status do Kanban: "Nova", "Em Andamento", "Concluida", "Cancelada", etc.

### Gap 5: Tabelas Basicas
**Problema:** Usa tabelas HTML basicas sem sorting, filtering, paginacao avancada.
**Referencia:** Attio tem tabela relacional tipo spreadsheet como core.
**Recomendacao:** Avaliar TanStack Table v8 para tabelas complexas com sorting, filtering, column resize.

### Gap 6: Sem Tema "System" (Sincronizar com OS)
**Problema:** Apenas Light e Dark, sem opcao de seguir preferencia do sistema.
**Referencia:** Pipedrive oferece Light/Dark/System. Dado: dark mode aumenta retencao.
**Recomendacao:** Adicionar terceira opcao "Sistema" no toggle de tema.

### Gap 7: Micro-interacoes Limitadas
**Problema:** Animacoes documentadas mas limitadas a modais/sheets.
**Referencia:** Linear tem transicoes suaves em cada mudanca de estado. Stripe usa skeleton loading.
**Recomendacao:** Adicionar skeleton loading, button state transitions, card expand/collapse.

### Gap 8: Sem Dashboard Analytics Avancado
**Problema:** Graficos basicos com Recharts mas sem KPI cards, sparklines, heatmaps.
**Referencia:** Tremor oferece 35+ componentes de dashboard prontos.
**Recomendacao:** Avaliar Tremor para complementar Recharts com KPI cards e visualizacoes.

### Gap 9: Sem Progressive Disclosure
**Problema:** Interfaces mostram muita informacao de uma vez.
**Referencia:** Attio revela complexidade gradualmente, com hover para detalhes.
**Recomendacao:** Implementar collapsible sections, hover cards, detail panels progressivos.

### Gap 10: Font Display (Space Grotesk) Nao e Institucional
**Problema:** Space Grotesk e tech/startup, nao institucional.
**Referencia:** General Sans ou Manrope transmitem mais seriedade.
**Recomendacao:** Avaliar troca para General Sans (headings) mantendo Inter (body).

---

## Plano de Evolucao Priorizado

### Fase 1 — Quick Wins (1-2 dias)
- [ ] Adicionar opcao "Sistema" no theme toggle
- [ ] Implementar Command Palette (Cmd+K) com shadcn CommandDialog
- [ ] Definir cores semanticas nomeadas para status do Kanban
- [ ] Adicionar skeleton loading nos dashboards

### Fase 2 — Evolucao Visual (3-5 dias)
- [ ] Avaliar e testar Paleta Navy (Paleta A) vs Sky Blue atual
- [ ] Testar General Sans como font-display vs Space Grotesk
- [ ] Criar tokens semanticos por componente (Close CRM pattern)
- [ ] Implementar micro-interacoes (button states, card transitions)

### Fase 3 — Componentes Avancados (1-2 semanas)
- [ ] Avaliar TanStack Table para tabelas complexas
- [ ] Avaliar Tremor para componentes de dashboard/KPI
- [ ] Implementar progressive disclosure em telas complexas
- [ ] Bottom navigation mobile

### Fase 4 — AI e Analytics (futuro)
- [ ] Painel AI contextual (resumo de cidadao)
- [ ] Dashboard analytics avancado (heatmaps, sparklines)
- [ ] Natural language queries ("demandas por bairro este mes")

---

## Score Atual vs Meta

| Aspecto | Atual | Meta | Gap |
|---------|-------|------|-----|
| Cores & Temas | 8/10 | 9/10 | Paleta mais institucional |
| Tipografia | 7/10 | 8/10 | Font display mais seria |
| Componentes | 8/10 | 9/10 | Command palette, tabelas |
| Acessibilidade | 9/10 | 9/10 | Manter |
| Micro-interacoes | 5/10 | 8/10 | Skeleton, transitions |
| Mobile | 7/10 | 9/10 | Bottom nav, offline |
| Dashboard/Analytics | 6/10 | 8/10 | KPIs, sparklines |
| AI Features | 3/10 | 7/10 | Contextual AI |
| **TOTAL** | **53/80** | **67/80** | **+14 pontos** |
