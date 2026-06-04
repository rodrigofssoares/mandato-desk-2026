import { MessageCircle, Pencil, Trash2, KeyRound, Sparkles, Zap, Lock, LockOpen } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusChip } from '@/components/ui-system';
import type { ZapiAccount } from '@/hooks/useZapiAccounts';
import { countEnabledFeatures } from '@/lib/featureFlags';

interface AccountCardProps {
  account: ZapiAccount;
  /** EM078: indica se a conta tem senha do painel definida. Exibe badge no card. */
  hasPassword?: boolean;
  /** Quando ausente, oculta o botão (gating por role — non-admin não vê). */
  onEdit?: (account: ZapiAccount) => void;
  /** Quando ausente, oculta o botão. */
  onDelete?: (account: ZapiAccount) => void;
  /** Quando ausente, oculta o botão. */
  onResetPassword?: (account: ZapiAccount) => void;
  /** T46: gerenciador de respostas rápidas. */
  onQuickReplies?: (account: ZapiAccount) => void;
}

export function AccountCard({ account, hasPassword, onEdit, onDelete, onResetPassword, onQuickReplies }: AccountCardProps) {
  const hasAnyAction = onEdit || onDelete || onResetPassword || onQuickReplies;
  const createdAt = new Date(account.created_at).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const activeResourceCount = countEnabledFeatures(account.recursos_config);

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
            <div className="flex items-center gap-1.5 mt-1 flex-wrap">
              <StatusChip variant="info" tone="soft" size="sm">
                Configurado
              </StatusChip>
              {activeResourceCount > 0 && (
                <Badge
                  variant="secondary"
                  className="text-[10px] gap-1 font-medium py-0 px-1.5"
                  title={`${activeResourceCount} recurso${activeResourceCount !== 1 ? 's' : ''} ativo${activeResourceCount !== 1 ? 's' : ''}`}
                >
                  <Sparkles className="h-2.5 w-2.5" />
                  {activeResourceCount} recurso{activeResourceCount !== 1 ? 's' : ''}
                </Badge>
              )}
              {/* EM078: indicador de senha do painel */}
              {hasPassword !== undefined && (
                hasPassword ? (
                  <Badge
                    variant="outline"
                    className="text-[10px] gap-1 font-medium py-0 px-1.5 border-green-300 text-green-700 bg-green-50 dark:border-green-800 dark:text-green-400 dark:bg-green-950/30"
                    title="Acesso às conversas protegido por senha"
                  >
                    <Lock className="h-2.5 w-2.5" />
                    Com senha
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-[10px] gap-1 font-medium py-0 px-1.5 border-amber-300 text-amber-700 bg-amber-50 dark:border-amber-800 dark:text-amber-400 dark:bg-amber-950/30"
                    title="Conversas acessíveis sem senha"
                  >
                    <LockOpen className="h-2.5 w-2.5" />
                    Sem senha
                  </Badge>
                )
              )}
            </div>
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
            {onQuickReplies && (
              <Button
                size="sm"
                variant="outline"
                className="flex-1 gap-1.5"
                onClick={() => onQuickReplies(account)}
                title="Gerenciar respostas rápidas"
              >
                <Zap className="h-3.5 w-3.5" />
                Respostas
              </Button>
            )}
            {onResetPassword && (
              <Button
                size="sm"
                variant="outline"
                className="px-2"
                onClick={() => onResetPassword(account)}
                title="Redefinir senha do painel"
              >
                <KeyRound className="h-3.5 w-3.5" />
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
