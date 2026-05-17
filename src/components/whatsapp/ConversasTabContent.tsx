import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  MessageSquare,
  MessageSquarePlus,
  Send,
  RefreshCw,
  Paperclip,
  Image as ImageIcon,
  Video,
  Mic,
  FileText,
  BarChart3,
  Search,
  ChevronUp,
  ChevronDown,
  X,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { EmptyState } from '@/components/ui-system';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { toast } from 'sonner';
import { useZapiAccounts } from '@/hooks/useZapiAccounts';
import { useZapiChats, type ZapiChat } from '@/hooks/useZapiChats';
import { useZapiMessagesByChat, useSendZapiMessage } from '@/hooks/useZapiMessages';
import {
  useUploadZapiAttachment,
  useSendZapiMedia,
  type ZapiMediaType,
} from '@/hooks/useZapiMedia';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useContact } from '@/hooks/useContacts';
import { ChatListItem } from './ChatListItem';
import { formatPhone, isNonRealPhone } from '@/lib/zapi-format';
import { MessageBubble } from './MessageBubble';
import { AttachmentPreviewDialog } from './AttachmentPreviewDialog';
import { AudioRecorderBar } from './AudioRecorderBar';
import { PollDialog } from './PollDialog';
import { ContactPanel } from './ContactPanel';
import { ConversaPaletteDialog } from './ConversaPaletteDialog';
import { phoneComparisonKey } from '@/lib/normalization';

// ─── Conversa pendente ───────────────────────────────────────────────────────
// Representa um contato que ainda não tem chat em zapi_chats.
// Quando o usuário envia a primeira mensagem, a EF zapi-send-text cria o chat
// via UPSERT e retorna o chat_id real — então transitamos para o chat real.

const PENDING_CHAT_ID = '__pending__';

interface PendingChat {
  /** Marcador fixo que distingue do ZapiChat real */
  id: typeof PENDING_CHAT_ID;
  phone: string;
  account_id: string;
  contact_id: string | null;
  contact_name: string | null;
  whatsapp_name: string | null;
}

interface ConversasTabContentProps {
  /** T15: telefone puro (dígitos) para selecionar o chat automaticamente via deep-link */
  initialChatPhone?: string;
  /** T15: UUID de contato — resolve whatsapp/telefone e usa como initialChatPhone */
  initialContactId?: string;
}

