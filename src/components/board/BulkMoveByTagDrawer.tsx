import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronRight,
  Loader2,
  Users,
  Tag as TagIcon,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useTags, type Tag } from '@/hooks/useTags';
import { useBoards } from '@/hooks/useBoards';
import { useBoardStages } from '@/hooks/useBoardStages';
import { useBoardItems } from '@/hooks/useBoardItems';
import { useContacts } from '@/hooks/useContacts';
import { useBulkMoveContactsToBoard } from '@/hooks/useBulkMoveContactsToBoard';

interface PreSelectedContact {
  id: string;
  nome: string;
}

interface BulkMoveByTagDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Modo "Contatos": pré-seleção de contatos — o seletor de etiquetas é oculto
   * e usamos diretamente a lista informada.
   */
  initialContacts?: PreSelectedContact[];
  /** Pré-seleciona o board (ex: a partir da página do board ativo). */
  initialBoardId?: string | null;
}

const DEFAULT_COLOR = '#6B7280';

function initialsOf(nome: string | null | undefined): string {
  if (!nome) return '?';
  const parts = nome.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function BulkMoveByTagDrawer({
  open,
  onOpenChange,
  initialContacts,
  initialBoardId,
}: BulkMoveByTagDrawerProps) {
  const preSelectedMode = !!initialContacts && initialContacts.length > 0;

  // ---- Estado ----
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [boardId, setBoardId] = useState<string | null>(initialBoardId ?? null);
  const [stageId, setStageId] = useState<string | null>(null);

  // Reset ao abrir/fechar
  useEffect(() => {
    if (open) {
      setBoardId(initialBoardId ?? null);
      setStageId(null);
      setSelectedTagIds(new Set());
    }
  }, [open, initialBoardId]);

  // ---- Dados ----
  const { data: tags = [] } = useTags();
  const { data: boards = [] } = useBoards('contact');
  const { data: stages = [] } = useBoardStages(boardId);
  const { data: currentBoardItems = [] } = useBoardItems(boardId);

  // Quando o board muda, se o stage escolhido não pertence mais, reseta
  useEffect(() => {
    if (stageId && !stages.find((s) => s.id === stageId)) {
      setStageId(null);
    }
  }, [stages, stageId]);

  // Contatos impactados — filtra por etiquetas se não veio pré-selecionado
  const tagQueryFilter = useMemo(
    () => ({
      tags: selectedTagIds.size > 0 ? Array.from(selectedTagIds) : undefined,
      per_page: 500,
      page: 1,
    }),
    [selectedTagIds],
  );
  const tagContactsQuery = useContacts(
    preSelectedMode
      ? { per_page: 1, page: 1 } // no-op — hook roda, mas não usamos o resultado
      : tagQueryFilter,
  );

  const impactedContacts: PreSelectedContact[] = useMemo(() => {
    if (preSelectedMode) return initialContacts ?? [];
    if (selectedTagIds.size === 0) return [];
    return (tagContactsQuery.data?.data ?? []).map((c) => ({ id: c.id, nome: c.nome }));
  }, [preSelectedMode, initialContacts, selectedTagIds, tagContactsQuery.data]);

  const existingIdsInBoard = useMemo(
    () => new Set(currentBoardItems.map((i) => i.contact?.id).filter(Boolean) as string[]),
    [currentBoardItems],
  );

  const updatedCount = impactedContacts.filter((c) =>
    existingIdsInBoard.has(c.id),
  ).length;
  const newCount = impactedContacts.length - updatedCount;

  // ---- Mutation ----
  const moveMutation = useBulkMoveContactsToBoard();

  const canSubmit =
    !!boardId && !!stageId && impactedContacts.length > 0 && !moveMutation.isPending;

  const handleSubmit = async () => {
    if (!canSubmit || !boardId || !stageId) return;
    const contactIds = impactedContacts.map((c) => c.id);
    try {
      await moveMutation.mutateAsync({ contactIds, boardId, stageId });
      onOpenChange(false);
    } catch {
      // toast no hook
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      return next;
    });
  };

  const selectedTags: Tag[] = tags.filter((t) => selectedTagIds.has(t.id));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 flex flex-col"
      >
        <SheetHeader className="px-5 py-4 border-b">
          <SheetTitle>Mover contatos em massa</SheetTitle>
          <SheetDescription>
            {preSelectedMode
              ? `Selecione board e etapa para ${impactedContacts.length} contato(s) escolhido(s).`
              : 'Filtre por etiqueta e envie todos os contatos para uma etapa.'}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Modo contatos pré-selecionados */}
          {preSelectedMode ? (
            <div>
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Contatos selecionados
              </label>
              <div className="mt-1.5 flex items-center gap-2 p-2.5 border rounded-lg bg-muted/30">
                <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Users className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">
                    {impactedContacts.length} contato(s)
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {impactedContacts.slice(0, 3).map((c) => c.nome).join(', ')}
                    {impactedContacts.length > 3 &&
                      ` e +${impactedContacts.length - 3} outros`}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            // Modo filtro por etiquetas
            <div>
              <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                Etiquetas
              </label>
              <p className="text-xs text-muted-foreground mt-0.5 mb-2">
                Todos os contatos vinculados a qualquer etiqueta selecionada serão incluídos.
              </p>
              {tags.length === 0 ? (
                <div className="p-3 border border-dashed rounded-lg text-xs text-muted-foreground">
                  Nenhuma etiqueta cadastrada.
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto flex flex-wrap gap-1.5 p-2 border rounded-lg">
                  {tags.map((tag) => {
                    const selected = selectedTagIds.has(tag.id);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => toggleTag(tag.id)}
                        className={cn(
                          'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold transition-colors border',
                          selected
                            ? 'border-primary/60'
                            : 'border-transparent hover:border-border',
                        )}
                        style={
                          selected
                            ? {
                                background: `${tag.cor ?? DEFAULT_COLOR}22`,
                                color: tag.cor ?? undefined,
                              }
                            : { background: 'hsl(var(--muted))' }
                        }
                      >
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{ background: tag.cor ?? DEFAULT_COLOR }}
                        />
                        {tag.nome}
                        {selected && <Check className="h-3 w-3" />}
                      </button>
                    );
                  })}
                </div>
              )}
              {selectedTags.length > 0 && (
                <p className="mt-2 text-xs text-muted-foreground inline-flex items-center gap-1.5">
                  <TagIcon className="h-3 w-3" />
                  {selectedTags.length} etiqueta(s) selecionada(s)
                </p>
              )}
            </div>
          )}

          {/* Board */}
          <div>
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Board de destino
            </label>
            <Select
              value={boardId ?? undefined}
              onValueChange={(v) => setBoardId(v)}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue placeholder="Escolha um board" />
              </SelectTrigger>
              <SelectContent>
                {boards.length === 0 && (
                  <div className="px-2 py-3 text-xs text-muted-foreground">
                    Nenhum board de contatos disponível.
                  </div>
                )}
                {boards.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.nome}
                    {b.is_default ? ' (padrão)' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Etapa */}
          <div>
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
              Etapa de destino
            </label>
            {!boardId ? (
              <p className="mt-1.5 text-xs text-muted-foreground px-2 py-3 border border-dashed rounded-lg">
                Escolha um board primeiro.
              </p>
            ) : stages.length === 0 ? (
              <p className="mt-1.5 text-xs text-muted-foreground px-2 py-3 border border-dashed rounded-lg">
                Este board não tem etapas.
              </p>
            ) : (
              <div className="mt-1.5 grid grid-cols-2 gap-2">
                {stages.map((s) => {
                  const active = stageId === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStageId(s.id)}
                      className={cn(
                        'px-3 py-2 text-sm rounded-md border text-left flex items-center gap-2 transition-colors',
                        active
                          ? 'border-primary/60 bg-primary/5 font-semibold'
                          : 'border-border hover:border-primary/40',
                      )}
                    >
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ background: s.cor ?? DEFAULT_COLOR }}
                      />
                      <span className="flex-1 truncate">{s.nome}</span>
                      {active && <Check className="h-3.5 w-3.5 text-primary" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Preview */}
          {impactedContacts.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Preview ({impactedContacts.length})
                </label>
                <div className="flex gap-3 text-xs">
                  <span className="text-green-600 font-medium">{newCount} novos</span>
                  {updatedCount > 0 && (
                    <span className="text-amber-600 font-medium">
                      {updatedCount} atualizados
                    </span>
                  )}
                </div>
              </div>
              <ul className="border rounded-lg divide-y max-h-56 overflow-y-auto">
                {impactedContacts.slice(0, 40).map((c) => {
                  const already = existingIdsInBoard.has(c.id);
                  return (
                    <li
                      key={c.id}
                      className="px-3 py-1.5 flex items-center gap-2 text-sm"
                    >
                      <div className="h-6 w-6 rounded-full bg-primary/10 text-primary text-[10px] font-semibold flex items-center justify-center shrink-0">
                        {initialsOf(c.nome)}
                      </div>
                      <span className="flex-1 truncate">{c.nome}</span>
                      {already && (
                        <Badge variant="secondary" className="text-[10px] h-5">
                          já no board
                        </Badge>
                      )}
                    </li>
                  );
                })}
                {impactedContacts.length > 40 && (
                  <li className="px-3 py-2 text-xs text-center text-muted-foreground">
                    + {impactedContacts.length - 40} outros contatos
                  </li>
                )}
              </ul>
              {updatedCount > 0 && (
                <div className="mt-2 p-2.5 rounded-md bg-amber-500/10 border border-amber-500/20 flex gap-2 text-xs">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-amber-700 dark:text-amber-400">
                    Os {updatedCount} contato(s) já presentes neste board terão a
                    etapa <b>atualizada</b> — nenhum será duplicado.
                  </p>
                </div>
              )}
            </div>
          )}

          {!preSelectedMode &&
            selectedTagIds.size > 0 &&
            impactedContacts.length === 0 &&
            !tagContactsQuery.isLoading && (
              <p className="text-xs text-muted-foreground text-center py-3">
                Nenhum contato encontrado com essas etiquetas.
              </p>
            )}
        </div>

        <div className="px-5 py-4 border-t flex items-center gap-2 bg-background">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
            disabled={moveMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-[2]"
          >
            {moveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <ChevronRight className="h-4 w-4 mr-2" />
            )}
            Mover {impactedContacts.length > 0 ? impactedContacts.length : ''} contato(s)
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
