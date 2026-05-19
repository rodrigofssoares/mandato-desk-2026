import { useRef, useState } from 'react';
import { X, Send, StickyNote, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useChatNotes } from '@/hooks/useChatNotes';
import { useUsers } from '@/hooks/useUsers';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  const h = Math.floor(diff / 3_600_000);
  const d = Math.floor(diff / 86_400_000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  if (h < 24) return `há ${h}h`;
  if (d < 7) return `há ${d}d`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/** Renderiza @palavra com destaque */
function renderCorpo(corpo: string) {
  const parts = corpo.split(/(@\S+)/g);
  return parts.map((part, i) =>
    part.startsWith('@')
      ? <strong key={i} className="text-primary font-semibold">{part}</strong>
      : <span key={i}>{part}</span>
  );
}

// ─── ChatNotesSection ─────────────────────────────────────────────────────────

interface ChatNotesSectionProps {
  chatId: string | null;
  /** uid do usuário logado — para mostrar botão de delete apenas nas próprias notas */
  currentUserId: string | null;
}

export function ChatNotesSection({ chatId, currentUserId }: ChatNotesSectionProps) {
  const { notesQuery, createNoteMutation, deleteNoteMutation } = useChatNotes(chatId);
  const { data: users = [] } = useUsers();
  const { user } = useAuth();
  const { can } = usePermissions();
  const isAdmin = can.editWhatsapp();

  const [corpo, setCorpo] = useState('');
  const [mencoes, setMencoes] = useState<string[]>([]);
  const [mentionSearch, setMentionSearch] = useState('');
  const [mentionOpen, setMentionOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeUsers = users.filter((u) => u.status_aprovacao === 'ATIVO');

  function handleCorpoChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setCorpo(val);

    // Detectar @ no final do texto para ativar autocomplete
    const match = val.match(/@(\w*)$/);
    if (match) {
      setMentionSearch(match[1].toLowerCase());
      setMentionOpen(true);
    } else {
      setMentionOpen(false);
      setMentionSearch('');
    }
  }

  function handleSelectMention(u: { id: string; nome: string }) {
    // Limite de 20 menções por nota — não adiciona além disso
    if (mencoes.length >= 20 && !mencoes.includes(u.id)) {
      toast.warning('Máximo de 20 menções por nota');
      return;
    }

    // Substitui o @parcial pelo @nome completo
    const updated = corpo.replace(/@(\w*)$/, `@${u.nome} `);
    setCorpo(updated);
    setMencoes((prev) => [...prev.filter((id) => id !== u.id), u.id]);
    setMentionOpen(false);
    setMentionSearch('');
    textareaRef.current?.focus();
  }

  function handlePublish() {
    if (!chatId || !corpo.trim() || !user?.id) return;
    createNoteMutation.mutate(
      { chat_id: chatId, corpo: corpo.trim(), mencoes: mencoes.length > 0 ? mencoes : null, autor_id: user.id },
      {
        onSuccess: () => {
          setCorpo('');
          setMencoes([]);
        },
      },
    );
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handlePublish();
    }
  }

  const filteredMentionUsers = mentionSearch
    ? activeUsers.filter((u) => u.nome.toLowerCase().includes(mentionSearch))
    : activeUsers.slice(0, 8);

  if (!chatId) return null;

  return (
    <div className="space-y-2">
      {/* Cabeçalho */}
      <div className="flex items-center gap-1.5">
        <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Notas internas
        </p>
      </div>
      <p className="text-[10px] text-muted-foreground italic">
        Apenas a equipe vê estas notas
      </p>

      {/* Lista de notas */}
      {notesQuery.isLoading ? (
        <p className="text-xs text-muted-foreground">Carregando notas...</p>
      ) : notesQuery.data && notesQuery.data.length > 0 ? (
        <ScrollArea className="max-h-48">
          <div className="space-y-2 pr-1">
            {notesQuery.data.map((note) => {
              const isOwn = note.autor_id === (currentUserId ?? user?.id);
              const canDelete = isOwn || isAdmin;
              return (
                <div key={note.id} className="group flex gap-2 text-xs">
                  <Avatar className="h-6 w-6 shrink-0 mt-0.5">
                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                      {note.autor?.nome ? initials(note.autor.nome) : '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-medium truncate">{note.autor?.nome ?? 'Desconhecido'}</span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatRelativeTime(note.created_at)}
                      </span>
                    </div>
                    <p className="text-muted-foreground leading-snug break-words">
                      {renderCorpo(note.corpo)}
                    </p>
                  </div>
                  {canDelete && (
                    <button
                      type="button"
                      aria-label="Excluir nota"
                      className={cn(
                        'h-5 w-5 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 transition-opacity',
                        'opacity-0 group-hover:opacity-100',
                      )}
                      onClick={() => deleteNoteMutation.mutate(note.id)}
                      disabled={deleteNoteMutation.isPending}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      ) : (
        <p className="text-xs text-muted-foreground italic">Sem notas ainda.</p>
      )}

      {/* Campo para nova nota */}
      <div className="space-y-1.5 relative">
        <Popover open={mentionOpen && filteredMentionUsers.length > 0} onOpenChange={setMentionOpen}>
          <PopoverTrigger asChild>
            <Textarea
              ref={textareaRef}
              value={corpo}
              onChange={handleCorpoChange}
              onKeyDown={handleKeyDown}
              placeholder="Escreva uma nota interna... (@ para mencionar, Ctrl+Enter para publicar)"
              rows={2}
              className="text-xs resize-none"
              disabled={createNoteMutation.isPending}
              maxLength={2000}
            />
          </PopoverTrigger>
          {mentionOpen && filteredMentionUsers.length > 0 && (
            <PopoverContent className="p-1 w-52" align="start" side="top">
              {filteredMentionUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-accent text-left"
                  onClick={() => handleSelectMention(u)}
                >
                  <Avatar className="h-5 w-5 shrink-0">
                    <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                      {initials(u.nome)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate">{u.nome}</span>
                </button>
              ))}
            </PopoverContent>
          )}
        </Popover>

        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs w-full"
          onClick={handlePublish}
          disabled={!corpo.trim() || createNoteMutation.isPending}
        >
          {createNoteMutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5 mr-1.5" />
          )}
          Publicar nota
        </Button>
      </div>
    </div>
  );
}
