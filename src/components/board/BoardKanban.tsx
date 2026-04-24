import { useEffect, useRef, useState } from 'react';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import { BoardColumn } from './BoardColumn';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
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

  // Refs pra sincronizar scroll horizontal entre a scrollbar do topo e a de baixo
  const topScrollAreaRef = useRef<HTMLDivElement>(null);
  const bottomScrollAreaRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);

  useEffect(() => {
    const topViewport = topScrollAreaRef.current?.querySelector<HTMLDivElement>(
      '[data-radix-scroll-area-viewport]',
    );
    const bottomViewport = bottomScrollAreaRef.current?.querySelector<HTMLDivElement>(
      '[data-radix-scroll-area-viewport]',
    );
    if (!topViewport || !bottomViewport) return;

    // Sincroniza scrollLeft entre os dois viewports. Nos extremos (primeiros 2px
    // de max-left ou max-right), faz "snap" pro extremo oposto usar o PROPRIO
    // maximo — assim os dois bars ficam grudados nas pontas mesmo que tenham
    // scrollWidth/clientWidth levemente diferentes.
    const SNAP_THRESHOLD = 2;
    let syncing = false;
    const syncTo = (source: HTMLDivElement, target: HTMLDivElement) => {
      if (syncing) return;
      syncing = true;
      const sourceMax = source.scrollWidth - source.clientWidth;
      const targetMax = target.scrollWidth - target.clientWidth;
      if (source.scrollLeft <= SNAP_THRESHOLD) {
        target.scrollLeft = 0;
      } else if (source.scrollLeft >= sourceMax - SNAP_THRESHOLD) {
        target.scrollLeft = targetMax;
      } else {
        target.scrollLeft = source.scrollLeft;
      }
      requestAnimationFrame(() => {
        syncing = false;
      });
    };
    const syncFromBottom = () => syncTo(bottomViewport, topViewport);
    const syncFromTop = () => syncTo(topViewport, bottomViewport);
    bottomViewport.addEventListener('scroll', syncFromBottom, { passive: true });
    topViewport.addEventListener('scroll', syncFromTop, { passive: true });

    const measure = () => {
      const inner = bottomViewport.firstElementChild as HTMLElement | null;
      if (inner) setContentWidth(inner.scrollWidth);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(bottomViewport);
    if (bottomViewport.firstElementChild) {
      ro.observe(bottomViewport.firstElementChild as Element);
    }

    return () => {
      bottomViewport.removeEventListener('scroll', syncFromBottom);
      topViewport.removeEventListener('scroll', syncFromTop);
      ro.disconnect();
    };
  }, [stages.length, items.length]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      // delay + tolerance (em vez de distance) deixa o drag iniciar somente apos segurar ~150ms.
      // Swipes rapidos passam como scroll horizontal nativo sem serem sequestrados pelo DnD.
      activationConstraint: { delay: 150, tolerance: 8 },
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
      {/* Scrollbar horizontal espelhada no TOPO — type="always" deixa a barra sempre visivel (sem hover) */}
      <ScrollArea ref={topScrollAreaRef} type="always" className="w-full h-3 mb-2">
        <div style={{ width: contentWidth || '100%', height: 1 }} />
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <ScrollArea ref={bottomScrollAreaRef} type="always" className="w-full pb-2">
        <div className="flex gap-3 pb-4 touch-pan-x">
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
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </DndContext>
  );
}
