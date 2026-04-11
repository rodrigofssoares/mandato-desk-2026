# 21 — Hooks: Tarefas

**Tipo:** Funcional (React hooks)
**Fase:** 1
**Depende de:** 11-func-schema-tarefas
**Desbloqueia:** 31-func-page-tarefas, 42-func-contato-aba-tarefas

## Objetivo
Hook `useTarefas` com CRUD, filtros e ações em lote. Padrão de `useContacts.ts`.

## Arquivos a criar
- `src/hooks/useTarefas.ts`

## API esperada
```ts
type TarefaFilters = {
  search?: string;
  tipos?: TarefaTipo[];          // LIGACAO, VISITA, etc
  periodo?: 'hoje'|'amanha'|'semana'|'mes'|'atrasadas'|'todas';
  responsavel_id?: string;
  contact_id?: string;
  leader_id?: string;
  demand_id?: string;
  board_item_id?: string;
  concluida?: boolean;
};

useTarefas(filters?: TarefaFilters): { data, isLoading }
useTarefaDetail(id): { data }
useCreateTarefa(): mutation(input)
useUpdateTarefa(): mutation({ id, patch })
useToggleConcluida(): mutation({ id, concluida })  // seta concluida_em
useDeleteTarefa(): mutation(id)
useBulkConcluir(): mutation(ids: string[])
useBulkAdiar(): mutation({ ids, novaData })
useBulkDelete(): mutation(ids: string[])
useTarefasHoje(): { data } // helper para Dashboard
```

## Agrupamento (helper)
```ts
export function agruparTarefasPorDia(tarefas: Tarefa[]): {
  atrasadas: Tarefa[];
  hoje: Tarefa[];
  amanha: Tarefa[];
  estaSemana: Tarefa[];
  proximas: Tarefa[];
}
```
Usar `date-fns` (`isToday`, `isTomorrow`, `isThisWeek`, `isPast`). Já instalado.

## Critérios de Aceite
- [ ] Todas as queries usam react-query com cache invalidation
- [ ] `useToggleConcluida` seta `concluida_em = now()` quando true e `null` quando false
- [ ] Bulk mutations enviam em UMA request (via `.in('id', ids)`)
- [ ] Helper `agruparTarefasPorDia` testado com mock
- [ ] `logActivity` nos CRUDs
- [ ] `npm run build` passa

## Verificação
- Criar tarefa manual via Supabase Studio → `useTarefas()` retorna ela
- Filtrar `periodo='hoje'` → só retorna tarefas de hoje
