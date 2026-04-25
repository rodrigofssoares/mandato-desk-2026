import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Eye,
  GitCompare,
  GitMerge,
  Trash2,
  Loader2,
  Phone,
  Mail,
  User,
  AlertTriangle,
  Check,
  Sparkles,
  Wand2,
} from "lucide-react";
import {
  useDuplicateGroups,
  useBulkDeleteDuplicates,
  useDeleteSingleDuplicate,
  useAutoMergeDuplicates,
  useAutoResolveDuplicates,
  useMergeGroupWithWinner,
  useDismissDuplicateGroups,
  type DuplicateContact,
  type DuplicateGroup,
} from "@/hooks/useDuplicates";
import { analyzeDuplicates } from "@/lib/duplicate-analysis";
import { Progress } from "@/components/ui/progress";
import { X, Crown } from "lucide-react";
import { ContactCompareModal } from "./duplicates/ContactCompareModal";
import { ContactMergeModal } from "./duplicates/ContactMergeModal";
import { ContactViewDrawer } from "./duplicates/ContactViewDrawer";
import { getContactDisplayName } from "@/lib/contactDisplay";
import { formatPhoneDisplay } from "@/lib/normalization";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

// ---------- Props ----------

interface DuplicatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// ---------- Helpers ----------

const ANALYSIS_COLORS = {
  emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  sky: 'bg-sky-100 text-sky-700 border-sky-200',
  slate: 'bg-slate-100 text-slate-700 border-slate-200',
  amber: 'bg-amber-100 text-amber-700 border-amber-200',
} as const;

