import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, Bell, BellOff, Clock, Cake, Loader2, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useDismissedAlerts } from '@/hooks/useDismissedAlerts';
import { formatAlertKey } from '@/lib/alertUtils';

// ─── Mapeamento de alert_type → ícone ────────────────────────────────────────

const TYPE_ICON: Record<string, typeof AlertTriangle> = {
  contato_parado: Clock,
  tarefa_vencida: AlertTriangle,
  aniversariante_sem_tarefa: Cake,
};

const TYPE_COLOR: Record<string, string> = {
  contato_parado: 'text-amber-600',
  tarefa_vencida: 'text-red-600',
  aniversariante_sem_tarefa: 'text-pink-600',
};

function AlertTypeIcon({ alertType }: { alertType: string }) {
  const Icon = TYPE_ICON[alertType] ?? Bell;
  const color = TYPE_COLOR[alertType] ?? 'text-muted-foreground';
  return <Icon className={`h-4 w-4 shrink-0 ${color}`} />;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function AlertasTab() {
  const { dismissedList, restoreOne, restoreAll, isLoading } = useDismissedAlerts();
  const [confirmRestoreAllOpen, setConfirmRestoreAllOpen] = useState(false);
  const [isRestoringAll, setIsRestoringAll] = useState(false);

  async function handleRestoreAll() {
    setIsRestoringAll(true);
    try {
      await restoreAll();
      setConfirmRestoreAllOpen(false);
    } finally {
      setIsRestoringAll(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <BellOff className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Alertas Dispensados</CardTitle>
              <CardDescription className="mt-1">
                Alertas que você silenciou no dashboard. Restaure para que voltem a
                aparecer na modal de alertas.
              </CardDescription>
            </div>
          </div>

          {dismissedList.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmRestoreAllOpen(true)}
              disabled={isLoading}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Restaurar todos
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          // Skeleton enquanto carrega
          <div className="space-y-3 max-w-2xl">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14 w-full rounded-md" />
            ))}
          </div>
        ) : dismissedList.length === 0 ? (
          // Estado vazio
          <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <Bell className="h-8 w-8 opacity-30" />
            <p className="text-sm">Nenhum alerta dispensado no momento</p>
            <p className="text-xs max-w-xs">
              Quando você dispensar um alerta no dashboard, ele aparecerá aqui para
              que você possa restaurá-lo quando quiser.
            </p>
          </div>
        ) : (
          // Lista de dismissals
          <div className="space-y-2 max-w-2xl">
            {dismissedList.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-md border bg-card/50 px-3 py-3 text-sm"
              >
                <AlertTypeIcon alertType={item.alert_type} />

                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm">
                    {item.alert_title ?? formatAlertKey(item.alert_key)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatAlertKey(item.alert_key)}
                    {item.alert_subtitle ? ` — ${item.alert_subtitle}` : ''}
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-0.5">
                    Dispensado em{' '}
                    {format(new Date(item.dismissed_at), "dd/MM/yyyy 'às' HH:mm", {
                      locale: ptBR,
                    })}
                  </p>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => restoreOne(item.alert_key)}
                  aria-label={`Restaurar alerta: ${item.alert_title ?? item.alert_key}`}
                  className="shrink-0"
                >
                  <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                  Restaurar
                </Button>
              </div>
            ))}

            <p className="text-xs text-muted-foreground pt-1">
              {dismissedList.length} alerta{dismissedList.length === 1 ? '' : 's'} dispensado
              {dismissedList.length === 1 ? '' : 's'}
            </p>
          </div>
        )}
      </CardContent>

      {/* AlertDialog de confirmação — restaurar todos */}
      <AlertDialog open={confirmRestoreAllOpen} onOpenChange={setConfirmRestoreAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar todos os alertas dispensados?</AlertDialogTitle>
            <AlertDialogDescription>
              Restaurar {dismissedList.length} alerta
              {dismissedList.length === 1 ? '' : 's'} dispensado
              {dismissedList.length === 1 ? '' : 's'}? Eles voltarão a aparecer na modal
              do dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRestoringAll}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleRestoreAll();
              }}
              disabled={isRestoringAll}
            >
              {isRestoringAll ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Restaurando...
                </>
              ) : (
                `Restaurar ${dismissedList.length}`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
