import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MessageSquare,
  Send,
  User,
  ExternalLink,
  RefreshCw,
  Paperclip,
  Image as ImageIcon,
  Video,
  Mic,
  FileText,
  BarChart3,
} from 'lucide-react';
import { EmptyState } from '@/components/ui-system';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useZapiAccounts } from '@/hooks/useZapiAccounts';
import { useZapiChats } from '@/hooks/useZapiChats';
import { useZapiMessagesByChat, useSendZapiMessage } from '@/hooks/useZapiMessages';
import type { ZapiMediaType } from '@/hooks/useZapiMedia';
import { ChatListItem } from './ChatListItem';
import { formatPhone } from '@/lib/zapi-format';
import { MessageBubble } from './MessageBubble';
import { AttachmentPreviewDialog } from './AttachmentPreviewDialog';
import { PollDialog } from './PollDialog';

export function ConversasTabContent() {
  const { data: accounts = [], isLoading: accountsLoading } = useZapiAccounts();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  // Pré-seleciona primeira conta sendable
  useEffect(() => {
    if (selectedAccountId) return;
    const first = accounts.find((a) => a.status !== 'disconnected') ?? accounts[0];
    if (first) setSelectedAccountId(first.id);
  }, [accounts, selectedAccountId]);

  // Reset chat selecionado ao trocar de conta
  useEffect(() => {
    setSelectedChatId(null);
  }, [selectedAccountId]);

  const { data: chats = [], isLoading: chatsLoading, refetch: refetchChats } =
    useZapiChats(selectedAccountId);

  const selectedChat = useMemo(
    () => chats.find((c) => c.id === selectedChatId) ?? null,
    [chats, selectedChatId],
  );

  if (accountsLoading) {
    return (
      <div className="min-h-[320px] flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Carregando contas...</p>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="Nenhuma conta Z-API"
        description="Cadastre uma conta na aba Contas pra começar a trocar mensagens com eleitores."
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* Seletor de conta + refresh */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-md">
          <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
            Conta:
          </span>
          <Select
            value={selectedAccountId ?? ''}
            onValueChange={(v) => setSelectedAccountId(v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione uma conta" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((acc) => (
                <SelectItem key={acc.id} value={acc.id}>
                  {acc.name}{' '}
                  <span className="text-xs text-muted-foreground ml-1">({acc.status})</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetchChats()}
          disabled={chatsLoading}
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${chatsLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      {/* 3 colunas */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr_280px] gap-3 h-[calc(100vh-280px)] min-h-[480px]">
        {/* ── Coluna 1: lista de chats ───────────────────────────────── */}
        <div className="border rounded-lg bg-card overflow-hidden flex flex-col">
          <div className="px-3 py-2 border-b bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground">
              Conversas {chats.length > 0 && `(${chats.length})`}
            </p>
          </div>
          <ScrollArea className="flex-1">
            {chatsLoading ? (
              <p className="text-xs text-muted-foreground p-4 text-center">Carregando...</p>
            ) : chats.length === 0 ? (
              <div className="p-6 text-center">
                <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-xs text-muted-foreground">
                  Nenhuma conversa ainda. Envie uma mensagem ou aguarde um eleitor escrever.
                </p>
              </div>
            ) : (
              chats.map((chat) => (
                <ChatListItem
                  key={chat.id}
                  chat={chat}
                  selected={chat.id === selectedChatId}
                  onSelect={setSelectedChatId}
                />
              ))
            )}
          </ScrollArea>
        </div>

        {/* ── Coluna 2: conversa ─────────────────────────────────────── */}
        <div className="border rounded-lg bg-card overflow-hidden flex flex-col">
          {selectedChat ? (
            <ChatPanel chat={selectedChat} />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <EmptyState
                icon={MessageSquare}
                title="Selecione uma conversa"
                description="Escolha uma conversa à esquerda pra ver as mensagens e responder."
              />
            </div>
          )}
        </div>

        {/* ── Coluna 3: info do contato ──────────────────────────────── */}
        <div className="hidden lg:flex border rounded-lg bg-card overflow-hidden flex-col">
          {selectedChat ? (
            <ContactPanel chat={selectedChat} />
          ) : (
            <div className="flex-1 flex items-center justify-center p-4">
              <p className="text-xs text-muted-foreground text-center">
                Detalhes do contato aparecem aqui.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Subcomponentes ─────────────────────────────────────────────────────────

interface ChatPanelProps {
  chat: NonNullable<ReturnType<typeof useZapiChats>['data']>[number];
}

function ChatPanel({ chat }: ChatPanelProps) {
  const { data: messages = [], isLoading } = useZapiMessagesByChat(chat.id);
  const sendMessage = useSendZapiMessage();
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Estado do anexo/poll
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const [pendingAttachment, setPendingAttachment] = useState<
    { file: File; type: ZapiMediaType } | null
  >(null);
  const [pollOpen, setPollOpen] = useState(false);

  // Auto-scroll para o fim quando chega nova mensagem
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  const display = chat.contact_name ?? formatPhone(chat.phone);

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    sendMessage.mutate(
      {
        account_id: chat.account_id,
        phone: chat.phone,
        message: trimmed,
      },
      {
        onSuccess: () => setDraft(''),
      },
    );
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend(e as unknown as React.FormEvent);
    }
  }

  function handleFilePicked(type: ZapiMediaType, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) setPendingAttachment({ file, type });
    // Reseta input pra permitir mesmo arquivo de novo após cancelar
    e.target.value = '';
  }

  return (
    <>
      {/* Header */}
      <div className="px-4 py-3 border-b bg-muted/30 shrink-0">
        <p className="font-medium text-sm">{display}</p>
        {chat.contact_name && (
          <p className="text-xs text-muted-foreground">{formatPhone(chat.phone)}</p>
        )}
      </div>

      {/* Mensagens */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        {isLoading ? (
          <p className="text-xs text-muted-foreground text-center py-8">Carregando mensagens...</p>
        ) : messages.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            Sem mensagens. Comece a conversa abaixo.
          </p>
        ) : (
          <div className="space-y-2">
            {messages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
          </div>
        )}
      </div>

      {/* Composer */}
      <form onSubmit={handleSend} className="border-t p-3 bg-muted/10 shrink-0">
        <div className="flex items-end gap-2">
          {/* Inputs file ocultos */}
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => handleFilePicked('image', e)}
          />
          <input
            ref={videoInputRef}
            type="file"
            accept="video/mp4,video/3gpp,video/quicktime"
            className="hidden"
            onChange={(e) => handleFilePicked('video', e)}
          />
          <input
            ref={audioInputRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => handleFilePicked('audio', e)}
          />
          <input
            ref={documentInputRef}
            type="file"
            className="hidden"
            onChange={(e) => handleFilePicked('document', e)}
          />

          {/* Paperclip menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="outline"
                disabled={sendMessage.isPending}
                title="Anexos e enquetes"
              >
                <Paperclip className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" side="top">
              <DropdownMenuItem onClick={() => imageInputRef.current?.click()}>
                <ImageIcon className="h-4 w-4 mr-2" /> Imagem
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => videoInputRef.current?.click()}>
                <Video className="h-4 w-4 mr-2" /> Vídeo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => audioInputRef.current?.click()}>
                <Mic className="h-4 w-4 mr-2" /> Áudio
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => documentInputRef.current?.click()}>
                <FileText className="h-4 w-4 mr-2" /> Documento
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setPollOpen(true)}>
                <BarChart3 className="h-4 w-4 mr-2" /> Enquete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Escreva uma mensagem... (Enter para enviar)"
            rows={2}
            className="resize-none"
            disabled={sendMessage.isPending}
            maxLength={4096}
          />
          <Button
            type="submit"
            size="icon"
            disabled={sendMessage.isPending || !draft.trim()}
            title="Enviar mensagem"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          {draft.length}/4096 — Enter envia, Shift+Enter quebra linha
        </p>
      </form>

      {/* Dialogs */}
      <AttachmentPreviewDialog
        open={!!pendingAttachment}
        onOpenChange={(o) => !o && setPendingAttachment(null)}
        file={pendingAttachment?.file ?? null}
        type={pendingAttachment?.type ?? 'image'}
        accountId={chat.account_id}
        phone={chat.phone}
      />
      <PollDialog
        open={pollOpen}
        onOpenChange={setPollOpen}
        accountId={chat.account_id}
        phone={chat.phone}
      />
    </>
  );
}

interface ContactPanelProps {
  chat: NonNullable<ReturnType<typeof useZapiChats>['data']>[number];
}

function ContactPanel({ chat }: ContactPanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b bg-muted/30 shrink-0">
        <p className="text-xs font-medium text-muted-foreground">Detalhes do contato</p>
      </div>

      <div className="p-4 space-y-4 flex-1 overflow-auto">
        <div className="flex flex-col items-center text-center">
          <div className="h-16 w-16 rounded-full bg-primary/15 flex items-center justify-center mb-2">
            <User className="h-7 w-7 text-primary" />
          </div>
          <p className="font-medium">
            {chat.contact_name ?? <span className="italic text-muted-foreground">Sem cadastro</span>}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">{formatPhone(chat.phone)}</p>
        </div>

        <Separator />

        {chat.contact_id ? (
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link to="/contacts">
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Ver no CRM
            </Link>
          </Button>
        ) : (
          <div className="text-xs text-muted-foreground space-y-2">
            <p>Este número ainda não está vinculado a nenhum contato do CRM.</p>
            <p className="text-[11px]">
              Para vincular, cadastre o contato em <strong>Contatos → Novo</strong> usando este
              número no campo WhatsApp.
            </p>
          </div>
        )}

        <Separator />

        <div className="text-xs space-y-1.5">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Não lidas</span>
            <span className="font-medium">{chat.unread_count}</span>
          </div>
          {chat.last_message_at && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Última atividade</span>
              <span className="font-medium">
                {new Date(chat.last_message_at).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
