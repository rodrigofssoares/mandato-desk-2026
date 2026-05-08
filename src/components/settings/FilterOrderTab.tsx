import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, RotateCcw, ListFilter, ShieldOff } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  useFilterOrder,
  FILTER_SEGMENT_LABELS,
  type FilterSegmentKey,
} from '@/hooks/useFilterOrder';

interface SortableRowProps {
  segmentKey: FilterSegmentKey;
  index: number;
  disabled: boolean;
}

function SortableRow({ segmentKey, index, disabled }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: segmentKey,
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        'flex items-center gap-3 rounded-md border bg-card px-3 py-2.5 transition-shadow',
        isDragging
          ? 'shadow-lg border-primary ring-1 ring-primary/30'
          : 'shadow-sm border-border',
      ].join(' ')}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        disabled={disabled}
        aria-label={`Reordenar ${FILTER_SEGMENT_LABELS[segmentKey]}`}
        className={[
          'p-1 rounded text-muted-foreground transition-colors',
          disabled
            ? 'cursor-not-allowed opacity-40'
            : 'hover:text-foreground hover:bg-muted cursor-grab active:cursor-grabbing',
        ].join(' ')}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <Badge variant="secondary" className="font-mono text-[10px] min-w-[28px] justify-center">
        {index + 1}
      </Badge>

      <span className="font-medium text-sm flex-1">
        {FILTER_SEGMENT_LABELS[segmentKey]}
      </span>
    </div>
  );
}

export function FilterOrderTab() {
  const { order, setOrder, resetOrder, canReorder, isLoading } = useFilterOrder();
  const [localOrder, setLocalOrder] = useState<FilterSegmentKey[]>(order);

  // Mantém localOrder sincronizado se ordem mudar externamente (outra aba)
  useEffect(() => {
    setLocalOrder(order);
  }, [order]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localOrder.indexOf(active.id as FilterSegmentKey);
    const newIndex = localOrder.indexOf(over.id as FilterSegmentKey);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(localOrder, oldIndex, newIndex);
    setLocalOrder(next);
    setOrder(next);
    toast.success('Ordem dos filtros atualizada', { duration: 1500 });
  }

  function handleReset() {
    resetOrder();
    toast.success('Ordem dos filtros restaurada ao padrão');
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Carregando permissões…
        </CardContent>
      </Card>
    );
  }

  if (!canReorder) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldOff className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Sem permissão</CardTitle>
          </div>
          <CardDescription>
            Seu cargo não tem permissão para reordenar os filtros. Peça a um administrador
            ou proprietário pra ajustar a permissão "Ordenação de Filtros" em
            Configurações → Permissões.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <ListFilter className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Ordenação dos Filtros</CardTitle>
              <CardDescription className="mt-1">
                Arraste os cards pela alça para definir a ordem em que aparecem no drawer
                de filtros da página de Contatos. A preferência é salva no seu navegador.
              </CardDescription>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Restaurar padrão
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={localOrder} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2 max-w-xl">
              {localOrder.map((key, idx) => (
                <SortableRow key={key} segmentKey={key} index={idx} disabled={!canReorder} />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        <p className="text-xs text-muted-foreground mt-4 max-w-xl">
          Dica: use <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Tab</kbd> para
          focar a alça e <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Espaço</kbd> +
          setas pra reordenar via teclado.
        </p>
      </CardContent>
    </Card>
  );
}
