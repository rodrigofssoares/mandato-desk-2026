# 31 — Página Tarefas (funcional)

**Tipo:** Funcional (Página + componentes)
**Fase:** 4
**Depende de:** 21-func-hooks-tarefas, 02-proto-tarefas-wireframes
**Desbloqueia:** 31b-func-tarefas-calendar-view, 42-func-contato-aba-tarefas

## Objetivo
Plugar `useTarefas` no protótipo (02) para tornar a página `/tarefas` funcional com persistência real.

## Arquivos a criar/modificar
- `src/pages/Tarefas.tsx`
- `src/components/tarefas/TarefasList.tsx`
- `src/components/tarefas/TarefaRow.tsx`
- `src/components/tarefas/TarefaFormDialog.tsx` (novo — criar/editar)
- `src/components/tarefas/TarefasFilters.tsx` (novo)
- `src/components/tarefas/TarefasBulkToolbar.tsx`
- `src/components/tarefas/TarefaIcon.tsx`

## Fluxos principais
1. **Listar tarefas** agrupadas (Atrasadas/Hoje/Amanhã/Esta semana/Próximas) usando `agruparTarefasPorDia` helper
2. **Criar nova tarefa** → dialog com: título, tipo, data/hora, responsável, vínculo (contato/articulador/demanda), descrição
3. **Marcar como concluída** → checkbox dispara `useToggleConcluida`
4. **Editar/deletar** linha → dialog reutilizado em modo edit
5. **Bulk**: seleção → toolbar com Concluir / Adiar / Excluir em lote
6. **Filtros**: tipo (multi), período, responsável

## Integração com contatos
`TarefaFormDialog` tem um autocomplete (shadcn `Command`) para buscar contato/articulador/demanda a vincular. Campo opcional.

## Critérios de Aceite
- [ ] Lista carrega tarefas reais do Supabase
- [ ] Agrupamento correto por data usando `date-fns`
- [ ] Criar tarefa persiste e aparece na lista
- [ ] Toggle concluída atualiza UI imediatamente (optimistic)
- [ ] Filtros funcionam (backend + client side)
- [ ] Bulk operations funcionam (batch no Supabase)
- [ ] Campo "vínculo" permite buscar contato e salvar `contact_id`
- [ ] Toasts de sucesso/erro em português
- [ ] Responsivo no mobile

## Verificação
Ver seção 12 do plano master.
