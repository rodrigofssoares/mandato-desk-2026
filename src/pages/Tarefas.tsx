import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { setHours, setMinutes, setSeconds, setMilliseconds } from 'date-fns';
import { Button } from '@/components/ui/button';
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
import { Plus, Loader2, ClipboardList, List, Calendar as CalendarIcon } from 'lucide-react';

import {
  useTarefas,
  useToggleTarefaConcluida,
  useDeleteTarefa,
  type Tarefa,
  type TarefaFilters,
} from '@/hooks/useTarefas';
import { useContacts } from '@/hooks/useContacts';
import { useLeaders } from '@/hooks/useLeaders';
import { useDemands } from '@/hooks/useDemands';
import { agruparTarefasPorDia } from '@/lib/tarefas/agruparPorDia';

import { TarefasFilters } from '@/components/tarefas/TarefasFilters';
import { TarefasList } from '@/components/tarefas/TarefasList';
import { TarefasBulkToolbar } from '@/components/tarefas/TarefasBulkToolbar';
import { TarefaFormDialog } from '@/components/tarefas/TarefaFormDialog';
import { TarefasCalendar } from '@/components/tarefas/TarefasCalendar';

export default function Tarefas() {
  const [searchParams, setSearchParams] = useSearchParams();
  const view: 'list' | 'calendar' =
    searchParams.get('view') === 'calendar' ? 'calendar' : 'list';

  const setView = (v: 'list' | 'calendar') => {
    const next = new URLSearchParams(searchParams);
    if (v === 'calendar') next.set('view', 'calendar');
    else next.delete('view');
    setSearchParams(next, { replace: true });
  };

  const [filters, setFilters] = useState<TarefaFilters>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Tarefa | null>(null);
  const [deleting, setDeleting] = useState<Tarefa | null>(null);
  const [createDefaultDate, setCreateDefaultDate] = useState<Date | null>(null);

  const { data: tarefas = [], isLoading } = useTarefas(filters);
  const toggleConcluida = useToggleTarefaConcluida();
  const deleteTarefa = useDeleteTarefa();

  // Hooks pra resolver labels de vínculo (sem N+1: pega todos uma vez e indexa)
  const { data: contactsData } = useContacts({ per_page: 500 });
  const { data: leaders = [] } = useLeaders();
  const { data: demandas = [] } = useDemands();

  const vinculoLabelById = useMemo(() => {
    const map: Record<string, string> = {};
    const contactsById = new Map((contactsData?.data ?? []).map((c) => [c.id, c.nome]));
    const leadersById = new Map(leaders.map((l) => [l.id, l.nome]));
    const demandasById = new Map(demandas.map((d) => [d.id, d.title]));
    for (const t of tarefas) {
      if (t.contact_id && contactsById.has(t.contact_id)) {
        map[t.id] = contactsById.get(t.contact_id)!;
      } else if (t.leader_id && leadersById.has(t.leader_id)) {
        map[t.id] = `${leadersById.get(t.leader_id)} (articulador)`;
      } else if (t.demand_id && demandasById.has(t.demand_id)) {
        map[t.id] = `${demandasById.get(t.demand_id)} (demanda)`;
      }
    }
    return map;
  }, [tarefas, contactsData, leaders, demandas]);

  const grupos = useMemo(() => agruparTarefasPorDia(tarefas), [tarefas]);

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleClearSelection = () => setSelectedIds(new Set());

  const handleEdit = (tarefa: Tarefa) => {
    setEditing(tarefa);
    setFormOpen(true);
  };

  const handleNew = () => {
    setEditing(null);
    setCreateDefaultDate(null);
    setFormOpen(true);
  };

  const handleCreateAtDate = (date: Date) => {
    // Fixa o horário padrão em 09:00:00
    const withTime = setMilliseconds(setSeconds(setMinutes(setHours(date, 9), 0), 0), 0);
    setCreateDefaultDate(withTime);
    setEditing(null);
    setFormOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteTarefa.mutateAsync(deleting.id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(deleting.id);
        return next;
      });
    } catch {
      // toast no hook
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="p-6 space-y-6 pb-24">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <ClipboardList className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Tarefas</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border p-0.5 bg-muted/40">
            <Button
              variant={view === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('list')}
              className="h-7 px-2"
              aria-pressed={view === 'list'}
            >
              <List className="h-4 w-4 mr-1" />
              Lista
            </Button>
            <Button
              variant={view === 'calendar' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('calendar')}
              className="h-7 px-2"
              aria-pressed={view === 'calendar'}
            >
              <CalendarIcon className="h-4 w-4 mr-1" />
              Calendário
            </Button>
          </div>
          <Button onClick={handleNew} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nova tarefa
          </Button>
        </div>
      </div>

      <TarefasFilters filters={filters} onChange={setFilters} />

      {view === 'list' ? (
        <>
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <TarefasList
              grupos={grupos}
              selectedIds={selectedIds}
              vinculoLabelById={vinculoLabelById}
              onToggleSelect={handleToggleSelect}
              onToggleConcluida={(t) =>
                toggleConcluida.mutate({ id: t.id, concluida: !t.concluida })
              }
              onEdit={handleEdit}
              onDelete={setDeleting}
            />
          )}

          <TarefasBulkToolbar selectedIds={[...selectedIds]} onClear={handleClearSelection} />
        </>
      ) : (
        <TarefasCalendar
          filters={filters}
          onEditTarefa={handleEdit}
          onCreateAtDate={handleCreateAtDate}
        />
      )}

      <TarefaFormDialog
        open={formOpen}
        onOpenChange={(o) => {
          setFormOpen(o);
          if (!o) {
            setEditing(null);
            setCreateDefaultDate(null);
          }
        }}
        tarefa={editing}
        defaultDataAgendada={createDefaultDate?.toISOString() ?? null}
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
