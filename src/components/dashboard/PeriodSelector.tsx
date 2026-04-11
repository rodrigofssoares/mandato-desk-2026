import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { DashboardPeriod } from '@/hooks/useDashboardMetrics';

interface PeriodSelectorProps {
  value: DashboardPeriod;
  onChange: (period: DashboardPeriod) => void;
}

const OPTIONS: { value: DashboardPeriod; label: string }[] = [
  { value: 'hoje', label: 'Hoje' },
  { value: '7d', label: 'Últimos 7 dias' },
  { value: '30d', label: 'Últimos 30 dias' },
  { value: 'mes', label: 'Este mês' },
];

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as DashboardPeriod)}>
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Período" />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