function AnalysisRow({
  color,
  label,
  hint,
  stats,
}: {
  color: keyof typeof ANALYSIS_COLORS;
  label: string;
  hint: string;
  stats: { groups: number; contacts: number; duplicates: number };
}) {
  return (
    <div className="flex items-start gap-2">
      <Badge variant="outline" className={cn('shrink-0 mt-0.5 font-mono', ANALYSIS_COLORS[color])}>
        {stats.groups} grupos · {stats.duplicates} dups
      </Badge>
      <div className="flex-1 min-w-0">
        <p className="font-medium">{label}</p>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </div>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function MatchFieldIcon({ field }: { field: DuplicateGroup["match_field"] }) {
  if (field === "whatsapp") return <Phone className="h-3.5 w-3.5 shrink-0 text-green-600" />;
  if (field === "email") return <Mail className="h-3.5 w-3.5 shrink-0 text-blue-600" />;
  return <User className="h-3.5 w-3.5 shrink-0 text-violet-600" />;
}

function matchFieldLabel(field: DuplicateGroup["match_field"]): string {
  if (field === "whatsapp") return "WhatsApp";
  if (field === "email") return "E-mail";
  return "Nome";
}

// ---------- Component ----------

export function DuplicatesDialog({ open, onOpenChange, onSuccess }: DuplicatesDialogProps) {
  const [strategy, setStrategy] = useState<"keep_newest" | "keep_oldest">("keep_newest");
  const [expandedGroups, setExpandedGroups] = useState<string[]>([]);

  // Selection state: track selected contact IDs per group for compare/merge
  const [selectedByGroup, setSelectedByGroup] = useState<Record<string, string[]>>({});

  // Sub-modal state
  const [viewContact, setViewContact] = useState<DuplicateContact | null>(null);
  const [compareContacts, setCompareContacts] = useState<[DuplicateContact, DuplicateContact] | null>(null);
  const [mergeContacts, setMergeContacts] = useState<[DuplicateContact, DuplicateContact] | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [showMerge, setShowMerge] = useState(false);
  const [showView, setShowView] = useState(false);

  // Delete confirmation
  const [deletingContact, setDeletingContact] = useState<DuplicateContact | null>(null);

  const { data: groups, isLoading, refetch } = useDuplicateGroups(open);
  const bulkDelete = useBulkDeleteDuplicates();
  const deleteSingle = useDeleteSingleDuplicate();
  const autoMerge = useAutoMergeDuplicates();
  const [confirmAutoMerge, setConfirmAutoMerge] = useState(false);

  // Resolucao automatica em massa (auto-merge + dismiss)
  const [confirmResolveAll, setConfirmResolveAll] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number; label: string } | null>(null);
  const autoResolve = useAutoResolveDuplicates({
    onProgress: (done, total, label) => setProgress({ done, total, label }),
  });

  // Acoes rapidas por grupo
  const mergeGroup = useMergeGroupWithWinner();
  const dismissGroups = useDismissDuplicateGroups();

  const safeGroups: DuplicateGroup[] = groups ?? [];
  const totalGroups = safeGroups.length;
  const totalDuplicates = safeGroups.reduce((sum, g) => sum + (g.contacts.length - 1), 0);

  // Analise local: classifica cada grupo em AUTO_HARD / AUTO_SOFT / DISMISS_NAME / MANUAL.
  // Roda em useMemo p/ recomputar apenas quando os grupos mudarem.
  const analysis = useMemo(() => analyzeDuplicates(safeGroups), [safeGroups]);
  const [showAnalysis, setShowAnalysis] = useState(false);

  function toggleGroup(key: string) {
    setExpandedGroups((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function toggleContactSelection(groupKey: string, contactId: string) {
    setSelectedByGroup((prev) => {
      const current = prev[groupKey] ?? [];
      if (current.includes(contactId)) {
        return { ...prev, [groupKey]: current.filter((id) => id !== contactId) };
      }
      return { ...prev, [groupKey]: [...current, contactId] };
    });
  }

  function getSelectedContacts(groupKey: string, group: DuplicateGroup): DuplicateContact[] {
    const ids = selectedByGroup[groupKey] ?? [];
    return ids
      .map((id) => group.contacts.find((c) => c.id === id))
      .filter(Boolean) as DuplicateContact[];
  }

  async function handleBulkDelete() {
    await bulkDelete.mutateAsync({ groups: safeGroups, strategy });
    refetch();
    onSuccess?.();
  }

  async function handleAutoMerge() {
    setConfirmAutoMerge(false);
    await autoMerge.mutateAsync(safeGroups);
    refetch();
    onSuccess?.();
  }

  async function handleResolveAll() {
    setConfirmResolveAll(false);
    setProgress({ done: 0, total: 0, label: 'Iniciando...' });
    try {
      await autoResolve.mutateAsync(analysis);
      refetch();
      onSuccess?.();
    } finally {
      setProgress(null);
    }
  }

  // Quantos grupos (de telefone) podem ser auto-resolvidos sem precisar
  // do usuário (sem conflito de campo)? Exibido no botão para o usuário
  // saber o que esperar antes de clicar.
  const phoneGroupsCount = safeGroups.filter((g) => g.match_field === 'whatsapp' && g.contacts.length >= 2).length;

  async function handleDeleteSingle() {
    if (!deletingContact) return;
    await deleteSingle.mutateAsync(deletingContact.id);
    setDeletingContact(null);
    refetch();
    onSuccess?.();
  }

  // Delete all selected contacts in a group
  const [deletingGroupKey, setDeletingGroupKey] = useState<string | null>(null);
  const [batchDeleting, setBatchDeleting] = useState(false);

  async function handleDeleteSelected(groupKey: string) {
    const ids = selectedByGroup[groupKey] ?? [];
    if (ids.length === 0) return;
    setBatchDeleting(true);
    try {
      for (const id of ids) {
        await deleteSingle.mutateAsync(id);
      }
      setSelectedByGroup((prev) => ({ ...prev, [groupKey]: [] }));
      setDeletingGroupKey(null);
      refetch();
      onSuccess?.();
    } finally {
      setBatchDeleting(false);
    }
  }

  function handleCompare(groupKey: string, group: DuplicateGroup) {
    const selected = getSelectedContacts(groupKey, group);
    if (selected.length === 2) {
      setCompareContacts([selected[0], selected[1]]);
      setShowCompare(true);
    }
  }

  function handleMerge(groupKey: string, group: DuplicateGroup) {
    const selected = getSelectedContacts(groupKey, group);
    if (selected.length === 2) {
      setMergeContacts([selected[0], selected[1]]);
      setShowMerge(true);
    }
  }

  return (
    <TooltipProvider delayDuration={300}>
      {/* Main dialog */}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Contatos Duplicados
            </DialogTitle>
            <DialogDescription>
              {totalGroups > 0
                ? `${totalGroups} grupo${totalGroups !== 1 ? "s" : ""} com duplicatas — ${totalDuplicates} contato${totalDuplicates !== 1 ? "s" : ""} duplicado${totalDuplicates !== 1 ? "s" : ""}`
                : "Analise e resolva contatos duplicados na sua base."}
            </DialogDescription>
          </DialogHeader>

          {/* Actions bar */}
          {!isLoading && totalGroups > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Select
                value={strategy}
                onValueChange={(v) => setStrategy(v as "keep_newest" | "keep_oldest")}
              >
                <SelectTrigger className="w-[200px] h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="keep_newest">Manter mais recente</SelectItem>
                  <SelectItem value="keep_oldest">Manter mais antigo</SelectItem>
                </SelectContent>
              </Select>

              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={bulkDelete.isPending || totalDuplicates === 0}
                className="gap-2"
              >
                {bulkDelete.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {bulkDelete.isPending
                  ? "Removendo..."
                  : `Remover ${totalDuplicates} Duplicado${totalDuplicates !== 1 ? "s" : ""}`}
              </Button>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setConfirmAutoMerge(true)}
                    disabled={autoMerge.isPending || phoneGroupsCount === 0}
                    className="gap-2"
                  >
                    {autoMerge.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {autoMerge.isPending ? 'Mesclando...' : 'Auto-mesclar sem conflito'}
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p className="text-xs">
                    Mescla automaticamente todos os grupos onde a única diferença é o formato do telefone
                    (ex: <code>+55…</code> vs <code>55…</code> vs sem DDI) <strong>e</strong> não há
                    conflito em nenhum outro campo. Mantém o registro com prefixo 55 e absorve
                    etiquetas + dados vazios dos demais.
                  </p>
                  <p className="text-xs mt-2">
                    Grupos com conflito real (ex: nomes ou Instagram diferentes) ficam para revisão manual.
                  </p>
                </TooltipContent>
              </Tooltip>

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAnalysis((v) => !v)}
                className="gap-2"
              >
                <Wand2 className="h-4 w-4" />
                {showAnalysis ? 'Ocultar analise' : 'Analisar duplicatas'}
              </Button>

              <p className="text-xs text-muted-foreground ml-auto">
                Selecione 2 contatos em um grupo para comparar ou mesclar
              </p>
            </div>
          )}

          {/* Painel de analise classificada */}
          {!isLoading && totalGroups > 0 && showAnalysis && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-2 text-xs">
              <div className="flex items-center gap-2 font-medium text-sm">
                <Wand2 className="h-4 w-4 text-primary" />
                Analise dos {analysis.totalGroups} grupos ({analysis.totalContacts} contatos)
              </div>
              <AnalysisRow
                color="emerald"
                label="Auto-mergeavel sem conflito"
                hint="mesmo telefone, sem nenhuma divergencia"
                stats={analysis.byCategory.AUTO_HARD}
              />
              <AnalysisRow
                color="sky"
                label="Auto-mergeavel com regras suaves"
                hint="mesmo telefone; nome maior, e-mail mais recente, observacoes concatenadas, etc"
                stats={analysis.byCategory.AUTO_SOFT}
              />
              <AnalysisRow
                color="slate"
                label="Falsos positivos por nome"
                hint="nomes iguais ('Ana', 'Maria') com telefones distintos — devem ser ocultados"
                stats={analysis.byCategory.DISMISS_NAME}
              />
              <AnalysisRow
                color="amber"
                label="Conflito real (revisao manual)"
                hint="CPF/nascimento/genero divergem ou whatsapp diferente em mesmo email"
                stats={analysis.byCategory.MANUAL}
              />
              <p className="text-[11px] text-muted-foreground pt-1">
                Total: <strong>{analysis.byCategory.AUTO_HARD.duplicates + analysis.byCategory.AUTO_SOFT.duplicates}</strong>{' '}
                contatos podem ser mesclados automaticamente,{' '}
                <strong>{analysis.byCategory.DISMISS_NAME.duplicates}</strong> ocultados como falso positivo, e{' '}
                <strong>{analysis.byCategory.MANUAL.duplicates}</strong> precisam de revisao manual.
              </p>

              {progress ? (
                <div className="pt-2 space-y-1.5">
                  <Progress value={progress.total > 0 ? (progress.done / progress.total) * 100 : 0} />
                  <p className="text-[11px] text-muted-foreground text-center">
                    {progress.label} — {progress.done} de {progress.total}
                  </p>
                </div>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setConfirmResolveAll(true)}
                  disabled={
                    autoResolve.isPending ||
                    (analysis.byCategory.AUTO_HARD.groups +
                      analysis.byCategory.AUTO_SOFT.groups +
                      analysis.byCategory.DISMISS_NAME.groups ===
                      0)
                  }
                  className="w-full gap-2 mt-2"
                >
                  <Wand2 className="h-4 w-4" />
                  Resolver tudo automaticamente
                </Button>
              )}
            </div>
          )}

          {/* Groups list */}
          <ScrollArea className="max-h-[500px] rounded-md border">
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : totalGroups === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
                <User className="h-8 w-8 opacity-30" />
                <p className="text-sm">Nenhum contato duplicado encontrado</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {safeGroups.map((group) => {
                  const key = `${group.match_field}:${group.match_value}`;
                  const isExpanded = expandedGroups.includes(key);
                  const selectedIds = selectedByGroup[key] ?? [];
                  const selectedCount = selectedIds.length;

                  return (
                    <Collapsible key={key} open={isExpanded}>
                      {/* Group trigger row */}
                      <CollapsibleTrigger
                        onClick={() => toggleGroup(key)}
                        className="flex w-full items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left"
                      >
                        <span className="shrink-0">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </span>

                        <MatchFieldIcon field={group.match_field} />

                        <span className="text-xs font-medium text-muted-foreground shrink-0">
                          {matchFieldLabel(group.match_field)}
                        </span>

                        <span className="flex-1 truncate text-sm font-medium">
                          {group.match_value}
                        </span>

                        <Badge variant="secondary" className="shrink-0 text-xs">
                          {group.contacts.length} contatos
                        </Badge>
                      </CollapsibleTrigger>

                      {/* Contact rows */}
                      <CollapsibleContent>
                        <div className="bg-muted/20">
                          {/* Group actions bar */}
                          <div className="flex items-center gap-2 px-6 py-2 border-b border-border/50 flex-wrap">
                            <span className="text-xs text-muted-foreground flex-1 min-w-[120px]">
                              {selectedCount === 0
                                ? "Selecione os contatos que deseja excluir"
                                : `${selectedCount} selecionado${selectedCount !== 1 ? "s" : ""}`}
                            </span>

                            {/* Acoes rapidas: Manter A / Manter B (so para grupos de 2) */}
                            {group.contacts.length === 2 && (
                              <>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 gap-1.5 text-xs"
                                      disabled={mergeGroup.isPending}
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        await mergeGroup.mutateAsync({ group, winnerId: group.contacts[0].id });
                                        refetch();
                                        onSuccess?.();
                                      }}
                                    >
                                      <Crown className="h-3.5 w-3.5" />
                                      Manter {getContactDisplayName(group.contacts[0]).split(' ')[0]}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Mantem o primeiro contato e absorve o segundo (regras suaves)
                                  </TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 gap-1.5 text-xs"
                                      disabled={mergeGroup.isPending}
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        await mergeGroup.mutateAsync({ group, winnerId: group.contacts[1].id });
                                        refetch();
                                        onSuccess?.();
                                      }}
                                    >
                                      <Crown className="h-3.5 w-3.5" />
                                      Manter {getContactDisplayName(group.contacts[1]).split(' ')[0]}
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Mantem o segundo contato e absorve o primeiro (regras suaves)
                                  </TooltipContent>
                                </Tooltip>
                              </>
                            )}

                            {/* Nao sao duplicatas: dispensa este grupo */}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 gap-1.5 text-xs"
                                  disabled={dismissGroups.isPending}
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    await dismissGroups.mutateAsync({ groups: [group] });
                                    refetch();
                                    onSuccess?.();
                                  }}
                                >
                                  <X className="h-3.5 w-3.5" />
                                  Nao sao duplicatas
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                Marca este grupo como falso positivo e oculta para sempre
                              </TooltipContent>
                            </Tooltip>

                            {selectedCount >= 1 && (
                              <Button
                                variant="destructive"
                                size="sm"
                                className="h-7 gap-1.5 text-xs"
                                disabled={batchDeleting}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setDeletingGroupKey(key);
                                }}
                              >
                                {batchDeleting && deletingGroupKey === key ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Trash2 className="h-3.5 w-3.5" />
                                )}
                                Excluir {selectedCount}
                              </Button>
                            )}

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 gap-1.5 text-xs"
                                  disabled={selectedCount !== 2}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCompare(key, group);
                                  }}
                                >
                                  <GitCompare className="h-3.5 w-3.5" />
                                  Comparar
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Selecione exatamente 2 para comparar</TooltipContent>
                            </Tooltip>

                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 gap-1.5 text-xs"
                                  disabled={selectedCount !== 2}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMerge(key, group);
                                  }}
                                >
                                  <GitMerge className="h-3.5 w-3.5" />
                                  Mesclar
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Selecione exatamente 2 para mesclar</TooltipContent>
                            </Tooltip>
                          </div>

                          {group.contacts.map((contact, idx) => {
                            const isSelected = selectedIds.includes(contact.id);
                            return (
                              <div key={contact.id}>
                                <div
                                  className={cn(
                                    "flex items-center gap-3 px-6 py-2.5 cursor-pointer transition-colors",
                                    isSelected
                                      ? "bg-primary/10 border-l-2 border-l-primary"
                                      : "hover:bg-muted/40 border-l-2 border-l-transparent"
                                  )}
                                  onClick={() => toggleContactSelection(key, contact.id)}
                                >
                                  {/* Selection indicator */}
                                  <span
                                    className={cn(
                                      "flex items-center justify-center h-5 w-5 rounded border-2 shrink-0 transition-colors",
                                      isSelected
                                        ? "bg-primary border-primary text-primary-foreground"
                                        : "border-muted-foreground/40"
                                    )}
                                  >
                                    {isSelected && <Check className="h-3 w-3" />}
                                  </span>

                                  {/* Contact info */}
                                  <div className="flex-1 min-w-0 space-y-0.5">
                                    <p className="text-sm font-medium truncate">{getContactDisplayName(contact)}</p>
                                    <p className="text-xs text-muted-foreground truncate">
                                      {contact.whatsapp
                                        ? formatPhoneDisplay(contact.whatsapp)
                                        : contact.email
                                        ? contact.email
                                        : "(sem contato)"}
                                    </p>
                                  </div>

                                  {/* Created at */}
                                  <span className="text-xs text-muted-foreground shrink-0 hidden sm:block">
                                    {formatDate(contact.created_at)}
                                  </span>

                                  {/* Actions */}
                                  <div className="flex items-center gap-1 shrink-0">
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setViewContact(contact);
                                            setShowView(true);
                                          }}
                                        >
                                          <Eye className="h-3.5 w-3.5" />
                                          <span className="sr-only">Ver detalhes</span>
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Ver detalhes</TooltipContent>
                                    </Tooltip>

                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-7 w-7 text-destructive hover:text-destructive"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setDeletingContact(contact);
                                          }}
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                          <span className="sr-only">Excluir</span>
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Excluir este contato</TooltipContent>
                                    </Tooltip>
                                  </div>
                                </div>

                                {idx < group.contacts.length - 1 && (
                                  <Separator className="mx-6" />
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingContact} onOpenChange={(o) => !o && setDeletingContact(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contato</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deletingContact?.nome}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSingle}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteSingle.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch delete confirmation */}
      <AlertDialog open={!!deletingGroupKey} onOpenChange={(o) => !o && setDeletingGroupKey(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir contatos selecionados</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir{" "}
              <strong>{deletingGroupKey ? (selectedByGroup[deletingGroupKey]?.length ?? 0) : 0} contatos</strong>?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={batchDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingGroupKey && handleDeleteSelected(deletingGroupKey)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={batchDeleting}
            >
              {batchDeleting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Excluir {deletingGroupKey ? (selectedByGroup[deletingGroupKey]?.length ?? 0) : 0} contatos
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação do "Resolver tudo automaticamente" */}
      <AlertDialog open={confirmResolveAll} onOpenChange={setConfirmResolveAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Wand2 className="h-5 w-5 text-primary" />
              Resolver duplicatas em massa
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">Vou processar os {analysis.totalGroups} grupos detectados:</span>
              <span className="block">
                ✓ <strong>{analysis.byCategory.AUTO_HARD.groups + analysis.byCategory.AUTO_SOFT.groups} grupos</strong>{' '}
                ({analysis.byCategory.AUTO_HARD.duplicates + analysis.byCategory.AUTO_SOFT.duplicates} contatos)
                serao mesclados automaticamente, mantendo o registro mais completo e
                absorvendo etiquetas, dados extras e observacoes dos demais.
              </span>
              <span className="block">
                ✓ <strong>{analysis.byCategory.DISMISS_NAME.groups} grupos</strong>{' '}
                ({analysis.byCategory.DISMISS_NAME.duplicates} contatos) serao marcados como
                "nao sao duplicatas" (sao nomes iguais com telefones distintos — falsos positivos).
              </span>
              <span className="block">
                ⚠ <strong>{analysis.byCategory.MANUAL.groups} grupos</strong>{' '}
                ({analysis.byCategory.MANUAL.duplicates} contatos) ficarao na lista para revisao manual
                (CPF, nascimento ou genero divergem; ou telefones distintos no mesmo email).
              </span>
              <span className="block text-amber-700 mt-2">
                Esta acao e <strong>reversivel</strong> via tabela <code>contact_merges</code>{' '}
                (snapshot completo de cada contato consumido) e via <code>dismissed_duplicate_groups</code>{' '}
                (delete na tabela traz o grupo de volta).
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={autoResolve.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleResolveAll} disabled={autoResolve.isPending} className="gap-2">
              {autoResolve.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              Resolver tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmação do Auto-merge */}
      <AlertDialog open={confirmAutoMerge} onOpenChange={setConfirmAutoMerge}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Auto-mesclar grupos sem conflito
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                Vou analisar os <strong>{phoneGroupsCount} grupos</strong> de duplicados por telefone:
              </span>
              <span className="block">
                • <strong>Sem conflito</strong> (mesmo número em formatos diferentes ou um campo vazio em um lado): <strong>mesclo automaticamente</strong>, mantendo o registro com prefixo <code>55</code> e absorvendo etiquetas + dados dos outros.
              </span>
              <span className="block">
                • <strong>Com conflito real</strong> (ex: nomes ou Instagram diferentes): <strong>deixo na lista</strong> para você decidir manualmente.
              </span>
              <span className="block text-amber-700 mt-2">
                Esta ação é irreversível em massa — cria <code>merged_into</code> nos contatos absorvidos. Pode levar alguns minutos para grupos volumosos.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={autoMerge.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleAutoMerge} disabled={autoMerge.isPending} className="gap-2">
              {autoMerge.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Confirmar e mesclar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Sub-modals */}
      <ContactViewDrawer
        open={showView}
        onOpenChange={setShowView}
        contact={viewContact}
      />

      <ContactCompareModal
        open={showCompare}
        onOpenChange={setShowCompare}
        contacts={compareContacts}
        onGoToMerge={() => {
          setShowCompare(false);
          setMergeContacts(compareContacts);
          setShowMerge(true);
        }}
      />

      <ContactMergeModal
        open={showMerge}
        onOpenChange={setShowMerge}
        contacts={mergeContacts}
        onSuccess={() => {
          refetch();
          onSuccess?.();
        }}
      />
    </TooltipProvider>
  );
}
