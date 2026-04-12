import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CampoPersonalizado } from '@/hooks/useCustomFields';
import type { CustomFieldFilterValue } from '@/hooks/useContacts';

interface CustomFieldFilterInputProps {
  campo: CampoPersonalizado;
  value: CustomFieldFilterValue | undefined;
  onChange: (value: CustomFieldFilterValue | undefined) => void;
}

/**
 * Renderiza o input de filtro apropriado para cada tipo de campo personalizado.
 * - texto    → contains (ilike)
 * - numero   → min/max (gte/lte)
 * - data     → from/to (gte/lte)
 * - booleano → Sim/Não/Qualquer
 * - selecao  → multi-select via checkboxes
 */
export function CustomFieldFilterInput({ campo, value, onChange }: CustomFieldFilterInputProps) {
  switch (campo.tipo) {
    case 'texto': {
      const current = value?.tipo === 'texto' ? value.contains : '';
      return (
        <div>
          <Label className="text-xs">{campo.rotulo}</Label>
          <Input
            className="mt-1"
            placeholder="Contém..."
            value={current}
            onChange={(e) => {
              const v = e.target.value;
              onChange(v ? { tipo: 'texto', contains: v } : undefined);
            }}
          />
        </div>
      );
    }

    case 'numero': {
      const min = value?.tipo === 'numero' ? value.min : undefined;
      const max = value?.tipo === 'numero' ? value.max : undefined;
      const update = (patch: { min?: number; max?: number }) => {
        const next = { tipo: 'numero' as const, min, max, ...patch };
        if (next.min === undefined && next.max === undefined) return onChange(undefined);
        onChange(next);
      };
      return (
        <div>
          <Label className="text-xs">{campo.rotulo}</Label>
          <div className="flex gap-2 mt-1">
            <Input
              type="number"
              placeholder="Mín"
              value={min ?? ''}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') return update({ min: undefined });
                const n = Number(raw);
                if (!Number.isNaN(n)) update({ min: n });
              }}
            />
            <Input
              type="number"
              placeholder="Máx"
              value={max ?? ''}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') return update({ max: undefined });
                const n = Number(raw);
                if (!Number.isNaN(n)) update({ max: n });
              }}
            />
          </div>
        </div>
      );
    }

    case 'data': {
      const from = value?.tipo === 'data' ? value.from : undefined;
      const to = value?.tipo === 'data' ? value.to : undefined;
      const update = (patch: { from?: string; to?: string }) => {
        const next = { tipo: 'data' as const, from, to, ...patch };
        if (!next.from && !next.to) return onChange(undefined);
        onChange(next);
      };
      return (
        <div>
          <Label className="text-xs">{campo.rotulo}</Label>
          <div className="flex gap-2 mt-1">
            <Input
              type="date"
              value={from ?? ''}
              onChange={(e) => update({ from: e.target.value || undefined })}
            />
            <Input
              type="date"
              value={to ?? ''}
              onChange={(e) => update({ to: e.target.value || undefined })}
            />
          </div>
        </div>
      );
    }

    case 'booleano': {
      const current =
        value?.tipo === 'booleano' ? (value.value ? 'sim' : 'nao') : 'todos';
      return (
        <div>
          <Label className="text-xs">{campo.rotulo}</Label>
          <Select
            value={current}
            onValueChange={(v) => {
              if (v === 'todos') return onChange(undefined);
              onChange({ tipo: 'booleano', value: v === 'sim' });
            }}
          >
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Qualquer</SelectItem>
              <SelectItem value="sim">Sim</SelectItem>
              <SelectItem value="nao">Não</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );
    }

    case 'selecao': {
      const selected = value?.tipo === 'selecao' ? value.values : [];
      const toggle = (opcao: string) => {
        const next = selected.includes(opcao)
          ? selected.filter((o) => o !== opcao)
          : [...selected, opcao];
        if (next.length === 0) return onChange(undefined);
        onChange({ tipo: 'selecao', values: next });
      };
      return (
        <div>
          <Label className="text-xs">{campo.rotulo}</Label>
          <div className="border rounded-md p-2 mt-1 flex flex-wrap gap-2 max-h-24 overflow-y-auto">
            {(campo.opcoes ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">Sem opções</p>
            ) : (
              (campo.opcoes ?? []).map((opcao) => (
                <label key={opcao} className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <Checkbox
                    checked={selected.includes(opcao)}
                    onCheckedChange={() => toggle(opcao)}
                  />
                  <span>{opcao}</span>
                </label>
              ))
            )}
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}
