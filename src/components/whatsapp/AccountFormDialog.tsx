import { useEffect } from 'react';
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

const schemaCreate = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres').max(100),
  instance_id: z.string().min(4, 'Instance ID deve ter ao menos 4 caracteres').max(200),
  instance_token: z.string().min(8, 'Token deve ter ao menos 8 caracteres').max(500),
  client_token: z.string().min(8, 'Client Token deve ter ao menos 8 caracteres').max(500),
  panel_password: z
    .string()
    .max(100)
    .optional()
    .refine((v) => !v || v.length >= 8, 'Senha deve ter ao menos 8 caracteres'),
});

const schemaEdit = z.object({
  name: z.string().min(2, 'Nome deve ter ao menos 2 caracteres').max(100),
  instance_id: z.string().min(4, 'Instance ID deve ter ao menos 4 caracteres').max(200),
  instance_token: z.string().max(500).optional(),
  client_token: z.string().max(500).optional(),
});

type FormValues = z.infer<typeof schemaCreate>;

// ─── Props ───────────────────────────────────────────────────────────────────

interface AccountFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Se definido, estamos editando. Se null, estamos criando. */
  account: ZapiAccount | null;
  isLoading: boolean;
  onSubmit: (values: FormValues) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AccountFormDialog({
  open,
  onOpenChange,
  account,
  isLoading,
  onSubmit,
}: AccountFormDialogProps) {
  const isEditing = account !== null;
  const schema = isEditing ? schemaEdit : schemaCreate;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      instance_id: '',
      instance_token: '',
      client_token: '',
      panel_password: '',
    },
  });

  // Preenche form ao abrir em modo edição
  useEffect(() => {
    if (open) {
      if (account) {
        reset({
          name: account.name,
          instance_id: account.instance_id,
          instance_token: '',
          client_token: '',
        });
      } else {
        reset({
          name: '',
          instance_id: '',
          instance_token: '',
          client_token: '',
          panel_password: '',
        });
      }
    }
  }, [open, account, reset]);

  function handleFormSubmit(values: FormValues) {
    onSubmit(values);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar conta Z-API' : 'Nova conta Z-API'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize os dados da instância Z-API. Deixe os campos de token em branco para manter os valores atuais.'
              : 'Configure uma nova instância Z-API para enviar e receber mensagens.'}
          </DialogDescription>
        </DialogHeader>

        {/* Warning de segurança — tokens em texto puro no MVP */}
        <Alert className="border-warning/40 bg-warning-soft text-warning-soft-foreground">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <AlertDescription className="text-xs">
            Por enquanto, tokens ficam armazenados em texto puro. A criptografia
            AES-256-GCM sera aplicada quando a Edge Function{' '}
            <code className="font-mono">zapi-encrypt</code> estiver implementada (proxima
            sessao). Use apenas instancias de TESTE ate la.
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          {/* Nome */}
          <div className="space-y-1.5">
            <Label htmlFor="name">Nome da conta</Label>
            <Input
              id="name"
              placeholder="Ex: Conta Principal, Atendimento..."
              {...register('name')}
            />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Instance ID */}
          <div className="space-y-1.5">
            <Label htmlFor="instance_id">Instance ID</Label>
            <Input
              id="instance_id"
              placeholder="ID da instancia Z-API"
              className="font-mono text-sm"
              {...register('instance_id')}
            />
            {errors.instance_id && (
              <p className="text-xs text-destructive">{errors.instance_id.message}</p>
            )}
          </div>

          {/* Instance Token */}
          <div className="space-y-1.5">
            <Label htmlFor="instance_token">
              Instance Token
              {isEditing && (
                <span className="ml-1.5 text-xs text-muted-foreground">(deixe em branco para manter)</span>
              )}
            </Label>
            <Input
              id="instance_token"
              type="password"
              autoComplete="off"
              placeholder={isEditing ? '••••••••' : 'Token da instancia Z-API'}
              className="font-mono text-sm"
              {...register('instance_token')}
            />
            {errors.instance_token && (
              <p className="text-xs text-destructive">{errors.instance_token.message}</p>
            )}
          </div>

          {/* Client Token */}
          <div className="space-y-1.5">
            <Label htmlFor="client_token">
              Client Token
              {isEditing && (
                <span className="ml-1.5 text-xs text-muted-foreground">(deixe em branco para manter)</span>
              )}
            </Label>
            <Input
              id="client_token"
              type="password"
              autoComplete="off"
              placeholder={isEditing ? '••••••••' : 'Client Token Z-API'}
              className="font-mono text-sm"
              {...register('client_token')}
            />
            {errors.client_token && (
              <p className="text-xs text-destructive">{errors.client_token.message}</p>
            )}
          </div>

          {/* Senha extra do painel — somente na criação */}
          {!isEditing && (
            <div className="space-y-1.5">
              <Label htmlFor="panel_password">
                Senha do painel{' '}
                <span className="text-xs text-muted-foreground">(opcional)</span>
              </Label>
              <Input
                id="panel_password"
                type="password"
                autoComplete="new-password"
                placeholder="Senha para acessar as conversas (mínimo 8 caracteres)"
                {...register('panel_password')}
              />
              {errors.panel_password && (
                <p className="text-xs text-destructive">{errors.panel_password.message}</p>
              )}
              <p className="text-[11px] text-muted-foreground">
                Senha armazenada em texto puro temporariamente. Bcrypt hash sera
                aplicado via Edge Function em sessao futura (T03). Use senha de TESTE.
              </p>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Salvando...' : isEditing ? 'Salvar alterações' : 'Criar conta'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
