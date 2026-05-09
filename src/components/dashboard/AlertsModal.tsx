import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertTriangle, Clock, Cake, ExternalLink, X, Loader2, Settings } from 'lucide-react';
import type { Alert, AlertType } from '@/hooks/useDashboardMetrics';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface AlertsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alerts: Alert[];
  onDismissOne: (alert: Pick<Alert, 'id' | 'type' | 'title' | 'subtitle'>) => Promise<void>;
  onDismissMany: (alerts: Pick<Alert, 'id' | 'type' | 'title' | 'subtitle'>[]) => Promise<void>;
}

// ─── Mapas de ícone e cor ─────────────────────────────────────────────────────

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

// ─── Componente principal ─────────────────────────────────────────────────────

export function AlertsModal({
  open,
  onOpenChange,
  alerts,
  onDismissOne,
  onDismissMany,
}: AlertsModalProps) {
  const navigate = useNavigate();
  const [confirmAllOpen, setConfirmAllOpen] = useState(false);
  const [isDismissingAll, setIsDismissingAll] = useState(false);
  // IDs em processo de dismiss individual (para animação de saída)
  const [dismissingIds, setDismissingIds] = useState<Set<string>>(new Set());

  // ── Dismiss individual ───────────────────────────────────────────────────
  async function handleDismissOne(alert: Alert) {
    // Guard contra double-click — evita upserts duplicados em voo (Security M1)
    if (dismissingIds.has(alert.id)) return;
    setDismissingIds((prev) => new Set(prev).add(alert.id));
    try {
      await onDismissOne({
        id: alert.id,
        type: alert.type,
        title: alert.title,
        subtitle: alert.subtitle,
      });
    } catch {
      // onDismissOne já exibe toast.error via hook
    } finally {
      setDismissingIds((prev) => {
        const next = new Set(prev);
        next.delete(alert.id);
        return next;
      });
    }
  }

  // ── Dismiss todos ────────────────────────────────────────────────────────
  async function handleDismissAll() {
    setIsDismissingAll(true);
    try {
      await onDismissMany(
        alerts.map((a) => ({
          id: a.id,
          type: a.type,
          title: a.title,
          subtitle: a.subtitle,
        }))
      );
      setConfirmAllOpen(false);
    } catch {
      // onDismissMany já exibe toast.error via hook — dialog permanece aberto
    } finally {
      setIsDismissingAll(false);
    }
  }

  // ── Navegação para Configurações > Alertas ───────────────────────────────
  function handleGerenciarDispensados() {
    onOpenChange(false);
    navigate('/settings?tab=alertas');
  }

  // ── Agrupamento ──────────────────────────────────────────────────────────
  const grouped: Record<AlertType, Alert[]> = {
    contato_parado: [],
    tarefa_vencida: [],
    aniversariante_sem_tarefa: [],
  };
  for (const a of alerts) grouped[a.type].push(a);

  return (
    <>
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
              Nenhum alerta no momento
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
                          const isDismissing = dismissingIds.has(a.id);
                          const row = (
                            <div
                              className={[
                                'flex items-start justify-between gap-3 rounded-md border bg-card/50 px-3 py-2 text-sm hover:bg-muted/50 transition-all duration-200',
                                isDismissing ? 'opacity-0 scale-95 pointer-events-none' : 'opacity-100 scale-100',
                              ].join(' ')}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="font-medium truncate">{a.title}</p>
                                <p className="text-xs text-muted-foreground">{a.subtitle}</p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0 mt-0.5">
                                {a.href && (
                                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                                )}
                                <button
                                  type="button"
                                  aria-label="Dispensar alerta"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleDismissOne(a);
                                  }}
                                  className="ml-1 rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                  <X className="h-3.5 w-3.5" />
                                </button>
                              </div>
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

          {/* Rodapé com ações */}
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between sm:items-center pt-2">
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-muted-foreground text-xs"
              onClick={handleGerenciarDispensados}
            >
              <Settings className="h-3 w-3 mr-1" />
              Gerenciar alertas dispensados
            </Button>

            {alerts.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmAllOpen(true)}
              >
                Dispensar todos ({alerts.length})
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog de confirmação — dismiss em massa */}
      <AlertDialog open={confirmAllOpen} onOpenChange={setConfirmAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Dispensar todos os alertas?</AlertDialogTitle>
            <AlertDialogDescription>
              Dispensar {alerts.length} alerta{alerts.length === 1 ? '' : 's'}? Eles
              serão removidos desta lista. Você pode restaurá-los a qualquer momento
              em Configurações &rsaquo; Alertas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDismissingAll}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDismissAll();
              }}
              disabled={isDismissingAll}
            >
              {isDismissingAll ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Dispensando...
                </>
              ) : (
                `Dispensar ${alerts.length}`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
