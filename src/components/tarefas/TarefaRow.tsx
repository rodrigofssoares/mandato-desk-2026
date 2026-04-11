import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Pencil, Trash2, AlertCircle } from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { TarefaIcon, TIPO_LABELS } from './TarefaIcon';
import type { Tarefa } from '@/hooks/useTarefas';

interface Props {
  tarefa: Tarefa;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onToggleConcluida: (tarefa: Tarefa) => void;
  onEdit: (tarefa: Tarefa) => void;
  onDelete: (tarefa: Tarefa) => void;
  vinculoLabel?: string | null;
}

export function TarefaRow({
  tarefa,
  selected,
  onToggleSelect,
  onToggleConcluida,
  onEdit,
  onDelete,
  vinculoLabel,
}: Props) {
  const data = tarefa.data_agendada ? new Date(tarefa.data_agendada) : null;
  const atrasada = data && !tarefa.concluida && isPast(data) && !isToday(data);

  return (
    <div
      className={`group flex items-center gap-3 rounded-md border bg-card px-3 py-2.5 transition-colors hover:bg-accent/30 ${
        selected ? 'border-primary/60 bg-accent/40' : 'border-border'
      } ${tarefa.concluida ? 'opacity-60' : ''}`}
    >
      <Checkbox
        checked={selected}
        onCheckedChange={() => onToggleSelect(tarefa.id)}
        aria-label="Selecionar tarefa"
      />

      <Checkbox
        checked={tarefa.concluida}
        onCheckedChange={() => onToggleConcluida(tarefa)}
        aria-label="Marcar como concluída"
        className="data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
      />

      <TarefaIcon tipo={tarefa.tipo} className="h-4 w-4 shrink-0" />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={`text-sm font-medium truncate ${
              tarefa.concluida ? 'line-through text-muted-foreground' : ''
            }`}
          >
            {tarefa.titulo}
          </span>
          {atrasada && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-rose-600">
              <AlertCircle className="h-3 w-3" />
              atrasada
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <span>{TIPO_LABELS[tarefa.tipo]}</span>
          {vinculoLabel && (
            <>
              <span aria-hidden>•</span>
              <span className="truncate">{vinculoLabel}</span>
            </>
          )}
          {data && (
            <>
              <span aria-hidden>•</span>
              <span>{format(data, "dd/MM 'às' HH:mm", { locale: ptBR })}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onEdit(tarefa)}
          aria-label="Editar tarefa"
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={() => onDelete(tarefa)}
          aria-label="Excluir tarefa"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
