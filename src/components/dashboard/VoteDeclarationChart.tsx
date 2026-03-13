import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useVoteStats } from '@/hooks/useDashboard';

export function VoteDeclarationChart() {
  const { data, isLoading } = useVoteStats();

  const chartData = data
    ? [
        {
          name: 'Declararam Voto',
          value: data.declared,
          pct: data.total > 0 ? ((data.declared / data.total) * 100).toFixed(1) + '%' : '0%',
          fill: '#22c55e',
        },
        {
          name: 'Não Declararam',
          value: data.notDeclared,
          pct: data.total > 0 ? ((data.notDeclared / data.total) * 100).toFixed(1) + '%' : '0%',
          fill: '#6b7280',
        },
      ]
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Declaração de Voto</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[250px] w-full" />
        ) : chartData.length === 0 ? (
          <div className="h-[250px] flex items-center justify-center text-muted-foreground">
            Nenhum dado disponível
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={chartData} layout="vertical" barSize={32}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
              <XAxis type="number" allowDecimals={false} className="fill-muted-foreground" />
              <YAxis
                type="category"
                dataKey="name"
                width={130}
                tick={{ fontSize: 13 }}
                className="fill-muted-foreground"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--card-foreground))',
                }}
                formatter={(value: number, _name: string, props: any) => [
                  `${value} (${props.payload.pct})`,
                  'Contatos',
                ]}
              />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {chartData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.fill} />
                ))}
                <LabelList dataKey="pct" position="right" className="fill-foreground text-sm" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