export function ConversasTabContent({
  initialChatPhone,
  initialContactId,
}: ConversasTabContentProps) {
  const [, setSearchParams] = useSearchParams();
  const { data: accounts = [], isLoading: accountsLoading } = useZapiAccounts();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [pendingChat, setPendingChat] = useState<PendingChat | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [paletteOpen, setPaletteOpen] = useState(false);

  // T15: resolve ?contact= → número para usar como deep-link
  const { data: deepLinkContact, isLoading: deepLinkContactLoading } = useContact(initialContactId);
  const resolvedDeepLinkPhone = initialChatPhone
    ?? (deepLinkContact
      ? (deepLinkContact.whatsapp ?? deepLinkContact.telefone ?? undefined)
      : undefined);

  // Flag para garantir que a seleção automática acontece apenas uma vez por navegação
  const deepLinkAppliedRef = useRef(false);

  // Pré-seleciona primeira conta sendable
  useEffect(() => {
    if (selectedAccountId) return;
    const first = accounts.find((a) => a.status !== 'disconnected') ?? accounts[0];
    if (first) setSelectedAccountId(first.id);
  }, [accounts, selectedAccountId]);

  // Reset chat selecionado, pendente E busca ao trocar de conta
  useEffect(() => {
    setSelectedChatId(null);
    setPendingChat(null);
    setSearchTerm('');
    deepLinkAppliedRef.current = false;
  }, [selectedAccountId]);

  // Abre conversa pendente para um telefone/contato sem chat existente.
  // Chamado pelo deep-link e pelo ConversaPaletteDialog.
  function openPendingChat(
    phone: string,
    contactId: string | null,
    contactName: string | null,
  ) {
    if (!selectedAccountId) return;
    setSelectedChatId(null);
    setPendingChat({
      id: PENDING_CHAT_ID,
      phone,
      account_id: selectedAccountId,
      contact_id: contactId ?? null,
      contact_name: contactName ?? null,
      whatsapp_name: null,
    });
  }

  const { data: chats = [], isLoading: chatsLoading, refetch: refetchChats } =
    useZapiChats(selectedAccountId);

  // T15: seleção automática via deep-link após chats carregarem.
  // Correção de timing: só aplica depois que os chats da conta selecionada
  // realmente carregaram (chatsLoading=false E selectedAccountId definido).
  // Se não encontrar chat existente, abre conversa pendente em vez de silenciar.
  useEffect(() => {
    if (deepLinkAppliedRef.current) return;
    // Aguarda conta selecionada e chats carregados para aquela conta
    if (!selectedAccountId) return;
    if (chatsLoading) return;

    // Aguarda resolução do contato quando há ?contact= (evita tratar "sem telefone" como
    // dado definitivo enquanto a query ainda está em voo).
    if (initialContactId && deepLinkContactLoading) return;

    // Contato resolveu mas não tem telefone nem whatsapp → limpa a URL e para.
    if (initialContactId && !deepLinkContactLoading && !resolvedDeepLinkPhone) {
      deepLinkAppliedRef.current = true;
      setSearchParams(
        (prev) => {
          prev.delete('chat');
          prev.delete('contact');
          return prev;
        },
        { replace: true },
      );
      return;
    }

    if (!resolvedDeepLinkPhone) return;

    const targetKey = phoneComparisonKey(resolvedDeepLinkPhone);
    if (!targetKey) return;

    const match = chats.find((c) => phoneComparisonKey(c.phone) === targetKey);
    if (match) {
      // Chat existente → seleciona normalmente
      setSelectedChatId(match.id);
      setPendingChat(null);
    } else {
      // Chat não existe → abre conversa pendente
      const contactId = deepLinkContact?.id ?? null;
      const contactName = deepLinkContact?.nome ?? null;
      openPendingChat(resolvedDeepLinkPhone, contactId, contactName);
    }

    deepLinkAppliedRef.current = true;

    // Remove ?chat= e ?contact= da URL após processar (replace:true para não criar histórico)
    setSearchParams(
      (prev) => {
        prev.delete('chat');
        prev.delete('contact');
        return prev;
      },
      { replace: true },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chats, chatsLoading, selectedAccountId, initialContactId, deepLinkContactLoading, resolvedDeepLinkPhone, deepLinkContact, setSearchParams]);

  // Filtro client-side por nome, telefone, empresa e tag — T16
  // trim() antes de filtrar para não penalizar espaços acidentais.
  // Uso de String.includes (nunca RegExp sobre input do usuário) evita crash com
  // caracteres especiais como (, ), -, +.
  const filteredChats = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return chats;
    return chats.filter((c) => {
      const nameMatch = c.contact_name
        ? c.contact_name.toLowerCase().includes(term)
        : false;
      const waNameMatch = c.whatsapp_name
        ? c.whatsapp_name.toLowerCase().includes(term)
        : false;
      const phoneMatch = c.phone.toLowerCase().includes(term);
      // T16: busca por empresa (profissao)
      const empresaMatch = c.contact_profissao
        ? c.contact_profissao.toLowerCase().includes(term)
        : false;
      // T16: busca por tags
      const tagMatch = c.contact_tags
        ? c.contact_tags.some(
            (ct) => ct.tags && ct.tags.nome.toLowerCase().includes(term),
          )
        : false;
      return nameMatch || waNameMatch || phoneMatch || empresaMatch || tagMatch;
    });
  }, [chats, searchTerm]);

  const selectedChat = useMemo(
    () => chats.find((c) => c.id === selectedChatId) ?? null,
    [chats, selectedChatId],
  );

  // Chat ativo: pode ser um chat real ou um chat pendente
  const activeChat: ZapiChat | PendingChat | null = pendingChat ?? selectedChat;

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
          <div className="px-3 py-2 border-b bg-muted/30 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                Conversas{' '}
                {chats.length > 0 &&
                  (searchTerm.trim() && filteredChats.length !== chats.length
                    ? `(${filteredChats.length} de ${chats.length})`
                    : `(${chats.length})`)}
              </p>
              {/* T13: botão para abrir o command palette de nova conversa */}
              {selectedAccountId && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  title="Nova conversa"
                  onClick={() => setPaletteOpen(true)}
                >
                  <MessageSquarePlus className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            {/* Campo de busca — visível quando há conta selecionada */}
            {selectedAccountId && (
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por nome, telefone, empresa ou tag..."
                  className="pl-7 h-7 text-xs"
                />
              </div>
            )}
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
            ) : filteredChats.length === 0 ? (
              // Estado de busca sem resultados — lista original existe mas filtro não bate
              <div className="p-6 text-center">
                <Search className="h-6 w-6 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-xs text-muted-foreground">
                  Nenhuma conversa encontrada para &apos;{searchTerm.trim()}&apos;
                </p>
              </div>
            ) : (
              filteredChats.map((chat) => (
                <ChatListItem
                  key={chat.id}
                  chat={chat}
                  selected={chat.id === selectedChatId}
                  onSelect={(chatId) => {
                    setPendingChat(null);
                    setSelectedChatId(chatId);
                  }}
                />
              ))
            )}
          </ScrollArea>
        </div>

        {/* ── Coluna 2: conversa ─────────────────────────────────────── */}
        <div className="border rounded-lg bg-card overflow-hidden flex flex-col">
          {activeChat ? (
            <ChatPanel
              chat={activeChat}
              onChatCreated={(realChatId) => {
                setPendingChat(null);
                setSelectedChatId(realChatId);
              }}
            />
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
            <ContactPanel chat={selectedChat} refetchChats={refetchChats} />
          ) : activeChat ? (
            // Chat pendente: painel mínimo com o nome
            <div className="flex-1 flex items-center justify-center p-4">
              <p className="text-xs text-muted-foreground text-center">
                Envie a primeira mensagem para criar a conversa.
              </p>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center p-4">
              <p className="text-xs text-muted-foreground text-center">
                Detalhes do contato aparecem aqui.
              </p>
            </div>
          )}
        </div>
      </div>
      {/* T13: command palette para buscar e selecionar contatos */}
      <ConversaPaletteDialog
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        chats={chats}
        selectedAccountId={selectedAccountId}
        onSelectChat={(chatId) => {
          setPendingChat(null);
          setSelectedChatId(chatId);
        }}
        onOpenPending={(phone, contactId, contactName) => {
          openPendingChat(phone, contactId, contactName);
        }}
      />
    </div>
  );
}

