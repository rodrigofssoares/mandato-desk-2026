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
  Reply,
  Bookmark,
  MapPin,
  CalendarClock,
  CheckSquare,
  AlarmClock,
  Zap,
  Clock,
  Keyboard,
  Pencil,
  Sparkles,
} from 'lucide-react';
import { format } from 'date-fns';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { EmptyState } from '@/components/ui-system';
import { Button } from '@/components/ui/button';
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
import { useZapiChats, useAllZapiChats, type ZapiChat, type ZapiChatWithAccount } from '@/hooks/useZapiChats';
import { useZapiMessagesByChat, useSendZapiMessage, type ZapiMessage } from '@/hooks/useZapiMessages';
import {
  useUploadZapiAttachment,
  useSendZapiMedia,
  useSendZapiPoll,
  type ZapiMediaType,
} from '@/hooks/useZapiMedia';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';
import { useContact } from '@/hooks/useContacts';
import { useChatUpdate } from '@/hooks/useChatUpdate';
import { useAccountFeatures } from '@/hooks/useAccountFeatures';
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
import { ForwardMessageDialog } from './ForwardMessageDialog';
import { SendLocationDialog } from './SendLocationDialog';
import { TypingDots } from './TypingDots';
import { phoneComparisonKey } from '@/lib/normalization';
import type { UserProfile } from '@/hooks/useUsers';
import { useChatNotes } from '@/hooks/useChatNotes';
import { useZapiInstanceStatus } from '@/hooks/useZapiInstanceStatus';
import { isFeatureEnabled } from '@/lib/featureFlags';
import { exportChatToPdf } from '@/lib/exportChatPdf';
import { useImpersonation } from '@/context/ImpersonationContext';
import { useBusinessHours } from '@/hooks/useBusinessHours';
import { FiltrosFavoritosConversasBar } from './FiltrosFavoritosConversasBar';
import { useFiltrosFavoritosConversas } from '@/hooks/useFiltrosFavoritosConversas';
import type { ConversaFilters } from '@/hooks/useFiltrosFavoritosConversas';
import { useMessageQueue } from '@/hooks/useMessageQueue';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useBulkChatUpdate } from '@/hooks/useBulkChatUpdate';
import { useScheduledMessages } from '@/hooks/useScheduledMessages';
import { useQuickReplies, type QuickReply } from '@/hooks/useQuickReplies';
import { useDraftPersistence, getDraftChatIds } from '@/hooks/useDraftPersistence';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useMessageFlags } from '@/hooks/useMessageFlags';
import { useReactToMessage } from '@/hooks/useZapiReaction';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { QuotedMessageBlock } from './MessageBubble';
import { ExtractToContactDialog } from './ExtractToContactDialog';
import { useAISuggestReply } from '@/hooks/useAISuggestReply';
import { useTranscribeAudio } from '@/hooks/useTranscribeAudio';

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

  // T44: modo de seleção múltipla
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedChatIds, setSelectedChatIds] = useState<Set<string>>(new Set());

  // T57: visão de snoozadas
  const [showSnoozed, setShowSnoozed] = useState(false);

  // T52: filtros favoritos
  const { favoritos: filtrosFavoritos, salvarFavorito, removerFavorito } = useFiltrosFavoritosConversas();

  // T49: set de chatIds com rascunho
  const [draftChatIds, setDraftChatIds] = useState<Set<string>>(() => getDraftChatIds());

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
    setShowSnoozed(false);
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

  // T87 (Fase 7 Onda A): C26 — visão consolidada multi-instância
  const ALL_ACCOUNTS_VALUE = '__all__';
  const isAllAccounts = selectedAccountId === ALL_ACCOUNTS_VALUE;

  const singleAccountQuery = useZapiChats(isAllAccounts ? null : selectedAccountId);
  const allAccountsQuery   = useAllZapiChats();

  const { data: chats = [], isLoading: chatsLoading, refetch: refetchChats } =
    isAllAccounts
      ? (allAccountsQuery as { data: ZapiChatWithAccount[]; isLoading: boolean; refetch: () => void })
      : singleAccountQuery;

  // T18: hook de atualização de chat
  // Em modo __all__, useChatUpdate/bulk não dependem de accountId (passado no patch)
  const chatUpdate = useChatUpdate(isAllAccounts ? null : selectedAccountId);
  // T44: hook de atualização em lote
  const bulkChatUpdate = useBulkChatUpdate(isAllAccounts ? null : selectedAccountId);

  // T27/T28: status de conexão da instância Z-API (polling 60s)
  // Em modo __all__ não poleia nenhuma instância específica
  const instanceStatus = useZapiInstanceStatus(isAllAccounts ? null : selectedAccountId);

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

    // T57: visão de snoozadas
    if (showSnoozed) {
      result = result.filter(
        (c) => !c.archived && c.snoozed_until && new Date(c.snoozed_until) > new Date(),
      );
    } else {
      // T25: separar arquivadas da lista ativa
      result = showArchived
        ? result.filter((c) => c.archived)
        : result.filter((c) => !c.archived);

      // T48: ocultar conversas com snooze ativo (snoozed_until > now)
      if (!showArchived) {
        result = result.filter(
          (c) => !c.snoozed_until || new Date(c.snoozed_until) <= new Date(),
        );
      }
    }

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
  // slaTick não é lido dentro do callback mas é dep intencional: força reavaliação periódica
  // do filtro de snooze (que usa `new Date()`) sem aguardar refetch do servidor.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chats, searchTerm, statusFilter, onlyMine, showArchived, showSnoozed, user?.id, filterByAssignee, slaTick]);

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

  // T48: snooze
  function handleSnooze(chatId: string, until: string | null) {
    chatUpdate.mutate({ chat_id: chatId, patch: { snoozed_until: until } }, {
      onSuccess: () => {
        if (until) {
          const dt = new Date(until);
          const formatted = format(dt, "dd/MM 'às' HH:mm");
          toast(`Conversa adiada até ${formatted}`, {
            action: {
              label: 'Desfazer',
              onClick: () => chatUpdate.mutate({ chat_id: chatId, patch: { snoozed_until: null } }),
            },
          });
          // Se a conversa adiada estava selecionada, deselecionar
          if (selectedChatId === chatId) setSelectedChatId(null);
        } else {
          toast.success('Adiamento removido');
        }
      },
    });
  }

  // T44: toggle de seleção de chat no modo bulk
  function handleToggleBulkSelect(chatId: string) {
    setSelectedChatIds((prev) => {
      const next = new Set(prev);
      if (next.has(chatId)) next.delete(chatId);
      else next.add(chatId);
      return next;
    });
  }

  // T44: ações em massa
  function handleBulkArchive() {
    const ids = [...selectedChatIds];
    if (ids.length === 0) return;
    bulkChatUpdate.mutate({ chat_ids: ids, patch: { archived: true } }, {
      onSuccess: (data) => {
        toast.success(`${data.updated} conversa${data.updated !== 1 ? 's' : ''} arquivada${data.updated !== 1 ? 's' : ''}`);
        setSelectedChatIds(new Set());
        setSelectionMode(false);
        if (selectedChatId && ids.includes(selectedChatId)) setSelectedChatId(null);
      },
    });
  }

  function handleBulkStatusChange(status: 'aberta' | 'em_atendimento' | 'aguardando' | 'finalizada') {
    const ids = [...selectedChatIds];
    if (ids.length === 0) return;
    bulkChatUpdate.mutate({ chat_ids: ids, patch: { status } }, {
      onSuccess: (data) => {
        toast.success(`${data.updated} conversa${data.updated !== 1 ? 's' : ''} atualizada${data.updated !== 1 ? 's' : ''}`);
        setSelectedChatIds(new Set());
        setSelectionMode(false);
      },
    });
  }

  // T56: atalhos de teclado na aba de conversas
  useKeyboardShortcuts([
    {
      key: 'k',
      ctrlKey: true,
      disableInInputs: true,
      handler: (e) => { e.preventDefault(); setPaletteOpen(true); },
    },
    {
      key: 'Escape',
      disableInInputs: false,
      handler: () => {
        if (selectionMode) { setSelectionMode(false); setSelectedChatIds(new Set()); }
      },
    },
  ], !!selectedAccountId);

  // T57: badge de snoozadas — calculado com slaTick para invalidar a cada 60s.
  // Deve ficar antes dos early returns para não violar Rules of Hooks.
  // slaTick não é lido diretamente no callback mas é dep intencional para reavaliação de new Date().
  const snoozedCount = useMemo(
    () =>
      chats.filter(
        (c) => !c.archived && c.snoozed_until && new Date(c.snoozed_until) > new Date(),
      ).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps -- slaTick força reavaliação temporal
    [chats, slaTick],
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

  // T24: separa fixadas das não-fixadas (após todos os filtros)
  const pinnedChats = filteredChats.filter((c) => c.pinned);
  const unpinnedChats = filteredChats.filter((c) => !c.pinned);

  // T20: texto do empty state dependente do filtro ativo
  function emptyStateText() {
    if (showSnoozed) return 'Nenhuma conversa adiada.';
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
              {/* T87 (Fase 7): C26 — visão consolidada multi-instância */}
              {accounts.length >= 1 && (
                <SelectItem value={ALL_ACCOUNTS_VALUE}>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full shrink-0 bg-primary/60" aria-hidden="true" />
                    Todos os números
                  </span>
                </SelectItem>
              )}
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
              <div className="flex items-center gap-1">
                {/* T57: badge de snoozadas — clicável para ver visão Adiadas */}
                {snoozedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowSnoozed(true);
                      setShowArchived(false);
                      setStatusFilter(null);
                      setOnlyMine(false);
                    }}
                    className="text-[10px] text-amber-600 border border-amber-300 rounded-full px-1.5 py-0.5 flex items-center gap-0.5 hover:bg-amber-50 transition-colors"
                    title={`${snoozedCount} conversa${snoozedCount !== 1 ? 's' : ''} adiada${snoozedCount !== 1 ? 's' : ''} — clique para ver`}
                  >
                    <AlarmClock className="h-2.5 w-2.5" />
                    {snoozedCount}
                  </button>
                )}
                {/* T44: botão Selecionar — apenas para quem pode editar */}
                {selectedAccountId && canEdit && !selectionMode && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    title="Selecionar conversas"
                    onClick={() => { setSelectionMode(true); setSelectedChatIds(new Set()); }}
                  >
                    <CheckSquare className="h-3.5 w-3.5" />
                  </Button>
                )}
                {selectedAccountId && !selectionMode && (
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
                {/* T56: atalhos de teclado */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 shrink-0"
                  title="Atalhos: Ctrl+K (nova conversa) · Ctrl+F (buscar na conversa) · Ctrl+Enter (enviar) · Ctrl+/ (respostas rápidas) · Ctrl+Shift+S (snooze 1h)"
                >
                  <Keyboard className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            </div>

            {/* T44: barra de ações em massa */}
            {selectionMode && (
              <div className="flex items-center gap-1.5 py-1 px-1 bg-primary/5 rounded border border-primary/20">
                <span className="text-[11px] text-muted-foreground flex-1">
                  {selectedChatIds.size} selecionada{selectedChatIds.size !== 1 ? 's' : ''}
                </span>
                {selectedChatIds.size > 0 && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] px-2"
                      onClick={handleBulkArchive}
                      disabled={bulkChatUpdate.isPending}
                    >
                      Arquivar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px] px-2"
                      onClick={() => handleBulkStatusChange('finalizada')}
                      disabled={bulkChatUpdate.isPending}
                    >
                      Finalizar
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[10px] px-2"
                  onClick={() => { setSelectionMode(false); setSelectedChatIds(new Set()); }}
                >
                  Cancelar
                </Button>
              </div>
            )}

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
                    setShowSnoozed(false);
                    setStatusFilter(null);
                  }}
                  className={cn(
                    'px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors',
                    !showArchived && !showSnoozed
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
                    setShowSnoozed(false);
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
                {/* T57: chip Adiadas */}
                <button
                  type="button"
                  onClick={() => {
                    setShowSnoozed(true);
                    setShowArchived(false);
                    setStatusFilter(null);
                    setOnlyMine(false);
                  }}
                  className={cn(
                    'px-2 py-0.5 rounded-full text-[10px] font-medium border transition-colors flex items-center gap-1',
                    showSnoozed
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-transparent text-muted-foreground border-border hover:bg-accent',
                  )}
                >
                  <Clock className="h-2.5 w-2.5" />
                  Adiadas
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

          {/* T52: barra de filtros favoritos */}
          {!showArchived && !showSnoozed && selectedAccountId && (
            <div className="px-3 py-1.5 border-b flex items-center gap-1.5 flex-wrap">
              <FiltrosFavoritosConversasBar
                favoritos={filtrosFavoritos}
                filtrosAtuais={{
                  status: statusFilter ?? undefined,
                  onlyMine,
                  showArchived,
                  showSnoozed,
                }}
                filtrosAtivosCount={
                  (statusFilter ? 1 : 0) + (onlyMine ? 1 : 0)
                }
                onSalvar={(nome, filtros) => {
                  salvarFavorito(nome, filtros as ConversaFilters);
                }}
                onAplicar={(filtros) => {
                  setStatusFilter(filtros.status ?? null);
                  setOnlyMine(filtros.onlyMine ?? false);
                  if (filtros.showArchived) setShowArchived(true);
                  if (filtros.showSnoozed) setShowSnoozed(true);
                }}
                onRemover={removerFavorito}
              />
            </div>
          )}

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
                        onSnooze={canEdit ? handleSnooze : undefined}
                        slaTick={slaTick}
                        slaEnabled={slaEnabled}
                        selectionMode={selectionMode}
                        bulkSelected={selectedChatIds.has(chat.id)}
                        onToggleBulkSelect={handleToggleBulkSelect}
                        hasDraft={draftChatIds.has(chat.id)}
                        showSnoozedTimeRemaining={showSnoozed}
                        accountName={isAllAccounts ? (chat as ZapiChatWithAccount).account_name : undefined}
                        isUrgent={(chat as ZapiChat & { ai_sentiment?: string | null }).ai_sentiment === 'urgente'}
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
                    onSnooze={canEdit ? handleSnooze : undefined}
                    slaTick={slaTick}
                    slaEnabled={slaEnabled}
                    selectionMode={selectionMode}
                    bulkSelected={selectedChatIds.has(chat.id)}
                    onToggleBulkSelect={handleToggleBulkSelect}
                    hasDraft={draftChatIds.has(chat.id)}
                    showSnoozedTimeRemaining={showSnoozed}
                    accountName={isAllAccounts ? (chat as ZapiChatWithAccount).account_name : undefined}
                    isUrgent={(chat as ZapiChat & { ai_sentiment?: string | null }).ai_sentiment === 'urgente'}
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
              selectedAccountId={
                // T87: em modo consolidado, usa account_id do chat selecionado
                isAllAccounts && activeChat.account_id
                  ? activeChat.account_id
                  : selectedAccountId
              }
              selectedAccount={
                isAllAccounts && activeChat.account_id
                  ? (accounts.find((a) => a.id === activeChat.account_id) ?? selectedAccount)
                  : selectedAccount
              }
              instanceStatus={instanceStatus}
              chats={chats}
              onChatCreated={(realChatId) => {
                setPendingChat(null);
                setSelectedChatId(realChatId);
              }}
              onDraftChange={(chatId, hasDraft) => {
                setDraftChatIds((prev) => {
                  const next = new Set(prev);
                  if (hasDraft) next.add(chatId);
                  else next.delete(chatId);
                  return next;
                });
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

// ─── CSAT constant ────────────────────────────────────────────────────────────

const CSAT_QUESTION = 'Como você avalia o atendimento do gabinete?';
const CSAT_OPTIONS = [
  '⭐ Muito ruim',
  '⭐⭐ Ruim',
  '⭐⭐⭐ Regular',
  '⭐⭐⭐⭐ Bom',
  '⭐⭐⭐⭐⭐ Excelente',
];

function StatusSelector({ chat, accountId, disabled }: StatusSelectorProps) {
  const chatUpdate = useChatUpdate(accountId);
  const sendPoll = useSendZapiPoll();
  const { isEnabled: isFeatureEnabledFn } = useAccountFeatures(accountId);
  const [csatDialogOpen, setCsatDialogOpen] = useState(false);
  const [pendingFinalizar, setPendingFinalizar] = useState(false);

  const statuses: ChatStatus[] = ['aberta', 'em_atendimento', 'aguardando', 'finalizada'];

  function handleSelect(s: ChatStatus) {
    if (s === chat.status) return;
    // T76: se está finalizando e c29 ativo, exibir AlertDialog com opção CSAT
    if (s === 'finalizada' && isFeatureEnabledFn('c29')) {
      setPendingFinalizar(true);
      setCsatDialogOpen(true);
      return;
    }
    chatUpdate.mutate(
      { chat_id: chat.id, patch: { status: s } },
      { onSuccess: () => toast.success(`Status atualizado: ${STATUS_LABELS[s]}`) },
    );
  }

  function handleFinalizarOnly() {
    setCsatDialogOpen(false);
    setPendingFinalizar(false);
    chatUpdate.mutate(
      { chat_id: chat.id, patch: { status: 'finalizada' } },
      { onSuccess: () => toast.success('Atendimento finalizado') },
    );
  }

  function handleFinalizarComCsat() {
    setCsatDialogOpen(false);
    setPendingFinalizar(false);
    // Finaliza a conversa
    chatUpdate.mutate({ chat_id: chat.id, patch: { status: 'finalizada' } });
    // Envia a enquete CSAT
    sendPoll.mutate(
      {
        account_id: accountId ?? '',
        phone: chat.phone,
        question: CSAT_QUESTION,
        options: CSAT_OPTIONS,
        allow_multiple_answers: false,
      },
      {
        onSuccess: () => toast.success('Atendimento finalizado + CSAT enviado'),
        onError: () => toast.warning('Atendimento finalizado, mas não foi possível enviar o CSAT'),
      },
    );
  }

  const currentStatus = (chat.status ?? 'aberta') as ChatStatus;
  const badgeClass = STATUS_BADGE_CLASS[currentStatus] ?? STATUS_BADGE_CLASS['aberta'];

  return (
    <>
    {/* T76: AlertDialog de CSAT ao finalizar */}
    {pendingFinalizar && (
      <AlertDialog open={csatDialogOpen} onOpenChange={(open) => { if (!open) { setCsatDialogOpen(false); setPendingFinalizar(false); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar atendimento</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja enviar uma pesquisa de satisfação (CSAT) ao eleitor antes de finalizar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button type="button" variant="outline" onClick={handleFinalizarOnly}>
              Finalizar apenas
            </Button>
            <AlertDialogAction onClick={handleFinalizarComCsat}>
              Finalizar e enviar CSAT
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    )}
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
    </>
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

interface ChatPanelProps {
  chat: ZapiChat | PendingChat;
  selectedAccountId: string | null;
  instanceStatus?: { connected: boolean; state: string; needsQR: boolean; isLoading: boolean };
  onChatCreated?: (realChatId: string) => void;
  chats?: ZapiChat[];
  /** T49: callback para atualizar o Set de drafts no pai */
  onDraftChange?: (chatId: string, hasDraft: boolean) => void;
  /** T51: conta selecionada para calcular horário de atendimento */
  selectedAccount?: import('@/hooks/useZapiAccounts').ZapiAccount | null;
}

function ChatPanel({ chat, selectedAccountId, instanceStatus, onChatCreated, chats = [], onDraftChange, selectedAccount }: ChatPanelProps) {
  const isPending = chat.id === PENDING_CHAT_ID;
  const chatAsZapi = isPending ? null : (chat as ZapiChat);

  // T51: horário de atendimento (C27)
  const businessHours = useBusinessHours(selectedAccount ?? null);
  const showBusinessHoursBanner =
    !isPending &&
    isFeatureEnabled((selectedAccount?.recursos_config) ?? null, "c27") &&
    !businessHours.isOpen &&
    businessHours.config !== null;

  const { data: messages = [], isLoading } = useZapiMessagesByChat(
    isPending ? null : chat.id,
  );
  const sendMessage = useSendZapiMessage();

  // T49: rascunho persistente por conversa
  const { draft, setDraft, clearDraft } = useDraftPersistence(isPending ? null : chat.id);

  // T49: notifica o pai quando o draft muda (para atualizar draftChatIds no ChatListItem)
  useEffect(() => {
    if (!isPending && onDraftChange) {
      onDraftChange(chat.id, draft.trim().length > 0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, chat.id, isPending]);

  // T68 (Fase 6 Onda A): pré-preenche o compositor ao clicar em "Enviar parabéns"
  useEffect(() => {
    if (isPending) return;
    function handlePrefill(e: Event) {
      const { chatId, message } = (e as CustomEvent<{ chatId: string; message: string }>).detail;
      if (chatId === chat.id) {
        setDraft(message);
        setTimeout(() => composerRef.current?.focus(), 50);
      }
    }
    window.addEventListener('whatsapp:prefill-message', handlePrefill);
    return () => window.removeEventListener('whatsapp:prefill-message', handlePrefill);
  }, [chat.id, isPending, setDraft]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const { can } = usePermissions();
  const canEdit = can.editWhatsapp();
  const chatUpdate = useChatUpdate(selectedAccountId);

  // ── T34: reply/citação ────────────────────────────────────────────────────
  const [replyTo, setReplyTo] = useState<ZapiMessage | null>(null);

  // ── T35: favoritos ────────────────────────────────────────────────────────
  const chatIdForFlags = isPending ? null : chat.id;
  const { isFlagged, toggleFlag, flaggedCount, flagsQuery } = useMessageFlags(chatIdForFlags);
  const [showFavorites, setShowFavorites] = useState(false);

  // ── T36: reações ──────────────────────────────────────────────────────────
  const reactToMessage = useReactToMessage(isPending ? null : chat.id);

  // ── T37: encaminhar ───────────────────────────────────────────────────────
  const [forwardMessage, setForwardMessage] = useState<ZapiMessage | null>(null);

  // ── T38: localização ──────────────────────────────────────────────────────
  const [locationDialogOpen, setLocationDialogOpen] = useState(false);

  // ── T40: digitando... ─────────────────────────────────────────────────────
  const { isTyping, typingState } = useTypingIndicator(isPending ? null : chat.id);

  // ── T47: atalho "/" — respostas rápidas ───────────────────────────────────
  const { listQuery: quickRepliesQuery } = useQuickReplies(selectedAccountId);
  const quickReplies = quickRepliesQuery.data ?? [];
  const [slashQuery, setSlashQuery] = useState('');
  const [slashOpen, setSlashOpen] = useState(false);
  const [varDialog, setVarDialog] = useState<{
    reply: QuickReply;
    variables: string[];
  } | null>(null);

  // ── T43: agendamento de mensagem ─────────────────────────────────────────
  const chatIdForSchedule = isPending ? null : chat.id;
  const { listQuery: scheduledQuery, createMutation: scheduleMutation, cancelMutation: cancelScheduleMutation } =
    useScheduledMessages(chatIdForSchedule);
  const scheduledPending = scheduledQuery.data ?? [];
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');

  // ── T82 (Fase 7): sugestão de resposta IA (C34) ───────────────────────────
  const [aiSuggestionActive, setAiSuggestionActive] = useState(false);
  const suggestReply = useAISuggestReply(isPending ? null : chat.id, chat.account_id ?? null);

  function handleAISuggest() {
    suggestReply.mutate(undefined, {
      onSuccess: (res) => {
        if (res.skipped || res.error || !res.suggestion) {
          toast.warning('IA não disponível neste momento');
          return;
        }
        setDraft(res.suggestion);
        setAiSuggestionActive(true);
        setTimeout(() => composerRef.current?.focus(), 50);
      },
      onError: () => {
        toast.error('Não foi possível gerar a sugestão');
      },
    });
  }

  function handleClearAISuggestion() {
    setDraft('');
    setAiSuggestionActive(false);
  }

  // ── T84 (Fase 7): transcrição de áudio (C38) ─────────────────────────────
  const transcribeAudio = useTranscribeAudio(isPending ? null : chat.id);
  const [transcribingMessageId, setTranscribingMessageId] = useState<string | null>(null);

  function handleTranscribeMessage(messageId: string) {
    if (!chat.account_id) return;
    setTranscribingMessageId(messageId);
    transcribeAudio.mutate(
      { messageId, accountId: chat.account_id },
      {
        onSuccess: (res) => {
          if (res.skipped && res.reason === 'provider_unsupported') {
            toast.warning(res.message ?? 'Transcrição de áudio não disponível para o provider configurado. Use OpenAI ou Google.');
          } else if (res.error) {
            toast.error('Não foi possível transcrever o áudio');
          }
        },
        onError: () => {
          toast.error('Erro ao transcrever o áudio');
        },
        onSettled: () => {
          setTranscribingMessageId(null);
        },
      },
    );
  }

  // Reset estado ao trocar de chat
  useEffect(() => {
    setReplyTo(null);
    setShowFavorites(false);
    setForwardMessage(null);
    setLocationDialogOpen(false);
    setAiSuggestionActive(false);
    setTranscribingMessageId(null);
  }, [chat.id]);

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

  // T53/C31: exportar PDF
  const [exportingPdf, setExportingPdf] = useState(false);

  async function handleExportPdf() {
    if (!chatAsZapi || exportingPdf) return;
    setExportingPdf(true);
    try {
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          exportChatToPdf(chatAsZapi, messages, selectedAccount?.name);
          resolve();
        }, 0);
      });
    } catch {
      toast.error('Erro ao gerar o PDF. Tente novamente.');
    } finally {
      setExportingPdf(false);
    }
  }

  // T54/C32: fila de reenvio offline
  const { queue: messageQueue, enqueue: enqueueMessage, failedCount, clearFailed } = useMessageQueue(chat.account_id);

  // T56: atalhos de teclado no ChatPanel
  useKeyboardShortcuts([
    {
      key: 'f',
      ctrlKey: true,
      disableInInputs: true,
      handler: (e) => {
        if (isPending) return;
        e.preventDefault();
        setChatSearchOpen(true);
      },
    },
    {
      key: 'Enter',
      ctrlKey: true,
      disableInInputs: false,
      handler: (e) => {
        if (draft.trim()) {
          handleSend(e as unknown as React.FormEvent);
        }
      },
    },
    {
      key: 'Escape',
      disableInInputs: false,
      handler: () => {
        if (chatSearchOpen) { setChatSearchOpen(false); setChatSearchQuery(''); }
        else if (slashOpen) { setSlashOpen(false); }
      },
    },
    // T56: Ctrl+/ — abre popover de respostas rápidas no composer
    {
      key: '/',
      ctrlKey: true,
      disableInInputs: false,
      handler: (e) => {
        if (isPending) return;
        e.preventDefault();
        setSlashOpen(true);
        setSlashQuery('/');
      },
    },
    // T56: Ctrl+Shift+S — snooze rápido de 1 hora na conversa selecionada
    {
      key: 'S',
      ctrlKey: true,
      shiftKey: true,
      disableInInputs: true,
      handler: (e) => {
        if (isPending) return;
        e.preventDefault();
        const until = new Date(Date.now() + 60 * 60 * 1000).toISOString();
        chatUpdate.mutate({ chat_id: chat.id, patch: { snoozed_until: until } }, {
          onSuccess: () => {
            const dt = new Date(until);
            const formatted = format(dt, "dd/MM 'às' HH:mm");
            toast(`Conversa adiada até ${formatted}`, {
              action: {
                label: 'Desfazer',
                onClick: () => chatUpdate.mutate({ chat_id: chat.id, patch: { snoozed_until: null } }),
              },
            });
          },
        });
      },
    },
  ], !isPending);

  // T56: atalhos de teclado globais
  const uploadAudio = useUploadZapiAttachment();
  const sendAudioMedia = useSendZapiMedia();
  const isSendingAudio = uploadAudio.isPending || sendAudioMedia.isPending;

  const [chatSearchOpen, setChatSearchOpen] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [currentMatchIndex, setCurrentMatchIndex] = useState(0);
  const chatSearchInputRef = useRef<HTMLInputElement>(null);
  const messageRefs = useRef<(HTMLDivElement | null)[]>([]);

  // T55: extração de texto para campo de contato
  const [extractDialog, setExtractDialog] = useState<{
    selectedText: string;
    contactId: string;
  } | null>(null);
  const [extractMiniMenu, setExtractMiniMenu] = useState<{
    text: string;
    x: number;
    y: number;
    contactId: string;
  } | null>(null);

  function handleMessagesMouseUp(e: React.MouseEvent<HTMLDivElement>) {
    // Só processa se há contactId na conversa (contato vinculado)
    const contactId = chatAsZapi?.contact_id;
    if (!contactId || isPending) return;

    const sel = window.getSelection();
    const selectedText = sel?.toString().trim() ?? '';
    if (!selectedText) {
      setExtractMiniMenu(null);
      return;
    }

    // Garante que a seleção está dentro da área de mensagens
    const anchor = sel?.anchorNode;
    if (!anchor) return;
    const container = e.currentTarget;
    if (!container.contains(anchor as Node)) return;

    // T55: só exibe mini-menu para mensagens RECEBIDAS (inbound)
    const anchorEl = anchor.nodeType === Node.TEXT_NODE ? anchor.parentElement : (anchor as Element);
    const msgWrapper = anchorEl?.closest('[data-direction]') as HTMLElement | null;
    if (!msgWrapper || msgWrapper.dataset.direction !== 'inbound') {
      setExtractMiniMenu(null);
      return;
    }

    setExtractMiniMenu({
      text: selectedText,
      x: e.clientX,
      y: e.clientY,
      contactId,
    });
  }

  useEffect(() => {
    setChatSearchOpen(false);
    setChatSearchQuery('');
    setCurrentMatchIndex(0);
    setExtractMiniMenu(null);
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
  }, [messages.length, chatSearchOpen, isTyping]);

  const display = chat.contact_name ?? chat.whatsapp_name ?? 'Contato sem nome';

  function handleSend(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = draft.trim();
    if (!trimmed) return;
    // T34: inclui quoted_message_id quando reply ativo
    const payload = {
      account_id: chat.account_id,
      phone: chat.phone,
      message: trimmed,
      ...(replyTo ? { quoted_message_id: replyTo.message_id } : {}),
    };

    // T54/C32: enfileirar quando offline
    if (!navigator.onLine) {
      enqueueMessage({ chatId: chat.id, message: payload });
      clearDraft();
      setReplyTo(null);
      return;
    }

    sendMessage.mutate(
      payload,
      {
        onSuccess: (result) => {
          clearDraft(); // T49: limpa rascunho persistente após envio
          setReplyTo(null); // T34: limpa reply após envio bem-sucedido
          if (isPending && onChatCreated && result.chat_id) {
            onChatCreated(result.chat_id);
          }
        },
        onError: (err) => {
          // T54: se erro de rede, enfileirar
          const msg = (err as Error)?.message ?? '';
          if (msg.toLowerCase().includes('failed to fetch') || !navigator.onLine) {
            enqueueMessage({ chatId: chat.id, message: payload });
            clearDraft();
            setReplyTo(null);
            toast.warning('Sem conexão — mensagem em fila para reenvio');
          }
          // T34: mantém replyTo em caso de erro para o usuário reenviar com contexto
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
              {/* Ações do header: pin, archive, favoritas, busca */}
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
                {/* T35: botão de favoritas */}
                {!isPending && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 relative"
                    title={showFavorites ? 'Voltar ao histórico' : 'Ver favoritas'}
                    onClick={() => setShowFavorites((v) => !v)}
                  >
                    <Bookmark className={cn('h-3.5 w-3.5', showFavorites ? 'fill-amber-400 text-amber-400' : '')} />
                    {flaggedCount > 0 && !showFavorites && (
                      <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-amber-400 text-[9px] text-white font-bold flex items-center justify-center leading-none">
                        {flaggedCount > 9 ? '9+' : flaggedCount}
                      </span>
                    )}
                  </Button>
                )}
                {!isPending && (
                  <Button type="button" variant="ghost" size="icon" className="h-7 w-7 shrink-0" title="Buscar na conversa (Ctrl+F)" onClick={() => setChatSearchOpen(true)}>
                    <Search className="h-3.5 w-3.5" />
                  </Button>
                )}
                {/* T53/C31: exportar conversa em PDF */}
                {!isPending && chatAsZapi && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    title="Exportar conversa em PDF"
                    disabled={exportingPdf}
                    onClick={handleExportPdf}
                  >
                    {exportingPdf ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileText className="h-3.5 w-3.5" />
                    )}
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

      {/* T51/C27: banner de fora do expediente */}
      {showBusinessHoursBanner && businessHours.nextOpenTime && (
        <Alert className="mx-3 mt-2 mb-0 py-1.5 shrink-0 border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <Clock className="h-3.5 w-3.5 text-amber-600" />
          <AlertDescription className="text-xs text-amber-800 dark:text-amber-300">
            Fora do horário de atendimento.{' '}
            Próximo atendimento:{' '}
            <strong>
              {businessHours.nextOpenTime.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
              {' às '}
              {businessHours.nextOpenTime.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
            </strong>
          </AlertDescription>
        </Alert>
      )}

      {/* T55: mini-menu flutuante de extração de texto */}
      {extractMiniMenu && (
        <div
          className="fixed z-50 bg-popover border rounded-md shadow-md p-1 flex gap-1"
          style={{ left: extractMiniMenu.x + 4, top: extractMiniMenu.y - 36 }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs px-2 py-1 rounded hover:bg-accent transition-colors"
            onClick={() => {
              setExtractDialog({ selectedText: extractMiniMenu.text, contactId: extractMiniMenu.contactId });
              setExtractMiniMenu(null);
              window.getSelection()?.removeAllRanges();
            }}
          >
            <Pencil className="h-3 w-3 text-primary" />
            Salvar em contato
          </button>
        </div>
      )}

      {/* T35: visão de favoritas / histórico normal */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3" onMouseUp={handleMessagesMouseUp}>
        {showFavorites ? (
          // ── Visão de favoritas ────────────────────────────────────────────
          <div>
            <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1">
              <Bookmark className="h-3 w-3" />
              Mensagens favoritadas
            </p>
            {flagsQuery.isLoading ? (
              <p className="text-xs text-muted-foreground text-center py-8">Carregando...</p>
            ) : flaggedCount === 0 ? (
              <div className="text-center py-8">
                <Bookmark className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-xs text-muted-foreground">Nenhuma mensagem favoritada ainda.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {messages
                  .filter((m) => isFlagged(m.message_id))
                  .map((msg) => (
                    <MessageBubble
                      key={msg.id}
                      message={msg}
                      onFlag={() => toggleFlag(msg.message_id)}
                      isFlagged
                    />
                  ))}
              </div>
            )}
          </div>
        ) : isLoading && !isPending ? (
          // ── Carregando ────────────────────────────────────────────────────
          <p className="text-xs text-muted-foreground text-center py-8">Carregando mensagens...</p>
        ) : messages.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            {isPending ? 'Nenhuma conversa ainda. Envie a primeira mensagem abaixo.' : 'Sem mensagens. Comece a conversa abaixo.'}
          </p>
        ) : (
          // ── Histórico normal ──────────────────────────────────────────────
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
                  data-direction={msg.direction}
                >
                  <MessageBubble
                    message={msg}
                    highlightTerm={isSearchActive && isMatch && msg.body ? chatSearchQuery : undefined}
                    highlightText={isSearchActive && isMatch && msg.body ? highlightText : undefined}
                    onReply={canEdit ? setReplyTo : undefined}
                    onFlag={canEdit ? () => toggleFlag(msg.message_id) : undefined}
                    isFlagged={isFlagged(msg.message_id)}
                    onReact={canEdit ? (messageId, emoji) => {
                      reactToMessage.mutate({
                        account_id: chat.account_id,
                        phone: chat.phone,
                        message_id: messageId,
                        reaction: emoji,
                      });
                    } : undefined}
                    onForward={canEdit ? setForwardMessage : undefined}
                    transcriptionEnabled={isFeatureEnabled(selectedAccount?.recursos_config ?? null, 'c38')}
                    onTranscribe={handleTranscribeMessage}
                    isTranscribing={transcribingMessageId === msg.id}
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* T40: indicador "digitando..." */}
        {isTyping && !isPending && (
          <div className="flex items-center gap-2 px-1 pt-2 text-xs text-muted-foreground">
            <TypingDots />
            <span>
              {(chat as ZapiChat).contact_name ?? (chat as ZapiChat).whatsapp_name ?? 'Contato'}{' '}
              {typingState === 'recording' ? 'está gravando um áudio...' : 'está digitando...'}
            </span>
          </div>
        )}
      </div>

      {/* T54/C32: indicador de fila de mensagens pendentes */}
      {messageQueue.filter((q) => q.chatId === (isPending ? null : chat.id) && (q.status === 'pendente' || q.status === 'tentando')).length > 0 && (
        <div className="px-3 py-1 border-t bg-amber-50/50 dark:bg-amber-950/20 shrink-0 flex items-center gap-2 text-[11px] text-amber-700 dark:text-amber-400">
          <Loader2 className="h-3 w-3 animate-spin" />
          {messageQueue.filter((q) => q.chatId === (isPending ? null : chat.id) && (q.status === 'pendente' || q.status === 'tentando')).length} mensagem(ns) aguardando reenvio
        </div>
      )}
      {failedCount > 0 && messageQueue.some((q) => q.chatId === (isPending ? null : chat.id) && q.status === 'falha_permanente') && (
        <div className="px-3 py-1 border-t bg-destructive/5 shrink-0 flex items-center gap-2 text-[11px] text-destructive">
          <AlertTriangle className="h-3 w-3" />
          {messageQueue.filter((q) => q.chatId === (isPending ? null : chat.id) && q.status === 'falha_permanente').length} mensagem(ns) não puderam ser enviadas
          <button type="button" className="ml-auto underline" onClick={clearFailed}>Limpar</button>
        </div>
      )}

      {/* T43: indicador de mensagens agendadas */}
      {!isPending && scheduledPending.length > 0 && (
        <div className="px-3 py-1.5 border-t bg-amber-50/50 dark:bg-amber-950/20 shrink-0">
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 text-[11px] text-amber-700 dark:text-amber-400 hover:underline"
              >
                <CalendarClock className="h-3.5 w-3.5" />
                {scheduledPending.length} mensagem{scheduledPending.length !== 1 ? 'ns' : ''} agendada{scheduledPending.length !== 1 ? 's' : ''}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-3" align="start" side="top">
              <p className="text-xs font-medium mb-2">Mensagens agendadas</p>
              <div className="space-y-2">
                {scheduledPending.map((sm) => (
                  <div key={sm.id} className="flex items-start justify-between gap-2 text-xs">
                    <div className="flex-1 min-w-0">
                      <p className="text-muted-foreground text-[10px]">
                        {format(new Date(sm.scheduled_at), "dd/MM/yyyy 'às' HH:mm")}
                      </p>
                      <p className="truncate">{sm.body}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
                      onClick={() => cancelScheduleMutation.mutate(sm.id)}
                      disabled={cancelScheduleMutation.isPending}
                      title="Cancelar agendamento"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Composer */}
      <form onSubmit={handleSend} className="border-t p-3 bg-muted/10 shrink-0">
        {/* T34: banner de reply ativo */}
        {replyTo && (
          <div className="flex items-start gap-2 mb-2 px-2 py-1.5 bg-muted/50 rounded border-l-2 border-primary/60">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-muted-foreground flex items-center gap-1 mb-0.5">
                <Reply className="h-3 w-3" />
                Respondendo a:
              </p>
              <QuotedMessageBlock
                body={replyTo.quoted_body ?? replyTo.body}
                type={replyTo.media_type ?? 'text'}
                isOutbound={false}
              />
            </div>
            <button
              type="button"
              onClick={() => setReplyTo(null)}
              className="p-0.5 rounded hover:bg-accent transition-colors mt-0.5 shrink-0"
              aria-label="Cancelar reply"
            >
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
        )}

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
                  {/* T38: item de localização */}
                  <DropdownMenuItem onClick={() => setLocationDialogOpen(true)}><MapPin className="h-4 w-4 mr-2" /> Localização</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* T82 (Fase 7): Botão Sugestão IA (C34) — visível somente quando c34 ativo */}
              {!isPending && isFeatureEnabled(selectedAccount?.recursos_config ?? null, 'c34') && (
                <Button
                  type="button"
                  size="icon"
                  variant={aiSuggestionActive ? 'default' : 'outline'}
                  onClick={handleAISuggest}
                  disabled={suggestReply.isPending || sendMessage.isPending}
                  title="Sugestão de resposta com IA"
                >
                  {suggestReply.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                </Button>
              )}

              {/* T47: popover de respostas rápidas */}
              <div className="relative flex-1">
                {/* T82 (Fase 7): badge de sugestão ativa */}
                {aiSuggestionActive && (
                  <div className="absolute top-0 right-0 z-10 flex items-center gap-1 bg-primary/10 border border-primary/30 rounded-md px-1.5 py-0.5">
                    <Sparkles className="h-3 w-3 text-primary shrink-0" />
                    <span className="text-[10px] text-primary font-medium">Sugestão IA</span>
                    <button
                      type="button"
                      onClick={handleClearAISuggestion}
                      className="ml-0.5 text-primary/70 hover:text-primary"
                      aria-label="Descartar sugestão"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                )}
                {slashOpen && (
                  <div className="absolute bottom-full mb-1 left-0 right-0 z-50 rounded-md border bg-popover shadow-md">
                    <Command>
                      <CommandInput
                        value={slashQuery}
                        onValueChange={setSlashQuery}
                        placeholder="Buscar resposta rápida..."
                        className="h-8 text-xs"
                      />
                      <CommandList className="max-h-48">
                        <CommandEmpty>Nenhuma resposta rápida encontrada.</CommandEmpty>
                        {quickReplies.length > 0 && (() => {
                          const term = slashQuery.replace(/^\//, '').toLowerCase();
                          const filtered = quickReplies.filter(
                            (r) =>
                              !term ||
                              r.titulo.toLowerCase().includes(term) ||
                              (r.categoria ?? '').toLowerCase().includes(term),
                          );
                          // Agrupa por categoria
                          const bycat = new Map<string, QuickReply[]>();
                          for (const r of filtered) {
                            const k = r.categoria ?? 'Geral';
                            if (!bycat.has(k)) bycat.set(k, []);
                            bycat.get(k)!.push(r);
                          }
                          return [...bycat.entries()].map(([cat, items]) => (
                            <CommandGroup key={cat} heading={cat}>
                              {items.map((r) => (
                                <CommandItem
                                  key={r.id}
                                  value={r.titulo}
                                  onSelect={() => {
                                    setSlashOpen(false);
                                    setSlashQuery('');
                                    if (r.variaveis && r.variaveis.length > 0) {
                                      setVarDialog({ reply: r, variables: r.variaveis });
                                    } else {
                                      setDraft(r.corpo);
                                      composerRef.current?.focus();
                                    }
                                  }}
                                  className="text-xs cursor-pointer"
                                >
                                  <Zap className="h-3 w-3 mr-2 shrink-0 text-primary/60" />
                                  <span className="flex-1 truncate">{r.titulo}</span>
                                  {r.variaveis && r.variaveis.length > 0 && (
                                    <span className="text-[10px] text-muted-foreground shrink-0">
                                      {r.variaveis.length} var.
                                    </span>
                                  )}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          ));
                        })()}
                      </CommandList>
                    </Command>
                  </div>
                )}

                <Textarea
                  ref={composerRef}
                  value={draft}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDraft(val);
                    // T47: detecta atalho "/" no início ou após espaço
                    const lastSpaceIdx = val.lastIndexOf(' ');
                    const lastPart = lastSpaceIdx === -1 ? val : val.slice(lastSpaceIdx + 1);
                    if (lastPart.startsWith('/')) {
                      setSlashQuery(lastPart);
                      setSlashOpen(true);
                    } else {
                      setSlashOpen(false);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (slashOpen && (e.key === 'Escape')) {
                      e.preventDefault();
                      setSlashOpen(false);
                      return;
                    }
                    handleKeyDown(e);
                  }}
                  placeholder="Escreva uma mensagem... (/ para respostas rápidas, Enter envia)"
                  rows={2}
                  className="resize-none"
                  disabled={sendMessage.isPending}
                  maxLength={4096}
                />
              </div>

              <Button type="button" size="icon" variant="outline" onClick={() => { void recorder.start(); }} disabled={sendMessage.isPending || !recorder.isSupported} title={recorder.isSupported ? 'Gravar áudio' : 'Gravação de áudio não suportada neste navegador'}>
                <Mic className="h-4 w-4" />
              </Button>

              {/* T43: botão Agendar — só para quem pode editar e quando não é chat pendente */}
              {canEdit && !isPending && (
                <Popover open={scheduleOpen} onOpenChange={setScheduleOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      size="icon"
                      variant="outline"
                      disabled={sendMessage.isPending || !draft.trim()}
                      title="Agendar envio"
                    >
                      <CalendarClock className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72" align="end" side="top">
                    <div className="space-y-3">
                      <p className="text-sm font-medium">Agendar envio</p>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">Data e hora</label>
                        <input
                          type="datetime-local"
                          value={scheduledAt}
                          onChange={(e) => setScheduledAt(e.target.value)}
                          min={new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16)}
                          max={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)}
                          className="w-full text-sm border rounded px-2 py-1.5 bg-background"
                        />
                        <p className="text-[10px] text-muted-foreground">
                          Mínimo: 5 minutos à frente. Máximo: 30 dias.
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        className="w-full"
                        disabled={!scheduledAt || scheduleMutation.isPending}
                        onClick={async () => {
                          if (!scheduledAt || !draft.trim()) return;
                          const chosenDate = new Date(scheduledAt);
                          if (chosenDate.getTime() < Date.now() + 4 * 60 * 1000) {
                            toast.error('Escolha um horário ao menos 5 minutos à frente');
                            return;
                          }
                          await scheduleMutation.mutateAsync({
                            account_id: chat.account_id,
                            chat_id: isPending ? null : chat.id,
                            phone: chat.phone,
                            body: draft.trim(),
                            quoted_message_id: replyTo?.message_id ?? null,
                            scheduled_at: chosenDate.toISOString(),
                          });
                          clearDraft();
                          setReplyTo(null);
                          setScheduleOpen(false);
                          setScheduledAt('');
                        }}
                      >
                        {scheduleMutation.isPending ? 'Agendando...' : 'Confirmar agendamento'}
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              )}

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

      {/* T37: ForwardMessageDialog */}
      <ForwardMessageDialog
        open={!!forwardMessage}
        onOpenChange={(o) => !o && setForwardMessage(null)}
        message={forwardMessage}
        accountId={chat.account_id}
        chats={chats}
      />

      {/* T38: SendLocationDialog */}
      <SendLocationDialog
        open={locationDialogOpen}
        onOpenChange={setLocationDialogOpen}
        accountId={chat.account_id}
        phone={chat.phone}
        onSent={(chatId) => {
          setLocationDialogOpen(false);
          if (isPending && onChatCreated && chatId) onChatCreated(chatId);
        }}
      />

      {/* T47: VariablesFillDialog — preencher variáveis antes de inserir resposta no draft */}
      {varDialog && (
        <VariablesFillDialog
          open={!!varDialog}
          onClose={() => setVarDialog(null)}
          reply={varDialog.reply}
          variables={varDialog.variables}
          contactName={
            isPending
              ? (chat as PendingChat).contact_name ?? undefined
              : (chat as ZapiChat).contact_name ?? (chat as ZapiChat).whatsapp_name ?? undefined
          }
          onConfirm={(filledBody) => {
            setDraft(filledBody);
            setVarDialog(null);
            composerRef.current?.focus();
          }}
        />
      )}

      {/* T55: ExtractToContactDialog */}
      {extractDialog && (
        <ExtractToContactDialog
          open={!!extractDialog}
          onOpenChange={(o) => !o && setExtractDialog(null)}
          contactId={extractDialog.contactId}
          selectedText={extractDialog.selectedText}
        />
      )}

      {/* Loading overlay para chatUpdate */}
      {chatUpdate.isPending && (
        <div className="absolute inset-0 pointer-events-none flex items-start justify-end p-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}
    </>
  );
}

// ─── VariablesFillDialog (T47) ─────────────────────────────────────────────────

interface VariablesFillDialogProps {
  open: boolean;
  onClose: () => void;
  reply: QuickReply;
  variables: string[];
  /** Nome do contato para pré-preencher {{nome}} */
  contactName?: string;
  onConfirm: (filledBody: string) => void;
}

function VariablesFillDialog({ open, onClose, reply, variables, contactName, onConfirm }: VariablesFillDialogProps) {
  // Pré-preenche as variáveis conhecidas
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const v of variables) {
      if (v === 'nome' && contactName) init[v] = contactName;
      else init[v] = '';
    }
    return init;
  });

  function handleConfirm() {
    const filled = reply.corpo.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? `{{${key}}}`);
    // Avisa se há variáveis não preenchidas
    const unfilled = variables.filter((v) => !values[v]);
    if (unfilled.length > 0) {
      toast.warning(`Variável${unfilled.length !== 1 ? 's' : ''} não preenchida${unfilled.length !== 1 ? 's' : ''}: ${unfilled.map((v) => `{{${v}}}`).join(', ')}`);
    }
    onConfirm(filled);
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className={open ? 'fixed inset-0 z-50 flex items-center justify-center' : 'hidden'}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="fixed inset-0 bg-black/50" />
      <div className="relative bg-background rounded-lg border shadow-lg w-full max-w-sm p-5 space-y-4 z-10">
        <div>
          <h2 className="text-sm font-semibold">Preencher variáveis</h2>
          <p className="text-xs text-muted-foreground mt-0.5">{reply.titulo}</p>
        </div>
        <div className="space-y-3">
          {variables.map((v) => (
            <div key={v} className="space-y-1">
              <label className="text-xs font-medium">
                {`{{${v}}}`}
              </label>
              <Input
                value={values[v] ?? ''}
                onChange={(e) => setValues((prev) => ({ ...prev, [v]: e.target.value }))}
                placeholder={`Valor para {{${v}}}`}
                className="h-8 text-xs"
                autoFocus={variables[0] === v}
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2 justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" size="sm" onClick={handleConfirm}>
            Confirmar
          </Button>
        </div>
      </div>
    </div>
  );
}
