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
import type { ContactFilters } from '@/hooks/useContacts';
import type { FiltroFavoritoContato } from '@/hooks/useFiltrosFavoritos';

interface FiltrosFavoritosBarProps {
  favoritos: FiltroFavoritoContato[];
  filtrosAtuais: ContactFilters;
  filtrosAtivosCount: number;
  onSalvar: (nome: string, filtros: ContactFilters) => void;
  onAplicar: (filtros: ContactFilters) => void;
  onRemover: (id: string) => void;
}

function descreverFiltros(f: ContactFilters): string {
  const partes: string[] = [];
  if (f.search) partes.push(`Busca: "${f.search}"`);
  if (f.tags && f.tags.length > 0) partes.push(`${f.tags.length} etiqueta(s)`);
  if (f.is_favorite) partes.push('Favoritos');
  if (f.declarou_voto === true) partes.push('Declarou voto: Sim');
  if (f.declarou_voto === false) partes.push('Declarou voto: Não');
  if (f.birthday_filter) partes.push('Aniversário');
  if (f.last_contact_filter) partes.push('Último contato');
  if (f.leader_id) partes.push('Liderança');
  if (f.date_from || f.date_to) partes.push('Período de criação');
  return partes.length > 0 ? partes.join(', ') : 'Sem filtros';
}

export function FiltrosFavoritosBar({
  favoritos,
  filtrosAtuais,
  filtrosAtivosCount,
  onSalvar,
  onAplicar,
  onRemover,
}: FiltrosFavoritosBarProps) {
  const [salvarOpen, setSalvarOpen] = useState(false);
  const [listaOpen, setListaOpen] = useState(false);
  const [nomeFiltro, setNomeFiltro] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleSalvar = () => {
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
  };

  const handleConfirmarDelete = () => {
    if (confirmDeleteId) {
      const fav = favoritos.find((f) => f.id === confirmDeleteId);
      onRemover(confirmDeleteId);
      setConfirmDeleteId(null);
      toast.success(`Filtro "${fav?.nome}" removido`);
    }
  };

  return (
    <>
      {filtrosAtivosCount > 0 && (
        <Popover open={salvarOpen} onOpenChange={setSalvarOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-9 text-amber-600 hover:text-amber-700 hover:border-amber-300"
            >
              <Star className="h-4 w-4 mr-1" />
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
            <Button variant="outline" size="sm" className="h-9">
              <Bookmark className="h-4 w-4 mr-1" />
              Favoritos
              <Badge className="bg-amber-100 text-amber-800 text-[10px] px-1.5 ml-1.5 border-0">
                {favoritos.length}
              </Badge>
              <ChevronDown className="h-3 w-3 ml-1 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-2" align="start">
            <p className="text-xs font-medium text-muted-foreground px-2 mb-1.5">
              Filtros salvos
            </p>
            <div className="max-h-64 overflow-y-auto space-y-0.5">
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
                  <Star className="h-3.5 w-3.5 text-amber-500 shrink-0 fill-amber-500" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{fav.nome}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {descreverFiltros(fav.filtros)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDeleteId(fav.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
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
