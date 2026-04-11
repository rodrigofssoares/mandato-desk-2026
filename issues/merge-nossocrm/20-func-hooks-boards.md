# 20 — Hooks: Boards, Stages, Items

**Tipo:** Funcional (React hooks)
**Fase:** 1
**Depende de:** 10-func-schema-boards
**Desbloqueia:** 30-func-page-board, 34-func-tab-funis

## Objetivo
Criar hooks react-query para CRUD de boards, stages e items. Seguir o padrão de `src/hooks/useContacts.ts`.

## Arquivos a criar
- `src/hooks/useBoards.ts`
- `src/hooks/useBoardStages.ts`
- `src/hooks/useBoardItems.ts`

## API esperada
```ts
// useBoards.ts
useBoards(): { data, isLoading, error }
useBoardDetail(boardId): { data, isLoading }
useCreateBoard(): mutation({ nome, descricao })
useUpdateBoard(): mutation({ id, patch })
useDeleteBoard(): mutation(id)

// useBoardStages.ts
useBoardStages(boardId): { data }
useCreateStage(): mutation({ board_id, nome, cor })
useUpdateStage(): mutation({ id, patch })
useDeleteStage(): mutation(id)
useReorderStages(): mutation({ board_id, orderedIds: string[] }) // batch update

// useBoardItems.ts
useBoardItems(boardId, filters?): { data }  // já com JOIN em contacts
useAddContactToBoard(): mutation({ board_id, stage_id, contact_id })
useMoveItem(): mutation({ item_id, new_stage_id, new_ordem })
useRemoveItem(): mutation(item_id)
```

## Padrão de implementação (espelhar)
Seguir exatamente o estilo de `src/hooks/useContacts.ts`: uso de `useQuery` + `useMutation`, invalidação de `queryKey` após mutations, `toast.success()`/`toast.error()` nos callbacks, chamada a `logActivity` do audit log.

## Critérios de Aceite
- [ ] Todos os hooks tipados usando `Tables<"boards">`, `TablesInsert<"boards">`, etc.
- [ ] `useMoveItem` atualiza também `moved_at = now()` no update
- [ ] `useReorderStages` faz batch update via `upsert`
- [ ] Mutations invalidam queryKey correto
- [ ] Toasts em português nos erros e sucessos
- [ ] `logActivity` chamado para create/update/delete nas 3 entidades
- [ ] `npm run build` passa sem erro de tipo

## Verificação
- Criar teste manual em `/board` mock que usa os hooks → testar create, move, reorder