// ─── Subcomponentes ─────────────────────────────────────────────────────────

interface ChatPanelProps {
  chat: ZapiChat | PendingChat;
  /** Chamado após o primeiro envio num chat pendente — passa o chat_id real criado. */
  onChatCreated?: (realChatId: string) => void;
}

// ─── Helper: destaca ocorrências de um termo no texto (sem dangerouslySetInnerHTML) ──

function highlightText(text: string, term: string): ReactNode {
  if (!term || term.length < 2) return text;
  const lower = text.toLowerCase();
  const termLower = term.toLowerCase();
  const parts: ReactNode[] = [];
  let cursor = 0;
  let idx = lower.indexOf(termLower, cursor);
  while (idx !== -1) {
    if (idx > cursor) parts.push(text.slice(cursor, idx));
    parts.push(
      <mark
        key={idx}
        className="bg-yellow-200 text-yellow-900 rounded-sm px-0.5"
      >
        {text.slice(idx, idx + term.length)}
      </mark>,
    );
    cursor = idx + term.length;
    idx = lower.indexOf(termLower, cursor);
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

function ChatPanel({ chat, onChatCreated }: ChatPanelProps) {
  const isPending = chat.id === PENDING_CHAT_ID;
  // Para chat pendente, não busca mensagens (chat não existe no banco ainda)
  const { data: messages = [], isLoading } = useZapiMessagesByChat(
    isPending ? null : chat.id,
  );
  const sendMessage = useSendZapiMessage();
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  // Auto-foca o composer quando é uma conversa pendente (novo contato)
  useEffect(() => {
    if (isPending) {
      const id = setTimeout(() => composerRef.current?.focus(), 80);
      return () => clearTimeout(id);
    }
  }, [isPending, chat.id]);

  // Estado do anexo/poll
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const [pendingAttachment, setPendingAttachment] = useState<
    { file: File; type: ZapiMediaType } | null
  >(null);
  const [pollOpen, setPollOpen] = useState(false);

  // Gravação de áudio in-line (microfone)
  const recorder = useAudioRecorder();
  const uploadAudio = useUploadZapiAttachment();
  const sendAudioMedia = useSendZapiMedia();
  const isSendingAudio = uploadAudio.isPending || sendAudioMedia.isPending;

  // T17: estado de busca dentro da conversa
  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const chatSearchInputRef = useRef<HTMLInputElement>(null);
  const messageRefs = useRef<(HTMLDivElement | null)[]>([]);

  // T17: reset busca ao trocar de chat
  useEffect(() => {
    setChatSearchOpen(false);
    setChatSearchQuery('');
    setCurrentMatchIndex(0);
  }, [chat.id]);

  // T17: foca o input quando a barra abre
  useEffect(() => {
    if (chatSearchOpen) {
      setTimeout(() => chatSearchInputRef.current?.focus(), 50);
    }
  }, [chatSearchOpen]);

  // T17: índices das mensagens que batem com o termo de busca
  const matchingIndices = useMemo(() => {
    if (!chatSearchQuery || chatSearchQuery.length < 2) return [];
    const term = chatSearchQuery.toLowerCase();
    return messages.reduce<number[]>((acc, msg, i) => {
      const body = msg.body ?? '';
      if (typeof body === 'string' && body.toLowerCase().includes(term)) {
        acc.push(i);
      }
      return acc;
    }, []);
  }, [messages, chatSearchQuery]);

  // T17: Set para lookup O(1) no render — evita O(n²) de matchingIndices.includes(i)
  // dentro do .map(). O array matchingIndices é mantido para navegação anterior/próximo.
  const matchingSet = useMemo(() => new Set(matchingIndices), [matchingIndices]);

  // T17: scroll até o resultado atual quando muda o índice ou os matches
  useEffect(() => {
    if (matchingIndices.length === 0) return;
    const targetMsgIdx = matchingIndices[currentMatchIndex];
    if (targetMsgIdx === undefined) return;
    const el = messageRefs.current[targetMsgIdx];
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [matchingIndices, currentMatchIndex]);

  // T17: garante que currentMatchIndex está dentro do range quando matches muda.
  // Forma funcional do setter evita depender de currentMatchIndex nas deps,
  // impedindo double-fire quando ambos mudam no mesmo ciclo.
  useEffect(() => {
    setCurrentMatchIndex((prev) =>
      matchingIndices.length === 0 ? 0 : Math.min(prev, matchingIndices.length - 1)
    );
  }, [matchingIndices]);

  // Erros de gravação (permissão negada, sem microfone) viram toast.
  useEffect(() => {
    if (recorder.error) toast.error(recorder.error);
  }, [recorder.error]);

  async function handleSendAudio() {
    const file = recorder.getFile();
    if (!file) return;
    try {
      const uploaded = await uploadAudio.mutateAsync({
        account_id: chat.account_id,
        file,
        type: 'audio',
      });
      const result = await sendAudioMedia.mutateAsync({
        account_id: chat.account_id,
        phone: chat.phone,
        type: 'audio',
        media_url: uploaded.url,
        mime_type: uploaded.mime,
        file_name: file.name,
      });
      recorder.reset();
      // Se era chat pendente, transita para o chat real recém-criado
      if (isPending && onChatCreated && result.chat_id) {
        onChatCreated(result.chat_id);
      }
    } catch {
      // toasts já disparados pelos hooks; mantém o áudio gravado pra retry
    }
  }

  // Auto-scroll para o fim quando chega nova mensagem (só quando busca não está ativa)
  useEffect(() => {
    if (chatSearchOpen) return;
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages.length, chatSearchOpen]);

  // Ordem: contato CRM > nome do WhatsApp > fallback fixo.
  const display = chat.contact_name ?? chat.whatsapp_name ?? 'Contato sem nome';

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
        onSuccess: (result) => {
          setDraft('');
          // Se era chat pendente, transita para o chat real recém-criado
          if (isPending && onChatCreated && result.chat_id) {
            onChatCreated(result.chat_id);
          }
        },
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

  const isSearchActive = chatSearchOpen && chatSearchQuery.length >= 2;
  const totalMatches = matchingIndices.length;

  return (
    <>
      {/* Header */}
      <div className="px-4 py-3 border-b bg-muted/30 shrink-0">
        {chatSearchOpen ? (
          /* T17: barra de busca inline */
          <div className="flex items-center gap-2">
            <input
              ref={chatSearchInputRef}
              type="text"
              value={chatSearchQuery}
              onChange={(e) => {
                setChatSearchQuery(e.target.value);
                setCurrentMatchIndex(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setChatSearchOpen(false);
                  setChatSearchQuery('');
                }
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (totalMatches === 0) return;
                  setCurrentMatchIndex((i) => (i + 1) % totalMatches);
                }
              }}
              placeholder="Buscar na conversa..."
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
              aria-label="Buscar mensagem"
            />
            {isSearchActive && (
              <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                {totalMatches === 0
                  ? '0 de 0'
                  : `${currentMatchIndex + 1} de ${totalMatches}`}
              </span>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              title="Resultado anterior"
              disabled={totalMatches === 0}
              onClick={() =>
                setCurrentMatchIndex((i) => (i - 1 + totalMatches) % totalMatches)
              }
            >
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              title="Próximo resultado"
              disabled={totalMatches === 0}
              onClick={() =>
                setCurrentMatchIndex((i) => (i + 1) % totalMatches)
              }
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 shrink-0"
              title="Fechar busca"
              onClick={() => {
                setChatSearchOpen(false);
                setChatSearchQuery('');
              }}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          /* Header normal */
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="font-medium text-sm truncate">{display}</p>
                {isPending && (
                  <span className="text-[10px] font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded px-1 py-0.5 shrink-0">
                    Nova conversa
                  </span>
                )}
              </div>
              {/* Subtítulo de telefone: só para contato CRM com phone real (não LID). */}
              {(chat.contact_name || isPending) && !isNonRealPhone(chat.phone) && (
                <p className="text-xs text-muted-foreground">{formatPhone(chat.phone)}</p>
              )}
            </div>
            {/* Busca só disponível em conversas reais (com histórico) */}
            {!isPending && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                title="Buscar na conversa"
                onClick={() => setChatSearchOpen(true)}
              >
                <Search className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Mensagens */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        {isLoading && !isPending ? (
          <p className="text-xs text-muted-foreground text-center py-8">Carregando mensagens...</p>
        ) : messages.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            {isPending
              ? 'Nenhuma conversa ainda. Envie a primeira mensagem abaixo.'
              : 'Sem mensagens. Comece a conversa abaixo.'}
          </p>
        ) : (
          <div className="space-y-2">
            {messages.map((msg, i) => {
              const isMatch = isSearchActive && matchingSet.has(i);
              const isCurrentMatch =
                isSearchActive && matchingIndices[currentMatchIndex] === i;
              return (
                <div
                  key={msg.id}
                  ref={(el) => { messageRefs.current[i] = el; }}
                  className={
                    isSearchActive && !isMatch ? 'opacity-30 transition-opacity' : 'transition-opacity'
                  }
                  style={isCurrentMatch ? { outline: '2px solid var(--primary)', borderRadius: '8px' } : undefined}
                >
                  {/* T17: passa body com highlight quando há busca ativa */}
                  {isSearchActive && isMatch && msg.body ? (
                    <MessageBubble
                      message={msg}
                      highlightTerm={chatSearchQuery}
                      highlightText={highlightText}
                    />
                  ) : (
                    <MessageBubble message={msg} />
                  )}
                </div>
              );
            })}
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

          {recorder.status === 'idle' ? (
            <>
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
                    <Mic className="h-4 w-4 mr-2" /> Áudio (arquivo)
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
                ref={composerRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escreva uma mensagem... (Enter para enviar)"
                rows={2}
                className="resize-none"
                disabled={sendMessage.isPending}
                maxLength={4096}
              />

              {/* Botão de microfone — gravação de áudio in-line */}
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={() => {
                  void recorder.start();
                }}
                disabled={sendMessage.isPending || !recorder.isSupported}
                title={
                  recorder.isSupported
                    ? 'Gravar áudio'
                    : 'Gravação de áudio não suportada neste navegador'
                }
              >
                <Mic className="h-4 w-4" />
              </Button>

              <Button
                type="submit"
                size="icon"
                disabled={sendMessage.isPending || !draft.trim()}
                title="Enviar mensagem"
              >
                <Send className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <AudioRecorderBar
              recorder={recorder}
              isSending={isSendingAudio}
              onSend={handleSendAudio}
            />
          )}
        </div>
        {recorder.status === 'idle' && (
          <p className="text-[10px] text-muted-foreground mt-1">
            {draft.length}/4096 — Enter envia, Shift+Enter quebra linha
          </p>
        )}
      </form>

      {/* Dialogs */}
      <AttachmentPreviewDialog
        open={!!pendingAttachment}
        onOpenChange={(o) => !o && setPendingAttachment(null)}
        file={pendingAttachment?.file ?? null}
        type={pendingAttachment?.type ?? 'image'}
        accountId={chat.account_id}
        phone={chat.phone}
        onSent={(chatId) => {
          setPendingAttachment(null);
          if (isPending && onChatCreated && chatId) onChatCreated(chatId);
        }}
      />
      <PollDialog
        open={pollOpen}
        onOpenChange={setPollOpen}
        accountId={chat.account_id}
        phone={chat.phone}
        onSent={(chatId) => {
          setPollOpen(false);
          if (isPending && onChatCreated && chatId) onChatCreated(chatId);
        }}
      />
    </>
  );
}

