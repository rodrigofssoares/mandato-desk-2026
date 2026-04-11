# 02 — Protótipo: Tarefas (Lista + Calendário)

**Tipo:** Protótipo visual
**Fase:** 4
**Depende de:** —
**Desbloqueia:** 31-func-page-tarefas

## Objetivo
Construir `/tarefas` com layout de lista agrupada (Hoje / Amanhã / Esta semana) e toggle para vista de calendário. Dados mockados, sem Supabase.

## Wireframe
```
╔══ TAREFAS ═════════════════════════════════════════════════╗
║ 🔍 Buscar  [Lista | Calendário]  🎯 Filtros  [+ Nova]       ║
║ Tipo: ☑Ligação ☑Reunião ☑Visita ☐Email ☐WhatsApp           ║
╠════════════════════════════════════════════════════════════╣
║ HOJE                                                        ║
║ ☐ 📞 Ligar p/ Maria S.   │ Zona Sul  │ 🔴 14:00  ✏ 🗑     ║
║ ☐ 🤝 Reunião Líder A.    │ Base Sul  │ 15:30     ✏ 🗑     ║
║ AMANHÃ                                                      ║
║ ☐ 🚗 Visita Creche Vila  │ Bairro X  │ 09:00     ✏ 🗑     ║
║ [2 selec.]  ✓ Concluir  🕑 Adiar  🗑 Excluir               ║
╚════════════════════════════════════════════════════════════╝
```

## Arquivos a criar
- `src/pages/Tarefas.tsx`
- `src/components/tarefas/TarefasList.tsx`
- `src/components/tarefas/TarefaRow.tsx`
- `src/components/tarefas/TarefaIcon.tsx`
- `src/components/tarefas/TarefasBulkToolbar.tsx`
- `src/components/tarefas/TarefasCalendar.tsx` (stub)

## Critérios de Aceite
- [ ] Rota `/tarefas` declarada
- [ ] Lista agrupada por dia (Hoje/Amanhã/Esta semana/Atrasadas)
- [ ] Cada linha: checkbox, ícone do tipo, título, vínculo (contato/local), data, ações
- [ ] Filtros de tipo (multi-checkbox) atualizam a lista
- [ ] Bulk toolbar aparece quando há seleção
- [ ] Toggle Lista/Calendário visível (Calendário = stub "em breve")

## Como testar
- Acessar `/tarefas` → ver lista agrupada
- Marcar checkbox de 2 itens → toolbar bulk aparece
- Clicar em filtro "Ligação" → filtra mock local
