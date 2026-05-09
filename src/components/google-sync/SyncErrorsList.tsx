import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { StatusChip } from '@/components/ui-system';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { googleSyncKeys, type ContactSyncError } from '@/hooks/useGoogleSync';
import { useState } from 'react';

interface SyncErrorsListProps {
  errors: ContactSyncError[];
  isLoading?: boolean;
}

export function SyncErrorsList({ errors, isLoading }: SyncErrorsListProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryingAll, setRetryingAll] = useState(false);

  async function handleRetry(err: ContactSyncError) {
    if (!user?.id) return;
    setRetryingId(err.contact_id);
    try {
      await supabase.functions.invoke('google-contacts-sync', {
        body: {
          contact_id: err.contact_id,
          user_id: user.id,
          operation: 'update',
        },
      });
      queryClient.invalidateQueries({ queryKey: googleSyncKeys.errors() });
      queryClient.invalidateQueries({ queryKey: googleSyncKeys.counts() });
      toast.success('Contato reprocessado com sucesso');
    } catch {
      toast.error('Erro ao reprocessar contato. Tente novamente.');
    } finally {
      setRetryingId(null);
    }
  }

  async function handleRetryAll() {
    if (!user?.id || retryingAll) return;
    setRetryingAll(true);

    let processed = 0;
    let errCount = 0;

    for (const err of errors) {
      try {
        const { error: invokeError } = await supabase.functions.invoke('google-contacts-sync', {
          body: {
            contact_id: err.contact_id,
            user_id: user.id,
            operation: 'update',
          },
        });
        if (invokeError) throw invokeError;
        processed++;
      } catch {
        errCount++;
      }
      // Pequeno delay para não sobrecarregar a API
      if (processed + errCount < errors.length) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    queryClient.invalidateQueries({ queryKey: googleSyncKeys.errors() });
    queryClient.invalidateQueries({ queryKey: googleSyncKeys.counts() });
    toast.success(
      `${processed} reprocessado${processed === 1 ? '' : 's'}` +
      (errCount > 0 ? `, ${errCount} ainda com erro` : ''),
    );

    setRetryingAll(false);
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground py-4 text-center">Carregando erros...</div>;
  }

  if (errors.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4 text-center">
        Nenhum contato com erro de sincronizacao.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {errors.length} contato{errors.length !== 1 ? 's' : ''} com erro
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRetryAll}
          disabled={retryingAll}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${retryingAll ? 'animate-spin' : ''}`} />
          Reprocessar todos os erros
        </Button>
      </div>

      <div className="divide-y rounded-md border">
        {errors.map((err) => (
          <div key={err.contact_id} className="flex items-start justify-between gap-3 p-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-danger shrink-0" />
                <span className="font-medium text-sm truncate">
                  {err.contacts?.nome ?? err.contact_id}
                </span>
                <StatusChip variant="danger" tone="solid" className="shrink-0">Erro</StatusChip>
              </div>
              {err.last_error && (
                <p className="text-xs text-muted-foreground mt-1 pl-6 truncate">
                  {err.last_error}
                </p>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleRetry(err)}
              disabled={retryingId === err.contact_id || retryingAll}
              className="shrink-0"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${retryingId === err.contact_id ? 'animate-spin' : ''}`} />
              Tentar novamente
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
