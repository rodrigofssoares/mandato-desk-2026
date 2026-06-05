import { useCallback } from 'react';
import {
  DndContext,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { DemandCard } from './DemandCard';
import { useUpdateDemand } from '@/hooks/useDemands';
import { useDemandBoardId, useDemandStages } from '@/hooks/useDemandColumns';
import type { Demand } from '@/hooks/useDemands';

interface DemandKanbanProps {
  demands: Demand[];
  onEditDemand: (demand: Demand) => void;
}

// ── Fallback legado (antes da migration 113 / sem colunas configuradas) ──────
type LegacyStatus = 'open' | 'in_progress' | 'resolved';
const LEGACY_COLUMNS: { id: LegacyStatus; title: string; color: string }[] = [
  { id: 'open', title: 'Aberta', color: '#F59E0B' },
  { id: 'in_progress', title: 'Em Andamento', color: '#3B82F6' },
  { id: 'resolved', title: 'Resolvida', color: '#22C55E' },
];

const NO_COLUMN = '__none__';

interface KanbanColumnModel {
  id: string;
  title: string;
  color: string | null;
}

function KanbanColumn({
  column,
  demands,
  onEditDemand,
}: {
  column: KanbanColumnModel;
  demands: Demand[];
  onEditDemand: (demand: Demand) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-[260px] snap-start rounded-lg border bg-muted/30 ${
        isOver ? 'ring-2 ring-primary/50' : ''
      }`}
    >
      <div className="p-3 border-b flex items-center gap-2">
        <div
          className="w-3 h-3 rounded-full shrink-0"
          style={{ backgroundColor: column.color ?? '#94A3B8' }}
        />
        <h3 className="font-semibold text-sm truncate">{column.title}</h3>
        <Badge variant="secondary" className="ml-auto text-xs">
          {demands.length}
        </Badge>
      </div>

      <ScrollArea className="h-[calc(100vh-280px)]">
        <div className="p-2">
          <SortableContext
            items={demands.map((d) => d.id)}
            strategy={verticalListSortingStrategy}
          >
            {demands.map((demand) => (
              <DemandCard
                key={demand.id}
                demand={demand}
                onClick={() => onEditDemand(demand)}
              />
            ))}
          </SortableContext>

          {demands.length === 0 && (
            <p className="text-center text-xs text-muted-foreground py-8">
              Nenhuma demanda
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export function DemandKanban({ demands, onEditDemand }: DemandKanbanProps) {
  const updateDemand = useUpdateDemand();
  const { data: boardId, isLoading: boardLoading } = useDemandBoardId();
  const { data: stages = [], isLoading: stagesLoading } = useDemandStages(boardId);

  // Modo dinâmico só quando há colunas configuradas (pós-migration 113).
  const dynamicMode = stages.length > 0;

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;

      const demandId = active.id as string;
      const target = over.id as string;
      const demand = demands.find((d) => d.id === demandId);
      if (!demand) return;

      if (dynamicMode) {
        const validIds = [...stages.map((s) => s.id), NO_COLUMN];
        if (!validIds.includes(target)) return;
        const nextStage = target === NO_COLUMN ? null : target;
        if (demand.stage_id === nextStage) return;
        updateDemand.mutate({ id: demandId, stage_id: nextStage });
      } else {
        const validStatuses: LegacyStatus[] = ['open', 'in_progress', 'resolved'];
        if (!validStatuses.includes(target as LegacyStatus)) return;
        if (demand.status === target) return;
        updateDemand.mutate({ id: demandId, status: target as LegacyStatus });
      }
    },
    [demands, dynamicMode, stages, updateDemand]
  );

  // Evita "flash" do modo legado enquanto descobrimos se há colunas configuradas.
  if (boardLoading || (boardId && stagesLoading)) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Monta as colunas + agrupa as demandas em cada uma.
  let columns: KanbanColumnModel[];
  let demandsByColumn: (columnId: string) => Demand[];

  if (dynamicMode) {
    const hasOrphans = demands.some((d) => !d.stage_id);
    columns = [
      ...stages.map((s) => ({ id: s.id, title: s.nome, color: s.cor })),
      ...(hasOrphans
        ? [{ id: NO_COLUMN, title: 'Sem coluna', color: '#94A3B8' }]
        : []),
    ];
    demandsByColumn = (columnId: string) =>
      columnId === NO_COLUMN
        ? demands.filter((d) => !d.stage_id)
        : demands.filter((d) => d.stage_id === columnId);
  } else {
    columns = LEGACY_COLUMNS.map((c) => ({ id: c.id, title: c.title, color: c.color }));
    demandsByColumn = (columnId: string) =>
      demands.filter((d) => d.status === columnId);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory sm:snap-none -mx-4 px-4 sm:mx-0 sm:px-0">
        {columns.map((col) => (
          <KanbanColumn
            key={col.id}
            column={col}
            demands={demandsByColumn(col.id)}
            onEditDemand={onEditDemand}
          />
        ))}
      </div>
    </DndContext>
  );
}
