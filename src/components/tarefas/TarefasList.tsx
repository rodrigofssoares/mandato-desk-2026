import { ClipboardList } from 'lucide-react';
import { TarefaRow } from './TarefaRow';
import type { Tarefa } from '@/hooks/useTarefas';
import type { GruposTarefas } from '@/lib/tarefas/agruparPorDia';

interface Props {
  grupos: GruposTarefas<Tarefa>;
  selectedIds: Set<string>;
  vinculoLabelById: Record<string, string>;
  onToggleSelect: (id: string) => void;
  onToggleConcluida: (tarefa: Tarefa) => void;
  onEdit: (tarefa: Tarefa) => void;
  onDelete: (tarefa: Tarefa) => void;
}

interface Section {
  key: keyof GruposTarefas<Tarefa>;
  label: string;
  tone: string;
}

const SECTIONS: Section[] = [
  { key: 'atrasadas', label: 'Atrasadas', tone: 'text-rose-600' },
  { key: 'hoje', label: 'Hoje', tone: 'text-foreground' },
  { key: 'amanha', label: 'Amanhã', tone: 'text-foreground' },
  { key: 'estaSemana', label: 'Esta semana', tone: 'text-foreground' },
  { key: 'proximas', label: 'Próximas', tone: 'text-muted-foreground' },
  { key: 'semData', label: 'Sem data', tone: 'text-muted-foreground' },
];

export function TarefasList({
  grupos,
  selectedIds,
  vinculoLabelById,
  onToggleSelect,
  onToggleConcluida,
  onEdit,
  onDelete,
}: Props) {
  const total =
    grupos.atrasadas.length +
    grupos.hoje.length +
    grupos.amanha.length +
    grupos.estaSemana.length +
    grupos.proximas.length +
    grupos.semData.length;

  if (total === 0) {
    return (
      <div className="rounded-lg border border-dashed py-16 text-center">
        <ClipboardList className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm font-medium">Nenhuma tarefa encontrada</p>
        <p className="text-xs text-muted-foreground mt-1">
          Crie a primeira tarefa ou ajuste os filtros.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {SECTIONS.map(({ key, label, tone }) => {
        const items = grupos[key];
        if (items.length === 0) return null;
        return (
          <section key={key} className="space-y-2">
            <h3 className={`text-xs font-semibold uppercase tracking-wider ${tone}`}>
              {label} <span className="text-muted-foreground">({items.length})</span>
            </h3>
            <div className="space-y-2">
              {items.map((tarefa) => (
                <TarefaRow
                  key={tarefa.id}
                  tarefa={tarefa}
                  selected={selectedIds.has(tarefa.id)}
                  onToggleSelect={onToggleSelect}
                  onToggleConcluida={onToggleConcluida}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  vinculoLabel={vinculoLabelById[tarefa.id] ?? null}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
