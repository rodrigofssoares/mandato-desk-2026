// EventosTabContent.tsx
// CRUD de eventos do mandato (T70 / Fase 6 Onda B — C20).
// Lista eventos futuros + passados, com criação, edição e exclusão.

import { useState } from 'react';
import {
  Calendar,
  Plus,
  Pencil,
  Trash2,
  Loader2,
  MapPin,
  Users,
} from 'lucide-react';
import { format, isPast } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/ui-system';
import {
  useMandatoEvents,
  useCreateMandatoEvent,
  useUpdateMandatoEvent,
  useDeleteMandatoEvent,
  type MandatoEvent,
  type MandatoEventInsert,
} from '@/hooks/useMandatoEvents';
import { useZapiAccounts } from '@/hooks/useZapiAccounts';

interface EventosTabContentProps {
  /** Conta selecionada no momento (para pré-selecionar no form) */
  accountId: string;
}

// ─── EventFormDialog ──────────────────────────────────────────────────────────

interface EventFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: MandatoEvent | null;
  defaultAccountId: string;
  isLoading: boolean;
  onSubmit: (data: MandatoEventInsert) => void;
}

function EventFormDialog({
  open,
  onOpenChange,
  event,
  defaultAccountId,
  isLoading,
  onSubmit,
}: EventFormDialogProps) {
  const { data: accounts = [] } = useZapiAccounts();
  const isEditing = event !== null;

  const [title, setTitle] = useState('');
  const [descricao, setDescricao] = useState('');
  const [dataEvento, setDataEvento] = useState('');
  const [local, setLocal] = useState('');
  const [accountId, setAccountId] = useState(defaultAccountId);

  // Preenche o form ao abrir
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      if (event) {
        setTitle(event.title);
        setDescricao(event.descricao ?? '');
        // datetime-local exige formato "YYYY-MM-DDTHH:mm"
        const dt = new Date(event.data_evento);
        const localDt = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000);
        setDataEvento(localDt.toISOString().slice(0, 16));
        setLocal(event.local ?? '');
        setAccountId(event.account_id);
      } else {
        setTitle('');
        setDescricao('');
        setDataEvento('');
        setLocal('');
        setAccountId(defaultAccountId);
      }
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dataEvento || !accountId) return;

    onSubmit({
      title: title.trim(),
      descricao: descricao.trim() || null,
      data_evento: new Date(dataEvento).toISOString(),
      local: local.trim() || null,
      account_id: accountId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar evento' : 'Novo evento'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Altere os dados do evento.' : 'Crie um novo evento para disparar convites pelo WhatsApp.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label htmlFor="ev-title">Título *</Label>
            <Input
              id="ev-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Caminhada pelo bairro Centro"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ev-data">Data e horário *</Label>
            <Input
              id="ev-data"
              type="datetime-local"
              value={dataEvento}
              onChange={(e) => setDataEvento(e.target.value)}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ev-local">Local</Label>
            <Input
              id="ev-local"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              placeholder="Ex: Praça da Matriz, Centro"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ev-desc">Descrição</Label>
            <Textarea
              id="ev-desc"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Descrição opcional do evento..."
              rows={3}
              className="resize-none text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ev-account">Conta WhatsApp *</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger id="ev-account">
                <SelectValue placeholder="Selecione a conta" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !title.trim() || !dataEvento}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {isEditing ? 'Salvar alterações' : 'Criar evento'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── EventosTabContent ────────────────────────────────────────────────────────

export function EventosTabContent({ accountId }: EventosTabContentProps) {
  const { data: events = [], isLoading } = useMandatoEvents(accountId);
  const createEvent = useCreateMandatoEvent();
  const updateEvent = useUpdateMandatoEvent();
  const deleteEvent = useDeleteMandatoEvent();

  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<MandatoEvent | null>(null);
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null);

  const futureEvents = events.filter((e) => !isPast(new Date(e.data_evento)));
  const pastEvents = events.filter((e) => isPast(new Date(e.data_evento)));

  function handleOpenCreate() {
    setEditingEvent(null);
    setFormOpen(true);
  }

  function handleOpenEdit(event: MandatoEvent) {
    setEditingEvent(event);
    setFormOpen(true);
  }

  function handleSubmit(data: MandatoEventInsert) {
    if (editingEvent) {
      updateEvent.mutate(
        { id: editingEvent.id, ...data },
        { onSuccess: () => setFormOpen(false) },
      );
    } else {
      createEvent.mutate(data, { onSuccess: () => setFormOpen(false) });
    }
  }

  function handleDeleteConfirm() {
    if (!deletingEventId) return;
    deleteEvent.mutate(
      { id: deletingEventId, accountId },
      { onSuccess: () => setDeletingEventId(null) },
    );
  }

  const isMutating = createEvent.isPending || updateEvent.isPending;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Eventos do mandato</h3>
        </div>
        <Button size="sm" className="h-8 gap-1.5" onClick={handleOpenCreate}>
          <Plus className="h-3.5 w-3.5" />
          Novo evento
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando eventos...
          </div>
        ) : events.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="Nenhum evento criado"
            description="Crie um evento para disparar convites pelo WhatsApp."
            action={
              <Button size="sm" onClick={handleOpenCreate} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" />
                Criar evento
              </Button>
            }
          />
        ) : (
          <>
            {futureEvents.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Próximos eventos ({futureEvents.length})
                </p>
                {futureEvents.map((ev) => (
                  <EventCard
                    key={ev.id}
                    event={ev}
                    onEdit={handleOpenEdit}
                    onDelete={(id) => setDeletingEventId(id)}
                  />
                ))}
              </div>
            )}

            {pastEvents.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Eventos passados ({pastEvents.length})
                </p>
                {pastEvents.map((ev) => (
                  <EventCard
                    key={ev.id}
                    event={ev}
                    past
                    onEdit={handleOpenEdit}
                    onDelete={(id) => setDeletingEventId(id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Form Dialog */}
      <EventFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        event={editingEvent}
        defaultAccountId={accountId}
        isLoading={isMutating}
        onSubmit={handleSubmit}
      />

      {/* Alert de confirmação de exclusão */}
      <AlertDialog
        open={!!deletingEventId}
        onOpenChange={(open) => !open && setDeletingEventId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir evento</AlertDialogTitle>
            <AlertDialogDescription>
              Excluir este evento também exclui todas as confirmações de presença (RSVPs) associadas.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDeleteConfirm}
            >
              {deleteEvent.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Excluir evento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── EventCard ────────────────────────────────────────────────────────────────

function EventCard({
  event,
  past = false,
  onEdit,
  onDelete,
}: {
  event: MandatoEvent;
  past?: boolean;
  onEdit: (event: MandatoEvent) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className={`rounded-lg border p-3 space-y-1.5 ${past ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-tight">{event.title}</p>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => onEdit(event)}
            title="Editar evento"
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive hover:text-destructive"
            onClick={() => onDelete(event.id)}
            title="Excluir evento"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {format(new Date(event.data_evento), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
        </span>
        {event.local && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            {event.local}
          </span>
        )}
        {(event.confirmados_count ?? 0) > 0 && (
          <Badge variant="outline" className="gap-1 text-[10px] h-4 px-1.5">
            <Users className="h-2.5 w-2.5" />
            {event.confirmados_count} confirmado{event.confirmados_count !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {event.descricao && (
        <p className="text-xs text-muted-foreground line-clamp-2">{event.descricao}</p>
      )}
    </div>
  );
}
