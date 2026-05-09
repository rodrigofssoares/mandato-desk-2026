import { Cake } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useBirthdays } from '@/hooks/useDashboard';
import { WidgetHeader } from './WidgetHeader';

export function BirthdaySection() {
  const { data, isLoading } = useBirthdays();
  const totalToday = data?.today.length ?? 0;
  const totalNext7 = data?.next7.length ?? 0;

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <WidgetHeader
        eyebrow="Esta semana"
        title="Aniversariantes"
        icon={Cake}
        iconBubbleClassName="bg-pink-500/10 text-pink-500"
        actions={
          totalToday + totalNext7 > 0 ? (
            <span className="px-2.5 py-0.5 rounded-full bg-pink-500/10 text-pink-600 text-xs font-semibold">
              {totalToday + totalNext7}
            </span>
          ) : undefined
        }
      />
      <CardContent className="flex-1 min-h-0 overflow-y-auto space-y-4">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-5 w-full" />
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-5 w-1/2" />
          </div>
        ) : (
          <>
            {/* Hoje */}
            <div>
              <h4 className="text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                Aniversariantes de hoje
              </h4>
              {totalToday === 0 ? (
                <p className="text-sm text-muted-foreground italic">Nenhum aniversariante</p>
              ) : (
                <ul className="space-y-1.5">
                  {data?.today.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center justify-between text-sm gap-3 rounded-lg px-2 py-1.5 hover:bg-accent/5"
                    >
                      <span className="font-medium truncate">{c.name}</span>
                      <span className="text-muted-foreground text-xs shrink-0 tabular-nums">
                        {c.displayDate}
                        {c.age !== null && ` (${c.age} anos)`}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Próximos 7 dias */}
            <div>
              <h4 className="text-[0.65rem] font-bold uppercase tracking-widest text-muted-foreground mb-2">
                Próximos 7 dias
              </h4>
              {totalNext7 === 0 ? (
                <p className="text-sm text-muted-foreground italic">Nenhum aniversariante</p>
              ) : (
                <ul className="space-y-1.5">
                  {data?.next7.map((c) => (
                    <li
                      key={c.id}
                      className="flex items-center justify-between text-sm gap-3 rounded-lg px-2 py-1.5 hover:bg-accent/5"
                    >
                      <span className="font-medium truncate">{c.name}</span>
                      <span className="text-muted-foreground text-xs shrink-0 tabular-nums">
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
