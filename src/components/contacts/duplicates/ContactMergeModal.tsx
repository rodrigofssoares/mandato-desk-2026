import { useEffect, useState } from "react";
import { GitMerge, AlertTriangle, Loader2, ArrowLeftRight } from "lucide-react";
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

  // Which side is kept vs deleted — user can toggle
  const [keepSide, setKeepSide] = useState<"A" | "B">("A");

  const [fieldSelections, setFieldSelections] = useState<
    Record<MergeableFieldKey, "A" | "B">
  >({} as Record<MergeableFieldKey, "A" | "B">);

  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const contactA = contacts?.[0] ?? null;
  const contactB = contacts?.[1] ?? null;

  const keptContact = keepSide === "A" ? contactA : contactB;
  const deletedContact = keepSide === "A" ? contactB : contactA;

  function getValueA(key: MergeableFieldKey): unknown {
    return contactA ? contactA[key] : undefined;
  }
  function getValueB(key: MergeableFieldKey): unknown {
    return contactB ? contactB[key] : undefined;
  }

  // Initialize selections when contacts change or keepSide changes
  useEffect(() => {
    if (!contactA || !contactB) return;

    const selections = {} as Record<MergeableFieldKey, "A" | "B">;

    for (const { key } of MERGEABLE_FIELDS) {
      const aHas = hasValue(contactA[key]);
      const bHas = hasValue(contactB[key]);

      if (aHas && !bHas) {
        selections[key] = "A";
      } else if (!aHas && bHas) {
        selections[key] = "B";
      } else {
        // Both have or both empty — default to the kept side
        selections[key] = keepSide;
      }
    }

    setFieldSelections(selections);

    // Tags: union of all tag IDs, all selected
    const allTagIds = new Set<string>();
    contactA.contact_tags?.forEach((ct) => allTagIds.add(ct.tag_id));
    contactB.contact_tags?.forEach((ct) => allTagIds.add(ct.tag_id));
    setSelectedTagIds([...allTagIds]);
  }, [contacts, keepSide]);

  // Build unified tag list
  const unifiedTags: UnifiedTag[] = (() => {
    if (!contactA || !contactB) return [];

    const tagMap = new Map<string, UnifiedTag>();

    contactA.contact_tags?.forEach((ct) => {
      tagMap.set(ct.tag_id, {
        id: ct.tag_id,
        nome: ct.tags.nome,
        cor: ct.tags.cor,
        origin: "A",
      });
    });

    contactB.contact_tags?.forEach((ct) => {
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

  function swapSides() {
    setKeepSide((prev) => (prev === "A" ? "B" : "A"));
  }

  async function handleMerge() {
    if (!keptContact || !deletedContact) return;

    // Build mergedData: pick field values based on selections
    // Selections reference A/B (the original contacts[0]/contacts[1])
    const mergedData: Record<string, unknown> = {};
    for (const { key } of MERGEABLE_FIELDS) {
      const selection = fieldSelections[key] ?? keepSide;
      mergedData[key] = selection === "A" ? contactA![key] : contactB![key];
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
            Escolha qual contato manter, selecione os valores de cada campo, e confirme a mesclagem.
          </DialogDescription>
        </DialogHeader>

        {!contacts || !contactA || !contactB ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            Nenhum contato selecionado para mesclar.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Warning alert */}
            <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
              <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-500" />
              <AlertDescription className="text-amber-800 dark:text-amber-400 text-sm">
                O contato marcado como "MANTER" sera preservado com os dados escolhidos.
                O outro sera excluido e todas as demandas serao transferidas.
              </AlertDescription>
            </Alert>

            {/* Contact cards with keep/delete choice */}
            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
              {/* Contact A card */}
              <button
                type="button"
                onClick={() => setKeepSide("A")}
                className={cn(
                  "rounded-lg border-2 p-3 space-y-1 text-left transition-all",
                  keepSide === "A"
                    ? "border-green-400 bg-green-50 dark:bg-green-950/20 ring-1 ring-green-300"
                    : "border-red-400 bg-red-50 dark:bg-red-950/20 hover:ring-1 hover:ring-red-300"
                )}
              >
                <div className="flex items-center gap-2">
                  {keepSide === "A" ? (
                    <Badge className="bg-green-600 text-white text-xs">MANTER</Badge>
                  ) : (
                    <Badge variant="destructive" className="text-xs">EXCLUIR</Badge>
                  )}
                </div>
                <p className="font-semibold text-sm leading-snug">{contactA.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {contactA.whatsapp || contactA.email || "(sem contato)"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Criado em {formatDate(contactA.created_at)}
                </p>
              </button>

              {/* Swap button */}
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full"
                onClick={swapSides}
                title="Trocar quem manter/excluir"
              >
                <ArrowLeftRight className="h-4 w-4" />
              </Button>

              {/* Contact B card */}
              <button
                type="button"
                onClick={() => setKeepSide("B")}
                className={cn(
                  "rounded-lg border-2 p-3 space-y-1 text-left transition-all",
                  keepSide === "B"
                    ? "border-green-400 bg-green-50 dark:bg-green-950/20 ring-1 ring-green-300"
                    : "border-red-400 bg-red-50 dark:bg-red-950/20 hover:ring-1 hover:ring-red-300"
                )}
              >
                <div className="flex items-center gap-2">
                  {keepSide === "B" ? (
                    <Badge className="bg-green-600 text-white text-xs">MANTER</Badge>
                  ) : (
                    <Badge variant="destructive" className="text-xs">EXCLUIR</Badge>
                  )}
                </div>
                <p className="font-semibold text-sm leading-snug">{contactB.nome}</p>
                <p className="text-xs text-muted-foreground">
                  {contactB.whatsapp || contactB.email || "(sem contato)"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Criado em {formatDate(contactB.created_at)}
                </p>
              </button>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Clique no card ou use o botao de trocar para escolher qual manter
            </p>

            {/* Field selection table */}
            <ScrollArea className="max-h-[300px] rounded-md border">
              <div className="p-1">
                {/* Table header */}
                <div className="grid grid-cols-[180px_1fr_1fr] gap-2 px-3 py-2 bg-muted/50 rounded text-xs font-semibold text-muted-foreground uppercase tracking-wide sticky top-0 z-10">
                  <span>Campo</span>
                  <span className="flex items-center gap-1">
                    <span className={cn(
                      "inline-block w-2 h-2 rounded-full",
                      keepSide === "A" ? "bg-green-500" : "bg-red-400"
                    )} />
                    Contato A {keepSide === "A" ? "(manter)" : "(excluir)"}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className={cn(
                      "inline-block w-2 h-2 rounded-full",
                      keepSide === "B" ? "bg-green-500" : "bg-red-400"
                    )} />
                    Contato B {keepSide === "B" ? "(manter)" : "(excluir)"}
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
                  const currentSelection = fieldSelections[key] ?? keepSide;

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
                        onClick={() => !isDisabled && toggleFieldSelection(key, "A")}
                        className={cn(
                          "flex items-center gap-2 rounded px-2 py-1 text-left w-full transition-colors",
                          isDisabled
                            ? "cursor-default"
                            : "cursor-pointer hover:bg-accent/50",
                          !isDisabled &&
                            currentSelection === "A" &&
                            "bg-primary/10 ring-1 ring-primary/40"
                        )}
                      >
                        <span
                          className={cn(
                            "inline-flex h-3.5 w-3.5 shrink-0 rounded-full border-2 transition-colors",
                            !isDisabled && currentSelection === "A"
                              ? "border-primary bg-primary"
                              : "border-muted-foreground bg-transparent"
                          )}
                        />
                        {renderValue(valA)}
                      </button>

                      {/* Option B */}
                      <button
                        type="button"
                        disabled={isDisabled}
                        onClick={() => !isDisabled && toggleFieldSelection(key, "B")}
                        className={cn(
                          "flex items-center gap-2 rounded px-2 py-1 text-left w-full transition-colors",
                          isDisabled
                            ? "cursor-default"
                            : "cursor-pointer hover:bg-accent/50",
                          !isDisabled &&
                            currentSelection === "B" &&
                            "bg-primary/10 ring-1 ring-primary/40"
                        )}
                      >
                        <span
                          className={cn(
                            "inline-flex h-3.5 w-3.5 shrink-0 rounded-full border-2 transition-colors",
                            !isDisabled && currentSelection === "B"
                              ? "border-primary bg-primary"
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
                    Selecione as etiquetas que devem ser mantidas no contato resultante.
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
