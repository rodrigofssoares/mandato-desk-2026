import { useEffect, useState } from "react";
import { GitMerge, AlertTriangle, Loader2 } from "lucide-react";
import type { DuplicateContact } from "@/hooks/useDuplicates";
import { useMergeContacts } from "@/hooks/useDuplicates";
import { MERGEABLE_FIELDS, type MergeableFieldKey } from "./types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

// ---------- Props ----------

interface ContactMergeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: [DuplicateContact, DuplicateContact] | null;
  onSuccess: () => void;
}

// ---------- Helpers ----------

function hasValue(val: unknown): boolean {
  if (val === null || val === undefined || val === "") return false;
  return true;
}

function renderValue(val: unknown): React.ReactNode {
  if (val === null || val === undefined || val === "") {
    return <span className="text-muted-foreground italic text-xs">(vazio)</span>;
  }
  if (typeof val === "boolean") {
    return <span className="text-xs">{val ? "Sim" : "Nao"}</span>;
  }
  if (typeof val === "number") {
    return <span className="text-xs">{val}</span>;
  }
  const str = String(val);
  if (str.length > 60) {
    return (
      <span className="text-xs" title={str}>
        {str.slice(0, 60)}…
      </span>
    );
  }
  return <span className="text-xs">{str}</span>;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

// ---------- Tag type ----------

interface UnifiedTag {
  id: string;
  nome: string;
  cor?: string | null;
  origin: "A" | "B" | "AB";
}

// ---------- Component ----------

export function ContactMergeModal({
  open,
  onOpenChange,
  contacts,
  onSuccess,
}: ContactMergeModalProps) {
  const mergeMutation = useMergeContacts();

  const [fieldSelections, setFieldSelections] = useState<
    Record<MergeableFieldKey, "A" | "B">
  >({} as Record<MergeableFieldKey, "A" | "B">);

  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // Determine kept (older) and deleted (newer) contacts
  const keptContact =
    contacts &&
    (new Date(contacts[0].created_at).getTime() <=
    new Date(contacts[1].created_at).getTime()
      ? contacts[0]
      : contacts[1]);

  const deletedContact =
    contacts &&
    (new Date(contacts[0].created_at).getTime() <=
    new Date(contacts[1].created_at).getTime()
      ? contacts[1]
      : contacts[0]);

  // Label helpers: A = keptContact, B = deletedContact
  function getValueA(key: MergeableFieldKey): unknown {
    return keptContact ? keptContact[key] : undefined;
  }
  function getValueB(key: MergeableFieldKey): unknown {
    return deletedContact ? deletedContact[key] : undefined;
  }

  // Initialize selections when contacts change
  useEffect(() => {
    if (!contacts || !keptContact || !deletedContact) return;

    const selections = {} as Record<MergeableFieldKey, "A" | "B">;

    for (const { key } of MERGEABLE_FIELDS) {
      const aHas = hasValue(keptContact[key]);
      const bHas = hasValue(deletedContact[key]);

      if (aHas && !bHas) {
        selections[key] = "A";
      } else if (!aHas && bHas) {
        selections[key] = "B";
      } else {
        // Both have values or neither — default to A (older/kept)
        selections[key] = "A";
      }
    }

    setFieldSelections(selections);

    // Tags: union of all tag IDs from both contacts, all selected by default
    const allTagIds = new Set<string>();
    keptContact.contact_tags?.forEach((ct) => allTagIds.add(ct.tag_id));
    deletedContact.contact_tags?.forEach((ct) => allTagIds.add(ct.tag_id));
    setSelectedTagIds([...allTagIds]);
  }, [contacts]);

  // Build unified tag list
  const unifiedTags: UnifiedTag[] = (() => {
    if (!keptContact || !deletedContact) return [];

    const tagMap = new Map<string, UnifiedTag>();

    keptContact.contact_tags?.forEach((ct) => {
      tagMap.set(ct.tag_id, {
        id: ct.tag_id,
        nome: ct.tags.nome,
        cor: ct.tags.cor,
        origin: "A",
      });
    });

    deletedContact.contact_tags?.forEach((ct) => {
      if (tagMap.has(ct.tag_id)) {
        tagMap.get(ct.tag_id)!.origin = "AB";
      } else {
        tagMap.set(ct.tag_id, {
          id: ct.tag_id,
          nome: ct.tags.nome,
          cor: ct.tags.cor,
          origin: "B",
        });
      }
    });

    return [...tagMap.values()];
  })();

  function toggleFieldSelection(key: MergeableFieldKey, value: "A" | "B") {
    setFieldSelections((prev) => ({ ...prev, [key]: value }));
  }

  function toggleTag(tagId: string, checked: boolean) {
    setSelectedTagIds((prev) =>
      checked ? [...prev, tagId] : prev.filter((id) => id !== tagId)
    );
  }

  async function handleMerge() {
    if (!keptContact || !deletedContact) return;

    // Build mergedData from field selections
    const mergedData: Record<string, unknown> = {};
    for (const { key } of MERGEABLE_FIELDS) {
      const selection = fieldSelections[key] ?? "A";
      mergedData[key] =
        selection === "A" ? keptContact[key] : deletedContact[key];
    }

    await mergeMutation.mutateAsync({
      keptId: keptContact.id,
      deletedId: deletedContact.id,
      mergedData,
      selectedTagIds,
    });

    onSuccess();
    onOpenChange(false);
  }

  const isMerging = mergeMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-5 w-5" />
            Mesclar Contatos
          </DialogTitle>
          <DialogDescription>
            Escolha quais valores manter para cada campo. O contato mais antigo
            sera preservado e o mais novo sera marcado como mesclado.
          </DialogDescription>
        </DialogHeader>

        {!contacts || !keptContact || !deletedContact ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            Nenhum contato selecionado para mesclar.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Warning alert */}
            <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
              <AlertDescription className="text-amber-800 dark:text-amber-400 text-sm">
                O contato mais antigo sera mantido e o mais novo sera excluido.
                Todas as demandas serao transferidas automaticamente.
              </AlertDescription>
            </Alert>

            {/* Contact summary row */}
            <div className="grid grid-cols-2 gap-3">
              {/* Kept contact */}
              <div className="rounded-lg border-2 border-green-400 bg-green-50 dark:bg-green-950/20 p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge className="bg-green-600 text-white text-xs">
                    MANTER
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Contato A (mais antigo)
                  </span>
                </div>
                <p className="font-semibold text-sm leading-snug">
                  {keptContact.nome}
                </p>
                <p className="text-xs text-muted-foreground">
                  Criado em {formatDate(keptContact.created_at)}
                </p>
              </div>

              {/* Deleted contact */}
              <div className="rounded-lg border-2 border-red-400 bg-red-50 dark:bg-red-950/20 p-3 space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="destructive" className="text-xs">
                    EXCLUIR
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    Contato B (mais novo)
                  </span>
                </div>
                <p className="font-semibold text-sm leading-snug">
                  {deletedContact.nome}
                </p>
                <p className="text-xs text-muted-foreground">
                  Criado em {formatDate(deletedContact.created_at)}
                </p>
              </div>
            </div>

            {/* Field selection table */}
            <ScrollArea className="max-h-[350px] rounded-md border">
              <div className="p-1">
                {/* Table header */}
                <div className="grid grid-cols-[180px_1fr_1fr] gap-2 px-3 py-2 bg-muted/50 rounded text-xs font-semibold text-muted-foreground uppercase tracking-wide sticky top-0">
                  <span>Campo</span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                    Manter (A)
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block w-2 h-2 rounded-full bg-red-400" />
                    Excluir (B)
                  </span>
                </div>

                {MERGEABLE_FIELDS.map(({ key, label }) => {
                  const valA = getValueA(key);
                  const valB = getValueB(key);
                  const bothEmpty = !hasValue(valA) && !hasValue(valB);
                  const sameValue =
                    !bothEmpty &&
                    String(valA ?? "") === String(valB ?? "") &&
                    hasValue(valA) &&
                    hasValue(valB);
                  const isDisabled = bothEmpty || sameValue;
                  const currentSelection = fieldSelections[key] ?? "A";

                  return (
                    <div
                      key={key}
                      className={cn(
                        "grid grid-cols-[180px_1fr_1fr] gap-2 px-3 py-2 rounded items-center",
                        isDisabled
                          ? "opacity-50"
                          : "hover:bg-muted/30 transition-colors"
                      )}
                    >
                      <span className="text-xs font-medium text-foreground">
                        {label}
                        {sameValue && (
                          <span className="ml-1 text-muted-foreground font-normal">
                            (igual)
                          </span>
                        )}
                      </span>

                      {/* Option A */}
                      <button
                        type="button"
                        disabled={isDisabled}
                        onClick={() =>
                          !isDisabled && toggleFieldSelection(key, "A")
                        }
                        className={cn(
                          "flex items-center gap-2 rounded px-2 py-1 text-left w-full transition-colors",
                          isDisabled
                            ? "cursor-default"
                            : "cursor-pointer hover:bg-green-50 dark:hover:bg-green-900/20",
                          !isDisabled &&
                            currentSelection === "A" &&
                            "bg-green-100 ring-1 ring-green-400 dark:bg-green-900/30"
                        )}
                      >
                        <span
                          className={cn(
                            "inline-flex h-3.5 w-3.5 shrink-0 rounded-full border-2 transition-colors",
                            !isDisabled && currentSelection === "A"
                              ? "border-green-500 bg-green-500"
                              : "border-muted-foreground bg-transparent"
                          )}
                        />
                        {renderValue(valA)}
                      </button>

                      {/* Option B */}
                      <button
                        type="button"
                        disabled={isDisabled}
                        onClick={() =>
                          !isDisabled && toggleFieldSelection(key, "B")
                        }
                        className={cn(
                          "flex items-center gap-2 rounded px-2 py-1 text-left w-full transition-colors",
                          isDisabled
                            ? "cursor-default"
                            : "cursor-pointer hover:bg-red-50 dark:hover:bg-red-900/20",
                          !isDisabled &&
                            currentSelection === "B" &&
                            "bg-red-100 ring-1 ring-red-400 dark:bg-red-900/30"
                        )}
                      >
                        <span
                          className={cn(
                            "inline-flex h-3.5 w-3.5 shrink-0 rounded-full border-2 transition-colors",
                            !isDisabled && currentSelection === "B"
                              ? "border-red-500 bg-red-500"
                              : "border-muted-foreground bg-transparent"
                          )}
                        />
                        {renderValue(valB)}
                      </button>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Tags section */}
            {unifiedTags.length > 0 && (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="text-sm font-semibold">Etiquetas</p>
                  <p className="text-xs text-muted-foreground">
                    Selecione as etiquetas que devem ser mantidas no contato
                    resultante.
                  </p>
                  <div className="flex flex-wrap gap-3">
                    {unifiedTags.map((tag) => {
                      const isChecked = selectedTagIds.includes(tag.id);
                      return (
                        <div
                          key={tag.id}
                          className="flex items-center gap-2 rounded-md border px-3 py-1.5"
                        >
                          <Checkbox
                            id={`tag-${tag.id}`}
                            checked={isChecked}
                            onCheckedChange={(checked) =>
                              toggleTag(tag.id, !!checked)
                            }
                          />
                          <Label
                            htmlFor={`tag-${tag.id}`}
                            className="flex items-center gap-1.5 cursor-pointer text-sm"
                          >
                            {tag.cor && (
                              <span
                                className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: tag.cor }}
                              />
                            )}
                            {tag.nome}
                            <span className="text-xs text-muted-foreground font-normal">
                              {tag.origin === "AB"
                                ? "(A+B)"
                                : tag.origin === "A"
                                ? "(A)"
                                : "(B)"}
                            </span>
                          </Label>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter className="mt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isMerging}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleMerge}
            disabled={isMerging || !contacts}
            className="gap-2"
          >
            {isMerging ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <GitMerge className="h-4 w-4" />
            )}
            {isMerging ? "Mesclando..." : "Confirmar Mesclagem"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
