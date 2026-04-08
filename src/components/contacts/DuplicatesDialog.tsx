import { useState } from "react";
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
} from "lucide-react";
import {
  useDuplicateGroups,
  useBulkDeleteDuplicates,
  type DuplicateContact,
  type DuplicateGroup,
} from "@/hooks/useDuplicates";
import { ContactCompareModal } from "./duplicates/ContactCompareModal";
import { ContactMergeModal } from "./duplicates/ContactMergeModal";
import { ContactViewDrawer } from "./duplicates/ContactViewDrawer";
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
import { cn } from "@/lib/utils";

// ---------- Props ----------

interface DuplicatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

// ---------- Helpers ----------

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

  // Sub-modal state
  const [viewContact, setViewContact] = useState<DuplicateContact | null>(null);
  const [compareContacts, setCompareContacts] = useState<[DuplicateContact, DuplicateContact] | null>(null);
  const [mergeContacts, setMergeContacts] = useState<[DuplicateContact, DuplicateContact] | null>(null);
  const [showCompare, setShowCompare] = useState(false);
  const [showMerge, setShowMerge] = useState(false);
  const [showView, setShowView] = useState(false);

  const { data: groups, isLoading, refetch } = useDuplicateGroups(open);
  const bulkDelete = useBulkDeleteDuplicates();

  const safeGroups: DuplicateGroup[] = groups ?? [];
  const totalGroups = safeGroups.length;
  const totalDuplicates = safeGroups.reduce((sum, g) => sum + (g.contacts.length - 1), 0);

  function toggleGroup(key: string) {
    setExpandedGroups((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  async function handleBulkDelete() {
    await bulkDelete.mutateAsync({ groups: safeGroups, strategy });
    refetch();
    onSuccess?.();
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
                ? `${totalGroups} grupo${totalGroups !== 1 ? "s" : ""} com duplicatas — ${totalDuplicates} contato${totalDuplicates !== 1 ? "s" : ""} ser${totalDuplicates !== 1 ? "ao" : "a"} removido${totalDuplicates !== 1 ? "s" : ""}`
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
                  const canCompareOrMerge = group.contacts.length === 2;

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
                          {group.contacts.map((contact, idx) => (
                            <div key={contact.id}>
                              <div className="flex items-center gap-3 px-6 py-2.5">
                                {/* Contact info */}
                                <div className="flex-1 min-w-0 space-y-0.5">
                                  <p className="text-sm font-medium truncate">{contact.nome}</p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {contact.whatsapp
                                      ? contact.whatsapp
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
                                        onClick={() => {
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

                                  {canCompareOrMerge && (
                                    <>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={() => {
                                              setCompareContacts([
                                                group.contacts[0],
                                                group.contacts[1],
                                              ]);
                                              setShowCompare(true);
                                            }}
                                          >
                                            <GitCompare className="h-3.5 w-3.5" />
                                            <span className="sr-only">Comparar</span>
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Comparar</TooltipContent>
                                      </Tooltip>

                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-7 w-7"
                                            onClick={() => {
                                              setMergeContacts([
                                                group.contacts[0],
                                                group.contacts[1],
                                              ]);
                                              setShowMerge(true);
                                            }}
                                          >
                                            <GitMerge className="h-3.5 w-3.5" />
                                            <span className="sr-only">Mesclar</span>
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Mesclar</TooltipContent>
                                      </Tooltip>
                                    </>
                                  )}
                                </div>
                              </div>

                              {idx < group.contacts.length - 1 && (
                                <Separator className="mx-6" />
                              )}
                            </div>
                          ))}
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
