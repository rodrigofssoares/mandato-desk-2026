import { Users, CheckCircle, Star, MapPin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useContactStats } from '@/hooks/useDashboard';

const stats = [
  { key: 'total' as const, label: 'Total de Contatos', icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
  { key: 'voteDeclared' as const, label: 'Declararam Voto', icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-500/10' },
  { key: 'favorites' as const, label: 'Favoritos', icon: Star, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  { key: 'withAddress' as const, label: 'Com Endereço', icon: MapPin, color: 'text-purple-500', bg: 'bg-purple-500/10' },
];

export function DashboardStatsCards() {
  const { data, isLoading } = useContactStats();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((s) => (
        <Card key={s.key}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className={`flex items-center justify-center h-12 w-12 rounded-lg ${s.bg}`}>
                <s.icon className={`h-6 w-6 ${s.color}`} />
              </div>
              <div>
                {isLoading ? (
                  <>
                    <Skeleton className="h-8 w-16 mb-1" />
                    <Skeleton className="h-4 w-24" />
                  </>
                ) : (
                  <>
                    <p className="text-3xl font-bold">{data?.[s.key] ?? 0}</p>
                    <p className="text-sm text-muted-foreground">{s.label}</p>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
