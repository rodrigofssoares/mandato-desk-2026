import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X } from 'lucide-react';
import { TIPO_LABELS } from './TarefaIcon';
import type { TarefaFilters, TarefaTipo } from '@/hooks/useTarefas';
import { useUsers } from '@/hooks/useUsers';

const TIPOS: TarefaTipo[] = ['LIGACAO', 'REUNIAO', 'VISITA', 'WHATSAPP', 'EMAIL', 'TAREFA'];

interface Props {
  filters: TarefaFilters;
  onChange: (next: TarefaFilters) => void;
}

export function TarefasFilters({ filters, onChange }: Props) {
  const { data: users = [] } = useUsers();

  const tiposSelecionados = filters.tipos ?? [];
  const periodo = filters.periodo ?? 'todas';
  const concluidaValue =
    filters.concluida === undefined ? 'todas' : filters.concluida ? 'concluidas' : 'pendentes';

  const toggleTipo = (tipo: TarefaTipo) => {
    const next = tiposSelecionados.includes(tipo)
      ? tiposSelecionados.filter((t) => t !== tipo)
      : [...tiposSelecionados, tipo];
    onChange({ ...filters, tipos: next.length > 0 ? next : undefined });
  };

  const handleClear = () => onChange({});

  const hasFilters =
    !!filters.search ||
    tiposSelecionados.length > 0 ||
    !!filters.responsavel_id ||
    (filters.periodo && filters.periodo !== 'todas') ||
    filters.concluida !== undefined;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.search ?? ''}
            onChange={(e) => onChange({ ...filters, search: e.target.value || undefined })}
            placeholder="Buscar por título…"
            className="pl-9"
          />
        </div>

        <Select
          value={periodo}
          onValueChange={(v) =>
            onChange({ ...filters, periodo: v as TarefaFilters['periodo'] })
          }
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todos os períodos</SelectItem>
            <SelectItem value="atrasadas">Atrasadas</SelectItem>
            <SelectItem value="hoje">Hoje</SelectItem>
            <SelectItem value="amanha">Amanhã</SelectItem>
            <SelectItem value="semana">Esta semana</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={filters.responsavel_id ?? '__all__'}
          onValueChange={(v) =>
            onChange({ ...filters, responsavel_id: v === '__all__' ? undefined : v })
          }
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos os responsáveis</SelectItem>
            {users.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={concluidaValue}
          onValueChange={(v) => {
            const next = { ...filters };
            if (v === 'todas') next.concluida = undefined;
            else if (v === 'pendentes') next.concluida = false;
            else next.concluida = true;
            onChange(next);
          }}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="pendentes">Pendentes</SelectItem>
            <SelectItem value="concluidas">Concluídas</SelectItem>
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={handleClear}>
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TIPOS.map((t) => {
          const active = tiposSelecionados.includes(t);
          return (
            <Button
              key={t}
              type="button"
              size="sm"
              variant={active ? 'default' : 'outline'}
              onClick={() => toggleTipo(t)}
              className="h-7 text-xs"
            >
              {TIPO_LABELS[t]}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
