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
  Pin,
  Archive,
  ArchiveRestore,
  ChevronDown as ChevronDownIcon,
  Check,
  User,
  UserMinus,
  Loader2,
  AlertTriangle,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { EmptyState } from '@/components/ui-system';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { cn } from '@/lib/utils';
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
import { useChatUpdate } from '@/hooks/useChatUpdate';
import { useUsers } from '@/hooks/useUsers';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/context/AuthContext';
import { ChatListItem, STATUS_LABELS, STATUS_DOT_CLASS } from './ChatListItem';
import { SupervisorPanel, UNASSIGNED_FILTER } from './SupervisorPanel';
import { formatPhone, isNonRealPhone } from '@/lib/zapi-format';
import { MessageBubble } from './MessageBubble';
import { AttachmentPreviewDialog } from './AttachmentPreviewDialog';
import { AudioRecorderBar } from './AudioRecorderBar';
import { PollDialog } from './PollDialog';
import { ContactPanel } from './ContactPanel';
import { ConversaPaletteDialog } from './ConversaPaletteDialog';
import { HandoffNoteDialog } from './HandoffNoteDialog';
import { phoneComparisonKey } from '@/lib/normalization';
import type { UserProfile } from '@/hooks/useUsers';
import { useChatNotes } from '@/hooks/useChatNotes';
import { useZapiInstanceStatus } from '@/hooks/useZapiInstanceStatus';
import { isFeatureEnabled } from '@/lib/featureFlags';
import { useImpersonation } from '@/context/ImpersonationContext';
import { Alert, AlertDescription } from '@/components/ui/alert';

// ─── Conversa pendente ───────────────────────────────────────────────────────

const PENDING_CHAT_ID = '__pending__';

interface PendingChat {
  id: typeof PENDING_CHAT_ID;
  phone: string;
  account_id: string;
  contact_id: string | null;
  contact_name: string | null;
  whatsapp_name: string | null;
}

interface ConversasTabContentProps {
  initialChatPhone?: string;
  initialContactId?: string;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

type ChatStatus = 'aberta' | 'em_atendimento' | 'aguardando' | 'finalizada';

const STATUS_BADGE_CLASS: Record<string, string> = {
  aberta: 'bg-gray-100 text-gray-700 border-gray-300',
  em_atendimento: 'bg-blue-100 text-blue-700 border-blue-300',
  aguardando: 'bg-amber-100 text-amber-700 border-amber-300',
  finalizada: 'bg-green-100 text-green-700 border-green-300',
};

function userInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

// ─── ConversasTabContent ──────────────────────────────────────────────────────

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

  // T20: filtros de status + "só minhas"
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [onlyMine, setOnlyMine] = useState(false);
  // T25: visão de arquivadas
  const [showArchived, setShowArchived] = useState(false);

  // T29: tick para forçar re-render do SLA a cada 60s
  const [slaTick, setSlaTick] = useState(0);

  // T30: filtro por atendente específico (modo supervisor)
  const [filterByAssignee, setFilterByAssignee] = useState<string | null>(null);

  const { user } = useAuth();
  const { can } = usePermissions();
  const canEdit = can.editWhatsapp();
  const { activeRole } = useImpersonation();

  // T15: resolve ?contact= → número para usar como deep-link
  const { data: deepLinkContact, isLoading: deepLinkContactLoading } = useContact(initialContactId);
  const resolvedDeepLinkPhone = initialChatPhone
    ?? (deepLinkContact
      ? (deepLinkContact.whatsapp ?? deepLinkContact.telefone ?? undefined)
      : undefined);

  const deepLinkAppliedRef = useRef(false);

  useEffect(() => {
    if (selectedAccountId) return;
    const first = accounts.find((a) => a.status !== 'disconnected') ?? accounts[0];
    if (first) setSelectedAccountId(first.id);
  }, [accounts, selectedAccountId]);

  // Reset tudo ao trocar de conta
  useEffect(() => {
    setSelectedChatId(null);
    setPendingChat(null);
    setSearchTerm('');
    setStatusFilter(null);
    setOnlyMine(false);
    setShowArchived(false);
    setFilterByAssignee(null);
    deepLinkAppliedRef.current = false;
  }, [selectedAccountId]);

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

  // T18: hook de atualização de chat
  const chatUpdate = useChatUpdate(selectedAccountId);

  // T27/T28: status de conexão da instância Z-API (polling 60s)
  const instanceStatus = useZapiInstanceStatus(selectedAccountId);

