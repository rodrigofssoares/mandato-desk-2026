import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
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

interface BoardFunnelCardProps {
  boards: Board[];
  activeBoardId: string | null;
  onChangeBoard: (boardId: string) => void;
  stages: FunilStage[];
  isLoading?: boolean;
}

export function BoardFunnelCard({
  boards,
  activeBoardId,
  onChangeBoard,
  stages,
  isLoading = false,
}: BoardFunnelCardProps) {
  const hasBoards = boards.length > 0;
  const hasData = stages.some((s) => s.count > 0);

  return (
    <Card>
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
          <Button variant="ghost" size="sm" asChild className="h-8 px-2">
            <Link to={activeBoardId ? `/board?board=${activeBoardId}` : '/board'}>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[260px] w-full" />
        ) : !hasBoards ? (
          <div className="h-[260px] flex flex-col items-center justify-center text-center text-sm text-muted-foreground gap-2">
            <p>Nenhum funil configurado.</p>
            <Button variant="outline" size="sm" asChild>
              <Link to="/settings?tab=funis">Criar funil</Link>
            </Button>
          </div>
        ) : !hasData ? (
          <div className="h-[260px] flex flex-col items-center justify-center text-center text-sm text-muted-foreground gap-2">
            <p>Funil vazio. Adicione contatos em {' '}
              <Link to={`/board?board=${activeBoardId}`} className="text-primary underline">
                /board
              </Link>
              .
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(260, stages.length * 44)}>
            <BarChart
              data={stages}
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
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--card-foreground))',
                }}
                cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
                formatter={(value: number) => [value, 'Contatos']}
              />
              <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                {stages.map((entry) => (
                  <Cell
                    key={entry.stage_id}
                    fill={entry.cor ?? 'hsl(var(--primary))'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
