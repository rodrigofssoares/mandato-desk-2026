import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  Loader2,
  CheckSquare,
  Square,
  Plus,
  ChevronDown,
  ChevronUp,
  Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  useTarefas,
  useCreateTarefa,
  useToggleTarefaConcluida,
  type Tarefa,
  type TarefaTipo,
  type TarefaPrioridade,
} from '@/hooks/useTarefas';

// ─── tipos locais ─────────────────────────────────────────────────────────────

interface ContactTasksSectionProps {
  contactId: string;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

const PRIORIDADE_CONFIG: Record<
  TarefaPrioridade,
  { label: string; className: string }
> = {
  baixa: { label: 'Baixa', className: 'bg-gray-100 text-gray-600 border-gray-200' },
  media: { label: 'Média', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  alta: { label: 'Alta', className: 'bg-red-50 text-red-700 border-red-200' },
};

const TIPOS: { value: TarefaTipo; label: string }[] = [
  { value: 'TAREFA', label: 'Tarefa' },
  { value: 'LIGACAO', label: 'Ligação' },
  { value: 'REUNIAO', label: 'Reunião' },
  { value: 'VISITA', label: 'Visita' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'EMAIL', label: 'E-mail' },
];

const PRIORIDADES: { value: TarefaPrioridade; label: string }[] = [
  { value: 'baixa', label: 'Baixa' },
  { value: 'media', label: 'Média' },
  { value: 'alta', label: 'Alta' },
];

// ─── TarefaItem ──────────────────────────────────────────────────────────────

function TarefaItem({ tarefa }: { tarefa: Tarefa }) {
  const toggle = useToggleTarefaConcluida();

  return (
    <div
      className={cn(
        'flex items-start gap-2 py-1.5 px-2 rounded-md hover:bg-muted/40 transition-colors',
        tarefa.concluida && 'opacity-60',
      )}
    >
      <button
        type="button"
        className="mt-0.5 shrink-0 text-muted-foreground hover:text-primary transition-colors"
        onClick={() =>
          toggle.mutate({ id: tarefa.id, concluida: !tarefa.concluida })
        }
        disabled={toggle.isPending}
        title={tarefa.concluida ? 'Reabrir tarefa' : 'Concluir tarefa'}
      >
        {tarefa.concluida ? (
          <CheckSquare className="h-4 w-4 text-primary" />
        ) : (
          <Square className="h-4 w-4" />
        )}
      </button>

      <div className="flex-1 min-w-0 space-y-0.5">
        <p
          className={cn(
            'text-xs leading-tight break-words',
            tarefa.concluida && 'line-through text-muted-foreground',
          )}
        >
          {tarefa.titulo}
        </p>

        <div className="flex items-center gap-1.5 flex-wrap">
          {tarefa.prioridade && (
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] px-1.5 py-0 h-4',
                PRIORIDADE_CONFIG[tarefa.prioridade].className,
              )}
            >
              {PRIORIDADE_CONFIG[tarefa.prioridade].label}
            </Badge>
          )}
          {tarefa.data_agendada && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <Calendar className="h-2.5 w-2.5" />
              {format(new Date(tarefa.data_agendada), "dd/MM", { locale: ptBR })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── FormNovaTarefa ───────────────────────────────────────────────────────────

interface FormNovaTarefaProps {
  contactId: string;
  onClose: () => void;
}

function FormNovaTarefa({ contactId, onClose }: FormNovaTarefaProps) {
  const createMutation = useCreateTarefa();

  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState<TarefaTipo>('TAREFA');
  const [prioridade, setPrioridade] = useState<TarefaPrioridade>('media');
  const [dataAgendada, setDataAgendada] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titulo.trim()) return;

    createMutation.mutate(
      {
        titulo: titulo.trim(),
        tipo,
        prioridade,
        data_agendada: dataAgendada || null,
        contact_id: contactId,
      },
      {
        onSuccess: () => {
          setTitulo('');
          setDataAgendada('');
          onClose();
        },
      },
    );
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border bg-muted/20 px-3 py-2.5 space-y-2"
    >
      <Input
        autoFocus
        value={titulo}
        onChange={(e) => setTitulo(e.target.value)}
        placeholder="Título da tarefa..."
        className="h-7 text-xs"
        maxLength={200}
      />

      <div className="grid grid-cols-2 gap-1.5">
        <Select value={tipo} onValueChange={(v) => setTipo(v as TarefaTipo)}>
          <SelectTrigger className="h-6 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIPOS.map((t) => (
              <SelectItem key={t.value} value={t.value} className="text-xs">
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={prioridade}
          onValueChange={(v) => setPrioridade(v as TarefaPrioridade)}
        >
          <SelectTrigger className="h-6 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRIORIDADES.map((p) => (
              <SelectItem key={p.value} value={p.value} className="text-xs">
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Input
        type="date"
        value={dataAgendada}
        onChange={(e) => setDataAgendada(e.target.value)}
        className="h-6 text-[11px]"
      />

      <div className="flex items-center justify-end gap-1.5">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-6 text-xs px-2"
          onClick={onClose}
          disabled={createMutation.isPending}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          size="sm"
          className="h-6 text-xs px-2"
          disabled={!titulo.trim() || createMutation.isPending}
        >
          {createMutation.isPending && (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          )}
          Criar
        </Button>
      </div>
    </form>
  );
}

// ─── ContactTasksSection ──────────────────────────────────────────────────────

export function ContactTasksSection({ contactId }: ContactTasksSectionProps) {
  const [showConcluidas, setShowConcluidas] = useState(false);
  const [addingTarefa, setAddingTarefa] = useState(false);

  const { data: tarefasPendentes = [], isLoading: loadingPendentes } = useTarefas({
    contact_id: contactId,
    concluida: false,
  });

  const { data: tarefasConcluidas = [], isLoading: loadingConcluidas } = useTarefas({
    contact_id: contactId,
    concluida: true,
  });

  const isLoading = loadingPendentes || (showConcluidas && loadingConcluidas);

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          Tarefas
          {tarefasPendentes.length > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center h-4 w-4 rounded-full bg-primary/10 text-primary text-[10px] font-semibold">
              {tarefasPendentes.length}
            </span>
          )}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-5 w-5"
          onClick={() => setAddingTarefa((v) => !v)}
          title="Nova tarefa"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Form nova tarefa */}
      {addingTarefa && (
        <FormNovaTarefa
          contactId={contactId}
          onClose={() => setAddingTarefa(false)}
        />
      )}

      {/* Lista de tarefas pendentes */}
      {isLoading ? (
        <div className="flex items-center justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : tarefasPendentes.length === 0 && !addingTarefa ? (
        <p className="text-xs text-muted-foreground italic">
          Nenhuma tarefa pendente
        </p>
      ) : (
        <div className="space-y-0.5">
          {tarefasPendentes.map((t) => (
            <TarefaItem key={t.id} tarefa={t} />
          ))}
        </div>
      )}

      {/* Toggle concluídas */}
      {tarefasConcluidas.length > 0 && (
        <button
          type="button"
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setShowConcluidas((v) => !v)}
        >
          {showConcluidas ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
          {tarefasConcluidas.length} concluída
          {tarefasConcluidas.length > 1 ? 's' : ''}
        </button>
      )}

      {showConcluidas && (
        <div className="space-y-0.5">
          {tarefasConcluidas.map((t) => (
            <TarefaItem key={t.id} tarefa={t} />
          ))}
        </div>
      )}
    </div>
  );
}
