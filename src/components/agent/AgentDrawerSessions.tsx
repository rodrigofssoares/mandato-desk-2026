import { useState } from 'react';
import { Bot, Plus, Pencil, Trash2, Check, X } from 'lucide-react';
import { formatDistanceToNow, differenceInDays, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useAgentSessions, useDeleteAgentSession, useRenameAgentSession } from '@/hooks/useAgentSessions';
import type { AgentSession } from '@/hooks/useAgentSessions';

// ============================================================================
// Helpers de agrupamento
// ============================================================================

type GroupKey = 'hoje' | 'ontem' | 'semana' | 'antigas';

const GROUP_LABELS: Record<GroupKey, string> = {
  hoje: 'Hoje',
  ontem: 'Ontem',
  semana: 'Semana passada',
  antigas: 'Mais antigas',
};

function classifySession(session: AgentSession): GroupKey {
  const ref = session.last_message_at ?? session.created_at;
  const date = new Date(ref);
  if (isToday(date)) return 'hoje';
  if (isYesterday(date)) return 'ontem';
  if (differenceInDays(new Date(), date) <= 7) return 'semana';
  return 'antigas';
}

function relativeTime(session: AgentSession): string {
  const ref = session.last_message_at ?? session.created_at;
  try {
    return formatDistanceToNow(new Date(ref), { addSuffix: true, locale: ptBR });
  } catch {
    return '';
  }
}

function groupSessions(sessions: AgentSession[]): Partial<Record<GroupKey, AgentSession[]>> {
  const groups: Partial<Record<GroupKey, AgentSession[]>> = {};
  for (const s of sessions) {
    const key = classifySession(s);
    if (!groups[key]) groups[key] = [];
    groups[key]!.push(s);
  }
  return groups;
}

const GROUP_ORDER: GroupKey[] = ['hoje', 'ontem', 'semana', 'antigas'];

// ============================================================================
// Item de sessão
// ============================================================================

interface SessionItemProps {
  session: AgentSession;
  isActive: boolean;
  onSelect: () => void;
  onDeleted: (id: string) => void;
}

function SessionItem({ session, isActive, onSelect, onDeleted }: SessionItemProps) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(session.title ?? '');
  const deleteSession = useDeleteAgentSession();
  const renameSession = useRenameAgentSession();

  const title = session.title ?? 'Nova conversa';
  const meta = relativeTime(session);

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    if (confirm('Excluir esta conversa? Esta ação não pode ser desfeita.')) {
      deleteSession.mutate(session.id, {
        onSuccess: () => onDeleted(session.id),
      });
    }
  }

  function handleRenameStart(e: React.MouseEvent) {
    e.stopPropagation();
    setRenameValue(session.title ?? '');
    setIsRenaming(true);
  }

  function handleRenameConfirm(e: React.MouseEvent) {
    e.stopPropagation();
    renameSession.mutate({ sessionId: session.id, title: renameValue });
    setIsRenaming(false);
  }

  function handleRenameCancel(e: React.MouseEvent) {
    e.stopPropagation();
    setIsRenaming(false);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
      className={cn(
        'group relative flex items-start gap-2.5 p-[12px_14px] rounded-[10px] cursor-pointer transition-colors duration-150 mb-[2px]',
        isActive
          ? 'bg-primary/8 border-l-[3px] border-l-primary pl-[11px]'
          : 'hover:bg-muted'
      )}
    >
      {/* Ícone */}
      <div
        className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg"
        style={{ background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))' }}
      >
        <Bot className="h-[13px] w-[13px]" />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        {isRenaming ? (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value.slice(0, 60))}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameConfirm(e as unknown as React.MouseEvent);
                if (e.key === 'Escape') handleRenameCancel(e as unknown as React.MouseEvent);
              }}
              className="flex-1 text-[13px] bg-background border border-border rounded px-2 py-0.5 outline-none focus:border-primary/50"
            />
            <button onClick={handleRenameConfirm} className="p-0.5 text-primary hover:opacity-80">
              <Check className="h-3.5 w-3.5" />
            </button>
            <button onClick={handleRenameCancel} className="p-0.5 text-muted-foreground hover:opacity-80">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <>
            <div className="text-[13px] font-medium truncate mb-[2px]">{title}</div>
            <div className="text-[11px] text-muted-foreground">{meta}</div>
          </>
        )}
      </div>

      {/* Botões de ação (aparecem no hover) */}
      {!isRenaming && (
        <div className="hidden group-hover:flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={handleRenameStart}
            aria-label="Renomear conversa"
            className="p-1.5 rounded-md text-muted-foreground hover:bg-background hover:text-foreground transition-colors"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            onClick={handleDelete}
            aria-label="Excluir conversa"
            disabled={deleteSession.isPending}
            className="p-1.5 rounded-md text-muted-foreground hover:bg-background hover:text-destructive transition-colors"
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Drawer principal
// ============================================================================

interface AgentDrawerSessionsProps {
  open: boolean;
  onClose: () => void;
  currentSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
}

export function AgentDrawerSessions({
  open,
  onClose,
  currentSessionId,
  onSelectSession,
  onNewSession,
}: AgentDrawerSessionsProps) {
  const { data: sessions = [], isLoading } = useAgentSessions();
  const grouped = groupSessions(sessions);

  function handleSelect(id: string) {
    onSelectSession(id);
    onClose();
  }

  function handleNew() {
    onNewSession();
    onClose();
  }

  function handleDeleted(deletedId: string) {
    if (currentSessionId === deletedId) {
      onSelectSession('');
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="left"
        className="flex flex-col p-0 w-[380px] max-w-[90vw] bg-card"
      >
        <SheetHeader className="px-5 py-5 border-b border-border flex-shrink-0">
          <SheetTitle
            className="text-[17px] font-semibold"
            style={{ fontFamily: "'Space Grotesk', sans-serif" }}
          >
            Histórico
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-[18px] py-4 scrollbar-thin">
          {/* Botão nova conversa */}
          <button
            onClick={handleNew}
            className="w-full flex items-center justify-center gap-2 px-[14px] py-[10px] mb-2 rounded-[11px] text-[13.5px] font-medium text-primary-foreground bg-primary hover:opacity-90 transition-opacity cursor-pointer"
          >
            <Plus className="h-[15px] w-[15px]" />
            Nova conversa
          </button>

          {isLoading && (
            <div className="text-center text-sm text-muted-foreground py-8">
              Carregando...
            </div>
          )}

          {!isLoading && sessions.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">
              Nenhuma conversa ainda.
            </div>
          )}

          {GROUP_ORDER.map((key) => {
            const group = grouped[key];
            if (!group?.length) return null;
            return (
              <div key={key}>
                <div
                  className="px-2 pt-4 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground"
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  {GROUP_LABELS[key]}
                </div>
                {group.map((session) => (
                  <SessionItem
                    key={session.id}
                    session={session}
                    isActive={session.id === currentSessionId}
                    onSelect={() => handleSelect(session.id)}
                    onDeleted={handleDeleted}
                  />
                ))}
              </div>
            );
          })}
        </div>

        {/* Rodapé */}
        <div className="flex-shrink-0 px-5 py-4 border-t border-border bg-background text-[11px] text-muted-foreground text-center">
          Conversas mais antigas que <strong>30 dias</strong> são apagadas automaticamente.
        </div>
      </SheetContent>
    </Sheet>
  );
}
