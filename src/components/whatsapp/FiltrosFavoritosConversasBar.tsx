// ─── FiltrosFavoritosConversasBar (T52 — C14) ────────────────────────────────
// Barra de filtros favoritos para a lista de conversas.
// Clona o padrão de FiltrosFavoritosBar (contatos).

import { useState } from 'react';
import { Star, Bookmark, ChevronDown, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { FiltroFavoritoConversa, ConversaFilters } from '@/hooks/useFiltrosFavoritosConversas';

// ─── Props ────────────────────────────────────────────────────────────────────

interface FiltrosFavoritosConversasBarProps {
  favoritos: FiltroFavoritoConversa[];
  filtrosAtuais: ConversaFilters;
  filtrosAtivosCount: number;
  onSalvar: (nome: string, filtros: ConversaFilters) => void;
  onAplicar: (filtros: ConversaFilters) => void;
  onRemover: (id: string) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function descreverFiltros(f: ConversaFilters): string {
  const partes: string[] = [];
  if (f.status) {
    const labels: Record<string, string> = {
      aberta: 'Aberta',
      em_atendimento: 'Em atendimento',
      aguardando: 'Aguardando',
      finalizada: 'Finalizada',
    };
    partes.push(`Status: ${labels[f.status] ?? f.status}`);
  }
  if (f.onlyMine) partes.push('Só minhas');
  if (f.showArchived) partes.push('Arquivadas');
  if (f.showSnoozed) partes.push('Adiadas');
  return partes.length > 0 ? partes.join(', ') : 'Sem filtros';
}

// ─── Component ───────────────────────────────────────────────────────────────

export function FiltrosFavoritosConversasBar({
  favoritos,
  filtrosAtuais,
  filtrosAtivosCount,
  onSalvar,
  onAplicar,
  onRemover,
}: FiltrosFavoritosConversasBarProps) {
  const [salvarOpen, setSalvarOpen] = useState(false);
  const [listaOpen, setListaOpen] = useState(false);
  const [nomeFiltro, setNomeFiltro] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  function handleSalvar() {
    const nome = nomeFiltro.trim();
    if (!nome) {
      toast.error('Digite um nome para o filtro');
      return;
    }
    if (favoritos.some((f) => f.nome.toLowerCase() === nome.toLowerCase())) {
      toast.error('Já existe um filtro com este nome');
      return;
    }
    onSalvar(nome, filtrosAtuais);
    setNomeFiltro('');
    setSalvarOpen(false);
    toast.success(`Filtro "${nome}" salvo com sucesso!`);
  }

  function handleConfirmarDelete() {
    if (confirmDeleteId) {
      const fav = favoritos.find((f) => f.id === confirmDeleteId);
      onRemover(confirmDeleteId);
      setConfirmDeleteId(null);
      toast.success(`Filtro "${fav?.nome}" removido`);
    }
  }

  return (
    <>
      {filtrosAtivosCount > 0 && (
        <Popover open={salvarOpen} onOpenChange={setSalvarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-[10px] px-2 text-warning hover:text-warning hover:border-warning/50"
            >
              <Star className="h-3 w-3 mr-1" />
              Salvar filtro
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-3" align="start">
            <p className="text-sm font-medium mb-2">Salvar filtro favorito</p>
            <p className="text-xs text-muted-foreground mb-3">
              {descreverFiltros(filtrosAtuais)}
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="Nome do filtro..."
                value={nomeFiltro}
                onChange={(e) => setNomeFiltro(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSalvar()}
                className="h-8 text-sm"
                autoFocus
              />
              <Button size="sm" className="h-8 px-3 shrink-0" onClick={handleSalvar}>
                Salvar
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {favoritos.length > 0 && (
        <Popover open={listaOpen} onOpenChange={setListaOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-7 text-[10px] px-2">
              <Bookmark className="h-3 w-3 mr-1" />
              Visões
              <Badge className="bg-warning-soft text-warning-soft-foreground hover:bg-warning-soft text-[9px] px-1 ml-1 border-0">
                {favoritos.length}
              </Badge>
              <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-2" align="start">
            <p className="text-xs font-medium text-muted-foreground px-2 mb-1.5">
              Filtros salvos
            </p>
            <div className="max-h-56 overflow-y-auto space-y-0.5">
              {favoritos.map((fav) => (
                <div
                  key={fav.id}
                  className="flex items-center gap-2 rounded-md hover:bg-muted/80 px-2 py-1.5 group cursor-pointer"
                  onClick={() => {
                    onAplicar(fav.filtros);
                    setListaOpen(false);
                    toast.success(`Filtro "${fav.nome}" aplicado`);
                  }}
                >
                  <Star className="h-3 w-3 text-warning shrink-0 fill-warning" />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{fav.nome}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {descreverFiltros(fav.filtros)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 opacity-0 group-hover:opacity-100 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteId(fav.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}

      <Dialog
        open={!!confirmDeleteId}
        onOpenChange={(open) => !open && setConfirmDeleteId(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir filtro favorito</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir o filtro &quot;
              {favoritos.find((f) => f.id === confirmDeleteId)?.nome}&quot;?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setConfirmDeleteId(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" size="sm" onClick={handleConfirmarDelete}>
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
