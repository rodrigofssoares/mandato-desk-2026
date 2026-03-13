import { Cake } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useBirthdays } from '@/hooks/useDashboard';

export function BirthdaySection() {
  const { data, isLoading } = useBirthdays();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Cake className="h-5 w-5 text-pink-500" />
          Aniversariantes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        ) : (
          <>
            {/* Today */}
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                Aniversariantes de Hoje
              </h4>
              {data?.today.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Nenhum aniversariante</p>
              ) : (
                <ul className="space-y-1.5">
                  {data?.today.map((c) => (
                    <li key={c.id} className="flex items-center justify-between text-sm">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-muted-foreground">
                        {c.displayDate}
                        {c.age !== null && ` (${c.age} anos)`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Next 7 days */}
            <div>
              <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                Próximos 7 Dias
              </h4>
              {data?.next7.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">Nenhum aniversariante</p>
              ) : (
                <ul className="space-y-1.5">
                  {data?.next7.map((c) => (
                    <li key={c.id} className="flex items-center justify-between text-sm">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-muted-foreground">
                        {c.displayDate}
                        {c.age !== null && ` (${c.age} anos)`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
