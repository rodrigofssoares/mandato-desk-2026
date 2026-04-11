# 40 — Evoluir Dashboard (Visão Geral)

**Tipo:** Funcional
**Fase:** 5
**Depende de:** 03-proto-visao-geral-wireframes, 20-func-hooks-boards, 21-func-hooks-tarefas
**Desbloqueia:** —

## Objetivo
Evoluir o Dashboard atual (rota `/`) plugando dados reais nos componentes criados no protótipo 03. Reaproveitar componentes políticos existentes e adicionar os novos.

## Arquivos a criar/modificar
- `src/pages/Dashboard.tsx` (modificar layout — não recriar)
- `src/components/dashboard/StatCardWithDelta.tsx` (plugar dados)
- `src/components/dashboard/PeriodSelector.tsx` (plugar estado)
- `src/components/dashboard/BoardFunnelCard.tsx` (plugar Recharts + useBoards)
- `src/components/dashboard/TarefasHojeCard.tsx` (plugar useTarefasHoje)
- `src/components/dashboard/AlertsBadge.tsx`
- `src/components/dashboard/AlertsModal.tsx`
- `src/hooks/useDashboardMetrics.ts` (novo — agregações com comparação)

## Layout alvo
```
── Header ─ Board: [Seguidores▼]  Período: [Este mês▼]  🔔3 ──

── 4 StatCards (delta colorido) ──────────────────────────────
[Base Total] [Novos no Mês] [Voto Declarado] [Multiplicadores]

── Grid principal ────────────────────────────────────────────
┌─ Funil (BoardFunnelCard) ─┐  ┌─ Tarefas Hoje ──┐
│  Recharts horizontal bars │  │  5 próximas     │
└───────────────────────────┘  └─────────────────┘
                               ┌─ Aniversários ──┐
┌─ Saúde da Base ───────────┐  │  (componente    │
│  (reusar componente atual)│  │   existente)    │
└───────────────────────────┘  └─────────────────┘

── Linha inferior ────────────────────────────────────────────
┌─ Crescimento (GrowthChart) ──┐  ┌─ Activity Feed ──┐
│  (componente existente)       │  │ (audit log)      │
└───────────────────────────────┘  └──────────────────┘
```

## Componentes reaproveitados (não mexer na lógica interna)
- `DashboardStatsCards.tsx` — pode ser substituído pelos 4 StatCardWithDelta
- `GrowthMetricsCards.tsx` — manter em uma seção secundária
- `GrowthChart.tsx` — manter
- `TagDistributionChart.tsx` — pode ir para uma tab/seção "Mais"
- `VoteDeclarationChart.tsx` — pode ir para "Mais"
- `BirthdaySection.tsx` — manter (lateral)
- `ActivityFeed.tsx` — manter (final da página)

## useDashboardMetrics
```ts
useDashboardMetrics(period: 'hoje'|'7d'|'30d'|'mes', boardId?: string) {
  // calcula:
  // - baseTotal, baseTotalPrevious (comparação)
  // - novosNoPeriodo, novosNoPeriodoPrevious
  // - votoDeclaradoCount, votoDeclaradoTaxa
  // - multiplicadoresCount (contatos com tag "multiplicador" ou stage específico)
  // - saudeBase: { ativos%, inativos%, perdidos% }
  // - funilStages: { stage_id, nome, count }[] do board selecionado
  // - tarefasHoje: Tarefa[]
  // - alertas: Alert[] (contatos parados 5+ dias no funil, tarefas vencidas, etc)
}
```

## Alertas modal
Tipos de alerta:
1. Contatos parados 5+ dias no funil ativo
2. Tarefas vencidas (data_agendada < now AND concluida = false)
3. Aniversariantes hoje sem tarefa de parabéns

## Critérios de Aceite
- [ ] Dashboard carrega com os 4 StatCards novos mostrando valores reais + delta
- [ ] Período muda e todos os números recalculam
- [ ] Seletor de board no header atualiza o BoardFunnelCard
- [ ] Funil renderiza com Recharts horizontal bar chart
- [ ] Tarefas de hoje card mostra top 5 + link "ver todas" → `/tarefas`
- [ ] Badge 🔔 mostra contagem; click abre modal com lista
- [ ] Componentes políticos existentes preservados (aniversários, growth, activity feed)
- [ ] Responsivo no mobile (cards em coluna)
- [ ] Build passa

## Verificação
Ver seção 12 do plano master (steps 14-17).
