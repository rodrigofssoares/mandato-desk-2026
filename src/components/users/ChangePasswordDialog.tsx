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
import { PasswordInput } from '@/components/ui/password-input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

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
  const { refreshProfile } = useAuth();

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

      // Se o perfil estava marcado como senha temporária, limpa a flag.
      await supabase
        .from('profiles')
        .update({ senha_temporaria: false })
        .eq('id', userId);

      // Sincroniza profile no contexto (senão o ProtectedRoute ainda
      // enxerga senha_temporaria=true e reboca pra /primeiro-acesso).
      await refreshProfile();

      toast.success('Senha alterada com sucesso');
      ownForm.reset();
      onOpenChange(false);
    } catch {
      toast.error('Erro ao alterar senha');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOtherPasswordSubmit = async (data: OtherPasswordForm) => {
    setIsSubmitting(true);
    try {
      const { data: resp, error } = await supabase.functions.invoke(
        'reset-user-password',
        { body: { userId, password: data.newPassword } },
      );

      if (error) {
        // Tenta extrair a mensagem de erro real do body retornado pela
        // edge function (supabase-js embrulha o body em `error.context`
        // quando o status é não-2xx).
        let detail =
          (resp as { error?: string } | null)?.error ??
          (error as { message?: string }).message ??
          'Erro ao redefinir senha';
        const ctx = (error as { context?: Response }).context;
        if (ctx && typeof ctx.json === 'function') {
          try {
            const body = await ctx.json();
            if (body?.error) detail = body.error;
          } catch {
            /* body não é JSON — mantém detail original */
          }
        }
        toast.error(detail);
        return;
      }

      toast.success(
        'Senha redefinida. O usuário será obrigado a criar uma nova senha no próximo login.',
      );
      otherForm.reset();
      onOpenChange(false);
    } catch {
      toast.error('Erro ao redefinir senha');
    } finally {
      setIsSubmitting(false);
    }
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
              <PasswordInput
                id="currentPassword"
                autoComplete="current-password"
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
              <PasswordInput
                id="newPassword"
                placeholder="Mínimo 6 caracteres"
                autoComplete="new-password"
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
              <PasswordInput
                id="confirmPassword"
                autoComplete="new-password"
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
            <PasswordInput
              id="otherNewPassword"
              placeholder="Mínimo 6 caracteres"
              autoComplete="new-password"
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
            <PasswordInput
              id="otherConfirmPassword"
              autoComplete="new-password"
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
