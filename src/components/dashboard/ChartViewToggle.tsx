import { BarChartHorizontal, BarChart3, PieChart } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  CHART_VIEW_LABELS,
  CHART_VIEW_TYPES,
  type ChartViewType,
} from '@/lib/dashboardLayout';
import { cn } from '@/lib/utils';

const ICONS: Record<ChartViewType, typeof BarChart3> = {
  'bar-horizontal': BarChartHorizontal,
  'bar-vertical': BarChart3,
  pie: PieChart,
};

interface ChartViewToggleProps {
  value: ChartViewType;
  onChange: (next: ChartViewType) => void;
  disabled?: boolean;
}

export function ChartViewToggle({ value, onChange, disabled }: ChartViewToggleProps) {
  const Icon = ICONS[value];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
          title={`Visualização: ${CHART_VIEW_LABELS[value]}`}
          disabled={disabled}
        >
          <Icon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {CHART_VIEW_TYPES.map((type) => {
          const ItemIcon = ICONS[type];
          return (
            <DropdownMenuItem
              key={type}
              onClick={() => onChange(type)}
              className={cn(
                'gap-2 cursor-pointer',
                value === type && 'bg-accent font-medium'
              )}
            >
              <ItemIcon className="h-4 w-4" />
              {CHART_VIEW_LABELS[type]}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
