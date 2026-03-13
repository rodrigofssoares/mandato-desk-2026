import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Calendar } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Demand } from '@/hooks/useDemands';

interface DemandCardProps {
  demand: Demand;
  onClick: () => void;
}

const priorityConfig = {
  low: { label: 'Baixa', className: 'bg-green-100 text-green-800 hover:bg-green-100' },
  medium: { label: 'Media', className: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100' },
  high: { label: 'Alta', className: 'bg-red-100 text-red-800 hover:bg-red-100' },
};

export function DemandCard({ demand, onClick }: DemandCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: demand.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const priority = priorityConfig[demand.priority];

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card
        className="cursor-pointer hover:shadow-md transition-shadow mb-2"
        onClick={onClick}
      >
        <CardContent className="p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <h4 className="font-semibold text-sm leading-tight line-clamp-2">
              {demand.title}
            </h4>
            <Badge variant="secondary" className={priority.className}>
              {priority.label}
            </Badge>
          </div>

          {demand.contact && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <User className="h-3 w-3" />
              <span className="truncate">{demand.contact.nome}</span>
            </div>
          )}

          {demand.responsible && (
            <div className="text-xs text-muted-foreground">
              Responsavel: {demand.responsible.nome}
            </div>
          )}

          {demand.demand_tags && demand.demand_tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {demand.demand_tags.map((dt) => (
                <Badge
                  key={dt.tag_id}
                  variant="outline"
                  className="text-[10px] px-1.5 py-0"
                  style={{
                    borderColor: dt.tags?.cor ?? '#6B7280',
                    color: dt.tags?.cor ?? '#6B7280',
                  }}
                >
                  {dt.tags?.nome}
                </Badge>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>
              {formatDistanceToNow(new Date(demand.created_at), {
                addSuffix: true,
                locale: ptBR,
              })}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
