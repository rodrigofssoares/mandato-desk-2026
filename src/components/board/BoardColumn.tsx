import { useDroppable } from '@dnd-kit/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus } from 'lucide-react';
import { BoardCard } from './BoardCard';
import { stageBgClass, stageDotClass, stageTextClass } from '@/components/settings/stageColors';
import type { BoardStage } from '@/hooks/useBoardStages';
import type { BoardItemWithContact } from '@/hooks/useBoardItems';

interface BoardColumnProps {
  stage: BoardStage;
  items: BoardItemWithContact[];
  onCardClick: (item: BoardItemWithContact) => void;
  onCardRemove: (item: BoardItemWithContact) => void;
  onAddContact: () => void;
}

export function BoardColumn({
  stage,
  items,
  onCardClick,
  onCardRemove,
  onAddContact,
}: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-72 rounded-lg border flex flex-col ${stageBgClass(
        stage.cor,
      )} ${isOver ? 'ring-2 ring-primary/60' : ''}`}
    >
      <div className="p-3 border-b border-border/50 flex items-center gap-2">
        <span className={`w-2.5 h-2.5 rounded-full ${stageDotClass(stage.cor)}`} />
        <h3
          className={`font-semibold text-sm uppercase tracking-wide ${stageTextClass(stage.cor)}`}
        >
          {stage.nome}
        </h3>
        <Badge variant="secondary" className="ml-auto text-xs">
          {items.length}
        </Badge>
      </div>

      <ScrollArea className="flex-1 h-[calc(100vh-340px)] min-h-[300px]">
        <div className="p-2">
          {items.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-8">
              Nenhum contato neste estágio
            </p>
          ) : (
            items.map((item) => (
              <BoardCard
                key={item.id}
                item={item}
                onClick={() => onCardClick(item)}
                onRemove={() => onCardRemove(item)}
              />
            ))
          )}
        </div>
      </ScrollArea>

      <div className="p-2 border-t border-border/50">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-xs"
          onClick={onAddContact}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Adicionar contato
        </Button>
      </div>
    </div>
  );
}
