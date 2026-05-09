import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarClock, ArrowRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useTarefasHoje } from '@/hooks/useTarefas';
import { TarefaIcon } from '@/components/tarefas/TarefaIcon';
import { WidgetHeader } from './WidgetHeader';

export function TarefasHojeCard() {
  const { data, isLoading } = useTarefasHoje(5);

  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <WidgetHeader
        eyebrow="Hoje"
        title="Tarefas do dia"
        icon={CalendarClock}
        iconBubbleClassName="bg-primary/10 text-primary"
        actions={
          <Button variant="ghost" size="sm" asChild className="h-8">
            <Link to="/tarefas" className="text-xs">
              Ver todas
              <ArrowRight className="h-3.5 w-3.5 ml-1" />
            </Link>
          </Button>
        }
      />
      <CardContent className="flex-1 min-h-0 overflow-y-auto">
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
                className="flex items-center gap-3 rounded-xl border border-border bg-card/60 px-3 py-2.5 text-sm hover:border-primary/40 hover:bg-accent/5 transition-colors"
              >
                <TarefaIcon tipo={t.tipo} className="h-4 w-4 shrink-0 text-primary" />
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
