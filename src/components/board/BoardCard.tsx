import { useDraggable } from '@dnd-kit/core';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertTriangle,
  Star,
  Phone,
  MoreVertical,
  Trash2,
  MessageCircle,
  GripVertical,
  ArrowRightLeft,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuPortal,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useTarefasPendentesCount } from '@/hooks/useTarefas';
import { usePermissions } from '@/hooks/usePermissions';
import type { BoardItemWithContact } from '@/hooks/useBoardItems';
import type { BoardStage } from '@/hooks/useBoardStages';
import { colorToHex } from '@/components/settings/stageColors';
import { cn } from '@/lib/utils';
import { getContactDisplayName } from '@/lib/contactDisplay';
import { formatPhoneDisplay } from '@/lib/normalization';

interface BoardCardProps {
  item: BoardItemWithContact;
  onClick: () => void;
  onRemove: () => void;
  /** Quando true, cards renderizam checkbox, ficam clicaveis p/ marcar e o drag e desligado. */
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  /** Todas as etapas do funil — alimenta o submenu "Mover para". */
  stages?: BoardStage[];
  /** Etapa atual do card (exclui do submenu de mover). */
  currentStageId?: string;
  /** Move o card para outra etapa via menu (caminho rapido, sem arrastar). */
  onMoveToStage?: (stageId: string) => void;
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
  stages,
  currentStageId,
  onMoveToStage,
}: BoardCardProps) {
  const navigate = useNavigate();
  const { can } = usePermissions();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: item.id,
    disabled: selectionMode,
  });

  const { data: pendentes = 0 } = useTarefasPendentesCount(item.contact?.id ?? null);

  const stale = daysSince(item.moved_at);
  const isStale = stale >= 5;
  // WhatsApp tem prioridade sobre telefone para o deep-link interno (mesma regra do ContactCard)
  const phone = item.contact?.whatsapp || item.contact?.telefone || null;
  const canConversar = !selectionMode && !!phone && can.accessWhatsapp();

  // Etapas de destino disponiveis no submenu "Mover para" (exclui a etapa atual).
  const moveTargets = (stages ?? []).filter((s) => s.id !== currentStageId);
  const canQuickMove = !selectionMode && !!onMoveToStage && moveTargets.length > 0;

  function handleConversar(e: React.MouseEvent) {
    e.stopPropagation();
    if (!phone) return;
    const normalized = phone.replace(/\D/g, '');
    navigate(`/integracoes/whatsapp?tab=conversas&chat=${normalized}`);
  }

  return (
    <Card
      ref={setNodeRef}
      className={cn(
        'mb-2 p-3 pr-10 transition-all relative',
        selectionMode ? 'cursor-pointer hover:border-primary/50' : 'hover:shadow-md',
        selected && 'ring-2 ring-primary/60 bg-primary/[0.03]',
        // Com DragOverlay, o card de origem so esmaece — o "fantasma" flutuante e quem segue o cursor.
        isDragging && 'opacity-40',
      )}
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
      <div className="flex items-start gap-2">
        {selectionMode ? (
          <div className="shrink-0 mt-0.5" onClick={(e) => e.stopPropagation()}>
            <Checkbox
              checked={!!selected}
              onCheckedChange={() => onToggleSelect?.()}
              aria-label={`Selecionar ${item.contact ? getContactDisplayName(item.contact) : 'contato'}`}
            />
          </div>
        ) : (
          // ALCA DE ARRASTE — so este ponto inicia o drag. Ativacao instantanea (sensor por
          // distancia, sem delay). touch-none impede o navegador de rolar ao segurar a alca.
          <button
            type="button"
            className="shrink-0 -ml-1 mt-0.5 self-stretch flex items-center px-0.5 rounded text-muted-foreground/40 hover:text-primary hover:bg-primary/5 cursor-grab active:cursor-grabbing touch-none transition-colors"
            aria-label="Arrastar para mover de etapa"
            onClick={(e) => e.stopPropagation()}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            {item.contact?.is_favorite && (
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500 shrink-0" />
            )}
            <p className="text-sm font-medium truncate min-w-0 flex-1">
              {item.contact ? getContactDisplayName(item.contact) : '(sem nome)'}
            </p>
          </div>

          {phone && (
            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 min-w-0">
              <Phone className="h-3 w-3 shrink-0" />
              <span className="truncate min-w-0">{formatPhoneDisplay(phone)}</span>
              {/* Botão Conversar logo após o número (lado esquerdo) — shrink-0
                  garante que nunca seja cortado pelo overflow-hidden da coluna. */}
              {canConversar && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 -my-1 ml-0.5 text-success hover:text-success"
                      aria-label="Conversar no WhatsApp"
                      onClick={handleConversar}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Conversar no WhatsApp</TooltipContent>
                </Tooltip>
              )}
            </div>
          )}
        </div>
      </div>

      {!selectionMode && (
        <div className="absolute top-2 right-2 z-10">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded p-1"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                aria-label="Mais acoes"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              {/* Caminho rapido: mover por clique, sem arrastar (ideal p/ muitos contatos) */}
              {canQuickMove && (
                <>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <ArrowRightLeft className="h-4 w-4 mr-2" />
                      Mover para
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent className="max-h-72 overflow-y-auto">
                        {moveTargets.map((s) => (
                          <DropdownMenuItem
                            key={s.id}
                            onSelect={(e) => {
                              e.preventDefault();
                              onMoveToStage?.(s.id);
                            }}
                          >
                            <span
                              className="w-2.5 h-2.5 rounded-full mr-2 shrink-0"
                              style={{ backgroundColor: colorToHex(s.cor) }}
                            />
                            <span className="truncate">{s.nome}</span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator />
                </>
              )}
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onSelect={(e) => {
                  e.preventDefault();
                  onRemove();
                }}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Remover do funil
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

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

/**
 * Versão visual (sem dnd nem queries) renderizada dentro do <DragOverlay> do Kanban.
 * É o "fantasma" que segue o cursor — renderizado em portal no nível do body, então
 * NÃO é cortado pelo overflow-hidden das colunas (causa-raiz da sensação de travar).
 */
export function BoardCardOverlay({ item }: { item: BoardItemWithContact }) {
  const phone = item.contact?.whatsapp || item.contact?.telefone || null;
  const stale = daysSince(item.moved_at);
  const isStale = stale >= 5;

  return (
    <Card className="w-[272px] p-3 pr-10 relative shadow-2xl ring-2 ring-primary/40 rotate-[-1.5deg] cursor-grabbing">
      <div className="flex items-start gap-2">
        <span className="shrink-0 -ml-1 mt-0.5 self-stretch flex items-center px-0.5 text-primary">
          <GripVertical className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            {item.contact?.is_favorite && (
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500 shrink-0" />
            )}
            <p className="text-sm font-medium truncate min-w-0 flex-1">
              {item.contact ? getContactDisplayName(item.contact) : '(sem nome)'}
            </p>
          </div>
          {phone && (
            <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 min-w-0">
              <Phone className="h-3 w-3 shrink-0" />
              <span className="truncate min-w-0">{formatPhoneDisplay(phone)}</span>
            </div>
          )}
        </div>
      </div>
      {isStale && (
        <div className="mt-2">
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 border-destructive text-destructive gap-1"
          >
            <AlertTriangle className="h-3 w-3" />
            {stale}d
          </Badge>
        </div>
      )}
    </Card>
  );
}
