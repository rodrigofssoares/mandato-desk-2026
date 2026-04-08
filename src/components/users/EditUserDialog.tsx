import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useUpdateProfile, type UserProfile } from '@/hooks/useUsers';
import { ROLES, ROLE_LABELS, ROLE_LEVELS, type Role } from '@/types/permissions';

const schema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório'),
  telefone: z.string().optional(),
  role: z.enum(ROLES).optional(),
});

type FormData = z.infer<typeof schema>;

interface EditUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: UserProfile;
  isOwnProfile: boolean;
  currentUserRole: Role;
}

export function EditUserDialog({
  open,
  onOpenChange,
  user,
  isOwnProfile,
  currentUserRole,
}: EditUserDialogProps) {
  const updateProfile = useUpdateProfile();

  const canChangeRole =
    !isOwnProfile &&
    (currentUserRole === 'admin' || currentUserRole === 'proprietario') &&
    ROLE_LEVELS[currentUserRole] > ROLE_LEVELS[user.role];

  const availableRoles = ROLES.filter(
    (role) => ROLE_LEVELS[role] <= ROLE_LEVELS[currentUserRole]
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      nome: user.nome || '',
      telefone: user.telefone || '',
      role: user.role,
    },
  });

  const selectedRole = watch('role');

  useEffect(() => {
    if (user) {
      reset({
        nome: user.nome || '',
        telefone: user.telefone || '',
        role: user.role,
      });
    }
  }, [user, reset]);

  const onSubmit = async (data: FormData) => {
    await updateProfile.mutateAsync({
      userId: user.id,
      nome: data.nome,
      telefone: data.telefone,
      role: canChangeRole ? data.role : undefined,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isOwnProfile ? 'Editar Perfil' : 'Editar Usuário'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="nome">Nome</Label>
            <Input id="nome" placeholder="Nome completo" {...register('nome')} />
            {errors.nome && (
              <p className="text-sm text-destructive">{errors.nome.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={user.email}
              disabled
              className="text-muted-foreground"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="telefone">Telefone</Label>
            <Input
              id="telefone"
              placeholder="(11) 99999-9999"
              {...register('telefone')}
            />
            {errors.telefone && (
              <p className="text-sm text-destructive">{errors.telefone.message}</p>
            )}
          </div>

          {canChangeRole && (
            <div className="space-y-2">
              <Label>Cargo</Label>
              <Select
                value={selectedRole}
                onValueChange={(value) => setValue('role', value as Role)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cargo" />
                </SelectTrigger>
                <SelectContent>
                  {availableRoles.map((role) => (
                    <SelectItem key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.role && (
                <p className="text-sm text-destructive">{errors.role.message}</p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
