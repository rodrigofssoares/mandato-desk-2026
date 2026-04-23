import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ExternalLink,
  ArrowRightLeft,
  Trash2,
  Loader2,
  KanbanSquare,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import {
  useContactBoardMemberships,
  type ContactBoardMembership,
} from '@/hooks/useContactBoardMemberships';
import { useMoveBoardItem, useRemoveBoardItem } from '@/hooks/useBoardItems';
import { useBoardStages } from '@/hooks/useBoardStages';

interface ContactBoardsPanelProps {
  contactId: string | undefined;
}

const DEFAULT_STAGE_COLOR = '#6B7280';

function formatEntry(iso: string) {
  const d = new Date(iso);
  return {
    absolute: format(d, "dd 'de' MMM 'de' yyyy", { locale: ptBR }),
    relative: formatDistanceToNow(d, { addSuffix: true, locale: ptBR }),
  };
}

function sameSecond(a: string, b: string) {
  return a.slice(0, 19) === b.slice(0, 19);
}

function StageMoverPopover({
  membership,
  onMoved,
}: {
  membership: ContactBoardMembership;
  onMoved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { data: stages = [], isLoading } = useBoardStages(open ? membership.boardId : null);
  const moveMutation = useMoveBoardItem();

  const handlePick = async (stageId: string) => {
    if (stageId === membership.stageId) {
      setOpen(false);
      return;
    }
    await moveMutation.mutateAsync({
      itemId: membership.boardItemId,
      newStageId: stageId,
    });
    setOpen(false);
    onMoved();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Mover de etapa"
          disabled={moveMutation.isPending}
        >
          {moveMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowRightLeft className="h-4 w-4" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-1">
        <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
          Mover para outra etapa
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : stages.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            Nenhuma etapa disponível.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {stages.map((s) => {
              const isCurrent = s.id === membership.stageId;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => handlePick(s.id)}
                    disabled={isCurrent}
                    className={cn(
                      'w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-left',
                      isCurrent
                        ? 'bg-primary/10 text-primary font-semibold cursor-default'
                        : 'hover:bg-muted',
                    )}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ background: s.cor ?? DEFAULT_STAGE_COLOR }}
                    />
                    <span className="flex-1 truncate">{s.nome}</span>
                    {isCurrent && <Check className="h-3.5 w-3.5" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

function MembershipCard({
  membership,
  onOpen,
  onRemove,
}: {
  membership: ContactBoardMembership;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const cor = membership.stageCor ?? DEFAULT_STAGE_COLOR;
  const progressPct = Math.max(
    8,
    Math.round((membership.stageOrdem / Math.max(membership.totalStages, 1)) * 100),
  );

  const entered = formatEntry(membership.createdAt);
  const moved = formatEntry(membership.movedAt);
  const neverMoved = sameSecond(membership.createdAt, membership.movedAt);

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div
        className="h-1.5 w-full"
        style={{
          background: `linear-gradient(to right, ${cor} 0%, ${cor} ${progressPct}%, hsl(var(--muted)) ${progressPct}%)`,
        }}
      />
      <div className="px-4 py-3 flex items-start gap-3">
        <div
          className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `${cor}1F` }}
        >
          <KanbanSquare className="h-4 w-4" style={{ color: cor }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm truncate">{membership.boardNome}</p>
            <span
              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold"
              style={{
                background: `${cor}22`,
                color: cor,
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: cor }} />
              {membership.stageNome}
            </span>
            <span className="text-[11px] text-muted-foreground">
              Etapa {membership.stageOrdem} de {membership.totalStages}
            </span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground space-y-0.5">
            <p>
              Entrou em{' '}
              <span className="text-foreground font-medium">{entered.absolute}</span>
              <span className="text-muted-foreground"> · {entered.relative}</span>
            </p>
            {!neverMoved && (
              <p>
                Última movimentação em{' '}
                <span className="text-foreground font-medium">{moved.absolute}</span>
                <span className="text-muted-foreground"> · {moved.relative}</span>
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <StageMoverPopover membership={membership} onMoved={() => undefined} />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Abrir funil"
            onClick={onOpen}
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            title="Remover deste funil"
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ContactBoardsPanel({ contactId }: ContactBoardsPanelProps) {
  const navigate = useNavigate();
  const { data: memberships = [], isLoading } = useContactBoardMemberships(contactId);
  const removeMutation = useRemoveBoardItem();
  const [removeTarget, setRemoveTarget] = useState<ContactBoardMembership | null>(null);

  if (!contactId) {
    return (
      <div className="rounded-lg border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
        Salve o contato para visualizar os funis em que ele participa.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleRemove = async () => {
    if (!removeTarget) return;
    try {
      await removeMutation.mutateAsync(removeTarget.boardItemId);
    } finally {
      setRemoveTarget(null);
    }
  };

  return (
    <div className="space-y-3">
      {memberships.length === 0 ? (
        <div className="rounded-lg border border-dashed py-10 text-center">
          <KanbanSquare className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
          <p className="text-sm font-medium">Este contato não está em nenhum funil</p>
          <p className="text-xs text-muted-foreground mt-1">
            Adicione-o em um funil pela página de Funis ou via movimentação em massa.
          </p>
        </div>
      ) : (
        memberships.map((m) => (
          <MembershipCard
            key={m.boardItemId}
            membership={m}
            onOpen={() => navigate(`/board?board=${m.boardId}`)}
            onRemove={() => setRemoveTarget(m)}
          />
        ))
      )}

      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remover do funil "{removeTarget?.boardNome}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              O contato continua existindo — apenas o vínculo com este funil é removido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              disabled={removeMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeMutation.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
