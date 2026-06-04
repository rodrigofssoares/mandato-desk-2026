import { useEffect, useState } from 'react';
import { format, differenceInHours, differenceInMinutes, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Trash2, RotateCcw, Clock, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { cn } from '@/lib/utils';
import { useZapiTrash, type CleanupBatch } from '@/hooks/useZapiTrash';
import { useUsers } from '@/hooks/useUsers';
import { useZapiAccounts } from '@/hooks/useZapiAccounts';

// ─── Constantes ──────────────────────────────────────────────────────────────

const MODO_LABELS: Record<CleanupBatch['mode'], string> = {
  period: 'Por período',
  all: 'Conta inteira',
  chats: 'Conversas específicas',
  granular: 'Granular',
};

// ─── Countdown visual ─────────────────────────────────────────────────────────

function useCountdown(expiresAt: string) {
  const [display, setDisplay] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);

  useEffect(() => {
    function update() {
      const expDate = new Date(expiresAt);
      if (isPast(expDate)) {
        setDisplay('Expirado');
        setIsUrgent(false);
        return;
      }
      const hoursLeft = differenceInHours(expDate, new Date());
      const minutesLeft = differenceInMinutes(expDate, new Date()) % 60;
      setIsUrgent(hoursLeft < 24);

      if (hoursLeft > 0) {
        setDisplay(`Expira em ${hoursLeft}h ${minutesLeft}min`);
      } else {
        setDisplay(`Expira em ${minutesLeft}min`);
      }
    }

    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return { display, isUrgent };
}

// ─── BatchCard ────────────────────────────────────────────────────────────────

interface BatchCardProps {
  batch: CleanupBatch;
  initiatorName?: string | null;
  accountName?: string | null;
  onRestore: (batchId: string, rowCount: number) => void;
  isRestoring: boolean;
}

function BatchCard({ batch, initiatorName, accountName, onRestore, isRestoring }: BatchCardProps) {
  const { display: countdownDisplay, isUrgent } = useCountdown(batch.expires_at);
  const isPending = batch.status === 'pending' && !isPast(new Date(batch.expires_at));

  const statusBadge = (() => {
    if (batch.status === 'restored') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
          <CheckCircle2 className="h-3 w-3" />
          Restaurado
        </span>
      );
    }
    if (batch.status === 'expired' || isPast(new Date(batch.expires_at))) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
          <XCircle className="h-3 w-3" />
          Expirado
        </span>
      );
    }
    return (
      <span className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border',
        isUrgent
          ? 'bg-amber-100 text-amber-700 border-amber-200'
          : 'bg-blue-100 text-blue-700 border-blue-200',
      )}>
        <Clock className="h-3 w-3" />
        Pendente
      </span>
    );
  })();

  return (
    <div className={cn(
      'rounded-lg border p-4 space-y-3 transition-colors',
      isPending ? 'bg-card' : 'bg-muted/20 opacity-70',
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {statusBadge}
            <span className="text-xs font-medium text-muted-foreground">
              {MODO_LABELS[batch.mode]}
            </span>
          </div>
          <p className="text-sm font-medium truncate">
            {accountName ?? batch.account_id.slice(0, 8)}
          </p>
          <p className="text-xs text-muted-foreground">
            Iniciado por <span className="font-medium text-foreground">{initiatorName ?? 'Desconhecido'}</span>
            {' · '}
            {format(new Date(batch.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </div>

        {isPending && (
          <Button
            size="sm"
            variant="outline"
            className="shrink-0"
            onClick={() => onRestore(batch.id, batch.row_count_estimate ?? 0)}
            disabled={isRestoring}
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            {isRestoring ? 'Restaurando...' : 'Restaurar'}
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2">
        <span>
          ~{batch.row_count_estimate ?? 0} {(batch.row_count_estimate ?? 0) === 1 ? 'item' : 'itens'}
        </span>
        {isPending && (
          <span className={cn(
            'flex items-center gap-1',
            isUrgent && 'text-amber-600 font-medium',
          )}>
            {isUrgent && <AlertTriangle className="h-3 w-3" />}
            {countdownDisplay}
          </span>
        )}
        {!isPending && batch.status !== 'restored' && (
          <span className="text-gray-500">
            Expirou em {format(new Date(batch.expires_at), "dd/MM/yyyy", { locale: ptBR })}
          </span>
        )}
        {batch.status === 'restored' && (
          <span className="text-green-600">
            Restaurado com sucesso
          </span>
        )}
      </div>
    </div>
  );
}

// ─── TrashPanel ───────────────────────────────────────────────────────────────

export function TrashPanel() {
  const { batchesQuery, restoreMutation } = useZapiTrash();
  const { data: users = [] } = useUsers();
  const { data: accounts = [] } = useZapiAccounts();
  const [confirmBatch, setConfirmBatch] = useState<{ id: string; rowCount: number } | null>(null);

  const batches = batchesQuery.data ?? [];

  function handleRestoreClick(batchId: string, rowCount: number) {
    setConfirmBatch({ id: batchId, rowCount });
  }

  function handleRestoreConfirm() {
    if (!confirmBatch) return;
    restoreMutation.mutate(
      { batch_id: confirmBatch.id },
      { onSettled: () => setConfirmBatch(null) },
    );
  }

  function getUserName(userId: string): string | null {
    return users.find((u) => u.id === userId)?.nome ?? null;
  }

  function getAccountName(accountId: string): string | null {
    return accounts.find((a) => a.id === accountId)?.name ?? null;
  }

  if (batchesQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-muted-foreground">Carregando lixeira...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-destructive/10 flex items-center justify-center">
          <Trash2 className="h-4 w-4 text-destructive" />
        </div>
        <div>
          <h3 className="font-semibold text-sm">Lixeira de histórico</h3>
          <p className="text-xs text-muted-foreground">
            Lotes de limpeza ficam disponíveis por 7 dias. Apenas administradores podem restaurar.
          </p>
        </div>
      </div>

      {batches.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <Trash2 className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum histórico na lixeira.</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Limpezas realizadas pelo módulo WhatsApp aparecerão aqui.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Batches pendentes primeiro */}
          {batches
            .filter((b) => b.status === 'pending' && !isPast(new Date(b.expires_at)))
            .map((batch) => (
              <BatchCard
                key={batch.id}
                batch={batch}
                initiatorName={getUserName(batch.initiated_by)}
                accountName={getAccountName(batch.account_id)}
                onRestore={handleRestoreClick}
                isRestoring={
                  restoreMutation.isPending &&
                  (restoreMutation.variables as { batch_id: string })?.batch_id === batch.id
                }
              />
            ))}
          {/* Demais (restaurados e expirados) */}
          {batches
            .filter((b) => b.status !== 'pending' || isPast(new Date(b.expires_at)))
            .map((batch) => (
              <BatchCard
                key={batch.id}
                batch={batch}
                initiatorName={getUserName(batch.initiated_by)}
                accountName={getAccountName(batch.account_id)}
                onRestore={handleRestoreClick}
                isRestoring={false}
              />
            ))}
        </div>
      )}

      {/* Diálogo de confirmação de restauração */}
      <AlertDialog open={!!confirmBatch} onOpenChange={(v) => !v && setConfirmBatch(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar histórico</AlertDialogTitle>
            <AlertDialogDescription>
              Restaurar este lote vai desfazer a limpeza de aproximadamente{' '}
              <span className="font-semibold">{confirmBatch?.rowCount ?? 0} itens</span>.
              As conversas e mensagens voltarão a aparecer na aba Conversas. Confirmar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={restoreMutation.isPending}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRestoreConfirm}
              disabled={restoreMutation.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              {restoreMutation.isPending ? 'Restaurando...' : 'Restaurar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
