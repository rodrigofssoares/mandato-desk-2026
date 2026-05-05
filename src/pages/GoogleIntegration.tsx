import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { CloudCog, Link2, Link2Off, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Skeleton } from '@/components/ui/skeleton';

import { useAuth } from '@/context/AuthContext';
import {
  useGoogleStatus,
  useGoogleSettings,
  useUpdateGoogleSettings,
  useDisconnectGoogle,
  useSyncStatusCounts,
  useGoogleSyncLogs,
  useContactSyncErrors,
  googleSyncKeys,
  startGoogleAuth,
} from '@/hooks/useGoogleSync';
import { SyncStatusCards } from '@/components/google-sync/SyncStatusCards';
import { SyncLogsTable } from '@/components/google-sync/SyncLogsTable';
import { SyncErrorsList } from '@/components/google-sync/SyncErrorsList';
import { runFullReconciliation, type ReconciliationProgress } from '@/lib/googleReconciliation';

export default function GoogleIntegration() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showFallbackLink, setShowFallbackLink] = useState(false);
  const [fallbackAuthUrl, setFallbackAuthUrl] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<ReconciliationProgress | null>(null);

  const { data: statusData, isLoading: isStatusLoading } = useGoogleStatus();
  const { data: settings, isLoading: isSettingsLoading } = useGoogleSettings();
  const { data: counts, isLoading: isCountsLoading } = useSyncStatusCounts();
  const { data: logs, isLoading: isLogsLoading } = useGoogleSyncLogs(50);
  const { data: syncErrors, isLoading: isErrorsLoading } = useContactSyncErrors();
  const updateSettings = useUpdateGoogleSettings();
  const disconnectGoogle = useDisconnectGoogle();

  const isConnected = statusData?.isConnected ?? false;
  const isExpired = statusData?.isExpired ?? false;
  const googleEmail = statusData?.googleEmail ?? null;

  // Detecta retorno do OAuth
  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');

    if (connected === 'true') {
      // EXTRA: limpar params ANTES de disparar handleSyncAll — evita re-disparo em reload mid-sync
      setSearchParams({}, { replace: true });
      toast.success('Conta Google conectada com sucesso');
      queryClient.invalidateQueries({ queryKey: googleSyncKeys.all });

      // Dispara reconciliação automática pós-OAuth
      if (user?.id) {
        handleSyncAll(true);
      }
    } else if (error === 'oauth_failed') {
      setSearchParams({}, { replace: true });
      toast.error('Falha ao conectar com Google. Tente novamente.');
    } else if (error === 'oauth_state_invalid') {
      // FIX P-HIGH-2: erro de nonce inválido/expirado retornado pelo callback
      setSearchParams({}, { replace: true });
      toast.error('Sessão de autorização expirada ou inválida. Reconecte.');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleConnect() {
    if (!user?.id) return;
    try {
      const authUrl = await startGoogleAuth();
      const win = window.open(authUrl, '_blank', 'width=500,height=600');
      if (!win) {
        setFallbackAuthUrl(authUrl);
        setShowFallbackLink(true);
        toast.warning('Popup bloqueado. Use o link abaixo para conectar.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error(`Erro ao iniciar conexão com o Google: ${msg}`);
    }
  }

  async function handleSyncAll(silent = false) {
    if (!user?.id || isSyncing) return;
    setIsSyncing(true);
    setSyncProgress({ processed: 0, total: 0, errors: 0 });

    try {
      const result = await runFullReconciliation(user.id, (progress) => {
        setSyncProgress(progress);
      });

      await updateSettings.mutateAsync({ last_full_sync: new Date().toISOString() });
      queryClient.invalidateQueries({ queryKey: googleSyncKeys.counts() });
      queryClient.invalidateQueries({ queryKey: googleSyncKeys.errors() });
      queryClient.invalidateQueries({ queryKey: googleSyncKeys.logs() });

      if (!silent) {
        toast.success(
          result.total === 0
            ? 'Todos os contatos ja estao sincronizados'
            : `Sincronizacao concluida: ${result.processed - result.errors} contatos enviados ao Google${result.errors > 0 ? `, ${result.errors} com erro` : ''}`,
        );
      } else {
        toast.success(
          result.total === 0
            ? 'Sincronizacao inicial: todos os contatos ja estavam atualizados'
            : `Sincronizacao inicial concluida: ${result.processed - result.errors} contatos enviados para o Google`,
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error(`Erro durante sincronizacao: ${msg}`);
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
    }
  }

  if (isStatusLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <CloudCog className="h-6 w-6" />
          <h1 className="text-2xl font-bold">Integracao Google Contacts</h1>
        </div>
        <Card className="max-w-lg">
          <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-9 w-40" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <CloudCog className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Integracao Google Contacts</h1>
      </div>

      {/* Banner token expirado */}
      {isExpired && (
        <Alert variant="destructive">
          <AlertDescription>
            Sua conexao com o Google expirou. Reconecte para continuar sincronizando contatos.
          </AlertDescription>
        </Alert>
      )}

      {/* Card de status de conexao */}
      <Card className="max-w-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Conta Google</CardTitle>
            {isConnected ? (
              <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Conectado</Badge>
            ) : (
              <Badge variant="secondary">Desconectado</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isConnected && googleEmail && (
            <p className="text-sm">
              Conectado como <span className="font-medium">{googleEmail}</span>
            </p>
          )}

          {!isConnected && (
            <p className="text-sm text-muted-foreground">
              Conecte sua conta Google para sincronizar contatos automaticamente.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleConnect} variant={isConnected ? 'outline' : 'default'}>
              <Link2 className="h-4 w-4 mr-2" />
              {isConnected ? 'Reconectar conta' : 'Conectar com Google'}
            </Button>

            {isConnected && (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleSyncAll()}
                  disabled={isSyncing}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isSyncing ? 'animate-spin' : ''}`} />
                  {isSyncing ? 'Sincronizando...' : 'Sincronizar todos os contatos'}
                </Button>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                      <Link2Off className="h-4 w-4 mr-2" />
                      Desconectar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Desconectar conta Google?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Isso nao remove contatos do Google Contacts. O sistema apenas para de sincronizar novas alteracoes. Voce pode reconectar a qualquer momento.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => disconnectGoogle.mutate()}
                        className="bg-red-600 hover:bg-red-700"
                      >
                        Desconectar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>

          {/* Fallback link para popup blocker */}
          {showFallbackLink && fallbackAuthUrl && (
            <Alert>
              <AlertDescription>
                Popup bloqueado pelo navegador.{' '}
                <a
                  href={fallbackAuthUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium"
                >
                  Clique aqui para conectar com o Google
                </a>
              </AlertDescription>
            </Alert>
          )}

          {/* Barra de progresso de sincronizacao */}
          {isSyncing && syncProgress && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Enviando contatos para o Google...</span>
                <span>
                  {syncProgress.processed} de {syncProgress.total}
                </span>
              </div>
              <Progress
                value={syncProgress.total > 0 ? (syncProgress.processed / syncProgress.total) * 100 : 0}
              />
              {syncProgress.errors > 0 && (
                <p className="text-xs text-muted-foreground">
                  {syncProgress.errors} com erro
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Configuracoes */}
      {isConnected && !isSettingsLoading && settings && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Configuracoes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="keep-on-delete">Manter contatos no Google ao excluir do CRM</Label>
                <p className="text-xs text-muted-foreground">
                  Quando desativado, excluir um contato aqui tambem o remove do Google Contacts.
                </p>
              </div>
              <Switch
                id="keep-on-delete"
                checked={settings.keep_on_google_delete}
                onCheckedChange={(checked) =>
                  updateSettings.mutate({ keep_on_google_delete: checked })
                }
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contadores de status */}
      {isConnected && (
        <SyncStatusCards
          counts={counts ?? { synced: 0, error: 0, pending: 0 }}
          lastFullSync={settings?.last_full_sync ?? null}
          isLoading={isCountsLoading}
        />
      )}

      {/* Contatos com erro */}
      {isConnected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contatos com erro de sincronizacao</CardTitle>
          </CardHeader>
          <CardContent>
            <SyncErrorsList
              errors={syncErrors ?? []}
              isLoading={isErrorsLoading}
            />
          </CardContent>
        </Card>
      )}

      {/* Log de operacoes */}
      {isConnected && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ultimas operacoes (50 mais recentes)</CardTitle>
          </CardHeader>
          <CardContent>
            <SyncLogsTable logs={logs ?? []} isLoading={isLogsLoading} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
