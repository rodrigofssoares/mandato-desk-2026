import { Pin, Archive, ArchiveRestore, BellOff, Bell, Clock, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPhone, isNonRealPhone } from '@/lib/zapi-format';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ZapiChat } from '@/hooks/useZapiChats';

// ─── SLA ─────────────────────────────────────────────────────────────────────

/** Limiar de SLA em minutos (30 min). Usado pelo T29. */
export const SLA_THRESHOLD_MINUTES = 30;

/** Estados que acionam o indicador de SLA. */
const SLA_ACTIVE_STATUSES: ReadonlySet<string> = new Set(['aberta', 'em_atendimento']);

/**
 * Calcula quantos minutos se passaram desde `last_message_at`.
 * Retorna null se a data for null/undefined.
 */
export function calcSlaMinutes(lastMessageAt: string | null | undefined): number | null {
  if (!lastMessageAt) return null;
  const diff = Date.now() - new Date(lastMessageAt).getTime();
  return Math.floor(diff / 60_000);
}

/** Formata duração em minutos para exibição amigável: "45min" ou "1h 20min". */
export function formatSlaDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

// ─── helpers locais ────────────────────────────────────────────────────────────

export const STATUS_LABELS: Record<string, string> = {
  aberta: 'Aberta',
  em_atendimento: 'Em atendimento',
  aguardando: 'Aguardando',
  finalizada: 'Finalizada',
};

export const STATUS_DOT_CLASS: Record<string, string> = {
  aberta: 'bg-gray-400',
  em_atendimento: 'bg-blue-500',
  aguardando: 'bg-amber-500',
  finalizada: 'bg-green-500',
};

