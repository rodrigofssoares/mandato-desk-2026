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
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { useCreateWebhook, useUpdateWebhook, WEBHOOK_EVENTS } from '@/hooks/useWebhooks';
import type { Webhook, WebhookEvent } from '@/hooks/useWebhooks';

const webhookSchema = z.object({
  name: z.string().min(1, 'Nome obrigatório'),
  url: z.string().url('URL inválida'),
  events: z.array(z.string()).min(1, 'Selecione pelo menos um evento'),
  is_active: z.boolean(),
});

type WebhookFormData = z.infer<typeof webhookSchema>;

interface WebhookDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  webhook?: Webhook | null;
}

const eventGroups: { label: string; prefix: string }[] = [
  { label: 'Contatos', prefix: 'contact.' },
  { label: 'Demandas', prefix: 'demand.' },
  { label: 'Etiquetas', prefix: 'tag.' },
  { label: 'Articuladores', prefix: 'leader.' },
  { label: 'Outros', prefix: 'branding.' },
];

export function WebhookDialog({ open, onOpenChange, webhook }: WebhookDialogProps) {
  const createWebhook = useCreateWebhook();
  const updateWebhook = useUpdateWebhook();
  const isEditing = !!webhook;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<WebhookFormData>({
    resolver: zodResolver(webhookSchema),
    defaultValues: {
      name: '',
      url: '',
      events: [],
      is_active: true,
    },
  });

  const selectedEvents = watch('events');
  const isActive = watch('is_active');

  useEffect(() => {
    if (open) {
      if (webhook) {
        reset({
          name: webhook.name,
          url: webhook.url,
          events: webhook.events,
          is_active: webhook.is_active,
        });
      } else {
        reset({
          name: '',
          url: '',
          events: [],
          is_active: true,
        });
      }
    }
  }, [open, webhook, reset]);

  const toggleEvent = (event: string) => {
    const current = selectedEvents ?? [];
    const next = current.includes(event)
      ? current.filter((e) => e !== event)
      : [...current, event];
    setValue('events', next, { shouldValidate: true });
  };

  const onSubmit = async (data: WebhookFormData) => {
    if (isEditing && webhook) {
      await updateWebhook.mutateAsync({
        id: webhook.id,
        name: data.name,
        url: data.url,
        events: data.events as WebhookEvent[],
        is_active: data.is_active,
      });
    } else {
      await createWebhook.mutateAsync({
        name: data.name,
        url: data.url,
        events: data.events as WebhookEvent[],
        is_active: data.is_active,
      });
    }
    onOpenChange(false);
  };

  const isPending = createWebhook.isPending || updateWebhook.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Webhook' : 'Novo Webhook'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="webhook-name">Nome *</Label>
            <Input id="webhook-name" {...register('name')} placeholder="Meu Webhook" />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* URL */}
          <div className="space-y-2">
            <Label htmlFor="webhook-url">URL *</Label>
            <Input
              id="webhook-url"
              {...register('url')}
              placeholder="https://exemplo.com/webhook"
            />
            {errors.url && (
              <p className="text-xs text-destructive">{errors.url.message}</p>
            )}
          </div>

          {/* Events */}
          <div className="space-y-3">
            <Label>Eventos *</Label>
            {errors.events && (
              <p className="text-xs text-destructive">{errors.events.message}</p>
            )}
            {eventGroups.map((group) => {
              const events = WEBHOOK_EVENTS.filter((e) => e.startsWith(group.prefix));
              if (events.length === 0) return null;

              return (
                <div key={group.prefix} className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">{group.label}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {events.map((event) => (
                      <label
                        key={event}
                        className="flex items-center gap-2 text-sm cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedEvents?.includes(event) ?? false}
                          onCheckedChange={() => toggleEvent(event)}
                        />
                        {event}
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Active toggle */}
          <div className="flex items-center gap-3">
            <Switch
              checked={isActive}
              onCheckedChange={(checked) => setValue('is_active', checked)}
            />
            <Label>Ativo</Label>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
