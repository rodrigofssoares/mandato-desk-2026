import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { CampoPersonalizado } from '@/hooks/useCustomFields';

interface CustomFieldInputProps {
  campo: CampoPersonalizado;
  value: string | number | boolean | null;
  onChange: (value: string | number | boolean | null) => void;
  disabled?: boolean;
}

export function CustomFieldInput({ campo, value, onChange, disabled }: CustomFieldInputProps) {
  switch (campo.tipo) {
    case 'texto':
      return (
        <Input
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={disabled}
          placeholder={`Digite ${campo.rotulo.toLowerCase()}`}
        />
      );

    case 'numero':
      return (
        <Input
          type="number"
          value={typeof value === 'number' ? value : ''}
          onChange={(e) => {
            const raw = e.target.value;
            if (raw === '') return onChange(null);
            const parsed = Number(raw);
            onChange(Number.isNaN(parsed) ? null : parsed);
          }}
          disabled={disabled}
          placeholder="0"
        />
      );

    case 'data':
      return (
        <Input
          type="date"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value || null)}
          disabled={disabled}
        />
      );

    case 'booleano':
      return (
        <div className="flex items-center gap-2 h-9">
          <Switch
            checked={value === true}
            onCheckedChange={(checked) => onChange(checked)}
            disabled={disabled}
          />
          <span className="text-sm text-muted-foreground">{value === true ? 'Sim' : 'Não'}</span>
        </div>
      );

    case 'selecao':
      return (
        <Select
          value={typeof value === 'string' && value ? value : undefined}
          onValueChange={(v) => onChange(v || null)}
          disabled={disabled}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {(campo.opcoes ?? []).map((opcao) => (
              <SelectItem key={opcao} value={opcao}>
                {opcao}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    default:
      return null;
  }
}
