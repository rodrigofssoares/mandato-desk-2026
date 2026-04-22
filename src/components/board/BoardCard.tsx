import { useDraggable } from '@dnd-kit/core';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, Star, Phone, MoreVertical, Trash2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTarefasPendentesCount } from '@/hooks/useTarefas';
import type { BoardItemWithContact } from '@/hooks/useBoardItems';
import { cn } from '@/lib/utils';
import { getContactDisplayName } from '@/lib/contactDisplay';

interface BoardCardProps {
  item: BoardItemWithContact;
  onClick: () => void;
  onRemove: () => void;
  /** Quando true, cards renderizam checkbox, ficam clicaveis p/ marcar e o drag e desligado. */
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
}

function daysSince(iso: string): number {
  const then = new Date(iso).getTime();
  const now = Date.now();
  return Math.floor((now - then) / (1000 * 60 * 60 * 24));
}

export function BoardCard({
  item,
  onClick,
  onRemove,
  selectionMode,
  selected,
  onToggleSelect,
}: BoardCardProps) {
  const { attributes, listeners, setNodeRef, isDragging, transform } = useDraggable({
    id: item.id,
    disabled: selectionMode,
  });

  const { data: pendentes = 0 } = useTarefasPendentesCount(item.contact?.id ?? null);

  const stale = daysSince(item.moved_at);
  const isStale = stale >= 5;
  const phone = item.contact?.whatsapp || item.contact?.telefone || null;

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  // Em modo selecao: sem drag-listeners, click marca/desmarca, visual ring + bg
  const dragProps = selectionMode ? {} : { ...attributes, ...listeners };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        'mb-2 p-3 transition-all',
        selectionMode
          ? 'cursor-pointer hover:border-primary/50'
          : 'cursor-grab active:cursor-grabbing hover:shadow-md',
        selected && 'ring-2 ring-primary/60 bg-primary/[0.03]',
        isDragging && 'opacity-50 shadow-lg',
      )}
      {...dragProps}
      onClick={(e) => {
        if (isDragging) return;
        e.stopPropagation();
        if (selectionMode) {
          onToggleSelect?.();
          return;
        }
        onClick();
      }}
    >
      <div className="flex items-start justify-between gap-2">
        {selectionMode && (
          <div
            className="shrink-0 mt-0.5"
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={!!selected}
              onCheckedChange={() => onToggleSelect?.()}
              aria-label={`Selecionar ${item.contact ? getContactDisplayName(item.contact) : 'contato'}`}
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            {item.contact?.is_favorite && (
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500 shrink-0" />
            )}
            <p className="text-sm font-medium truncate">
              {item.contact ? getContactDisplayName(item.contact) : '(sem nome)'}
            </p>
          </div>

          {phone && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
              <Phone className="h-3 w-3 shrink-0" />
              <span className="truncate">{phone}</span>
            </p>
          )}
        </div>

        {!selectionMode && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground p-0.5 -mr-1"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={(e) => {
                  e.preventDefault();
                  onRemove();
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remover do board
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      <div className="flex items-center gap-2 mt-2 flex-wrap">
        {pendentes > 0 && (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            {pendentes} tarefa{pendentes > 1 ? 's' : ''}
          </Badge>
        )}
        {isStale && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 border-destructive text-destructive gap-1"
              >
                <AlertTriangle className="h-3 w-3" />
                {stale}d
              </Badge>
            </TooltipTrigger>
            <TooltipContent>Parado há {stale} dias neste estágio</TooltipContent>
          </Tooltip>
        )}
      </div>
    </Card>
  );
}
