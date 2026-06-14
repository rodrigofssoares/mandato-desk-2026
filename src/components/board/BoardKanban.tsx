import { useEffect, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { BoardColumn } from './BoardColumn';
import { BoardCardOverlay } from './BoardCard';
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
  /**
   * IDs das etapas que estão "protegidas" pelo filtro de aceite WhatsApp
   * (etapas antes do ponto de início — mostram todos os cards, exibem badge amarelo).
   */
  protectedStageIds?: Set<string>;
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
  protectedStageIds,
}: BoardKanbanProps) {
  const moveItem = useMoveBoardItem();
  const [optimistic, setOptimistic] = useState<Record<string, string>>({});
  // Item sendo arrastado — renderizado no <DragOverlay> (fantasma flutuante).
  const [activeId, setActiveId] = useState<string | null>(null);

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
      // Como SÓ a alça (GripVertical) inicia o drag, não há mais conflito com o scroll
      // horizontal/vertical no resto do card. Ativação por distância curta = arraste
      // instantâneo (sem o antigo delay de 150ms que deixava o movimento "preso").
      activationConstraint: { distance: 4 },
    }),
  );

  // Move um item para outra etapa — compartilhado pelo drag-and-drop e pelo menu "Mover para".
  const moveTo = (itemId: string, newStageId: string) => {
    if (selectionMode) return;
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

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    // Em modo selecao, ignora qualquer drag (tambem ja estao disabled nos cards)
    if (selectionMode) return;
    const { active, over } = event;
    if (!over) return;
    moveTo(active.id as string, over.id as string);
  };

  const activeItem = activeId ? items.find((i) => i.id === activeId) ?? null : null;

  const itemsForStage = (stageId: string): BoardItemWithContact[] =>
    items.filter((item) => (optimistic[item.id] ?? item.stage_id) === stageId);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
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
              isProtected={protectedStageIds?.has(stage.id) ?? false}
              stages={stages}
              onMoveItem={(item, newStageId) => moveTo(item.id, newStageId)}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Fantasma flutuante: segue o cursor renderizado em portal — não é cortado pelas colunas. */}
      <DragOverlay dropAnimation={null}>
        {activeItem ? <BoardCardOverlay item={activeItem} /> : null}
      </DragOverlay>
    </DndContext>
  );
}
