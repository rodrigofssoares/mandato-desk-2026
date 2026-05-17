import { useState } from 'react';
import { Lock, MessageCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { EmptyState } from '@/components/ui-system';
import { useImpersonation } from '@/context/ImpersonationContext';
import { AccountCard } from './AccountCard';
import { AccountFormDialog } from './AccountFormDialog';
import { DeleteAccountDialog } from './DeleteAccountDialog';
import { ResetPanelPasswordDialog } from './ResetPanelPasswordDialog';
import {
  useZapiAccounts,
  useCreateZapiAccount,
  useUpdateZapiAccount,
  useDeleteZapiAccount,
  useResetZapiPanelPassword,
  type ZapiAccount,
} from '@/hooks/useZapiAccounts';
import type { RecursosConfig } from '@/lib/featureFlags';

export function ContasTabContent() {
  const { activeRole } = useImpersonation();
  const isAdmin = activeRole === 'admin';
  const { data: accounts = [], isLoading } = useZapiAccounts();

  const createMutation = useCreateZapiAccount();
  const updateMutation = useUpdateZapiAccount();
  const deleteMutation = useDeleteZapiAccount();
  const resetPasswordMutation = useResetZapiPanelPassword();

  // ─── Estado dos dialogs ──────────────────────────────────────────────────
  const [formOpen, setFormOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<ZapiAccount | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState<ZapiAccount | null>(null);

  const [resetPassOpen, setResetPassOpen] = useState(false);
  const [resetPassAccount, setResetPassAccount] = useState<ZapiAccount | null>(null);

  // ─── Handlers ────────────────────────────────────────────────────────────

  function handleNovaContaClick() {
    setEditingAccount(null);
    setFormOpen(true);
  }

  function handleEdit(account: ZapiAccount) {
    setEditingAccount(account);
    setFormOpen(true);
  }

  function handleDelete(account: ZapiAccount) {
    setDeletingAccount(account);
    setDeleteOpen(true);
  }

  function handleResetPassword(account: ZapiAccount) {
    setResetPassAccount(account);
    setResetPassOpen(true);
  }

  function handleFormSubmit(values: {
    name: string;
    instance_id: string;
    instance_token?: string;
    client_token?: string;
    panel_password?: string;
    recursos_config?: RecursosConfig;
  }) {
    if (editingAccount) {
      const payload: {
        id: string;
        name?: string;
        instance_id?: string;
        instance_token?: string;
        client_token?: string;
        recursos_config?: RecursosConfig;
      } = {
        id: editingAccount.id,
        name: values.name,
        instance_id: values.instance_id,
      };
      if (values.instance_token && values.instance_token.trim()) {
        payload.instance_token = values.instance_token;
      }
      if (values.client_token && values.client_token.trim()) {
        payload.client_token = values.client_token;
      }
      if (values.recursos_config !== undefined) {
        payload.recursos_config = values.recursos_config;
      }
      updateMutation.mutate(payload, {
        onSuccess: () => setFormOpen(false),
      });
    } else {
      createMutation.mutate(
        {
          name: values.name,
          instance_id: values.instance_id,
          instance_token: values.instance_token ?? '',
          client_token: values.client_token ?? '',
          panel_password: values.panel_password,
        },
        { onSuccess: () => setFormOpen(false) }
      );
    }
  }

  function handleConfirmDelete(accountId: string) {
    deleteMutation.mutate(accountId, {
      onSuccess: () => setDeleteOpen(false),
    });
  }

  function handleResetPasswordSubmit(accountId: string, newPassword: string) {
    resetPasswordMutation.mutate(
      { account_id: accountId, new_password: newPassword },
      { onSuccess: () => setResetPassOpen(false) }
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2].map((i) => (
          <div key={i} className="rounded-lg border border-border p-5 space-y-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-8 w-full mt-4" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Aviso para nao-admin */}
      {!isAdmin && (
        <Alert className="mb-4 border-info/30 bg-info-soft text-info-soft-foreground">
          <Lock className="h-4 w-4" />
          <AlertDescription>
            Apenas administradores podem gerenciar contas Z-API. Você pode visualizar
            as contas configuradas, mas as ações de criar, editar, redefinir senha e
            excluir estão restritas.
          </AlertDescription>
        </Alert>
      )}

      {/* Botao nova conta — somente admin */}
      {isAdmin && (
        <div className="flex justify-end mb-4">
          <Button onClick={handleNovaContaClick} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova conta Z-API
          </Button>
        </div>
      )}

      {/* Grid de contas */}
      {accounts.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="Nenhuma conta Z-API configurada"
          description={
            isAdmin
              ? 'Adicione sua primeira instancia Z-API para comecar a enviar e receber mensagens do WhatsApp.'
              : 'Aguarde o administrador configurar a primeira instancia Z-API.'
          }
          action={
            isAdmin ? (
              <Button onClick={handleNovaContaClick} className="gap-2">
                <Plus className="h-4 w-4" />
                Nova conta Z-API
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              onEdit={isAdmin ? handleEdit : undefined}
              onDelete={isAdmin ? handleDelete : undefined}
              onResetPassword={isAdmin ? handleResetPassword : undefined}
            />
          ))}
        </div>
      )}

      {/* Dialogs */}
      <AccountFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        account={editingAccount}
        isLoading={createMutation.isPending || updateMutation.isPending}
        onSubmit={handleFormSubmit}
      />

      <DeleteAccountDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        account={deletingAccount}
        isLoading={deleteMutation.isPending}
        onConfirm={handleConfirmDelete}
      />

      <ResetPanelPasswordDialog
        open={resetPassOpen}
        onOpenChange={setResetPassOpen}
        account={resetPassAccount}
        isLoading={resetPasswordMutation.isPending}
        onSubmit={handleResetPasswordSubmit}
      />
    </>
  );
}
