import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Phone } from 'lucide-react';
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from '@/components/ui/command';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useContacts } from '@/hooks/useContacts';
import type { ZapiChat } from '@/hooks/useZapiChats';
import { phoneComparisonKey, formatPhoneDisplay } from '@/lib/normalization';
import { getContactDisplayName } from '@/lib/contactDisplay';

interface ConversaPaletteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Lista de chats já carregados — usada para verificar se chat existe */
  chats: ZapiChat[];
  selectedAccountId: string | null;
  /** Callback quando o chat já existe — seleciona diretamente na lista */
  onSelectChat: (chatId: string) => void;
  /**
   * Callback quando o contato NÃO tem chat existente — abre conversa pendente.
   * Recebe (phone, contactId, contactName).
   */
  onOpenPending?: (phone: string, contactId: string | null, contactName: string | null) => void;
}

export function ConversaPaletteDialog({
  open,
  onOpenChange,
  chats,
  selectedAccountId,
  onSelectChat,
  onOpenPending,
}: ConversaPaletteDialogProps) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedTerm, setDebouncedTerm] = useState('');

  // Debounce de 300ms para não disparar query a cada tecla
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTerm(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset ao fechar
  useEffect(() => {
    if (!open) {
      setSearchTerm('');
      setDebouncedTerm('');
    }
  }, [open]);

  // Busca contatos com 2+ chars — per_page limitado para UI responsiva
  const { data: contactsResult } = useContacts(
    debouncedTerm.length >= 2
      ? { search: debouncedTerm, per_page: 20 }
      : {},
  );
  const contacts = contactsResult?.data ?? [];

  // Filtra apenas contatos com telefone ou whatsapp preenchido
  const contactsWithPhone = contacts.filter(
    (c) => !!(c.whatsapp || c.telefone),
  );

  // Cria mapa de chave canônica → chat para cruzamento rápido
  const chatByPhone = useCallback(
    (phone: string | null | undefined) => {
      if (!phone) return null;
      const key = phoneComparisonKey(phone);
      if (!key) return null;
      return chats.find((c) => phoneComparisonKey(c.phone) === key) ?? null;
    },
    [chats],
  );

  function handleSelect(
    contactPhone: string,
    contactId?: string | null,
    contactName?: string | null,
  ) {
    const existingChat = chatByPhone(contactPhone);
    if (existingChat) {
      // Chat já existe — seleciona diretamente na lista
      onSelectChat(existingChat.id);
      onOpenChange(false);
    } else if (onOpenPending) {
      // Chat não existe e temos callback direto — abre conversa pendente
      onOpenPending(contactPhone, contactId ?? null, contactName ?? null);
      onOpenChange(false);
    } else {
      // Fallback: navega com deep-link (sem callback — caso do uso externo)
      const normalized = contactPhone.replace(/\D/g, '');
      onOpenChange(false);
      navigate(
        `/integracoes/whatsapp?tab=conversas&chat=${normalized}`,
      );
    }
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Buscar contato por nome ou telefone..."
        value={searchTerm}
        onValueChange={setSearchTerm}
      />
      <CommandList>
        {debouncedTerm.length < 2 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            {selectedAccountId
              ? 'Digite 2 ou mais caracteres para buscar'
              : 'Selecione uma conta Z-API antes de iniciar uma conversa'}
          </div>
        ) : contactsWithPhone.length === 0 ? (
          <CommandEmpty>
            <div className="space-y-3">
              <p>Nenhum contato encontrado</p>
              <button
                type="button"
                className="text-xs text-primary underline underline-offset-2 hover:opacity-80 transition-opacity"
                onClick={() => {
                  onOpenChange(false);
                  // Sinaliza ao pai para abrir o NewMessageDialog
                  // via CustomEvent (desacoplado)
                  window.dispatchEvent(new CustomEvent('open-new-message-dialog'));
                }}
              >
                Enviar para número avulso
              </button>
            </div>
          </CommandEmpty>
        ) : (
          <CommandGroup heading="Contatos">
            {contactsWithPhone.map((contact) => {
              const phone = contact.whatsapp ?? contact.telefone ?? '';
              const existingChat = chatByPhone(phone);
              const displayName = getContactDisplayName(contact);
              const initials = displayName
                .replace(/^@/, '')
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((w) => w[0])
                .join('')
                .toUpperCase();
              const tags =
                contact.contact_tags?.map((ct) => ct.tags).filter(Boolean) ?? [];

              return (
                <CommandItem
                  key={contact.id}
                  value={`${displayName} ${phone}`}
                  onSelect={() => handleSelect(phone, contact.id, contact.nome)}
                  className="flex items-center gap-3 py-2"
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate">{displayName}</span>
                      {existingChat && (
                        <MessageSquare className="h-3 w-3 text-success shrink-0" />
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground">
                        {formatPhoneDisplay(phone)}
                      </span>
                    </div>
                    {tags.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {tags.slice(0, 2).map((tag) => (
                          <Badge
                            key={tag.id}
                            variant="secondary"
                            className="text-[10px] px-1 py-0"
                            style={
                              tag.cor
                                ? {
                                    backgroundColor: tag.cor + '20',
                                    color: tag.cor,
                                    borderColor: tag.cor + '40',
                                  }
                                : undefined
                            }
                          >
                            {tag.nome}
                          </Badge>
                        ))}
                        {tags.length > 2 && (
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            +{tags.length - 2}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
