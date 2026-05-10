import { User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPhone } from '@/lib/zapi-format';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { ZapiChat } from '@/hooks/useZapiChats';

interface ChatListItemProps {
  chat: ZapiChat;
  selected: boolean;
  onSelect: (chatId: string) => void;
}

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

export function ChatListItem({ chat, selected, onSelect }: ChatListItemProps) {
  const display = chat.contact_name ?? formatPhone(chat.phone);
  const showSubtitle = !!chat.contact_name;
  const hasUnread = (chat.unread_count ?? 0) > 0;

  return (
    <button
      type="button"
      onClick={() => onSelect(chat.id)}
      className={cn(
        'w-full flex items-center gap-3 px-3 py-3 border-b border-border/50 text-left transition-colors',
        selected ? 'bg-accent' : 'hover:bg-accent/50',
      )}
    >
      <Avatar className="h-10 w-10 shrink-0">
        <AvatarFallback className="bg-primary/15 text-primary text-sm font-medium">
          {chat.contact_name ? initials(chat.contact_name) : <User className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="font-medium text-sm truncate">{display}</p>
          <span className="text-[11px] text-muted-foreground shrink-0">
            {formatLastTime(chat.last_message_at)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="text-xs text-muted-foreground truncate">
            {showSubtitle && (
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
  );
}
