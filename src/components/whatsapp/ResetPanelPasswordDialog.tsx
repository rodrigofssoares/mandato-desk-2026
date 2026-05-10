import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { ZapiAccount } from '@/hooks/useZapiAccounts';

// ─── Schema ─────────────────────────────────────────────────────────────────

const schema = z
  .object({
    new_password: z.string().min(8, 'Senha deve ter ao menos 8 caracteres').max(100),
    confirm_password: z.string(),
  })
  .refine((v) => v.new_password === v.confirm_password, {
    message: 'As senhas nao coincidem',
    path: ['confirm_password'],
  });

type FormValues = z.infer<typeof schema>;

// ─── Props ───────────────────────────────────────────────────────────────────

interface ResetPanelPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: ZapiAccount | null;
  isLoading: boolean;
  onSubmit: (accountId: string, newPassword: string) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ResetPanelPasswordDialog({
  open,
  onOpenChange,
  account,
  isLoading,
  onSubmit,
}: ResetPanelPasswordDialogProps) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { new_password: '', confirm_password: '' },
  });

  function handleOpenChange(val: boolean) {
    if (!val) reset();
    onOpenChange(val);
  }

  function handleFormSubmit(values: FormValues) {
    if (!account) return;
    onSubmit(account.id, values.new_password);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Redefinir senha do painel</DialogTitle>
          <DialogDescription>
            {account ? (
              <>
                Conta: <strong>{account.name}</strong>. A nova senha sera exigida ao acessar a
                aba de Conversas desta conta.
              </>
            ) : null}
          </DialogDescription>
        </DialogHeader>

        {/* Warning MVP */}
        <Alert className="border-warning/40 bg-warning-soft text-warning-soft-foreground">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-xs">
            Senha sera re-hashada com bcrypt quando a Edge Function de validacao estiver
            pronta. Use senha de TESTE ate la.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="new_password">Nova senha</Label>
            <Input
              id="new_password"
              type="password"
              autoComplete="new-password"
              placeholder="Digite a nova senha (mínimo 8 caracteres)"
              {...register('new_password')}
            />
            {errors.new_password && (
              <p className="text-xs text-destructive">{errors.new_password.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm_password">Confirmar senha</Label>
            <Input
              id="confirm_password"
              type="password"
              autoComplete="new-password"
              placeholder="Repita a nova senha"
              {...register('confirm_password')}
            />
            {errors.confirm_password && (
              <p className="text-xs text-destructive">{errors.confirm_password.message}</p>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Salvando...' : 'Redefinir senha'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
