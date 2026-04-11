# 30b — Reordenação de Estágios via Drag-Drop

**Tipo:** Funcional
**Fase:** 3
**Depende de:** 30-func-page-board
**Desbloqueia:** —

## Objetivo
Permitir que o usuário arraste os estágios do board horizontalmente para reordenar. Disponível em 2 lugares: (a) no próprio Board (modo "Editar Estágios"), (b) em Settings → Funis.

## Arquivos a criar/modificar
- `src/components/board/BoardStagesManager.tsx` (novo)
- `src/pages/Board.tsx` (adicionar botão ⚙ "Editar Estágios" e modo edição)
- `src/components/settings/FunisTab.tsx` (reusar o Manager)

## Implementação
Usar `@dnd-kit/sortable` com `SortableContext` horizontal:

```tsx
<DndContext onDragEnd={handleDragEnd}>
  <SortableContext items={stages.map(s => s.id)} strategy={horizontalListSortingStrategy}>
    {stages.map(stage => (
      <SortableStageChip key={stage.id} stage={stage} />
    ))}
  </SortableContext>
</DndContext>
```

`handleDragEnd` reordena o array local e chama `useReorderStages({ board_id, orderedIds })` — batch update.

## Ações disponíveis por estágio
- ✏ Editar nome/cor (dialog pequeno)
- 🗑 Deletar (só se não tem items — caso contrário, alert)
- ⇅ Drag handle

## Botão "+ Novo estágio"
Adiciona um novo estágio ao final com nome editável inline.

## Critérios de Aceite
- [ ] Modo "Editar Estágios" no Board ativa um overlay de drag
- [ ] Arrastar chip muda ordem visual instantânea (optimistic)
- [ ] Ao soltar, `useReorderStages` persiste a nova ordem
- [ ] Erro na mutation reverte UI
- [ ] Deletar estágio com items mostra confirmação bloqueante
- [ ] Criar estágio novo funciona com cor default
- [ ] Mesmo componente funciona dentro da aba Funis de Settings
- [ ] Build passa

## Verificação
- Arrastar "Declarou Voto" para antes de "Contato Feito" → recarregar página → ordem persistida
- Verificar no Supabase que `board_stages.ordem` foi atualizado em batch
