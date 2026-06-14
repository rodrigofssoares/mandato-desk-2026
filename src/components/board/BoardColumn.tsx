import { useDroppable } from '@dnd-kit/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, ShieldCheck } from 'lucide-react';
import { BoardCard } from './BoardCard';
import { StageChecklistTrigger } from './StageChecklistTrigger';
import { colorToHex } from '@/components/settings/stageColors';
import type { BoardStage } from '@/hooks/useBoardStages';
import type { BoardItemWithContact } from '@/hooks/useBoardItems';

interface BoardColumnProps {
  stage: BoardStage;
  items: BoardItemWithContact[];
  onCardClick: (item: BoardItemWithContact) => void;
  onCardRemove: (item: BoardItemWithContact) => void;
  onAddContact: () => void;
  selectionMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (item: BoardItemWithContact) => void;
  /** Quando true, a etapa está protegida pelo filtro — exibe badge amarelo no header */
  isProtected?: boolean;
  /** Todas as etapas do funil — alimenta o submenu "Mover para" dos cards. */
  stages?: BoardStage[];
  /** Move um item para outra etapa via menu (caminho rápido, sem arrastar). */
  onMoveItem?: (item: BoardItemWithContact, stageId: string) => void;
}

export function BoardColumn({
  stage,
  items,
  onCardClick,
  onCardRemove,
  onAddContact,
  selectionMode,
  selectedIds,
  onToggleSelect,
  isProtected = false,
  stages,
  onMoveItem,
}: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  // Cor do stage suporta hex livre OU nome legacy. Convertemos pra hex e
  // aplicamos via inline style com opacidade — funciona universalmente.
  const corHex = colorToHex(stage.cor);

  return (
    <div
      ref={setNodeRef}
      className={`flex-shrink-0 w-72 max-w-72 overflow-hidden rounded-lg border flex flex-col ${
        isOver ? 'ring-2 ring-primary/60' : ''
      }`}
      style={{
        backgroundColor: `${corHex}14`, // ~8% alpha
        borderColor: `${corHex}30`,
      }}
    >
      <div className="p-3 border-b border-border/50 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: corHex }} />
        <h3 className="font-semibold text-sm uppercase tracking-wide" style={{ color: corHex }}>
          {stage.nome}
        </h3>
        {/* Badge "protegida" — exibido quando a etapa está antes do ponto de início do filtro */}
        {isProtected && (
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0.5 text-amber-700 border-amber-300 bg-amber-50 inline-flex items-center gap-1 whitespace-nowrap"
          >
            <ShieldCheck className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
            protegida
          </Badge>
        )}
        <Badge variant="secondary" className="ml-auto text-xs">
          {items.length}
        </Badge>
        <StageChecklistTrigger stage={stage} />
      </div>

      {/*
        O viewport do Radix ScrollArea envolve os filhos num <div style="display:table;min-width:100%">.
        Com display:table esse wrapper CRESCE pra caber nomes longos (white-space:nowrap do truncate),
        empurrando os cards alem da largura da coluna e quebrando o truncate. Forcamos esse wrapper
        interno a display:block (so neste ScrollArea vertical) pra que os cards respeitem a largura
        fixa da coluna e os nomes truncem com reticencias. Nao afeta o scroll horizontal do Kanban.
      */}
      <ScrollArea className="flex-1 h-[calc(100vh-340px)] min-h-[300px] [&_[data-radix-scroll-area-viewport]>div]:!block">
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
                selectionMode={selectionMode}
                selected={selectedIds?.has(item.id)}
                onToggleSelect={onToggleSelect ? () => onToggleSelect(item) : undefined}
                stages={stages}
                currentStageId={stage.id}
                onMoveToStage={onMoveItem ? (stageId) => onMoveItem(item, stageId) : undefined}
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
