import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarClock, ArrowRight } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useTarefasHoje } from '@/hooks/useTarefas';
import { TarefaIcon } from '@/components/tarefas/TarefaIcon';

export function TarefasHojeCard() {
  const { data, isLoading } = useTarefasHoje(5);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-primary" />
          Tarefas de hoje
        </CardTitle>
        <Button variant="ghost" size="sm" asChild className="h-8">
          <Link to="/tarefas" className="text-xs">
            Ver todas
            <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="flex-1">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-3/4" />
          </div>
        ) : !data || data.length === 0 ? (
          <p className="text-sm text-muted-foreground italic py-6 text-center">
            Nenhuma tarefa pendente para hoje 🎉
          </p>
        ) : (
          <ul className="space-y-2">
            {data.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-3 rounded-md border bg-card/50 px-3 py-2 text-sm"
              >
                <TarefaIcon tipo={t.tipo} className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate font-medium">{t.titulo}</span>
                {t.data_agendada && (
                  <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                    {format(parseISO(t.data_agendada), 'HH:mm', { locale: ptBR })}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
