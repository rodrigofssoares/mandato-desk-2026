import { Loader2, KanbanSquare, Check } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useContactBoardMemberships } from '@/hooks/useContactBoardMemberships';
import { useMoveBoardItem } from '@/hooks/useBoardItems';
import { useBoardStages } from '@/hooks/useBoardStages';

interface ContactFunnelSectionProps {
  contactId: string;
}

const DEFAULT_STAGE_COLOR = '#6B7280';

function StageChip({ color, label }: { color: string | null; label: string }) {
  const cor = color ?? DEFAULT_STAGE_COLOR;
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0"
      style={{ background: `${cor}22`, color: cor }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: cor }} />
      {label}
    </span>
  );
}

interface BoardFunnelBlockProps {
  boardItemId: string;
  boardId: string;
  boardNome: string;
  stageId: string;
  stageNome: string;
  stageCor: string | null;
}

function BoardFunnelBlock({
  boardItemId,
  boardId,
  boardNome,
  stageId,
  stageNome,
  stageCor,
}: BoardFunnelBlockProps) {
  const { data: stages = [], isLoading: stagesLoading } = useBoardStages(boardId);
  const moveMutation = useMoveBoardItem();

  const handleMove = async (newStageId: string) => {
    if (newStageId === stageId) return;
    await moveMutation.mutateAsync({ itemId: boardItemId, newStageId });
  };

  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2.5 space-y-2">
      <div className="flex items-center gap-1.5">
        <KanbanSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-xs font-semibold truncate">{boardNome}</span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <StageChip color={stageCor} label={stageNome} />

        {stagesLoading || moveMutation.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : (
          stages.length > 1 && (
            <Select
              value={stageId}
              onValueChange={(v) => void handleMove(v)}
              disabled={moveMutation.isPending}
            >
              <SelectTrigger className="h-6 text-[11px] w-auto min-w-[120px] max-w-[180px]">
                <SelectValue placeholder="Mover para..." />
              </SelectTrigger>
              <SelectContent>
                {stages.map((s) => (
                  <SelectItem key={s.id} value={s.id} className="text-xs">
                    <span className="flex items-center gap-1.5">
                      {s.id === stageId && (
                        <Check className="h-3 w-3 text-primary shrink-0" />
                      )}
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ background: s.cor ?? DEFAULT_STAGE_COLOR }}
                      />
                      {s.nome}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )
        )}
      </div>
    </div>
  );
}

export function ContactFunnelSection({ contactId }: ContactFunnelSectionProps) {
  const { data: memberships = [], isLoading } = useContactBoardMemberships(contactId);

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
        Funil
      </p>

      {isLoading ? (
        <div className="flex items-center justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : memberships.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">Sem funil</p>
      ) : (
        <div className="space-y-2">
          {memberships.map((m) => (
            <BoardFunnelBlock
              key={m.boardItemId}
              boardItemId={m.boardItemId}
              boardId={m.boardId}
              boardNome={m.boardNome}
              stageId={m.stageId}
              stageNome={m.stageNome}
              stageCor={m.stageCor}
            />
          ))}
        </div>
      )}
    </div>
  );
}