function formatLastTime(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function initials(text: string): string {
  const cleaned = text.trim();
  if (!cleaned) return '?';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface ChatListItemProps {
  chat: ZapiChat;
  selected: boolean;
  onSelect: (chatId: string) => void;
  /** T24: callback para fixar/desafixar */
  onPin?: (chatId: string, pinned: boolean) => void;
  /** T25: callback para arquivar/desarquivar */
  onArchive?: (chatId: string, archived: boolean) => void;
  /** T26: callback para marcar como lida/não-lida */
  onToggleUnread?: (chatId: string, unread: boolean) => void;
  /**
   * T29: contador de ticks periódico vindo do pai (incrementado a cada 60s via
   * setInterval). Serve para forçar re-render e recalcular o SLA sem nova query.
   */
  slaTick?: number;
  /** T29: true quando a feature flag c28 está habilitada para a conta ativa. */
  slaEnabled?: boolean;
}

// ─── ChatListItem ─────────────────────────────────────────────────────────────

export function ChatListItem({
  chat,
  selected,
  onSelect,
  onPin,
  onArchive,
  onToggleUnread,
  slaTick: _slaTick,
  slaEnabled = false,
}: ChatListItemProps) {
  const display = chat.contact_name ?? chat.whatsapp_name ?? 'Contato sem nome';
  const initialsSource = chat.contact_name ?? chat.whatsapp_name;
  const showPhoneSubtitle = !!chat.contact_name && !isNonRealPhone(chat.phone);
  const hasUnread = (chat.unread_count ?? 0) > 0;
  const statusDot = STATUS_DOT_CLASS[chat.status] ?? STATUS_DOT_CLASS['aberta'];

  // T29: cálculo de SLA (client-side, recalculado a cada tick do pai)
  const slaMinutes = slaEnabled ? calcSlaMinutes(chat.last_message_at) : null;
  const slaBreached =
    slaEnabled &&
    slaMinutes !== null &&
    slaMinutes >= SLA_THRESHOLD_MINUTES &&
    SLA_ACTIVE_STATUSES.has(chat.status ?? '');

  return (
    <div
      className={cn(
        'w-full flex items-center gap-3 px-3 py-3 border-b border-border/50 text-left transition-colors group relative',
        selected ? 'bg-accent' : 'hover:bg-accent/50',
        // T29: borda âmbar à esquerda quando SLA estourado
        slaBreached && 'border-l-2 border-l-amber-500',
      )}
    >
      {/* Área clicável principal */}
      <button
        type="button"
        onClick={() => onSelect(chat.id)}
        className="flex items-center gap-3 flex-1 min-w-0 text-left"
      >
        {/* Avatar com dot de status */}
        <div className="relative shrink-0">
          <Avatar className="h-10 w-10">
            <AvatarFallback className="bg-primary/15 text-primary text-sm font-medium">
              {initialsSource ? initials(initialsSource) : <User className="h-4 w-4" />}
            </AvatarFallback>
          </Avatar>
          {/* T19: dot de status */}
          <span
            className={cn(
              'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background',
              statusDot,
            )}
            title={STATUS_LABELS[chat.status] ?? 'Aberta'}
          />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 min-w-0">
              {/* T24: ícone de pin */}
              {chat.pinned && (
                <Pin className="h-3 w-3 text-amber-500 shrink-0" />
              )}
              <p className="font-medium text-sm truncate">{display}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {/* T29: ícone de SLA estourado */}
              {slaBreached && slaMinutes !== null && (
                <span
                  title={`Sem resposta há ${formatSlaDuration(slaMinutes)}`}
                  aria-label={`SLA: sem resposta há ${formatSlaDuration(slaMinutes)}`}
                  className="shrink-0 flex items-center"
                >
                  <Clock className="h-3.5 w-3.5 text-amber-500" />
                </span>
              )}
              <span className="text-[11px] text-muted-foreground">
                {formatLastTime(chat.last_message_at)}
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <p className="text-xs text-muted-foreground truncate">
              {showPhoneSubtitle && (
                <span className="text-[11px] mr-1.5">{formatPhone(chat.phone)} ·</span>
              )}
              {chat.last_message_preview ?? <span className="italic">Sem mensagens</span>}
            </p>
            {hasUnread && (
              <Badge className="h-5 min-w-5 px-1.5 text-[10px] shrink-0">
                {chat.unread_count}
              </Badge>
            )}
          </div>
        </div>
      </button>

      {/* Menu de contexto — visível no hover */}
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            'absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded flex items-center justify-center',
            'text-muted-foreground hover:text-foreground hover:bg-accent/80',
            'opacity-0 group-hover:opacity-100 transition-opacity',
            'focus:opacity-100',
          )}
          aria-label="Ações da conversa"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-sm leading-none">⋮</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          {/* T24: Fixar/Desafixar */}
          {onPin && (
            <DropdownMenuItem
              onClick={(e) => { e.stopPropagation(); onPin(chat.id, !chat.pinned); }}
            >
              <Pin className="h-4 w-4 mr-2" />
              {chat.pinned ? 'Desafixar conversa' : 'Fixar conversa'}
            </DropdownMenuItem>
          )}

          {/* T26: Marcar como lida/não-lida */}
          {onToggleUnread && (
            <DropdownMenuItem
              onClick={(e) => { e.stopPropagation(); onToggleUnread(chat.id, !hasUnread); }}
            >
              {hasUnread ? (
                <><Bell className="h-4 w-4 mr-2" /> Marcar como lida</>
              ) : (
                <><BellOff className="h-4 w-4 mr-2" /> Marcar como não-lida</>
              )}
            </DropdownMenuItem>
          )}

          {(onPin || onToggleUnread) && onArchive && <DropdownMenuSeparator />}

          {/* T25: Arquivar/Desarquivar */}
          {onArchive && (
            <DropdownMenuItem
              onClick={(e) => { e.stopPropagation(); onArchive(chat.id, !chat.archived); }}
            >
              {chat.archived ? (
                <><ArchiveRestore className="h-4 w-4 mr-2" /> Desarquivar</>
              ) : (
                <><Archive className="h-4 w-4 mr-2" /> Arquivar conversa</>
              )}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
