import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState } from 'react';

const ownPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Senha atual é obrigatória'),
    newPassword: z.string().min(6, 'Mínimo de 6 caracteres'),
    confirmPassword: z.string().min(1, 'Confirmação é obrigatória'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });

const otherPasswordSchema = z
  .object({
    newPassword: z.string().min(6, 'Mínimo de 6 caracteres'),
    confirmPassword: z.string().min(1, 'Confirmação é obrigatória'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });

type OwnPasswordForm = z.infer<typeof ownPasswordSchema>;
type OtherPasswordForm = z.infer<typeof otherPasswordSchema>;

interface ChangePasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  isOwnPassword: boolean;
}

export function ChangePasswordDialog({
  open,
  onOpenChange,
  userId,
  userName,
  isOwnPassword,
}: ChangePasswordDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const ownForm = useForm<OwnPasswordForm>({
    resolver: zodResolver(ownPasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  });

  const otherForm = useForm<OtherPasswordForm>({
    resolver: zodResolver(otherPasswordSchema),
    defaultValues: { newPassword: '', confirmPassword: '' },
  });

  const handleOwnPasswordSubmit = async (data: OwnPasswordForm) => {
    setIsSubmitting(true);
    try {
      // Verifica a senha atual fazendo login
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: (await supabase.auth.getUser()).data.user?.email ?? '',
        password: data.currentPassword,
      });

      if (signInError) {
        toast.error('Senha atual incorreta');
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password: data.newPassword,
      });

      if (error) {
        toast.error('Erro ao alterar senha');
        return;
      }

      toast.success('Senha alterada com sucesso');
      ownForm.reset();
      onOpenChange(false);
    } catch {
      toast.error('Erro ao alterar senha');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtherPasswordSubmit = async (_data: OtherPasswordForm) => {
    // TODO: Implementar alteração de senha de outro usuário via Edge Function
    // (manage-user-password). Requer Supabase Admin API no server-side.
    toast.error(
      'Alteração de senha de outro usuário requer configuração server-side (Edge Function). Entre em contato com o desenvolvedor.'
    );
  };

  if (isOwnPassword) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar Minha Senha</DialogTitle>
          </DialogHeader>

          <form onSubmit={ownForm.handleSubmit(handleOwnPasswordSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Senha Atual</Label>
              <Input
                id="currentPassword"
                type="password"
                {...ownForm.register('currentPassword')}
              />
              {ownForm.formState.errors.currentPassword && (
                <p className="text-sm text-destructive">
                  {ownForm.formState.errors.currentPassword.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova Senha</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Mínimo 6 caracteres"
                {...ownForm.register('newPassword')}
              />
              {ownForm.formState.errors.newPassword && (
                <p className="text-sm text-destructive">
                  {ownForm.formState.errors.newPassword.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                {...ownForm.register('confirmPassword')}
              />
              {ownForm.formState.errors.confirmPassword && (
                <p className="text-sm text-destructive">
                  {ownForm.formState.errors.confirmPassword.message}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Alterar Senha
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Alterar Senha - {userName}</DialogTitle>
          <DialogDescription>
            Defina uma nova senha para este usuário.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={otherForm.handleSubmit(handleOtherPasswordSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="otherNewPassword">Nova Senha</Label>
            <Input
              id="otherNewPassword"
              type="password"
              placeholder="Mínimo 6 caracteres"
              {...otherForm.register('newPassword')}
            />
            {otherForm.formState.errors.newPassword && (
              <p className="text-sm text-destructive">
                {otherForm.formState.errors.newPassword.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="otherConfirmPassword">Confirmar Nova Senha</Label>
            <Input
              id="otherConfirmPassword"
              type="password"
              {...otherForm.register('confirmPassword')}
            />
            {otherForm.formState.errors.confirmPassword && (
              <p className="text-sm text-destructive">
                {otherForm.formState.errors.confirmPassword.message}
              </p>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Alterar Senha
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
