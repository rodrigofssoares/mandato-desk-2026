import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
import { Check, Clock, Trash2, X, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import {
  useBulkConcluirTarefas,
  useBulkAdiarTarefas,
  useBulkDeleteTarefas,
} from '@/hooks/useTarefas';

interface Props {
  selectedIds: string[];
  onClear: () => void;
}

export function TarefasBulkToolbar({ selectedIds, onClear }: Props) {
  const concluir = useBulkConcluirTarefas();
  const adiar = useBulkAdiarTarefas();
  const excluir = useBulkDeleteTarefas();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [adiarOpen, setAdiarOpen] = useState(false);
  const [novaData, setNovaData] = useState(format(new Date(), "yyyy-MM-dd'T'HH:mm"));

  const isPending = concluir.isPending || adiar.isPending || excluir.isPending;
  const count = selectedIds.length;

  if (count === 0) return null;

  const handleConcluir = async () => {
    await concluir.mutateAsync(selectedIds);
    onClear();
  };

  const handleAdiar = async () => {
    const iso = new Date(novaData).toISOString();
    await adiar.mutateAsync({ ids: selectedIds, novaData: iso });
    setAdiarOpen(false);
    onClear();
  };

  const handleDelete = async () => {
    await excluir.mutateAsync(selectedIds);
    setConfirmDelete(false);
    onClear();
  };

  return (
    <>
      <div className="sticky bottom-4 z-20 mx-auto flex items-center gap-2 rounded-full border bg-background/95 px-4 py-2 shadow-lg backdrop-blur w-fit">
        <span className="text-sm font-medium">
          {count} {count === 1 ? 'selecionada' : 'selecionadas'}
        </span>
        <span className="h-4 w-px bg-border" />
        <Button size="sm" variant="ghost" onClick={handleConcluir} disabled={isPending}>
          <Check className="h-4 w-4 mr-1.5" />
          Concluir
        </Button>

        <Popover open={adiarOpen} onOpenChange={setAdiarOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="ghost" disabled={isPending}>
              <Clock className="h-4 w-4 mr-1.5" />
              Adiar
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 space-y-3">
            <p className="text-sm font-medium">Nova data e hora</p>
            <Input
              type="datetime-local"
              value={novaData}
              onChange={(e) => setNovaData(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setAdiarOpen(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleAdiar} disabled={adiar.isPending}>
                {adiar.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                Adiar
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:text-destructive"
          onClick={() => setConfirmDelete(true)}
          disabled={isPending}
        >
          <Trash2 className="h-4 w-4 mr-1.5" />
          Excluir
        </Button>

        <span className="h-4 w-px bg-border" />
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClear} disabled={isPending}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {count} tarefa(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. As tarefas selecionadas serão removidas
              permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluir.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={excluir.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {excluir.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
