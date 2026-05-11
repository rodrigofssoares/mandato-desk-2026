import { forwardRef } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
  FunnelChart,
  Funnel,
  LabelList,
} from 'recharts';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import {
  BarChartHorizontal,
  BarChart3,
  PieChart as PieChartIcon,
  Filter,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { FunnelReportStage } from '@/hooks/useFunnelReport';
import {
  REPORT_CHART_VIEW_TYPES,
  REPORT_CHART_VIEW_LABELS,
  type ReportChartViewType,
} from '@/lib/relatorios';

const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '12px',
  color: 'hsl(var(--card-foreground))',
  boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
};

const VIEW_ICONS: Record<ReportChartViewType, typeof BarChart3> = {
  'bar-horizontal': BarChartHorizontal,
  'bar-vertical': BarChart3,
  pie: PieChartIcon,
  funnel: Filter,
};

interface FunnelReportChartProps {
  stages: FunnelReportStage[];
  isLoading: boolean;
  viewType: ReportChartViewType;
  onChangeViewType: (type: ReportChartViewType) => void;
  hasSelection: boolean;
}

export const FunnelReportChart = forwardRef<HTMLDivElement, FunnelReportChartProps>(
  function FunnelReportChart(
    { stages, isLoading, viewType, onChangeViewType, hasSelection },
    ref
  ) {
    const tinted = stages.map((s) => ({
      ...s,
      fill: s.cor ?? 'hsl(var(--primary))',
      value: s.count,
    }));

    const hasData = stages.some((s) => s.count > 0);
    const Icon = VIEW_ICONS[viewType];

    return (
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between print:hidden">
          <span className="text-sm font-medium text-muted-foreground">Visualização</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                title={`Visualização: ${REPORT_CHART_VIEW_LABELS[viewType]}`}
              >
                <Icon className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {REPORT_CHART_VIEW_TYPES.map((type) => {
                const ItemIcon = VIEW_ICONS[type];
                return (
                  <DropdownMenuItem
                    key={type}
                    onClick={() => onChangeViewType(type)}
                    className={cn(
                      'gap-2 cursor-pointer',
                      viewType === type && 'bg-accent font-medium'
                    )}
                  >
                    <ItemIcon className="h-4 w-4" />
                    {REPORT_CHART_VIEW_LABELS[type]}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>
        <CardContent ref={ref} id="funnel-chart-container">
          {isLoading ? (
            <Skeleton className="h-60 w-full" />
          ) : !hasSelection ? (
            <div className="h-60 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">
                Selecione pelo menos um estágio
              </p>
            </div>
          ) : stages.length === 0 || !hasData ? (
            <div className="h-60 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">
                Funil sem contatos — adicione contatos no Board para visualizar o relatório
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              {viewType === 'pie' ? (
                <PieChart>
                  <Pie
                    data={tinted}
                    dataKey="count"
                    nameKey="nome"
                    innerRadius="40%"
                    outerRadius="75%"
                    paddingAngle={2}
                  >
                    {tinted.map((entry) => (
                      <Cell key={entry.stage_id} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value: number) => [value, 'Contatos']}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} verticalAlign="bottom" iconType="circle" />
                </PieChart>
              ) : viewType === 'bar-vertical' ? (
                <BarChart data={tinted} margin={{ top: 4, right: 12, left: 0, bottom: 40 }}>
                  <XAxis
                    dataKey="nome"
                    angle={-30}
                    textAnchor="end"
                    interval={0}
                    tick={{ fontSize: 11 }}
                    className="fill-muted-foreground"
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    className="fill-muted-foreground"
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
                    formatter={(value: number) => [value, 'Contatos']}
                  />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                    {tinted.map((entry) => (
                      <Cell key={entry.stage_id} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              ) : viewType === 'funnel' ? (
                <FunnelChart>
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value: number) => [value, 'Contatos']}
                  />
                  <Funnel
                    dataKey="value"
                    data={tinted}
                    isAnimationActive
                  >
                    {tinted.map((entry) => (
                      <Cell key={entry.stage_id} fill={entry.fill} />
                    ))}
                    <LabelList
                      position="right"
                      fill="hsl(var(--foreground))"
                      stroke="none"
                      dataKey="nome"
                      style={{ fontSize: 12 }}
                    />
                  </Funnel>
                </FunnelChart>
              ) : (
                // bar-horizontal (padrão)
                <BarChart
                  data={tinted}
                  layout="vertical"
                  margin={{ top: 4, right: 20, left: 0, bottom: 4 }}
                >
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11 }}
                    className="fill-muted-foreground"
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    dataKey="nome"
                    type="category"
                    tick={{ fontSize: 12 }}
                    className="fill-muted-foreground"
                    width={120}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
                    formatter={(value: number) => [value, 'Contatos']}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                    {tinted.map((entry) => (
                      <Cell key={entry.stage_id} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              )}
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    );
  }
);
