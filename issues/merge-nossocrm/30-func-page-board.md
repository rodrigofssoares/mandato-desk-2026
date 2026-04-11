# 30 — Página Board (funcional)

**Tipo:** Funcional (Página + componentes)
**Fase:** 3
**Depende de:** 20-func-hooks-boards, 01-proto-board-wireframes
**Desbloqueia:** 30b-func-board-stages-dnd-reorder

## Objetivo
Plugar os hooks `useBoards`, `useBoardStages`, `useBoardItems` no protótipo (01) para criar o Board funcional com persistência real.

## Arquivos a criar/modificar
- `src/pages/Board.tsx` (modificar — sai dos mocks)
- `src/components/board/BoardKanban.tsx`
- `src/components/board/BoardColumn.tsx`
- `src/components/board/BoardCard.tsx`
- `src/components/board/BoardSelector.tsx`
- `src/components/board/BoardCardDetailSheet.tsx` (novo)
- `src/components/board/AddContactToBoardDialog.tsx` (novo)
- `src/components/board/CreateBoardDialog.tsx` (novo)

## Referência técnica
- **Drag-drop**: espelhar `src/components/demands/DemandKanban.tsx` (já usa `@dnd-kit/core`)
- **Sheet lateral**: `src/components/ui/sheet.tsx`
- **Animação de card**: `framer-motion` `<AnimatePresence>` + `layout`

## Fluxos principais
1. **Listar boards** → `BoardSelector` popula dropdown via `useBoards()`
2. **Ver stages + cards** → `useBoardStages(boardId)` + `useBoardItems(boardId)`
3. **Arrastar card entre colunas** → `useMoveItem` atualiza `stage_id` e `moved_at`
4. **Clicar no card** → `BoardCardDetailSheet` abre com dados do contato + tarefas + botões
5. **"+ Contato no board"** → `AddContactToBoardDialog` com autocomplete de contatos existentes
6. **"+ Novo board"** → `CreateBoardDialog` pede nome, descrição, estágios iniciais

## Alerta "parado há X dias"
No `BoardCard`, calcular `daysSince(moved_at)`. Se `>=5`, mostrar ícone ⚠ vermelho com tooltip "Parado há N dias".

## Critérios de Aceite
- [ ] `/board` carrega boards reais do Supabase
- [ ] Drag-drop entre colunas persiste
- [ ] Criar novo board funciona (com estágios default)
- [ ] Adicionar contato existente a um board funciona
- [ ] Sheet de detalhe mostra dados reais do contato
- [ ] Contador de cards por coluna correto
- [ ] Responsivo: scroll horizontal no mobile
- [ ] Badge "N tarefas pendentes" no card (usando `useTarefas({ board_item_id })`)

## Verificação manual
Ver lista de verificação na seção 12 do plano master.