  // T29: incrementa slaTick a cada 60s para forçar re-render do SLA nos itens
  useEffect(() => {
    const id = setInterval(() => setSlaTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  // Conta Z-API selecionada (para feature flags)
  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === selectedAccountId) ?? null,
    [accounts, selectedAccountId],
  );

  // T29: SLA habilitado para a conta ativa
  const slaEnabled = isFeatureEnabled(selectedAccount?.recursos_config, 'c28');

  // T30: modo supervisor habilitado (admin + flag c30)
  const supervisorEnabled =
    activeRole === 'admin' &&
    isFeatureEnabled(selectedAccount?.recursos_config, 'c30');

  // T30: lista de atendentes ativos
  const { data: allUsers = [] } = useUsers();
  const activeUsers = useMemo(
    () => allUsers.filter((u) => u.status_aprovacao === 'ATIVO'),
    [allUsers],
  );

  // T15: seleção automática via deep-link
  useEffect(() => {
    if (deepLinkAppliedRef.current) return;
    if (!selectedAccountId) return;
    if (chatsLoading) return;
    if (initialContactId && deepLinkContactLoading) return;

    if (initialContactId && !deepLinkContactLoading && !resolvedDeepLinkPhone) {
      deepLinkAppliedRef.current = true;
      setSearchParams(
        (prev) => { prev.delete('chat'); prev.delete('contact'); return prev; },
        { replace: true },
      );
      return;
    }

    if (!resolvedDeepLinkPhone) return;

    const targetKey = phoneComparisonKey(resolvedDeepLinkPhone);
    if (!targetKey) return;

    const match = chats.find((c) => phoneComparisonKey(c.phone) === targetKey);
    if (match) {
      setSelectedChatId(match.id);
      setPendingChat(null);
    } else {
      const contactId = deepLinkContact?.id ?? null;
      const contactName = deepLinkContact?.nome ?? null;
      openPendingChat(resolvedDeepLinkPhone, contactId, contactName);
    }

    deepLinkAppliedRef.current = true;
    setSearchParams(
      (prev) => { prev.delete('chat'); prev.delete('contact'); return prev; },
      { replace: true },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chats, chatsLoading, selectedAccountId, initialContactId, deepLinkContactLoading, resolvedDeepLinkPhone, deepLinkContact, setSearchParams]);

  // ── T20: filtragem client-side ─────────────────────────────────────────────
  const filteredChats = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    let result = chats;

    // T25: separar arquivadas da lista ativa
    result = showArchived
      ? result.filter((c) => c.archived)
      : result.filter((c) => !c.archived);

    // Filtro de busca por texto
    if (term) {
      result = result.filter((c) => {
        const nameMatch = c.contact_name ? c.contact_name.toLowerCase().includes(term) : false;
        const waNameMatch = c.whatsapp_name ? c.whatsapp_name.toLowerCase().includes(term) : false;
        const phoneMatch = c.phone.toLowerCase().includes(term);
        const empresaMatch = c.contact_profissao ? c.contact_profissao.toLowerCase().includes(term) : false;
        const tagMatch = c.contact_tags
          ? c.contact_tags.some((ct) => ct.tags && ct.tags.nome.toLowerCase().includes(term))
          : false;
        return nameMatch || waNameMatch || phoneMatch || empresaMatch || tagMatch;
      });
    }

    // T20: filtro por status (só aplica na visão ativa, não na de arquivadas)
    if (!showArchived && statusFilter) {
      result = result.filter((c) => c.status === statusFilter);
    }

    // T20: filtro "só minhas"
    if (onlyMine && user?.id) {
      result = result.filter((c) => c.assigned_to === user.id);
    }

    // T30: filtro por atendente específico (modo supervisor)
    // UNASSIGNED_FILTER = sentinela para "não atribuídas"; null = sem filtro ativo
    if (filterByAssignee !== null) {
      result = filterByAssignee === UNASSIGNED_FILTER
        ? result.filter((c) => c.assigned_to === null)
        : result.filter((c) => c.assigned_to === filterByAssignee);
    }

    // T24: ordenar fixadas no topo
    result = [...result].sort((a, b) => {
      if (a.pinned === b.pinned) return 0;
      return a.pinned ? -1 : 1;
    });

    return result;
  }, [chats, searchTerm, statusFilter, onlyMine, showArchived, user?.id, filterByAssignee]);

  const selectedChat = useMemo(
    () => chats.find((c) => c.id === selectedChatId) ?? null,
    [chats, selectedChatId],
  );

  const activeChat: ZapiChat | PendingChat | null = pendingChat ?? selectedChat;

  // ── Handlers de ação rápida ────────────────────────────────────────────────

