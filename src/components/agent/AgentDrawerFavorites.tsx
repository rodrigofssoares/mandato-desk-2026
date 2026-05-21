import { useState, useMemo } from 'react';
import { Star, Copy, Pencil, Trash2, Check, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useAgentFavorites, FAVORITES_LIMIT } from '@/hooks/useAgentFavorites';
import { useUpdateFavoriteNote, useToggleFavorite } from '@/hooks/useAgentFavoritesMutation';
import type { AgentFavorite } from '@/hooks/useAgentFavorites';

// ============================================================================
// Helpers
// ============================================================================

function formatDate(iso: string): string {
  try {
    return format(new Date(iso), "dd/MM", { locale: ptBR });
  } catch {
    return '';
  }
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '…';
}

// ============================================================================
// Card de favorito
// ============================================================================

interface FavoriteCardProps {
  favorite: AgentFavorite;
}

function FavoriteCard({ favorite }: FavoriteCardProps) {
  const [isEditingNote, setIsEditingNote] = useState(false);
  const [noteValue, setNoteValue] = useState(favorite.note ?? '');
  const updateNote = useUpdateFavoriteNote();
  const toggleFav = useToggleFavorite();

  const displayText = truncate(favorite.message_content ?? '', 200);

  function handleCopy() {
    navigator.clipboard.writeText(favorite.message_content ?? '').then(() => {
      toast.success('Copiado para a área de transferência');
    }).catch(() => {
      toast.error('Falha ao copiar');
    });
  }

  function handleSaveNote() {
    updateNote.mutate({ favoriteId: favorite.id, note: noteValue });
    setIsEditingNote(false);
  }

  function handleRemove() {
    if (confirm('Remover dos favoritos?')) {
      toggleFav.mutate({ message_id: favorite.message_id, favorite_id: favorite.id });
    }
  }

  return (
    <div className="bg-background border border-border rounded-[12px] p-[14px_16px] mb-3">
      {/* Texto truncado */}
      <p className="text-[13px] leading-[1.55] text-foreground mb-1.5">{displayText}</p>

      {/* Nota */}
      {isEditingNote ? (
        <div className="mb-1.5">
          <textarea
            autoFocus
            value={noteValue}
            onChange={(e) => setNoteValue(e.target.value.slice(0, 200))}
            rows={2}
            className="w-full text-[12px] bg-background border border-border/70 rounded-md px-2.5 py-1.5 resize-none outline-none focus:border-primary/40"
            placeholder="Adicionar nota (max 200 chars)..."
          />
          <div className="flex gap-1 mt-1">
            <button
              onClick={handleSaveNote}
              disabled={updateNote.isPending}
              className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded text-primary hover:bg-primary/10 transition-colors"
            >
              <Check className="h-3 w-3" /> Salvar
            </button>
            <button
              onClick={() => { setIsEditingNote(false); setNoteValue(favorite.note ?? ''); }}
              className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="h-3 w-3" /> Cancelar
            </button>
          </div>
        </div>
      ) : favorite.note ? (
        <div
          className="text-[11.5px] italic text-muted-foreground border-l-2 border-accent/70 bg-accent/8 px-2.5 py-1.5 rounded-r-[5px] mb-1.5"
        >
          {favorite.note}
        </div>
      ) : null}

      {/* Meta */}
      <p className="text-[10.5px] text-muted-foreground mb-0">
        {formatDate(favorite.created_at)}
      </p>

      {/* Ações */}
      <div className="flex gap-1 mt-2 pt-2 border-t border-border">
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Copy className="h-3 w-3" />
          Copiar
        </button>
        <button
          onClick={() => setIsEditingNote(true)}
          className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Pencil className="h-3 w-3" />
          {favorite.note ? 'Editar nota' : 'Adicionar nota'}
        </button>
        <button
          onClick={handleRemove}
          disabled={toggleFav.isPending}
          className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md text-muted-foreground hover:bg-muted hover:text-destructive transition-colors ml-auto"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ============================================================================
// Drawer principal
// ============================================================================

interface AgentDrawerFavoritesProps {
  open: boolean;
  onClose: () => void;
}

export function AgentDrawerFavorites({ open, onClose }: AgentDrawerFavoritesProps) {
  const [search, setSearch] = useState('');
  const { data: favData } = useAgentFavorites();
  const count = favData?.count ?? 0;

  const filtered = useMemo(() => {
    const favorites = favData?.data ?? [];
    if (!search.trim()) return favorites;
    const q = search.toLowerCase();
    return favorites.filter(
      (f) =>
        f.message_content?.toLowerCase().includes(q) ||
        f.note?.toLowerCase().includes(q)
    );
  }, [favData, search]);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="right"
        className="flex flex-col p-0 w-[380px] max-w-[90vw] bg-card"
      >
        <SheetHeader className="px-5 py-5 border-b border-border flex-shrink-0">
          <SheetTitle className="flex items-center gap-2">
            <Star
              className="h-[18px] w-[18px]"
              fill="hsl(var(--accent))"
              color="hsl(var(--accent))"
            />
            <span
              className="text-[17px] font-semibold"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Favoritas
            </span>
            <span className="text-[13px] font-normal text-muted-foreground ml-1">
              {count} / {FAVORITES_LIMIT}
            </span>
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-[18px] py-4">
          {/* Busca */}
          <div className="mb-3">
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar nas favoritas..."
              aria-label="Buscar favoritas"
              className={cn(
                'w-full px-3.5 py-2 text-[13px] rounded-[10px]',
                'bg-background border border-border',
                'placeholder:text-muted-foreground',
                'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1'
              )}
            />
          </div>

          {/* Lista */}
          {filtered.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-10">
              {search ? 'Nenhum resultado encontrado.' : 'Você ainda não favoritou respostas.'}
            </div>
          )}

          {filtered.map((fav) => (
            <FavoriteCard key={fav.id} favorite={fav} />
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
