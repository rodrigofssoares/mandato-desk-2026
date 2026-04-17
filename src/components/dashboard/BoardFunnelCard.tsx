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
} from 'recharts';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { ExternalLink } from 'lucide-react';
import type { FunilStage } from '@/hooks/useDashboardMetrics';
import type { Board } from '@/hooks/useBoards';
import { ChartViewToggle } from './ChartViewToggle';
import type { ChartViewType } from '@/lib/dashboardLayout';

interface BoardFunnelCardProps {
  boards: Board[];
  activeBoardId: string | null;
  onChangeBoard: (boardId: string) => void;
  stages: FunilStage[];
  isLoading?: boolean;
  viewType?: ChartViewType;
  onChangeViewType?: (type: ChartViewType) => void;
}

const TOOLTIP_STYLE = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
  color: 'hsl(var(--card-foreground))',
};

export function BoardFunnelCard({
  boards,
  activeBoardId,
  onChangeBoard,
  stages,
  isLoading = false,
  viewType = 'bar-horizontal',
  onChangeViewType,
}: BoardFunnelCardProps) {
  const hasBoards = boards.length > 0;
  const hasData = stages.some((s) => s.count > 0);

  const tinted = stages.map((s) => ({
    ...s,
    fill: s.cor ?? 'hsl(var(--primary))',
  }));

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <div className="min-w-0 flex-1">
          <CardTitle className="text-lg">Funil</CardTitle>
        </div>
        <div className="flex items-center gap-2">
          {hasBoards && activeBoardId && (
            <Select value={activeBoardId} onValueChange={onChangeBoard}>
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {boards.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.nome}
                    {b.is_default ? ' (padrão)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {onChangeViewType && (
            <ChartViewToggle value={viewType} onChange={onChangeViewType} />
          )}
          <Button variant="ghost" size="sm" asChild className="h-8 px-2">
            <Link to={activeBoardId ? `/board?board=${activeBoardId}` : '/board'}>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 min-h-0">
        {isLoading ? (
          <Skeleton className="h-full min-h-[240px] w-full" />
        ) : !hasBoards ? (
          <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-center text-sm text-muted-foreground gap-2">
            <p>Nenhum funil configurado.</p>
            <Button variant="outline" size="sm" asChild>
              <Link to="/settings?tab=funis">Criar funil</Link>
            </Button>
          </div>
        ) : !hasData ? (
          <div className="h-full min-h-[240px] flex flex-col items-center justify-center text-center text-sm text-muted-foreground gap-2">
            <p>
              Funil vazio. Adicione contatos em{' '}
              <Link to={`/board?board=${activeBoardId}`} className="text-primary underline">
                /board
              </Link>
              .
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%" minHeight={240}>
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
            ) : (
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
