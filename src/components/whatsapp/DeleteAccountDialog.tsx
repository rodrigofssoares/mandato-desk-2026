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
import type { ZapiAccount } from '@/hooks/useZapiAccounts';

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: ZapiAccount | null;
  isLoading: boolean;
  onConfirm: (accountId: string) => void;
}

export function DeleteAccountDialog({
  open,
  onOpenChange,
  account,
  isLoading,
  onConfirm,
}: DeleteAccountDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir conta Z-API?</AlertDialogTitle>
          <AlertDialogDescription>
            A conta{' '}
            <strong>{account?.name}</strong> sera removida permanentemente. Os logs e
            mensagens existentes serao mantidos com o ID da conta preservado. Esta acao nao pode
            ser desfeita.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isLoading}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isLoading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => account && onConfirm(account.id)}
          >
            {isLoading ? 'Excluindo...' : 'Excluir conta'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
