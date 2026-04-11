import { useMemo, useState } from 'react';
import { Loader2, Plus, ClipboardList, FileQuestion } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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

import {
  useTarefas,
  useToggleTarefaConcluida,
  useDeleteTarefa,
  type Tarefa,
} from '@/hooks/useTarefas';
import { TarefaRow } from '@/components/tarefas/TarefaRow';
import { TarefaFormDialog } from '@/components/tarefas/TarefaFormDialog';

interface Props {
  /** ID do contato. Quando ausente (modo criação), o painel mostra um aviso. */
  contactId: string | null | undefined;
}

export function ContactTarefasPanel({ contactId }: Props) {
  const { data: tarefas = [], isLoading } = useTarefas(
    contactId ? { contact_id: contactId } : {},
  );
  const toggleConcluida = useToggleTarefaConcluida();
  const deleteTarefa = useDeleteTarefa();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Tarefa | null>(null);
  const [deleting, setDeleting] = useState<Tarefa | null>(null);
  const [subTab, setSubTab] = useState<'pendentes' | 'concluidas'>('pendentes');

  const { pendentes, concluidas } = useMemo(() => {
    const pendentes: Tarefa[] = [];
    const concluidas: Tarefa[] = [];
    for (const t of tarefas) {
      if (t.concluida) concluidas.push(t);
      else pendentes.push(t);
    }
    return { pendentes, concluidas };
  }, [tarefas]);

  const handleNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const handleEdit = (tarefa: Tarefa) => {
    setEditing(tarefa);
    setFormOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteTarefa.mutateAsync(deleting.id);
    } catch {
      // toast no hook
    } finally {
      setDeleting(null);
    }
  };

  // Empty state: contato ainda não salvo
  if (!contactId) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <FileQuestion className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="text-sm font-medium">Salve o contato primeiro</p>
        <p className="text-xs text-muted-foreground mt-1">
          As tarefas vinculadas ficam disponíveis após o contato ser criado.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md bg-orange-500/10 flex items-center justify-center">
            <ClipboardList className="h-3.5 w-3.5 text-orange-400" />
          </div>
          <span className="text-xs font-semibold text-muted-foreground">
            Tarefas ({tarefas.length})
          </span>
        </div>
        <Button type="button" size="sm" onClick={handleNew}>
          <Plus className="h-4 w-4 mr-1" />
          Nova tarefa
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs value={subTab} onValueChange={(v) => setSubTab(v as 'pendentes' | 'concluidas')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pendentes" className="gap-2">
              Pendentes
              {pendentes.length > 0 && (
                <Badge variant="secondary" className="h-5 min-w-5 px-1 text-[10px]">
                  {pendentes.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="concluidas" className="gap-2">
              Concluídas
              {concluidas.length > 0 && (
                <Badge variant="secondary" className="h-5 min-w-5 px-1 text-[10px]">
                  {concluidas.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pendentes" className="mt-3 space-y-2">
            {pendentes.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nenhuma tarefa pendente
              </div>
            ) : (
              pendentes.map((t) => (
                <TarefaRow
                  key={t.id}
                  tarefa={t}
                  selected={false}
                  onToggleSelect={() => {}}
                  onToggleConcluida={(tarefa) =>
                    toggleConcluida.mutate({ id: tarefa.id, concluida: !tarefa.concluida })
                  }
                  onEdit={handleEdit}
                  onDelete={setDeleting}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="concluidas" className="mt-3 space-y-2">
            {concluidas.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                Nenhuma tarefa concluída
              </div>
            ) : (
              concluidas.map((t) => (
                <TarefaRow
                  key={t.id}
                  tarefa={t}
                  selected={false}
                  onToggleSelect={() => {}}
                  onToggleConcluida={(tarefa) =>
                    toggleConcluida.mutate({ id: tarefa.id, concluida: !tarefa.concluida })
                  }
                  onEdit={handleEdit}
                  onDelete={setDeleting}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      )}

      <TarefaFormDialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) setEditing(null);
        }}
        tarefa={editing}
        defaultContactId={contactId}
      />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tarefa "{deleting?.titulo}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteTarefa.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteTarefa.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTarefa.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/**
 * Badge com contagem de tarefas pendentes para um contato — pensado para
 * aparecer no trigger da aba "Tarefas" dentro do ContactDialog.
 * Só deve ser renderizado quando `contactId` existir (contato já salvo).
 */
export function ContactTarefasPendenteBadge({ contactId }: { contactId: string }) {
  const { data: tarefas = [] } = useTarefas({ contact_id: contactId, concluida: false });
  if (tarefas.length === 0) return null;
  return (
    <Badge variant="secondary" className="h-4 min-w-4 px-1 text-[9px] ml-1">
      {tarefas.length}
    </Badge>
  );
}
