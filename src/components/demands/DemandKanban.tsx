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
import { DemandCard } from './DemandCard';
import { useUpdateDemand } from '@/hooks/useDemands';
import type { Demand } from '@/hooks/useDemands';

interface DemandKanbanProps {
  demands: Demand[];
  onEditDemand: (demand: Demand) => void;
}

type ColumnStatus = 'open' | 'in_progress' | 'resolved';

interface ColumnConfig {
  status: ColumnStatus;
  title: string;
  color: string;
  bgColor: string;
}

const columns: ColumnConfig[] = [
  { status: 'open', title: 'Aberta', color: 'bg-yellow-500', bgColor: 'bg-yellow-50' },
  { status: 'in_progress', title: 'Em Andamento', color: 'bg-blue-500', bgColor: 'bg-blue-50' },
  { status: 'resolved', title: 'Resolvida', color: 'bg-green-500', bgColor: 'bg-green-50' },
];

function KanbanColumn({
  config,
  demands,
  onEditDemand,
}: {
  config: ColumnConfig;
  demands: Demand[];
  onEditDemand: (demand: Demand) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: config.status });

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 min-w-[260px] snap-start rounded-lg border ${
        isOver ? 'ring-2 ring-primary/50' : ''
      } ${config.bgColor}`}
    >
      <div className="p-3 border-b flex items-center gap-2">
        <div className={`w-3 h-3 rounded-full ${config.color}`} />
        <h3 className="font-semibold text-sm">{config.title}</h3>
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
      const targetStatus = over.id as ColumnStatus;

      // Check if dropped on a column (not just reordering within same column)
      const validStatuses: ColumnStatus[] = ['open', 'in_progress', 'resolved'];
      if (!validStatuses.includes(targetStatus)) return;

      const demand = demands.find((d) => d.id === demandId);
      if (!demand || demand.status === targetStatus) return;

      updateDemand.mutate({ id: demandId, status: targetStatus });
    },
    [demands, updateDemand]
  );

  const demandsByStatus = (status: ColumnStatus) =>
    demands.filter((d) => d.status === status);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory sm:snap-none -mx-4 px-4 sm:mx-0 sm:px-0">
        {columns.map((col) => (
          <KanbanColumn
            key={col.status}
            config={col}
            demands={demandsByStatus(col.status)}
            onEditDemand={onEditDemand}
          />
        ))}
      </div>
    </DndContext>
  );
}
