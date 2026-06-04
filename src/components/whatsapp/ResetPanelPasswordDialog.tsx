// Componente: ResetPanelPasswordDialog
//
// Dialog admin-only para definir, alterar ou remover a senha do painel
// de conversas de uma conta Z-API.
//
// Modos:
//   - hasPassword=false → "Definir senha" (conta sem senha)
//   - hasPassword=true  → "Alterar senha" (conta já tem senha)
//
// CRUD:
//   - Definir nova senha  → onSubmit
//   - Alterar senha       → onSubmit (mesmo fluxo — EF faz upsert)
//   - Remover senha       → onRemove (CRUD completo: regra Rodrigo)
//
// Segurança:
//   - Hash PBKDF2-SHA256 gerado server-side pela EF zapi-set-panel-password.
//   - Senha nunca sai do componente em texto puro além da chamada à EF.
//
// Reference: RAQ-MAND-EM078 — T4 (admin gestão de senha)

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Key, Trash2, ShieldCheck } from 'lucide-react';
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
import { useState } from 'react';
import type { ZapiAccount } from '@/hooks/useZapiAccounts';

// ─── Schema ─────────────────────────────────────────────────────────────────

const schema = z
  .object({
    new_password: z.string().min(8, 'Senha deve ter ao menos 8 caracteres').max(100),
    confirm_password: z.string(),
  })
  .refine((v) => v.new_password === v.confirm_password, {
    message: 'As senhas não coincidem',
    path: ['confirm_password'],
  });

type FormValues = z.infer<typeof schema>;

// ─── Props ───────────────────────────────────────────────────────────────────

interface ResetPanelPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: ZapiAccount | null;
  /** Indica se a conta já tem senha definida (controla label/copy do dialog). */
  hasPassword: boolean;
  isLoading: boolean;
  isRemoving?: boolean;
  onSubmit: (accountId: string, newPassword: string) => void;
  onRemove?: (accountId: string) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ResetPanelPasswordDialog({
  open,
  onOpenChange,
  account,
  hasPassword,
  isLoading,
  isRemoving = false,
  onSubmit,
  onRemove,
}: ResetPanelPasswordDialogProps) {
  const [removeConfirmOpen, setRemoveConfirmOpen] = useState(false);

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

  function handleRemoveConfirm() {
    if (!account || !onRemove) return;
    setRemoveConfirmOpen(false);
    onRemove(account.id);
    handleOpenChange(false);
  }

  const actionLabel = hasPassword ? 'Alterar senha' : 'Definir senha';
  const dialogTitle = hasPassword ? 'Alterar senha do painel' : 'Definir senha do painel';
  const dialogDescription = account ? (
    <>
      Conta: <strong>{account.name}</strong>.{' '}
      {hasPassword
        ? 'Digite a nova senha. A anterior será invalidada e todos os usuários precisarão validar novamente.'
        : 'Defina uma senha para proteger o acesso às conversas desta conta.'}
    </>
  ) : null;

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-4 w-4 text-muted-foreground" />
              {dialogTitle}
            </DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
          </DialogHeader>

          {/* Info de segurança */}
          <div className="flex items-start gap-2 rounded-md border border-green-200 bg-green-50 p-3 text-xs text-green-800 dark:border-green-900/30 dark:bg-green-950/20 dark:text-green-300">
            <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Senha protegida por hash PBKDF2-SHA256 (100k iterações) no servidor.
              Nunca armazenada em texto puro.
            </span>
          </div>

          <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new_password">Nova senha</Label>
              <Input
                id="new_password"
                type="password"
                autoComplete="new-password"
                placeholder="Mínimo 8 caracteres"
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

            <DialogFooter className="pt-2 flex-col sm:flex-row gap-2">
              {/* Remover senha — só quando já tem senha definida */}
              {hasPassword && onRemove && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="sm:mr-auto"
                  onClick={() => setRemoveConfirmOpen(true)}
                  disabled={isLoading || isRemoving}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Remover senha
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                onClick={() => handleOpenChange(false)}
                disabled={isLoading || isRemoving}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isLoading || isRemoving}>
                {isLoading ? 'Salvando...' : actionLabel}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Confirmação de remoção */}
      <AlertDialog open={removeConfirmOpen} onOpenChange={setRemoveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover senha do painel?</AlertDialogTitle>
            <AlertDialogDescription>
              A conta <strong>{account?.name}</strong> ficará acessível sem senha para todos os
              usuários autenticados. Esta ação não pode ser desfeita (mas você pode definir uma
              nova senha depois).
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover senha
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
