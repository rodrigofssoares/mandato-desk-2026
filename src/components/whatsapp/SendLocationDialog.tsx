// SendLocationDialog — dialog para envio de localização via coordenadas
// T38 — Fase 4 (Interações nativas do WhatsApp)

import { MapPin } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { useSendLocation } from '@/hooks/useZapiLocation';

// ─── Schema de validação ──────────────────────────────────────────────────────

const locationSchema = z.object({
  lat: z
    .number({ invalid_type_error: 'Informe um número' })
    .min(-90, 'Latitude deve ser entre -90 e 90')
    .max(90, 'Latitude deve ser entre -90 e 90'),
  lng: z
    .number({ invalid_type_error: 'Informe um número' })
    .min(-180, 'Longitude deve ser entre -180 e 180')
    .max(180, 'Longitude deve ser entre -180 e 180'),
  name: z.string().max(255).optional(),
  address: z.string().max(255).optional(),
});

type LocationFormValues = z.infer<typeof locationSchema>;

interface SendLocationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  phone: string;
  onSent?: (chatId: string) => void;
}

export function SendLocationDialog({
  open,
  onOpenChange,
  accountId,
  phone,
  onSent,
}: SendLocationDialogProps) {
  const sendLocation = useSendLocation();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<LocationFormValues>({
    resolver: zodResolver(locationSchema),
    mode: 'onChange',
    defaultValues: { lat: undefined, lng: undefined, name: '', address: '' },
  });

  function handleClose() {
    reset();
    onOpenChange(false);
  }

  function onSubmit(values: LocationFormValues) {
    sendLocation.mutate(
      {
        account_id: accountId,
        phone,
        lat: values.lat,
        lng: values.lng,
        name: values.name?.trim() || undefined,
        address: values.address?.trim() || undefined,
      },
      {
        onSuccess: (data) => {
          handleClose();
          if (onSent) onSent(data.chat_id);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Enviar localização
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Informe as coordenadas do local. O destinatário poderá abrir no Google Maps.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="loc-lat" className="text-xs">
                Latitude <span className="text-destructive">*</span>
              </Label>
              <Input
                id="loc-lat"
                type="number"
                step="any"
                placeholder="-22.9068"
                className="h-8 text-xs"
                {...register('lat', { valueAsNumber: true })}
              />
              {errors.lat && (
                <p className="text-[11px] text-destructive">{errors.lat.message}</p>
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="loc-lng" className="text-xs">
                Longitude <span className="text-destructive">*</span>
              </Label>
              <Input
                id="loc-lng"
                type="number"
                step="any"
                placeholder="-43.1729"
                className="h-8 text-xs"
                {...register('lng', { valueAsNumber: true })}
              />
              {errors.lng && (
                <p className="text-[11px] text-destructive">{errors.lng.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="loc-name" className="text-xs">Nome do local (opcional)</Label>
            <Input
              id="loc-name"
              placeholder="Ex: Gabinete da Raquel"
              className="h-8 text-xs"
              {...register('name')}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="loc-address" className="text-xs">Endereço (opcional)</Label>
            <Input
              id="loc-address"
              placeholder="Ex: Rua XV de Novembro, 123"
              className="h-8 text-xs"
              {...register('address')}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" size="sm" onClick={handleClose}>
              Cancelar
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={!isValid || sendLocation.isPending}
            >
              <MapPin className="h-3.5 w-3.5 mr-1.5" />
              {sendLocation.isPending ? 'Enviando...' : 'Enviar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
