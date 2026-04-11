# 31b — Tarefas: Vista de Calendário

**Tipo:** Funcional
**Fase:** 4
**Depende de:** 31-func-page-tarefas
**Desbloqueia:** —

## Objetivo
Implementar o toggle "Calendário" em `/tarefas` — uma vista mensal onde cada dia mostra as tarefas agendadas, permite clicar para abrir/editar, e clicar em dia vazio para criar.

## Arquivos a criar/modificar
- `src/components/tarefas/TarefasCalendar.tsx` (substituir stub do proto)
- `src/pages/Tarefas.tsx` (ligar o toggle Lista ↔ Calendário)

## Biblioteca
Usar **apenas componentes existentes + date-fns**. Não adicionar `react-big-calendar` nem `fullcalendar` (evitar dependência nova).

Construir um grid próprio:
```tsx
// Header: navegação mês [<] Março 2026 [>]
// Grid 7 colunas (Dom-Sáb) × 5-6 linhas
// Cada célula: número do dia + até 3 chips de tarefas + "+N mais"
```

## Interações
- **Click numa tarefa (chip)** → abre `TarefaFormDialog` em modo edit
- **Click num dia vazio** → abre `TarefaFormDialog` em modo create com `data_agendada` pré-preenchida para aquele dia 09:00
- **Click em "+N mais"** → popover listando todas as tarefas daquele dia
- **Arrow keys / botões** → navegar entre meses

## Query
`useTarefas({ periodo: 'mes', mesReferencia: currentMonth })` — estender hook se preciso para aceitar range customizado.

## Chips visuais
- Cor do chip = cor do tipo (LIGACAO=azul, VISITA=laranja, etc)
- Ícone pequeno + título truncado
- Riscado + opacidade reduzida quando `concluida=true`

## Critérios de Aceite
- [ ] Toggle Lista/Calendário funcional com estado em URL (`?view=calendar`)
- [ ] Grid mensal navegável
- [ ] Tarefas do mês aparecem no dia correto
- [ ] Click em tarefa abre edit
- [ ] Click em dia vazio abre create pré-preenchido
- [ ] "+N mais" popover funcional
- [ ] Responsivo: no mobile vira lista de dias compacta
- [ ] Sem dependências novas
- [ ] Build passa

## Verificação
- Criar tarefa com data `2026-04-20 14:00` → alternar para calendar → aparece no dia 20
- Clicar em dia 25 vazio → dialog abre com data pré = 2026-04-25 09:00
- Marcar tarefa como concluída na lista → voltar ao calendário → chip aparece riscado
