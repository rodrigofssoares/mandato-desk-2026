import { GitMerge } from "lucide-react";
import type { DuplicateContact } from "@/hooks/useDuplicates";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { formatPhoneDisplay } from "@/lib/normalization";
import { MERGEABLE_FIELDS, type MergeableFieldKey } from "./types";

interface ContactCompareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contacts: [DuplicateContact, DuplicateContact] | null;
  onGoToMerge: () => void;
}

function formatDate(d: string | null | undefined): string {
  if (!d) return "(vazio)";
  return new Date(d).toLocaleDateString("pt-BR");
}

function renderValue(val: unknown): { text: string; empty: boolean } {
  if (val === null || val === undefined || val === "") {
    return { text: "(vazio)", empty: true };
  }
  if (typeof val === "boolean") {
    return { text: val ? "Sim" : "Nao", empty: false };
  }
  return { text: String(val), empty: false };
}

export function ContactCompareModal({
  open,
  onOpenChange,
  contacts,
  onGoToMerge,
}: ContactCompareModalProps) {
  const contactA = contacts?.[0] ?? null;
  const contactB = contacts?.[1] ?? null;

  function isDifferent(key: MergeableFieldKey): boolean {
    if (!contactA || !contactB) return false;
    const a = contactA[key];
    const b = contactB[key];
    const normalize = (v: unknown) =>
      v === null || v === undefined || v === "" ? null : v;
    return normalize(a) !== normalize(b);
  }

  const tagsA =
    contactA?.contact_tags?.map((ct) => ct.tags) ?? [];
  const tagsB =
    contactB?.contact_tags?.map((ct) => ct.tags) ?? [];

  const allTagIds = Array.from(
    new Set([...tagsA.map((t) => t.id), ...tagsB.map((t) => t.id)])
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Comparar Contatos</DialogTitle>
        </DialogHeader>

        {contacts === null ? null : (
          <>
            {/* Contact cards row */}
            <div className="flex gap-4">
              {/* Card A */}
              <div className="flex-1 rounded-lg border border-l-4 border-l-blue-500 bg-card p-4 space-y-1">
                <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                  Contato A
                </Badge>
                <p className="font-semibold text-base">{contactA!.nome}</p>
                <p className="text-sm text-muted-foreground">
                  {contactA!.whatsapp ? formatPhoneDisplay(contactA!.whatsapp) : "(sem WhatsApp)"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Criado em: {formatDate(contactA!.created_at)}
                </p>
              </div>

              {/* Card B */}
              <div className="flex-1 rounded-lg border border-l-4 border-l-purple-500 bg-card p-4 space-y-1">
                <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                  Contato B
                </Badge>
                <p className="font-semibold text-base">{contactB!.nome}</p>
                <p className="text-sm text-muted-foreground">
                  {contactB!.whatsapp ? formatPhoneDisplay(contactB!.whatsapp) : "(sem WhatsApp)"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Criado em: {formatDate(contactB!.created_at)}
                </p>
              </div>
            </div>

            {/* Comparison table */}
            <ScrollArea className="max-h-[400px] rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground w-[30%]">
                      Campo
                    </th>
                    <th className="text-left px-4 py-2 font-medium text-blue-600 dark:text-blue-400 w-[35%]">
                      Contato A
                    </th>
                    <th className="text-left px-4 py-2 font-medium text-purple-600 dark:text-purple-400 w-[35%]">
                      Contato B
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {/* Mergeable fields */}
                  {MERGEABLE_FIELDS.map(({ key, label }) => {
                    const different = isDifferent(key);
                    const valA = renderValue(contactA![key]);
                    const valB = renderValue(contactB![key]);

                    return (
                      <tr
                        key={key}
                        className={cn(
                          "transition-colors",
                          different && "bg-yellow-50 dark:bg-yellow-950/20"
                        )}
                      >
                        <td className="px-4 py-2 font-medium text-muted-foreground whitespace-nowrap">
                          {label}
                          {different && (
                            <span className="ml-2 inline-block w-1.5 h-1.5 rounded-full bg-yellow-500 align-middle" />
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {valA.empty ? (
                            <span className="text-muted-foreground italic">{valA.text}</span>
                          ) : (
                            valA.text
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {valB.empty ? (
                            <span className="text-muted-foreground italic">{valB.text}</span>
                          ) : (
                            valB.text
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Tags row */}
                  <tr className="bg-muted/30">
                    <td className="px-4 py-2 font-medium text-muted-foreground">Tags</td>
                    <td className="px-4 py-2">
                      {tagsA.length === 0 ? (
                        <span className="text-muted-foreground italic">(vazio)</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {tagsA.map((tag) => {
                            const inB = tagsB.some((t) => t.id === tag.id);
                            return (
                              <Badge
                                key={tag.id}
                                variant="outline"
                                style={tag.cor ? { borderColor: tag.cor, color: tag.cor } : undefined}
                                className="text-xs"
                              >
                                {tag.nome}
                                <span className="ml-1 text-muted-foreground">
                                  {inB ? "(ambos)" : "(A)"}
                                </span>
                              </Badge>
                            );
                          })}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {tagsB.length === 0 ? (
                        <span className="text-muted-foreground italic">(vazio)</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {tagsB.map((tag) => {
                            const inA = tagsA.some((t) => t.id === tag.id);
                            return (
                              <Badge
                                key={tag.id}
                                variant="outline"
                                style={tag.cor ? { borderColor: tag.cor, color: tag.cor } : undefined}
                                className="text-xs"
                              >
                                {tag.nome}
                                <span className="ml-1 text-muted-foreground">
                                  {inA ? "(ambos)" : "(B)"}
                                </span>
                              </Badge>
                            );
                          })}
                          {/* Show tags only in B that are not in A */}
                          {allTagIds
                            .filter((id) => !tagsB.some((t) => t.id === id) && tagsA.some((t) => t.id === id))
                            .map((id) => {
                              const tag = tagsA.find((t) => t.id === id)!;
                              return (
                                <Badge
                                  key={`only-a-${id}`}
                                  variant="outline"
                                  className="text-xs text-muted-foreground opacity-40"
                                >
                                  {tag.nome} (A)
                                </Badge>
                              );
                            })}
                        </div>
                      )}
                    </td>
                  </tr>

                  {/* System rows */}
                  <tr>
                    <td className="px-4 py-2 font-medium text-muted-foreground">ID</td>
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                      {contactA!.id.slice(0, 8)}…
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                      {contactB!.id.slice(0, 8)}…
                    </td>
                  </tr>
                  <tr className="bg-muted/20">
                    <td className="px-4 py-2 font-medium text-muted-foreground">Criado em</td>
                    <td className="px-4 py-2">{formatDate(contactA!.created_at)}</td>
                    <td className="px-4 py-2">{formatDate(contactB!.created_at)}</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 font-medium text-muted-foreground">Atualizado em</td>
                    <td className="px-4 py-2">
                      {contactA!.updated_at ? formatDate(contactA!.updated_at) : (
                        <span className="text-muted-foreground italic">(vazio)</span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {contactB!.updated_at ? formatDate(contactB!.updated_at) : (
                        <span className="text-muted-foreground italic">(vazio)</span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </ScrollArea>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button onClick={onGoToMerge} disabled={contacts === null}>
            <GitMerge className="mr-2 h-4 w-4" />
            Ir para Mesclar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
