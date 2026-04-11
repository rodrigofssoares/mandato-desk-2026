# 03 — Protótipo: Visão Geral (Dashboard evoluído)

**Tipo:** Protótipo visual
**Fase:** 5
**Depende de:** —
**Desbloqueia:** 40-func-evoluir-dashboard

## Objetivo
Construir novos componentes visuais do Dashboard (sem integrar dados reais), posicionados sobre o Dashboard atual. Validar layout e composição antes de plugar queries.

## Wireframe
```
╔══ VISÃO GERAL ═════════════════════════════════════════════╗
║ Board: Seguidores ▼  Período: Este mês ▼  🔔 3 alertas    ║
╠════════════════════════════════════════════════════════════╣
║ ┌────────────┬────────────┬────────────┬────────────┐     ║
║ │BASE TOTAL  │NOVOS NO MÊS│VOTO DECL.  │MULTIPLICA- │     ║
║ │ 12.458     │ +342       │ 3.872      │ DORES      │     ║
║ │ ↑ 8.2% MoM │ ↑ 12% YoY  │ 31% taxa   │ 142        │     ║
║ └────────────┴────────────┴────────────┴────────────┘     ║
║ ┌─ FUNIL ──────────────────┐ ┌ TAREFAS HOJE ┐             ║
║ │ estágio 1 ████████       │ │ 📞 Maria 14h │             ║
║ │ estágio 2 █████          │ │ 🤝 Líder 15h │             ║
║ └──────────────────────────┘ └──────────────┘             ║
╚════════════════════════════════════════════════════════════╝
```

## Arquivos a criar
- `src/components/dashboard/StatCardWithDelta.tsx`
- `src/components/dashboard/PeriodSelector.tsx`
- `src/components/dashboard/BoardFunnelCard.tsx`
- `src/components/dashboard/TarefasHojeCard.tsx`
- `src/components/dashboard/AlertsBadge.tsx`
- `src/components/dashboard/AlertsModal.tsx`

## Critérios de Aceite
- [ ] 4 StatCards com delta visual (↑ verde / ↓ vermelho)
- [ ] Seletor de período com 4 opções (hoje, 7d, 30d, este mês)
- [ ] Funil com 5-6 barras horizontais usando Recharts
- [ ] Card "Tarefas de hoje" com 3 mock entries
- [ ] Badge de alertas mostra contagem, clicar abre modal
- [ ] Dashboard atual continua intacto — novos componentes só ficam prontos para plugar

## Como testar
- `/` mostra componentes novos (em área de preview ou feature flag)
- Hover nos cards → animação de elevação
- Clicar no 🔔 → modal abre com lista mockada
