import { MessageCircle, Pencil, Trash2, KeyRound } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusChip } from '@/components/ui-system';
import type { ZapiAccount } from '@/hooks/useZapiAccounts';

interface AccountCardProps {
  account: ZapiAccount;
  /** Quando ausente, oculta o botão (gating por role — non-admin não vê). */
  onEdit?: (account: ZapiAccount) => void;
  /** Quando ausente, oculta o botão. */
  onDelete?: (account: ZapiAccount) => void;
  /** Quando ausente, oculta o botão. */
  onResetPassword?: (account: ZapiAccount) => void;
}

export function AccountCard({ account, onEdit, onDelete, onResetPassword }: AccountCardProps) {
  const hasAnyAction = onEdit || onDelete || onResetPassword;
  const createdAt = new Date(account.created_at).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });

  return (
    <Card className="group transition-shadow hover:shadow-md">
      <CardContent className="p-5">
        {/* Cabeçalho do card */}
        <div className="flex items-start gap-3 mb-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
            <MessageCircle className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground truncate">{account.name}</h3>
            <StatusChip variant="info" tone="soft" size="sm" className="mt-1">
              Configurado
            </StatusChip>
          </div>
        </div>

        {/* Dados da conta */}
        <dl className="space-y-2 text-sm mb-4">
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground shrink-0">Instance ID</dt>
            <dd className="font-mono text-xs text-right truncate max-w-[160px]" title={account.instance_id}>
              {account.instance_id_partial}
              <span className="text-muted-foreground">••••••••</span>
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground shrink-0">Cadastrada em</dt>
            <dd>{createdAt}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-muted-foreground shrink-0">Tokens</dt>
            <dd>
              <Badge variant="secondary" className="text-[10px] font-mono">
                ••••••••
              </Badge>
            </dd>
          </div>
        </dl>

        {/* Ações — só renderiza se houver pelo menos uma habilitada */}
        {hasAnyAction && (
          <div className="flex items-center gap-1.5 pt-3 border-t border-border">
            {onEdit && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 gap-1.5"
                onClick={() => onEdit(account)}
              >
                <Pencil className="h-3.5 w-3.5" />
                Editar
              </Button>
            )}
            {onResetPassword && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 gap-1.5"
                onClick={() => onResetPassword(account)}
              >
                <KeyRound className="h-3.5 w-3.5" />
                Senha
              </Button>
            )}
            {onDelete && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive hover:text-destructive hover:bg-destructive/10 px-2"
                onClick={() => onDelete(account)}
                aria-label={`Excluir conta ${account.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
