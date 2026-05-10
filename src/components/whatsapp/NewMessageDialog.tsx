import { useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Send, AlertCircle } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useZapiAccounts } from '@/hooks/useZapiAccounts';
import { useSendZapiMessage } from '@/hooks/useZapiMessages';

// ─── Schema ─────────────────────────────────────────────────────────────────

const schema = z.object({
  account_id: z.string().uuid('Selecione uma conta'),
  phone: z
    .string()
    .min(10, 'Informe DDD + número')
    .refine((v) => v.replace(/\D+/g, '').length >= 10, 'Telefone inválido'),
  message: z
    .string()
    .trim()
    .min(1, 'Mensagem é obrigatória')
    .max(4096, 'Mensagem excede 4096 caracteres'),
});

type FormValues = z.infer<typeof schema>;

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Aplica máscara BR enquanto o usuário digita. Aceita +55 e DDIs livres. */
function maskPhoneBR(raw: string): string {
  const digits = raw.replace(/\D+/g, '').slice(0, 13);

  // Mantém formato +55 (11) 99999-9999 quando começa com 55
  if (digits.startsWith('55') && digits.length > 2) {
    const ddd = digits.slice(2, 4);
    const rest = digits.slice(4);
    if (rest.length <= 4) return `+55 (${ddd}) ${rest}`;
    if (rest.length <= 8) return `+55 (${ddd}) ${rest.slice(0, 4)}-${rest.slice(4)}`;
    return `+55 (${ddd}) ${rest.slice(0, 5)}-${rest.slice(5, 9)}`;
  }

  // Formato simples: (11) 99999-9999
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface NewMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function NewMessageDialog({ open, onOpenChange }: NewMessageDialogProps) {
  const { data: accounts = [], isLoading: accountsLoading } = useZapiAccounts();
  const sendMessage = useSendZapiMessage();

  const sendableAccounts = useMemo(
    () => accounts.filter((a) => a.status !== 'disconnected'),
    [accounts],
  );

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { account_id: '', phone: '', message: '' },
  });

  const messageValue = watch('message') ?? '';

  // Reset ao abrir + pré-seleciona única conta (caso tenha apenas 1)
  useEffect(() => {
    if (open) {
      const defaultAccount =
        sendableAccounts.length === 1 ? sendableAccounts[0].id : '';
      reset({ account_id: defaultAccount, phone: '', message: '' });
    }
  }, [open, reset, sendableAccounts]);

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    setValue('phone', maskPhoneBR(e.target.value), { shouldValidate: true });
  }

  function onSubmit(values: FormValues) {
    sendMessage.mutate(
      {
        account_id: values.account_id,
        phone: values.phone,
        message: values.message,
      },
      {
        onSuccess: () => onOpenChange(false),
      },
    );
  }

  const noSendableAccounts = !accountsLoading && sendableAccounts.length === 0;
  const phone = watch('phone') ?? '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova mensagem</DialogTitle>
          <DialogDescription>
            Envie uma mensagem direto pra um número, sem precisar abrir uma conversa.
            Se ainda não houver chat, ele será criado automaticamente.
          </DialogDescription>
        </DialogHeader>

        {noSendableAccounts && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Nenhuma conta Z-API disponível. Cadastre uma conta na aba Contas antes de enviar mensagens.
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Conta Z-API */}
          <div className="space-y-1.5">
            <Label htmlFor="account_id">Conta de envio</Label>
            <Controller
              control={control}
              name="account_id"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={accountsLoading || noSendableAccounts}
                >
                  <SelectTrigger id="account_id">
                    <SelectValue
                      placeholder={
                        accountsLoading ? 'Carregando contas...' : 'Selecione a conta'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {sendableAccounts.map((acc) => (
                      <SelectItem key={acc.id} value={acc.id}>
                        {acc.name}
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({acc.status})
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.account_id && (
              <p className="text-xs text-destructive">{errors.account_id.message}</p>
            )}
          </div>

          {/* Telefone */}
          <div className="space-y-1.5">
            <Label htmlFor="phone">Telefone do destinatário</Label>
            <Input
              id="phone"
              inputMode="tel"
              autoComplete="off"
              placeholder="+55 (11) 99999-9999"
              value={phone}
              onChange={handlePhoneChange}
              disabled={sendMessage.isPending}
            />
            {/* registramos o campo só pra entrar no schema; valor controlado via watch/setValue */}
            <input type="hidden" {...register('phone')} value={phone} />
            {errors.phone && (
              <p className="text-xs text-destructive">{errors.phone.message}</p>
            )}
            <p className="text-[11px] text-muted-foreground">
              DDI 55 será adicionado automaticamente caso você informe apenas DDD + número.
            </p>
          </div>

          {/* Mensagem */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="message">Mensagem</Label>
              <span className="text-[11px] text-muted-foreground">
                {messageValue.length}/4096
              </span>
            </div>
            <Textarea
              id="message"
              rows={5}
              placeholder="Escreva sua mensagem..."
              {...register('message')}
              disabled={sendMessage.isPending}
            />
            {errors.message && (
              <p className="text-xs text-destructive">{errors.message.message}</p>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={sendMessage.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={sendMessage.isPending || noSendableAccounts}
            >
              <Send className="h-4 w-4 mr-2" />
              {sendMessage.isPending ? 'Enviando...' : 'Enviar mensagem'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
