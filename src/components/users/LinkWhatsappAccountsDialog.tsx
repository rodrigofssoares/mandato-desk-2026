import { MessageCircle, Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui-system';
import { useZapiAccounts } from '@/hooks/useZapiAccounts';
import { useZapiAccountUsers, useToggleAccountUserBinding } from '@/hooks/useZapiAccountUsers';

interface LinkWhatsappAccountsDialogProps {
  userId: string;
  userName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LinkWhatsappAccountsDialog({
  userId,
  userName,
  open,
  onOpenChange,
}: LinkWhatsappAccountsDialogProps) {
  const { data: accounts = [], isLoading: accountsLoading } = useZapiAccounts();
  const { data: bindings = [], isLoading: bindingsLoading } = useZapiAccountUsers();
  const toggleBinding = useToggleAccountUserBinding();

  const isLoading = accountsLoading || bindingsLoading;

  // IDs das contas vinculadas a este usuário
  const linkedAccountIds = new Set(
    bindings
      .filter((b) => b.user_id === userId)
      .map((b) => b.account_id),
  );

  function handleToggle(accountId: string, currentlyLinked: boolean) {
    toggleBinding.mutate({
      account_id: accountId,
      user_id: userId,
      linked: !currentlyLinked,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" />
            Contas WhatsApp — {userName}
          </DialogTitle>
          <DialogDescription>
            Marque as contas que este usuário poderá acessar na aba Conversas.
          </DialogDescription>
        </DialogHeader>

        <Alert className="border-info/30 bg-info-soft text-info-soft-foreground">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Administradores e Proprietários veem todas as contas, independente de vínculo.
          </AlertDescription>
        </Alert>

        <div className="space-y-3 py-2">
          {isLoading && (
            <>
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-4 w-4 rounded" />
                  <Skeleton className="h-4 w-48" />
                </div>
              ))}
            </>
          )}

          {!isLoading && accounts.length === 0 && (
            <EmptyState
              icon={MessageCircle}
              title="Nenhuma conta Z-API cadastrada"
              description="Cadastre uma conta Z-API na aba Contas do WhatsApp para poder vincular usuários."
            />
          )}

          {!isLoading && accounts.map((account) => {
            const isLinked = linkedAccountIds.has(account.id);
            const isPending = toggleBinding.isPending;

            return (
              <div key={account.id} className="flex items-center gap-3 py-1">
                <Checkbox
                  id={`account-${account.id}`}
                  checked={isLinked}
                  disabled={isPending}
                  onCheckedChange={() => handleToggle(account.id, isLinked)}
                />
                <Label
                  htmlFor={`account-${account.id}`}
                  className="flex-1 cursor-pointer text-sm font-normal"
                >
                  <span className="font-medium">{account.name}</span>
                  {account.status === 'disconnected' && (
                    <span className="ml-2 text-xs text-muted-foreground">(desconectada)</span>
                  )}
                </Label>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
