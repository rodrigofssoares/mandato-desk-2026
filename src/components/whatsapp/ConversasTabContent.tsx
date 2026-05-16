import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  Search,
  UserPlus,
} from 'lucide-react';
import { EmptyState } from '@/components/ui-system';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { toast } from 'sonner';
import { useZapiAccounts } from '@/hooks/useZapiAccounts';
import { useZapiChats } from '@/hooks/useZapiChats';
import { useZapiMessagesByChat, useSendZapiMessage } from '@/hooks/useZapiMessages';
import {
  useUploadZapiAttachment,
  useSendZapiMedia,
  type ZapiMediaType,
} from '@/hooks/useZapiMedia';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useCreateContact } from '@/hooks/useContacts';
import { supabase } from '@/integrations/supabase/client';
import { phoneComparisonKey } from '@/lib/normalization';
import { ChatListItem } from './ChatListItem';
import { formatPhone } from '@/lib/zapi-format';
import { MessageBubble } from './MessageBubble';
import { AttachmentPreviewDialog } from './AttachmentPreviewDialog';
import { AudioRecorderBar } from './AudioRecorderBar';
import { PollDialog } from './PollDialog';

export function ConversasTabContent() {
  const { data: accounts = [], isLoading: accountsLoading } = useZapiAccounts();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Pré-seleciona primeira conta sendable
  useEffect(() => {
    if (selectedAccountId) return;
    const first = accounts.find((a) => a.status !== 'disconnected') ?? accounts[0];
    if (first) setSelectedAccountId(first.id);
  }, [accounts, selectedAccountId]);

  // Reset chat selecionado E busca ao trocar de conta
  useEffect(() => {
    setSelectedChatId(null);
    setSearchTerm('');
  }, [selectedAccountId]);

  const { data: chats = [], isLoading: chatsLoading, refetch: refetchChats } =
    useZapiChats(selectedAccountId);

  // Filtro client-side por nome ou telefone — useMemo evita recomputação desnecessária.
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
      const phoneMatch = c.phone.toLowerCase().includes(term);
      return nameMatch || phoneMatch;
    });
  }, [chats, searchTerm]);

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
          <div className="px-3 py-2 border-b bg-muted/30 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">
              Conversas {chats.length > 0 && `(${chats.length})`}
            </p>
            {/* Campo de busca — visível quando há conta selecionada */}
            {selectedAccountId && (
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por nome ou telefone..."
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
            <ContactPanel chat={selectedChat} refetchChats={refetchChats} />
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

  // Gravação de áudio in-line (microfone)
  const recorder = useAudioRecorder();
  const uploadAudio = useUploadZapiAttachment();
  const sendAudioMedia = useSendZapiMedia();
  const isSendingAudio = uploadAudio.isPending || sendAudioMedia.isPending;

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
      await sendAudioMedia.mutateAsync({
        account_id: chat.account_id,
        phone: chat.phone,
        type: 'audio',
        media_url: uploaded.url,
        mime_type: uploaded.mime,
        file_name: file.name,
      });
      recorder.reset();
    } catch {
      // toasts já disparados pelos hooks; mantém o áudio gravado pra retry
    }
  }

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
  refetchChats: () => void;
}

/** Busca o contato duplicado por chave normalizada de telefone/whatsapp. */
async function findDuplicateByPhone(phone: string): Promise<{ id: string; nome: string } | null> {
  const key = phoneComparisonKey(phone);
  if (!key) return null;

  const { data, error } = await supabase
    .from('contacts')
    .select('id, nome, telefone, whatsapp')
    .is('merged_into', null)
    .or('telefone.not.is.null,whatsapp.not.is.null');

  if (error || !data) return null;

  for (const c of data) {
    const tk = phoneComparisonKey((c as { telefone?: string | null }).telefone ?? null);
    const wk = phoneComparisonKey((c as { whatsapp?: string | null }).whatsapp ?? null);
    if ((tk && tk === key) || (wk && wk === key)) {
      return { id: c.id, nome: (c as { nome: string }).nome };
    }
  }
  return null;
}

function ContactPanel({ chat, refetchChats }: ContactPanelProps) {
  const navigate = useNavigate();
  const createContact = useCreateContact();
  // Estado do alerta de duplicata: { id, nome } do contato existente, ou null
  const [duplicado, setDuplicado] = useState<{ id: string; nome: string } | null>(null);
  // Cobre a janela entre clique e início da mutation (busca de duplicata pode levar 1-3s)
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);

  async function handleAdicionarNoCRM() {
    // Verifica duplicata ANTES de chamar a mutation, para obter o id do existente
    // e exibir alerta acionável ("Abrir existente").
    setIsCheckingDuplicate(true);
    try {
      const dup = await findDuplicateByPhone(chat.phone);
      if (dup) {
        setDuplicado(dup);
        return;
      }
    } catch {
      // Falha de rede na verificação de duplicata: avisa em vez de falhar em silêncio.
      toast.error('Não foi possível verificar duplicatas. Tente novamente.');
      return;
    } finally {
      setIsCheckingDuplicate(false);
    }

    createContact.mutate(
      {
        nome: chat.contact_name ?? formatPhone(chat.phone),
        whatsapp: chat.phone,
        tag_ids: [],
      },
      {
        onSuccess: (data) => {
          // Refetch de chats para que chat.contact_id seja atualizado na coluna 1
          refetchChats();
          // Navega para o ContactDialog do novo contato
          navigate(`/contacts?contact=${data.id}`);
        },
      },
    );
  }

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
          // T02 — link direto ao contato via ?contact=<uuid>
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link to={`/contacts?contact=${chat.contact_id}`}>
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Ver no CRM
            </Link>
          </Button>
        ) : (
          // T03 — botão "Adicionar no CRM" com loading e prevenção de duplo clique.
          // isCheckingDuplicate cobre a janela do SELECT antes da mutation começar.
          <Button
            variant="default"
            size="sm"
            className="w-full"
            onClick={handleAdicionarNoCRM}
            disabled={isCheckingDuplicate || createContact.isPending}
          >
            <UserPlus className="h-3.5 w-3.5 mr-1.5" />
            {isCheckingDuplicate || createContact.isPending ? 'Adicionando...' : 'Adicionar no CRM'}
          </Button>
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

      {/* Alerta de duplicata — exibido quando o telefone já existe no CRM */}
      <AlertDialog open={!!duplicado} onOpenChange={(open) => !open && setDuplicado(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Contato já cadastrado</AlertDialogTitle>
            <AlertDialogDescription>
              Já existe um contato com este número:{' '}
              <strong>{duplicado?.nome ?? 'desconhecido'}</strong>. Deseja abrir o contato
              existente?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDuplicado(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (duplicado) {
                  navigate(`/contacts?contact=${duplicado.id}`);
                  setDuplicado(null);
                }
              }}
            >
              Abrir existente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
