// EventInviteDialog.tsx
// Dialog para enviar convite de evento pelo WhatsApp e registrar RSVP (T71 / Fase 6 Onda B — C20).

import { useState } from 'react';
import { Calendar, MapPin, Send, Loader2, Check, X } from 'lucide-react';
import { format, isFuture } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useMandatoEvents, useContactEventRsvps, useUpsertRsvp, type MandatoEvent } from '@/hooks/useMandatoEvents';
import { useSendZapiMessage } from '@/hooks/useZapiMessages';

interface EventInviteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  contactId: string;
  contactName: string;
  phone: string;
}

const RSVP_LABELS: Record<string, string> = {
  pendente:   'Aguardando',
  confirmado: 'Confirmado',
  recusado:   'Recusado',
};

const RSVP_BADGE_CLASS: Record<string, string> = {
  pendente:   'bg-amber-100 text-amber-700 border-amber-200',
  confirmado: 'bg-green-100 text-green-700 border-green-200',
  recusado:   'bg-red-100 text-red-700 border-red-200',
};

export function EventInviteDialog({
  open,
  onOpenChange,
  accountId,
  contactId,
  contactName,
  phone,
}: EventInviteDialogProps) {
  const { data: events = [], isLoading: eventsLoading } = useMandatoEvents(accountId);
  const { data: rsvps = [], isLoading: rsvpsLoading } = useContactEventRsvps(contactId);
  const upsertRsvp = useUpsertRsvp();
  const sendMessage = useSendZapiMessage();

  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);

  const futureEvents = events.filter((e) => isFuture(new Date(e.data_evento)));

  const selectedEvent = futureEvents.find((e) => e.id === selectedEventId) ?? null;

  // Busca o RSVP existente para o evento selecionado
  const existingRsvp = rsvps.find((r) => r.event_id === selectedEventId) ?? null;

  // Monta a mensagem de convite
  function buildInviteMessage(event: MandatoEvent): string {
    const dataFormatada = format(new Date(event.data_evento), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    const localPart = event.local ? ` no local: ${event.local}.` : '.';
    return (
      `Olá ${contactName}! Você está convidado(a) para ${event.title} em ${dataFormatada}${localPart}` +
      ` Confirme sua presença respondendo SIM ou NÃO.`
    );
  }

  async function handleSendInvite() {
    if (!selectedEvent) return;

    const message = buildInviteMessage(selectedEvent);

    sendMessage.mutate(
      { account_id: accountId, phone, message },
      {
        onSuccess: async () => {
          // Cria/atualiza o RSVP como 'pendente'
          await upsertRsvp.mutateAsync({
            event_id: selectedEvent.id,
            contact_id: contactId,
            status: 'pendente',
          });
          toast.success('Convite enviado com sucesso');
          onOpenChange(false);
        },
      },
    );
  }

  async function handleUpdateRsvp(eventId: string, status: 'confirmado' | 'recusado') {
    await upsertRsvp.mutateAsync({ event_id: eventId, contact_id: contactId, status });
    toast.success(status === 'confirmado' ? 'Presença confirmada' : 'Presença recusada');
  }

  const isSending = sendMessage.isPending || upsertRsvp.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Enviar convite de evento</DialogTitle>
          <DialogDescription>
            Selecione um evento e envie o convite para {contactName}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {eventsLoading || rsvpsLoading ? (
            <div className="flex items-center justify-center py-8 gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando...
            </div>
          ) : futureEvents.length === 0 ? (
            <div className="py-6 text-center">
              <Calendar className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhum evento futuro.</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Crie um evento primeiro na aba Eventos.
              </p>
            </div>
          ) : (
            <>
              {/* Lista de eventos */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {futureEvents.map((ev) => {
                  const rsvp = rsvps.find((r) => r.event_id === ev.id);
                  const isSelected = selectedEventId === ev.id;

                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => setSelectedEventId(isSelected ? null : ev.id)}
                      className={`w-full text-left rounded-lg border p-3 transition-colors ${
                        isSelected
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-tight">{ev.title}</p>
                        {rsvp && (
                          <Badge
                            variant="outline"
                            className={`text-[10px] shrink-0 ${RSVP_BADGE_CLASS[rsvp.status] ?? ''}`}
                          >
                            {RSVP_LABELS[rsvp.status] ?? rsvp.status}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(ev.data_evento), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                        {ev.local && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {ev.local}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Preview da mensagem e ações do RSVP */}
              {selectedEvent && (
                <>
                  <Separator />

                  <div className="space-y-3">
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                      Preview da mensagem
                    </p>
                    <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground leading-relaxed">
                      {buildInviteMessage(selectedEvent)}
                    </div>

                    {/* Estado do RSVP existente + ações */}
                    {existingRsvp ? (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">
                          Convite já enviado. Status atual:{' '}
                          <Badge
                            variant="outline"
                            className={`text-[10px] ml-1 ${RSVP_BADGE_CLASS[existingRsvp.status] ?? ''}`}
                          >
                            {RSVP_LABELS[existingRsvp.status] ?? existingRsvp.status}
                          </Badge>
                        </p>
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="flex-1 text-green-600 border-green-200 hover:bg-green-50"
                            disabled={existingRsvp.status === 'confirmado' || isSending}
                            onClick={() => void handleUpdateRsvp(selectedEvent.id, 'confirmado')}
                          >
                            <Check className="h-3.5 w-3.5 mr-1.5" />
                            Confirmar presença
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="flex-1 text-destructive border-destructive/30 hover:bg-destructive/5"
                            disabled={existingRsvp.status === 'recusado' || isSending}
                            onClick={() => void handleUpdateRsvp(selectedEvent.id, 'recusado')}
                          >
                            <X className="h-3.5 w-3.5 mr-1.5" />
                            Recusou
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        className="w-full gap-2"
                        disabled={isSending}
                        onClick={() => void handleSendInvite()}
                      >
                        {isSending
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Send className="h-4 w-4" />}
                        Enviar convite
                      </Button>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
