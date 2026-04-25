import { useState } from 'react';
import { ListChecks } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useStageHasChecklist } from '@/hooks/useStageChecklist';
import { StageChecklistViewerDialog } from './StageChecklistViewerDialog';
import type { BoardStage } from '@/hooks/useBoardStages';
import { cn } from '@/lib/utils';

interface Props {
  stage: BoardStage;
  className?: string;
}

/**
 * Ícone de checklist na header da coluna do Kanban. Sempre visível (para
 * descoberta), mas com indicador visual quando há conteúdo configurado.
 * Clicar abre o popup com o passo a passo orientativo.
 */
export function StageChecklistTrigger({ stage, className }: Props) {
  const [open, setOpen] = useState(false);
  const { data: hasContent = false } = useStageHasChecklist(stage.id);

  return (
    <>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label={`Ver checklist da etapa ${stage.nome}`}
              className={cn(
                'relative inline-flex items-center justify-center w-6 h-6 rounded-md transition-colors',
                'text-muted-foreground hover:text-foreground hover:bg-background/60',
                className,
              )}
            >
              <ListChecks className="h-4 w-4" />
              {hasContent && (
                <span
                  aria-hidden
                  className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-primary ring-2 ring-background"
                />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" sideOffset={4}>
            {hasContent ? 'Ver checklist da etapa' : 'Sem checklist configurado'}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <StageChecklistViewerDialog open={open} onOpenChange={setOpen} stage={stage} />
    </>
  );
}
