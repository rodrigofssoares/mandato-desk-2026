import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { AlertTriangle, Bell, BellOff, Clock, Cake, Loader2, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
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
import { usePermissions } from '@/hooks/usePermissions';

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

// ─── Badge de expiração ───────────────────────────────────────────────────────

function ExpirationBadge({ expiresAt }: { expiresAt: string }) {
  const now = Date.now();
  const expiresAtMs = new Date(expiresAt).getTime();
  const isExpired = expiresAtMs <= now;
  const daysRemaining = Math.ceil((expiresAtMs - now) / (1000 * 60 * 60 * 24));
  const daysExpired = Math.ceil((now - expiresAtMs) / (1000 * 60 * 60 * 24));

  if (isExpired) {
    return (
      <Badge
        variant="outline"
        className="text-amber-700 border-amber-600/40 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-700/40 text-[10px] h-4 px-1.5"
      >
        Expirado · há {daysExpired} dia{daysExpired === 1 ? '' : 's'}
      </Badge>
    );
  }

  const label =
    daysRemaining <= 1
      ? 'Ativo · expira hoje'
      : `Ativo · expira em ${daysRemaining} dias`;

  return (
    <Badge
      variant="secondary"
      className="text-[10px] h-4 px-1.5"
    >
      {label}
    </Badge>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function AlertasTab() {
  const { dismissedList, deleteOne, deleteAll, deleteExpired, isLoading } =
    useDismissedAlerts();
  const { can } = usePermissions();
  const canDeleteAlerta = can.canDeleteAlerta();
  const canBulkDeleteAlertas = can.canBulkDeleteAlertas();

  const [confirmDeleteAllOpen, setConfirmDeleteAllOpen] = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  const [confirmDeleteExpiredOpen, setConfirmDeleteExpiredOpen] = useState(false);
  const [isDeletingExpired, setIsDeletingExpired] = useState(false);

  // Contagem de expirados calculada no render (atualiza junto com a query)
  const now = Date.now();
  const expiredList = dismissedList.filter(
    (item) => new Date(item.expires_at).getTime() <= now,
  );
  const expiredCount = expiredList.length;

  async function handleDeleteAll() {
    setIsDeletingAll(true);
    try {
      await deleteAll();
      setConfirmDeleteAllOpen(false);
    } finally {
      setIsDeletingAll(false);
    }
  }

  async function handleDeleteExpired() {
    setIsDeletingExpired(true);
    try {
      await deleteExpired();
      setConfirmDeleteExpiredOpen(false);
    } finally {
      setIsDeletingExpired(false);
    }
  }

  const totalCount = dismissedList.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <BellOff className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Alertas Dispensados</CardTitle>
              <CardDescription className="mt-1">
                Alertas que você silenciou no dashboard. Por padrão, eles expiram após
                30 dias e voltam a aparecer automaticamente. Você pode apagá-los antes
                disso a qualquer momento.
              </CardDescription>
            </div>
          </div>

          {totalCount > 0 && canBulkDeleteAlertas && (
            <div className="flex flex-wrap gap-2">
              {expiredCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmDeleteExpiredOpen(true)}
                  disabled={isLoading}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Apagar antigos ({expiredCount})
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmDeleteAllOpen(true)}
                disabled={isLoading}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Apagar todos
              </Button>
            </div>
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
        ) : totalCount === 0 ? (
          // Estado vazio
          <div className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <Bell className="h-8 w-8 opacity-30" />
            <p className="text-sm">Nenhum alerta dispensado no momento</p>
            <p className="text-xs max-w-xs">
              Quando você dispensar um alerta no dashboard, ele aparecerá aqui para
              que você possa apagá-lo quando quiser.
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
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    <p className="text-xs text-muted-foreground/70">
                      Dispensado em{' '}
                      {format(new Date(item.dismissed_at), "dd/MM/yyyy 'às' HH:mm", {
                        locale: ptBR,
                      })}
                    </p>
                    <ExpirationBadge expiresAt={item.expires_at} />
                  </div>
                </div>

                {canDeleteAlerta && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteOne(item.alert_key)}
                    aria-label={`Apagar alerta: ${item.alert_title ?? item.alert_key}`}
                    className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                    Apagar
                  </Button>
                )}
              </div>
            ))}

            <p className="text-xs text-muted-foreground pt-1">
              {totalCount} alerta{totalCount === 1 ? '' : 's'} dispensado
              {totalCount === 1 ? '' : 's'}
              {expiredCount > 0 && (
                <span className="text-amber-600 dark:text-amber-400">
                  {' '}· {expiredCount} expirado{expiredCount === 1 ? '' : 's'}
                </span>
              )}
            </p>
          </div>
        )}
      </CardContent>

      {/* AlertDialog de confirmação — apagar todos */}
      <AlertDialog open={confirmDeleteAllOpen} onOpenChange={setConfirmDeleteAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar todos os alertas dispensados?</AlertDialogTitle>
            <AlertDialogDescription>
              Apagar {totalCount} alerta{totalCount === 1 ? '' : 's'} dispensado
              {totalCount === 1 ? '' : 's'}? Eles voltarão a aparecer no dashboard
              automaticamente se a fonte ainda existir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingAll}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteAll();
              }}
              disabled={isDeletingAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingAll ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Apagando...
                </>
              ) : (
                `Apagar ${totalCount}`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AlertDialog de confirmação — apagar antigos (expirados) */}
      <AlertDialog
        open={confirmDeleteExpiredOpen}
        onOpenChange={setConfirmDeleteExpiredOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apagar alertas antigos?</AlertDialogTitle>
            <AlertDialogDescription>
              Apagar {expiredCount} alerta{expiredCount === 1 ? '' : 's'} que já
              {expiredCount === 1 ? ' expirou' : ' expiraram'} (mais de 30 dias)? Esses
              alertas já não estão silenciando nada — só estão ocupando histórico.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingExpired}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDeleteExpired();
              }}
              disabled={isDeletingExpired}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingExpired ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Apagando...
                </>
              ) : (
                `Apagar ${expiredCount}`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
