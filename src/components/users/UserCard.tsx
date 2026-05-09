import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusChip, type StatusChipVariant } from '@/components/ui-system';
import { Avatar } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreVertical, Shield, UserCheck, UserX, RefreshCw, KeyRound, Pencil, Phone } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useUpdateUserRole, useUpdateUserStatus, type UserProfile } from '@/hooks/useUsers';
import { ROLES, ROLE_LABELS, ROLE_LEVELS, type Role } from '@/types/permissions';
import { ChangePasswordDialog } from './ChangePasswordDialog';
import { EditUserDialog } from './EditUserDialog';

interface UserCardProps {
  user: UserProfile;
}

const statusConfig: Record<string, { label: string; chipVariant: StatusChipVariant }> = {
  ATIVO:    { label: 'Ativo',    chipVariant: 'success' },
  PENDENTE: { label: 'Pendente', chipVariant: 'warning' },
  INATIVO:  { label: 'Inativo',  chipVariant: 'danger' },
};

const roleChipVariant: Record<Role, StatusChipVariant> = {
  admin:        'primary',
  proprietario: 'info',
  assessor:     'accent',
  assistente:   'neutral',
  estagiario:   'warning',
};

function getInitials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
}

export function UserCard({ user }: UserCardProps) {
  const { profile: currentUser } = useAuth();
  const updateRole = useUpdateUserRole();
  const updateStatus = useUpdateUserStatus();
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const isOwnCard = currentUser?.id === user.id;
  const currentUserLevel = ROLE_LEVELS[(currentUser?.role as Role) ?? 'estagiario'];
  const targetUserLevel = ROLE_LEVELS[user.role];
  const canManage = !isOwnCard && currentUserLevel > targetUserLevel;

  const status = statusConfig[user.status_aprovacao] ?? statusConfig.ATIVO;

  const availableRoles = ROLES.filter((r) => ROLE_LEVELS[r] < currentUserLevel);

  return (
    <>
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Avatar className="h-10 w-10 shrink-0 bg-muted flex items-center justify-center text-sm font-medium">
              <span>{getInitials(user.nome?.trim() || user.email)}</span>
            </Avatar>

            <div className="flex-1 min-w-0 space-y-1">
              <p className="font-medium truncate">{user.nome?.trim() || user.email}</p>
              <p className="text-sm text-muted-foreground truncate">{user.email}</p>
              {user.telefone && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {user.telefone}
                </p>
              )}
              <div className="flex items-center gap-2 flex-wrap">
                <StatusChip variant={roleChipVariant[user.role] ?? 'neutral'}>
                  {ROLE_LABELS[user.role] ?? user.role}
                </StatusChip>
                <StatusChip variant={status.chipVariant}>
                  {status.label}
                </StatusChip>
              </div>
            </div>

            {canManage && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Shield className="h-4 w-4 mr-2" />
                      Alterar Cargo
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      {availableRoles.map((role) => (
                        <DropdownMenuItem
                          key={role}
                          disabled={role === user.role}
                          onClick={() => updateRole.mutate({ userId: user.id, newRole: role })}
                        >
                          {ROLE_LABELS[role]}
                          {role === user.role && ' (atual)'}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>

                  <DropdownMenuSeparator />

                  {user.status_aprovacao === 'PENDENTE' && (
                    <DropdownMenuItem
                      onClick={() => updateStatus.mutate({ userId: user.id, newStatus: 'ATIVO' })}
                    >
                      <UserCheck className="h-4 w-4 mr-2" />
                      Aprovar
                    </DropdownMenuItem>
                  )}

                  {user.status_aprovacao === 'ATIVO' && (
                    <DropdownMenuItem
                      onClick={() => updateStatus.mutate({ userId: user.id, newStatus: 'INATIVO' })}
                      className="text-destructive focus:text-destructive"
                    >
                      <UserX className="h-4 w-4 mr-2" />
                      Desativar
                    </DropdownMenuItem>
                  )}

                  {user.status_aprovacao === 'INATIVO' && (
                    <DropdownMenuItem
                      onClick={() => updateStatus.mutate({ userId: user.id, newStatus: 'ATIVO' })}
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Reativar
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuSeparator />

                  <DropdownMenuItem onClick={() => setPasswordDialogOpen(true)}>
                    <KeyRound className="h-4 w-4 mr-2" />
                    Alterar Senha
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            {isOwnCard && (
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setEditDialogOpen(true)}
                  title="Editar meu perfil"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setPasswordDialogOpen(true)}
                  title="Alterar minha senha"
                >
                  <KeyRound className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <ChangePasswordDialog
        open={passwordDialogOpen}
        onOpenChange={setPasswordDialogOpen}
        userId={user.id}
        userName={user.nome?.trim() || user.email}
        isOwnPassword={isOwnCard}
      />

      <EditUserDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        user={user}
        isOwnProfile={isOwnCard}
        currentUserRole={(currentUser?.role as Role) ?? 'estagiario'}
      />
    </>
  );
}