  function handlePin(chatId: string, pinned: boolean) {
    chatUpdate.mutate({ chat_id: chatId, patch: { pinned } }, {
      onSuccess: () => toast.success(pinned ? 'Conversa fixada' : 'Conversa desafixada'),
    });
  }

  function handleArchive(chatId: string, archived: boolean) {
    chatUpdate.mutate({ chat_id: chatId, patch: { archived } }, {
      onSuccess: () => {
        if (archived) {
          toast('Conversa arquivada', {
            action: {
              label: 'Desfazer',
              onClick: () => chatUpdate.mutate({ chat_id: chatId, patch: { archived: false } }),
            },
          });
          // Se a conversa arquivada estava selecionada, deselecionar
          if (selectedChatId === chatId) setSelectedChatId(null);
        } else {
          toast.success('Conversa desarquivada');
        }
      },
    });
  }

  function handleToggleUnread(chatId: string, unread: boolean) {
    chatUpdate.mutate({ chat_id: chatId, patch: { unread } }, {
      onSuccess: () => toast.success(unread ? 'Marcada como não-lida' : 'Marcada como lida'),
    });
  }

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

  // T24: separa fixadas das não-fixadas (após todos os filtros)
  const pinnedChats = filteredChats.filter((c) => c.pinned);
  const unpinnedChats = filteredChats.filter((c) => !c.pinned);

  // T20: texto do empty state dependente do filtro ativo
  function emptyStateText() {
    if (showArchived) return 'Nenhuma conversa arquivada.';
    if (statusFilter) return `Nenhuma conversa com status "${STATUS_LABELS[statusFilter] ?? statusFilter}".`;
    if (onlyMine) return 'Nenhuma conversa atribuída a você.';
    if (searchTerm.trim()) return `Nenhuma conversa encontrada para '${searchTerm.trim()}'`;
    return 'Nenhuma conversa ainda.';
  }

