import { Link } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Clock, Cake, ExternalLink } from 'lucide-react';
import type { Alert, AlertType } from '@/hooks/useDashboardMetrics';

interface AlertsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alerts: Alert[];
}

const ICONS: Record<AlertType, typeof AlertTriangle> = {
  contato_parado: Clock,
  tarefa_vencida: AlertTriangle,
  aniversariante_sem_tarefa: Cake,
};

const ICON_COLORS: Record<AlertType, string> = {
  contato_parado: 'text-amber-600',
  tarefa_vencida: 'text-red-600',
  aniversariante_sem_tarefa: 'text-pink-600',
};

const GROUP_LABELS: Record<AlertType, string> = {
  contato_parado: 'Contatos parados no funil',
  tarefa_vencida: 'Tarefas vencidas',
  aniversariante_sem_tarefa: 'Aniversariantes sem tarefa',
};

export function AlertsModal({ open, onOpenChange, alerts }: AlertsModalProps) {
  const grouped: Record<AlertType, Alert[]> = {
    contato_parado: [],
    tarefa_vencida: [],
    aniversariante_sem_tarefa: [],
  };
  for (const a of alerts) grouped[a.type].push(a);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Alertas ({alerts.length})</DialogTitle>
          <DialogDescription>
            Itens que precisam da sua atenção agora.
          </DialogDescription>
        </DialogHeader>

        {alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nenhum alerta no momento 🎉
          </p>
        ) : (
          <ScrollArea className="max-h-[60vh] pr-3">
            <div className="space-y-6">
              {(Object.keys(grouped) as AlertType[]).map((type) => {
                const items = grouped[type];
                if (items.length === 0) return null;
                const Icon = ICONS[type];
                return (
                  <section key={type}>
                    <h3 className="text-sm font-semibold text-muted-foreground mb-2 flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${ICON_COLORS[type]}`} />
                      {GROUP_LABELS[type]} ({items.length})
                    </h3>
                    <ul className="space-y-2">
                      {items.map((a) => {
                        const row = (
                          <div className="flex items-start justify-between gap-3 rounded-md border bg-card/50 px-3 py-2 text-sm hover:bg-muted/50 transition-colors">
                            <div className="min-w-0 flex-1">
                              <p className="font-medium truncate">{a.title}</p>
                              <p className="text-xs text-muted-foreground">{a.subtitle}</p>
                            </div>
                            {a.href && (
                              <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                            )}
                          </div>
                        );
                        return (
                          <li key={a.id}>
                            {a.href ? (
                              <Link to={a.href} onClick={() => onOpenChange(false)}>
                                {row}
                              </Link>
                            ) : (
                              row
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
