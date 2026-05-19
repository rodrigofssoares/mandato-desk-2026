// ForwardMessageDialog — dialog de seleção de destino ao encaminhar mensagem
// T37 — Fase 4 (Interações nativas do WhatsApp)

import { useMemo, useState } from 'react';
import { Forward, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { useForwardMessage } from '@/hooks/useZapiForward';
import { formatPhone } from '@/lib/zapi-format';
import type { ZapiChat } from '@/hooks/useZapiChats';
import type { ZapiMessage } from '@/hooks/useZapiMessages';

interface ForwardMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: ZapiMessage | null;
  accountId: string;
  chats: ZapiChat[];
}

function chatInitials(chat: ZapiChat): string {
  const name = chat.contact_name ?? chat.whatsapp_name ?? '';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return chat.phone.slice(-2);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function ForwardMessageDialog({
  open,
  onOpenChange,
  message,
  accountId,
  chats,
}: ForwardMessageDialogProps) {
  const [search, setSearch] = useState('');
  const [selectedPhone, setSelectedPhone] = useState<string | null>(null);
  const forwardMutation = useForwardMessage();

  const filteredChats = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return chats;
    return chats.filter((c) => {
      const name = (c.contact_name ?? c.whatsapp_name ?? '').toLowerCase();
      return name.includes(term) || c.phone.includes(term);
    });
  }, [chats, search]);

  function handleClose() {
    setSearch('');
    setSelectedPhone(null);
    onOpenChange(false);
  }

  function handleConfirm() {
    if (!message || !selectedPhone) return;
    forwardMutation.mutate(
      {
        account_id: accountId,
        source_message_id: message.message_id,
        destination_phone: selectedPhone,
      },
      { onSettled: () => handleClose() },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Forward className="h-4 w-4" />
            Encaminhar mensagem
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Selecione a conversa de destino. Funciona apenas entre conversas da mesma conta Z-API.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Campo de busca */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou telefone..."
              className="pl-7 h-8 text-xs"
              autoFocus
            />
          </div>

          {/* Lista de chats */}
          <ScrollArea className="h-64 border rounded-md">
            {filteredChats.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">
                Nenhuma conversa encontrada.
              </p>
            ) : (
              <div>
                {filteredChats.map((chat) => {
                  const displayName = chat.contact_name ?? chat.whatsapp_name ?? formatPhone(chat.phone);
                  const isSelected = selectedPhone === chat.phone;
                  return (
                    <button
                      key={chat.id}
                      type="button"
                      onClick={() => setSelectedPhone(isSelected ? null : chat.phone)}
                      className={cn(
                        'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-accent',
                        isSelected && 'bg-primary/10 hover:bg-primary/15',
                      )}
                    >
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarFallback className="text-[10px] bg-muted">
                          {chatInitials(chat)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate font-medium">{displayName}</p>
                        <p className="text-xs text-muted-foreground truncate">{formatPhone(chat.phone)}</p>
                      </div>
                      {isSelected && (
                        <span className="h-2 w-2 rounded-full bg-primary shrink-0" aria-hidden="true" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={handleClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!selectedPhone || forwardMutation.isPending}
            onClick={handleConfirm}
          >
            <Forward className="h-3.5 w-3.5 mr-1.5" />
            {forwardMutation.isPending ? 'Encaminhando...' : 'Encaminhar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