  const totalVisible = filteredChats.length;
  const totalBase = showArchived
    ? chats.filter((c) => c.archived).length
    : chats.filter((c) => !c.archived).length;
  const showCounter = totalVisible !== totalBase || searchTerm.trim();

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
              {accounts.map((acc) => {
                // T28: dot de status de conexão (só para a conta selecionada, pois só poleia ela)
                const isSelected = acc.id === selectedAccountId;
                let dotClass = 'bg-gray-400'; // cinza = desconhecido / não-selecionado
                if (isSelected && !instanceStatus.isLoading) {
                  if (instanceStatus.connected) dotClass = 'bg-green-500';
                  else if (instanceStatus.state === 'PAIRING') dotClass = 'bg-amber-500';
                  else if (instanceStatus.state !== 'unknown') dotClass = 'bg-red-500';
                }
                return (
                  <SelectItem key={acc.id} value={acc.id}>
                    <span className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full shrink-0 ${dotClass}`} aria-hidden="true" />
                      {acc.name}
                    </span>
                  </SelectItem>
                );
              })}
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
                {(chats.length > 0) && showCounter
                  ? `(${totalVisible} de ${totalBase})`
                  : chats.length > 0
                    ? `(${totalBase})`
                    : ''}
              </p>
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

            {/* Campo de busca */}
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

            {/* T20: chips de filtro de status + T25: chip arquivadas */}
            {selectedAccountId && (
              <div className="flex flex-wrap gap-1">
                {/* Botão "Ativas" / "Arquivadas" */}
                <button
                  type="button"
                  onClick={() => {
                    setShowArchived(false);
                    setStatusFilter(null);
                  }}
                  className={cn(
                    'px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors',
                    !showArchived
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-transparent text-muted-foreground border-border hover:bg-accent',
                  )}
                >
                  Ativas
                </button>
                {(['aberta', 'em_atendimento', 'aguardando', 'finalizada'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setShowArchived(false);
                      setStatusFilter(statusFilter === s ? null : s);
                    }}
                    className={cn(
                      'px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors',
                      !showArchived && statusFilter === s
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-transparent text-muted-foreground border-border hover:bg-accent',
                    )}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
                {/* T25: chip arquivadas */}
                <button
                  type="button"
                  onClick={() => {
                    setShowArchived(true);
                    setStatusFilter(null);
                    setOnlyMine(false);
                  }}
                  className={cn(
                    'px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors flex items-center gap-1',
                    showArchived
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-transparent text-muted-foreground border-border hover:bg-accent',
                  )}
                >
                  <Archive className="h-2.5 w-2.5" />
                  Arquivadas
                </button>
              </div>
            )}

            {/* T20: toggle "Só minhas" */}
            {selectedAccountId && !showArchived && (
              <div className="flex items-center gap-2">
                <Switch
                  id="only-mine"
                  checked={onlyMine}
                  onCheckedChange={setOnlyMine}
                  className="h-4 w-7"
                />
                <Label htmlFor="only-mine" className="text-[10px] text-muted-foreground cursor-pointer">
                  Só minhas
                </Label>
              </div>
            )}
          </div>

          {/* T30: painel supervisor — visível apenas para admin + c30 */}
          {supervisorEnabled && selectedAccountId && (
            <div className="border-b">
              <SupervisorPanel
                chats={chats}
                users={activeUsers}
                filterByAssignee={filterByAssignee}
                onFilterByAssignee={setFilterByAssignee}
              />
            </div>
          )}

          <ScrollArea className="flex-1">
            {chatsLoading ? (
              <p className="text-xs text-muted-foreground p-4 text-center">Carregando...</p>
            ) : filteredChats.length === 0 ? (
              <div className="p-6 text-center">
                {showArchived
                  ? <Archive className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                  : <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                }
                <p className="text-xs text-muted-foreground">{emptyStateText()}</p>
              </div>
            ) : (
              <>
                {/* T24: seção fixadas */}
                {pinnedChats.length > 0 && (
                  <>
                    <div className="px-3 py-1 bg-muted/20">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                        <Pin className="h-2.5 w-2.5" /> Fixadas
                      </p>
                    </div>
                    {pinnedChats.map((chat) => (
                      <ChatListItem
                        key={chat.id}
                        chat={chat}
                        selected={chat.id === selectedChatId}
                        onSelect={(chatId) => { setPendingChat(null); setSelectedChatId(chatId); }}
                        onPin={canEdit ? handlePin : undefined}
                        onArchive={canEdit ? handleArchive : undefined}
                        onToggleUnread={canEdit ? handleToggleUnread : undefined}
                        slaTick={slaTick}
                        slaEnabled={slaEnabled}
                      />
                    ))}
                    {unpinnedChats.length > 0 && (
                      <div className="px-3 py-1 bg-muted/20">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                          Conversas
                        </p>
                      </div>
                    )}
                  </>
                )}

                {/* Conversas não fixadas */}
                {unpinnedChats.map((chat) => (
                  <ChatListItem
                    key={chat.id}
                    chat={chat}
                    selected={chat.id === selectedChatId}
                    onSelect={(chatId) => { setPendingChat(null); setSelectedChatId(chatId); }}
                    onPin={canEdit ? handlePin : undefined}
                    onArchive={canEdit ? handleArchive : undefined}
                    onToggleUnread={canEdit ? handleToggleUnread : undefined}
                    slaTick={slaTick}
                    slaEnabled={slaEnabled}
                  />
                ))}
              </>
            )}
          </ScrollArea>
        </div>

        {/* ── Coluna 2: conversa ─────────────────────────────────────── */}
        <div className="border rounded-lg bg-card overflow-hidden flex flex-col">
          {activeChat ? (
            <ChatPanel
              chat={activeChat}
              selectedAccountId={selectedAccountId}
              instanceStatus={instanceStatus}
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

      {/* T13: command palette */}
      <ConversaPaletteDialog
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        chats={chats}
        selectedAccountId={selectedAccountId}
        onSelectChat={(chatId) => { setPendingChat(null); setSelectedChatId(chatId); }}
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
  selectedAccountId: string | null;
  /** T28: status de conexão da instância Z-API para exibir banner de alerta. */
  instanceStatus?: { connected: boolean; state: string; needsQR: boolean; isLoading: boolean };
  onChatCreated?: (realChatId: string) => void;
}

// ─── Helper: destaca ocorrências de um termo no texto ──────────────────────

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
      <mark key={idx} className="bg-yellow-200 text-yellow-900 rounded-sm px-0.5">
        {text.slice(idx, idx + term.length)}
      </mark>,
    );
    cursor = idx + term.length;
    idx = lower.indexOf(termLower, cursor);
  }
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

// ─── StatusSelector (T19) ─────────────────────────────────────────────────────

interface StatusSelectorProps {
  chat: ZapiChat;
  accountId: string | null;
  disabled?: boolean;
}

function StatusSelector({ chat, accountId, disabled }: StatusSelectorProps) {
  const chatUpdate = useChatUpdate(accountId);
  const statuses: ChatStatus[] = ['aberta', 'em_atendimento', 'aguardando', 'finalizada'];

  function handleSelect(s: ChatStatus) {
    if (s === chat.status) return;
    chatUpdate.mutate(
      { chat_id: chat.id, patch: { status: s } },
      { onSuccess: () => toast.success(`Status atualizado: ${STATUS_LABELS[s]}`) },
    );
  }

  const currentStatus = (chat.status ?? 'aberta') as ChatStatus;
  const badgeClass = STATUS_BADGE_CLASS[currentStatus] ?? STATUS_BADGE_CLASS['aberta'];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border cursor-pointer',
            'hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed',
            badgeClass,
          )}
          title="Alterar status da conversa"
        >
          <span
            className={cn('h-1.5 w-1.5 rounded-full shrink-0', STATUS_DOT_CLASS[currentStatus] ?? 'bg-gray-400')}
          />
          {STATUS_LABELS[currentStatus]}
          {!disabled && <ChevronDownIcon className="h-3 w-3 ml-0.5" />}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44">
        {statuses.map((s) => (
          <DropdownMenuItem key={s} onClick={() => handleSelect(s)} className="gap-2">
            <span className={cn('h-2 w-2 rounded-full shrink-0', STATUS_DOT_CLASS[s])} />
            {STATUS_LABELS[s]}
            {s === currentStatus && <Check className="h-3.5 w-3.5 ml-auto" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── AssignmentSelector (T21) ─────────────────────────────────────────────────

interface AssignmentSelectorProps {
  chat: ZapiChat;
  accountId: string | null;
  disabled?: boolean;
  onHandoffNeeded: (targetUser: UserProfile, confirmCallback: (nota: string) => Promise<void>) => void;
}

function AssignmentSelector({ chat, accountId, disabled, onHandoffNeeded }: AssignmentSelectorProps) {
  const chatUpdate = useChatUpdate(accountId);
  const { createNoteMutation } = useChatNotes(chat.id);
  const { data: users = [] } = useUsers();
  const [open, setOpen] = useState(false);

  const { user: currentUser } = useAuth();
  const activeUsers = users.filter((u) => u.status_aprovacao === 'ATIVO');

  const assignedUser = users.find((u) => u.id === chat.assigned_to) ?? null;

  function handleSelect(targetUser: UserProfile) {
    setOpen(false);
    if (targetUser.id === chat.assigned_to) return;

    const isTransfer = chat.assigned_to !== null && chat.assigned_to !== targetUser.id;

    if (isTransfer) {
      // T22: abrir modal de handoff
      onHandoffNeeded(targetUser, async (nota: string) => {
        // 1. Cria nota de handoff
        if (currentUser?.id) {
          try {
            await createNoteMutation.mutateAsync({
              chat_id: chat.id,
              corpo: `[Transferência para ${targetUser.nome}]\n${nota}`,
              mencoes: [targetUser.id],
              autor_id: currentUser.id,
            });
          } catch (noteErr) {
            // Nota falhou — não bloqueia a transferência, mas avisa o usuário
            console.warn('handoff: falha ao criar nota de transferência', noteErr);
            toast.warning('Transferência feita, mas a nota não foi salva');
          }
        }
        // 2. Aplica patch de atribuição + status
        chatUpdate.mutate(
          { chat_id: chat.id, patch: { assigned_to: targetUser.id, status: 'em_atendimento' } },
          { onSuccess: () => toast.success(`Conversa transferida para ${targetUser.nome}`) },
        );
      });
    } else {
      // Primeira atribuição
      chatUpdate.mutate(
        { chat_id: chat.id, patch: { assigned_to: targetUser.id, status: 'em_atendimento' } },
        { onSuccess: () => toast.success(`Conversa atribuída a ${targetUser.nome}`) },
      );
    }
  }

  function handleRemove() {
    setOpen(false);
    chatUpdate.mutate(
      { chat_id: chat.id, patch: { assigned_to: null } },
      { onSuccess: () => toast.success('Atribuição removida') },
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            'inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded border bg-background hover:bg-accent transition-colors',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
          title="Atribuir conversa"
        >
          <Avatar className="h-5 w-5 shrink-0">
            <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
              {assignedUser ? userInitials(assignedUser.nome) : <User className="h-3 w-3" />}
            </AvatarFallback>
          </Avatar>
          <span className="max-w-[80px] truncate text-[11px]">
            {assignedUser ? assignedUser.nome : 'Não atribuído'}
          </span>
          {!disabled && <ChevronDownIcon className="h-3 w-3 shrink-0 text-muted-foreground" />}
        </button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-64" align="start">
        <Command>
          <CommandInput placeholder="Buscar atendente..." className="h-8 text-xs" />
          <CommandList>
            <CommandEmpty>Nenhum atendente encontrado.</CommandEmpty>
            <CommandGroup>
              {activeUsers.map((u) => (
                <CommandItem
                  key={u.id}
                  value={u.nome}
                  onSelect={() => handleSelect(u)}
                  className="gap-2 text-xs cursor-pointer"
                >
                  <Avatar className="h-6 w-6 shrink-0">
                    <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                      {userInitials(u.nome)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="flex-1 truncate">{u.nome}</span>
                  <span className="text-[10px] text-muted-foreground">{u.role}</span>
                  {u.id === chat.assigned_to && <Check className="h-3.5 w-3.5 ml-auto shrink-0" />}
                </CommandItem>
              ))}
            </CommandGroup>
            {chat.assigned_to && (
              <>
                <DropdownMenuSeparator />
                <CommandGroup>
                  <CommandItem
                    value="remover-atribuicao"
                    onSelect={handleRemove}
                    className="gap-2 text-xs text-destructive cursor-pointer"
                  >
                    <UserMinus className="h-4 w-4 shrink-0" />
                    Remover atribuição
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── ChatPanel ────────────────────────────────────────────────────────────────

function ChatPanel({ chat, selectedAccountId, instanceStatus, onChatCreated }: ChatPanelProps) {
  const isPending = chat.id === PENDING_CHAT_ID;
  const chatAsZapi = isPending ? null : (chat as ZapiChat);

  const { data: messages = [], isLoading } = useZapiMessagesByChat(
    isPending ? null : chat.id,
  );
  const sendMessage = useSendZapiMessage();
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const { can } = usePermissions();
  const canEdit = can.editWhatsapp();
  const chatUpdate = useChatUpdate(selectedAccountId);

  // T22: handoff modal state
  const [handoffOpen, setHandoffOpen] = useState(false);
  const [handoffTarget, setHandoffTarget] = useState<UserProfile | null>(null);
  // useRef evita o padrão frágil de setter funcional para guardar callbacks
  const handoffConfirmFnRef = useRef<((nota: string) => Promise<void>) | null>(null);

  function handleHandoffNeeded(
    targetUser: UserProfile,
    confirmCallback: (nota: string) => Promise<void>,
  ) {
    setHandoffTarget(targetUser);
    handoffConfirmFnRef.current = confirmCallback;
    setHandoffOpen(true);
  }

  async function handleHandoffConfirm(nota: string) {
    if (handoffConfirmFnRef.current) await handoffConfirmFnRef.current(nota);
    setHandoffOpen(false);
    setHandoffTarget(null);
    handoffConfirmFnRef.current = null;
  }

  useEffect(() => {
    if (isPending) {
      const id = setTimeout(() => composerRef.current?.focus(), 80);
      return () => clearTimeout(id);
    }
  }, [isPending, chat.id]);

  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const [pendingAttachment, setPendingAttachment] = useState<
    { file: File; type: ZapiMediaType } | null
  >(null);
  const [pollOpen, setPollOpen] = useState(false);

  const recorder = useAudioRecorder();
  const uploadAudio = useUploadZapiAttachment();
  const sendAudioMedia = useSendZapiMedia();
  const isSendingAudio = uploadAudio.isPending || sendAudioMedia.isPending;

  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const chatSearchInputRef = useRef<HTMLInputElement>(null);
  const messageRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    setChatSearchOpen(false);
    setChatSearchQuery('');
    setCurrentMatchIndex(0);
  }, [chat.id]);

  useEffect(() => {
    if (chatSearchOpen) {
      setTimeout(() => chatSearchInputRef.current?.focus(), 50);
    }
  }, [chatSearchOpen]);

  const matchingIndices = useMemo(() => {
    if (!chatSearchQuery || chatSearchQuery.length < 2) return [];
    const term = chatSearchQuery.toLowerCase();
    return messages.reduce<number[]>((acc, msg, i) => {
      const body = msg.body ?? '';
      if (typeof body === 'string' && body.toLowerCase().includes(term)) acc.push(i);
      return acc;
    }, []);
  }, [messages, chatSearchQuery]);

  const matchingSet = useMemo(() => new Set(matchingIndices), [matchingIndices]);

  useEffect(() => {
    if (matchingIndices.length === 0) return;
    const targetMsgIdx = matchingIndices[currentMatchIndex];
    if (targetMsgIdx === undefined) return;
    const el = messageRefs.current[targetMsgIdx];
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [matchingIndices, currentMatchIndex]);

  useEffect(() => {
    setCurrentMatchIndex((prev) =>
      matchingIndices.length === 0 ? 0 : Math.min(prev, matchingIndices.length - 1)
    );
  }, [matchingIndices]);

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
      if (isPending && onChatCreated && result.chat_id) {
        onChatCreated(result.chat_id);
      }
    } catch {
      // toasts disparados pelos hooks
    }
  }

  useEffect(() => {
    if (chatSearchOpen) return;
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages.length, chatSearchOpen]);

  const display = chat.contact_name ?? chat.whatsapp_name ?? 'Contato sem nome';

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    sendMessage.mutate(
      { account_id: chat.account_id, phone: chat.phone, message: trimmed },
      {
        onSuccess: (result) => {
          setDraft('');
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
    e.target.value = '';
  }

  const isSearchActive = chatSearchOpen && chatSearchQuery.length >= 2;
  const totalMatches = matchingIndices.length;

  return (
    <>
      {/* Header */}
      <div className="px-4 py-3 border-b bg-muted/30 shrink-0">
        {chatSearchOpen ? (
          <div className="flex items-center gap-2">
            <input
              ref={chatSearchInputRef}
              type="text"
              value={chatSearchQuery}
              onChange={(e) => { setChatSearchQuery(e.target.value); setCurrentMatchIndex(0); }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setChatSearchOpen(false); setChatSearchQuery(''); }
                if (e.key === 'Enter') { e.preventDefault(); if (totalMatches === 0) return; setCurrentMatchIndex((i) => (i + 1) % totalMatches); }
              }}
              placeholder="Buscar na conversa..."
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
              aria-label="Buscar mensagem"
            />
            {isSearchActive && (
              <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                {totalMatches === 0 ? '0 de 0' : `${currentMatchIndex + 1} de ${totalMatches}`}
              </span>
            )}
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" title="Resultado anterior" disabled={totalMatches === 0} onClick={() => setCurrentMatchIndex((i) => (i - 1 + totalMatches) % totalMatches)}>
              <ChevronUp className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" title="Próximo resultado" disabled={totalMatches === 0} onClick={() => setCurrentMatchIndex((i) => (i + 1) % totalMatches)}>
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-6 w-6 shrink-0" title="Fechar busca" onClick={() => { setChatSearchOpen(false); setChatSearchQuery(''); }}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <div className="space-y-1.5">
            {/* Linha 1: nome + busca */}
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
                {(chatAsZapi?.contact_name || isPending) && !isNonRealPhone(chat.phone) && (
                  <p className="text-xs text-muted-foreground">{formatPhone(chat.phone)}</p>
                )}
              </div>
              {/* Ações do header: pin, archive, busca */}
              <div className="flex items-center gap-1">
                {!isPending && chatAsZapi && canEdit && (
                  <>
                    {/* T24: pin no header */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      title={chatAsZapi.pinned ? 'Desafixar conversa' : 'Fixar conversa'}
                      onClick={() => chatUpdate.mutate(
                        { chat_id: chatAsZapi.id, patch: { pinned: !chatAsZapi.pinned } },
                        { onSuccess: () => toast.success(chatAsZapi.pinned ? 'Conversa desafixada' : 'Conversa fixada') },
                      )}
                    >
                      <Pin className={cn('h-3.5 w-3.5', chatAsZapi.pinned ? 'text-amber-500 fill-amber-500' : '')} />
                    </Button>
                    {/* T25: archive no header */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      title={chatAsZapi.archived ? 'Desarquivar' : 'Arquivar conversa'}
                      onClick={() => chatUpdate.mutate(
                        { chat_id: chatAsZapi.id, patch: { archived: !chatAsZapi.archived } },
                        { onSuccess: () => toast.success(chatAsZapi.archived ? 'Conversa desarquivada' : 'Conversa arquivada') },
                      )}
                    >
                      {chatAsZapi.archived
                        ? <ArchiveRestore className="h-3.5 w-3.5" />
                        : <Archive className="h-3.5 w-3.5" />
                      }
                    </Button>
                  </>
                )}
                {!isPending && (
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" title="Buscar na conversa" onClick={() => setChatSearchOpen(true)}>
                    <Search className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>

            {/* T19 + T21: segunda linha — status selector + assignment selector */}
            {!isPending && chatAsZapi && (
              <div className="flex items-center gap-2 flex-wrap">
                <StatusSelector
                  chat={chatAsZapi}
                  accountId={selectedAccountId}
                  disabled={!canEdit}
                />
                <AssignmentSelector
                  chat={chatAsZapi}
                  accountId={selectedAccountId}
                  disabled={!canEdit}
                  onHandoffNeeded={handleHandoffNeeded}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* T28: banner de alerta quando a instância Z-API está desconectada */}
      {instanceStatus && !instanceStatus.isLoading && !instanceStatus.connected && (
        <Alert variant="destructive" className="mx-3 mt-2 mb-0 py-2 shrink-0">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-2 text-xs">
            <span>
              {instanceStatus.state === 'PAIRING'
                ? 'Aguardando QR Code — escaneie o código para reconectar.'
                : 'Conexão Z-API perdida. Mensagens não serão entregues.'}
            </span>
            <a
              href="https://app.z-api.io"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 underline font-medium whitespace-nowrap hover:opacity-80"
            >
              {instanceStatus.needsQR ? (
                <><WifiOff className="h-3.5 w-3.5" /> Ver QR</>
              ) : (
                <><Wifi className="h-3.5 w-3.5" /> Reconectar</>
              )}
            </a>
          </AlertDescription>
        </Alert>
      )}

      {/* Mensagens */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3">
        {isLoading && !isPending ? (
          <p className="text-xs text-muted-foreground text-center py-8">Carregando mensagens...</p>
        ) : messages.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            {isPending ? 'Nenhuma conversa ainda. Envie a primeira mensagem abaixo.' : 'Sem mensagens. Comece a conversa abaixo.'}
          </p>
        ) : (
          <div className="space-y-2">
            {messages.map((msg, i) => {
              const isMatch = isSearchActive && matchingSet.has(i);
              const isCurrentMatch = isSearchActive && matchingIndices[currentMatchIndex] === i;
              return (
                <div
                  key={msg.id}
                  ref={(el) => { messageRefs.current[i] = el; }}
                  className={isSearchActive && !isMatch ? 'opacity-30 transition-opacity' : 'transition-opacity'}
                  style={isCurrentMatch ? { outline: '2px solid var(--primary)', borderRadius: '8px' } : undefined}
                >
                  {isSearchActive && isMatch && msg.body ? (
                    <MessageBubble message={msg} highlightTerm={chatSearchQuery} highlightText={highlightText} />
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
          <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={(e) => handleFilePicked('image', e)} />
          <input ref={videoInputRef} type="file" accept="video/mp4,video/3gpp,video/quicktime" className="hidden" onChange={(e) => handleFilePicked('video', e)} />
          <input ref={audioInputRef} type="file" accept="audio/*" className="hidden" onChange={(e) => handleFilePicked('audio', e)} />
          <input ref={documentInputRef} type="file" className="hidden" onChange={(e) => handleFilePicked('document', e)} />

          {recorder.status === 'idle' ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" size="icon" variant="outline" disabled={sendMessage.isPending} title="Anexos e enquetes">
                    <Paperclip className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="top">
                  <DropdownMenuItem onClick={() => imageInputRef.current?.click()}><ImageIcon className="h-4 w-4 mr-2" /> Imagem</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => videoInputRef.current?.click()}><Video className="h-4 w-4 mr-2" /> Vídeo</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => audioInputRef.current?.click()}><Mic className="h-4 w-4 mr-2" /> Áudio (arquivo)</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => documentInputRef.current?.click()}><FileText className="h-4 w-4 mr-2" /> Documento</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setPollOpen(true)}><BarChart3 className="h-4 w-4 mr-2" /> Enquete</DropdownMenuItem>
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

              <Button type="button" size="icon" variant="outline" onClick={() => { void recorder.start(); }} disabled={sendMessage.isPending || !recorder.isSupported} title={recorder.isSupported ? 'Gravar áudio' : 'Gravação de áudio não suportada neste navegador'}>
                <Mic className="h-4 w-4" />
              </Button>

              <Button type="submit" size="icon" disabled={sendMessage.isPending || !draft.trim()} title="Enviar mensagem">
                <Send className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <AudioRecorderBar recorder={recorder} isSending={isSendingAudio} onSend={handleSendAudio} />
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

      {/* T22: HandoffNoteDialog */}
      <HandoffNoteDialog
        open={handoffOpen}
        targetUser={handoffTarget}
        onConfirm={handleHandoffConfirm}
        onCancel={() => {
          setHandoffOpen(false);
          setHandoffTarget(null);
          handoffConfirmFnRef.current = null;
        }}
      />

      {/* Loading overlay para chatUpdate */}
      {chatUpdate.isPending && (
        <div className="absolute inset-0 pointer-events-none flex items-start justify-end p-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}
    </>
  );
}
