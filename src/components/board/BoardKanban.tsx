import { useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import { BoardColumn } from './BoardColumn';
import { useMoveBoardItem, type BoardItemWithContact } from '@/hooks/useBoardItems';
import type { BoardStage } from '@/hooks/useBoardStages';

interface BoardKanbanProps {
  stages: BoardStage[];
  items: BoardItemWithContact[];
  onCardClick: (item: BoardItemWithContact) => void;
  onCardRemove: (item: BoardItemWithContact) => void;
  onAddContact: (stageId: string) => void;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (item: BoardItemWithContact) => void;
}

export function BoardKanban({
  stages,
  items,
  onCardClick,
  onCardRemove,
  onAddContact,
  selectionMode,
  selectedIds,
  onToggleSelect,
}: BoardKanbanProps) {
  const moveItem = useMoveBoardItem();
  const [optimistic, setOptimistic] = useState<Record<string, string>>({});

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 6 },
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    // Em modo selecao, ignora qualquer drag (tambem ja estao disabled nos cards)
    if (selectionMode) return;
    const { active, over } = event;
    if (!over) return;

    const itemId = active.id as string;
    const newStageId = over.id as string;

    // Drop só faz sentido se for em uma coluna conhecida
    if (!stages.some((s) => s.id === newStageId)) return;

    const item = items.find((i) => i.id === itemId);
    if (!item) return;

    const currentStageId = optimistic[itemId] ?? item.stage_id;
    if (currentStageId === newStageId) return;

    setOptimistic((prev) => ({ ...prev, [itemId]: newStageId }));
    moveItem.mutate(
      { itemId, newStageId },
      {
        onError: () => {
          // Reverte
          setOptimistic((prev) => {
            const next = { ...prev };
            delete next[itemId];
            return next;
          });
        },
        onSuccess: () => {
          // Limpa override quando o cache for invalidado
          setOptimistic((prev) => {
            const next = { ...prev };
            delete next[itemId];
            return next;
          });
        },
      },
    );
  };

  const itemsForStage = (stageId: string): BoardItemWithContact[] =>
    items.filter((item) => (optimistic[item.id] ?? item.stage_id) === stageId);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
        {stages.map((stage) => (
          <BoardColumn
            key={stage.id}
            stage={stage}
            items={itemsForStage(stage.id)}
            onCardClick={onCardClick}
            onCardRemove={onCardRemove}
            onAddContact={() => onAddContact(stage.id)}
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            onToggleSelect={onToggleSelect}
          />
        ))}
      </div>
    </DndContext>
  );
}
