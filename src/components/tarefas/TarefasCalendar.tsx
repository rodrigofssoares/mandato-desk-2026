import { useMemo, useState } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  format,
  addMonths,
  subMonths,
  parseISO,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { useTarefas, type Tarefa, type TarefaFilters } from '@/hooks/useTarefas';
import { TarefaIcon } from './TarefaIcon';

interface Props {
  filters: TarefaFilters;
  onEditTarefa: (tarefa: Tarefa) => void;
  onCreateAtDate: (date: Date) => void;
}

const WEEK_HEADERS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function dayKey(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

export function TarefasCalendar({ filters, onEditTarefa, onCreateAtDate }: Props) {
  const [currentMonth, setCurrentMonth] = useState<Date>(() => startOfMonth(new Date()));

  const rangeStart = useMemo(
    () => startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 }),
    [currentMonth],
  );
  const rangeEnd = useMemo(
    () => endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 }),
    [currentMonth],
  );

  const { data: tarefas = [], isLoading } = useTarefas({
    ...filters,
    periodo: undefined,
    rangeStart: rangeStart.toISOString(),
    rangeEnd: rangeEnd.toISOString(),
  });

  const tarefasByDay = useMemo(() => {
    const map = new Map<string, Tarefa[]>();
    for (const t of tarefas) {
      if (!t.data_agendada) continue;
      const key = dayKey(parseISO(t.data_agendada));
      const list = map.get(key);
      if (list) list.push(t);
      else map.set(key, [t]);
    }
    // Ordena por hora dentro de cada dia
    for (const list of map.values()) {
      list.sort((a, b) => {
        const da = a.data_agendada ? new Date(a.data_agendada).getTime() : 0;
        const db = b.data_agendada ? new Date(b.data_agendada).getTime() : 0;
        return da - db;
      });
    }
    return map;
  }, [tarefas]);

  const days = useMemo(
    () => eachDayOfInterval({ start: rangeStart, end: rangeEnd }),
    [rangeStart, rangeEnd],
  );

  const diasDoMesCorrente = useMemo(
    () =>
      eachDayOfInterval({
        start: startOfMonth(currentMonth),
        end: endOfMonth(currentMonth),
      }),
    [currentMonth],
  );

  const handlePrev = () => setCurrentMonth((m) => subMonths(m, 1));
  const handleNext = () => setCurrentMonth((m) => addMonths(m, 1));
  const handleToday = () => setCurrentMonth(startOfMonth(new Date()));

  return (
    <div className="space-y-4">
      {/* Header: navegação de mês */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={handlePrev} aria-label="Mês anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold capitalize min-w-[160px] text-center">
            {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
          </h2>
          <Button variant="outline" size="icon" onClick={handleNext} aria-label="Próximo mês">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={handleToday}>
          Hoje
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
          Carregando tarefas...
        </div>
      )}

      {/* Grid desktop */}
      <div className="hidden md:block">
        <div className="grid grid-cols-7 gap-px bg-border rounded-md overflow-hidden border">
          {WEEK_HEADERS.map((label) => (
            <div
              key={label}
              className="bg-muted text-xs font-medium text-muted-foreground py-2 text-center"
            >
              {label}
            </div>
          ))}
          {days.map((day) => {
            const key = dayKey(day);
            const list = tarefasByDay.get(key) ?? [];
            const visible = list.slice(0, 3);
            const extra = list.length - visible.length;
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const hoje = isToday(day);

            return (
              <div
                key={key}
                role="button"
                tabIndex={0}
                onClick={() => onCreateAtDate(day)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onCreateAtDate(day);
                  }
                }}
                className={`bg-background min-h-[110px] p-1.5 text-left transition-colors hover:bg-accent/40 flex flex-col gap-1 cursor-pointer ${
                  !isCurrentMonth ? 'opacity-40' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-medium ${
                      hoje
                        ? 'bg-primary text-primary-foreground rounded-full w-5 h-5 flex items-center justify-center'
                        : 'text-foreground'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  {visible.map((t) => (
                    <CalendarChip
                      key={t.id}
                      tarefa={t}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditTarefa(t);
                      }}
                    />
                  ))}
                  {extra > 0 && (
                    <MoreTasksPopover
                      tarefas={list}
                      extra={extra}
                      onEditTarefa={onEditTarefa}
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Clique num dia vazio para criar uma tarefa às 09:00.
        </p>
      </div>

      {/* Lista mobile: apenas dias do mês corrente com tarefas, mais os demais em seção separada */}
      <div className="md:hidden space-y-2">
        {diasDoMesCorrente.map((day) => {
          const key = dayKey(day);
          const list = tarefasByDay.get(key) ?? [];
          const hoje = isToday(day);
          return (
            <div
              key={key}
              className={`border rounded-md p-3 ${hoje ? 'border-primary bg-primary/5' : ''}`}
            >
              <button
                type="button"
                onClick={() => onCreateAtDate(day)}
                className="flex items-center justify-between w-full text-left mb-2"
              >
                <span className="text-sm font-medium capitalize">
                  {format(day, "EEE, d 'de' MMMM", { locale: ptBR })}
                </span>
                <span className="text-xs text-muted-foreground">
                  {list.length === 0 ? 'Tocar p/ criar' : `${list.length} tarefa(s)`}
                </span>
              </button>
              {list.length > 0 && (
                <div className="flex flex-col gap-1">
                  {list.map((t) => (
                    <CalendarChip
                      key={t.id}
                      tarefa={t}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditTarefa(t);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================================
// Chip
// ============================================================================

interface ChipProps {
  tarefa: Tarefa;
  onClick: (e: React.MouseEvent) => void;
}

function CalendarChip({ tarefa, onClick }: ChipProps) {
  const hora = tarefa.data_agendada ? format(parseISO(tarefa.data_agendada), 'HH:mm') : '';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] bg-muted hover:bg-accent truncate w-full text-left ${
        tarefa.concluida ? 'line-through opacity-60' : ''
      }`}
      title={`${tarefa.titulo}${hora ? ` — ${hora}` : ''}`}
    >
      <TarefaIcon tipo={tarefa.tipo} className="h-3 w-3 shrink-0" />
      {hora && <span className="text-muted-foreground shrink-0">{hora}</span>}
      <span className="truncate">{tarefa.titulo}</span>
    </button>
  );
}

// ============================================================================
// Popover "+N mais"
// ============================================================================

interface MoreProps {
  tarefas: Tarefa[];
  extra: number;
  onEditTarefa: (t: Tarefa) => void;
}

function MoreTasksPopover({ tarefas, extra, onEditTarefa }: MoreProps) {
  const [open, setOpen] = useState(false);
  const primeira = tarefas[0];
  const dataRef = primeira?.data_agendada ? parseISO(primeira.data_agendada) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          className="text-[11px] text-muted-foreground hover:text-foreground hover:underline text-left px-1.5"
        >
          +{extra} mais
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" onClick={(e) => e.stopPropagation()}>
        {dataRef && (
          <div className="text-xs font-medium text-muted-foreground mb-2 capitalize">
            {format(dataRef, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </div>
        )}
        <div className="flex flex-col gap-1 max-h-72 overflow-y-auto">
          {tarefas.map((t) => (
            <CalendarChip
              key={t.id}
              tarefa={t}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                onEditTarefa(t);
              }}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// Helpers exportados para testes futuros
export { dayKey };
