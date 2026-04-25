import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus,
  GripVertical,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ListChecks,
  MessageSquareQuote,
  Eye,
  Loader2,
  Paperclip,
  Info,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
import { stageDotClass } from '@/components/settings/stageColors';
import {
  useStageChecklist,
  useCreateChecklistItem,
  useUpdateChecklistItem,
  useDeleteChecklistItem,
  useReorderChecklistItems,
  type ChecklistItem,
} from '@/hooks/useStageChecklist';
import {
  useStageTemplates,
  useCreateStageTemplate,
} from '@/hooks/useStageTemplates';
import type { BoardStage } from '@/hooks/useBoardStages';
import { AttachmentUploader } from './AttachmentUploader';
import { MessageTemplateRow } from './MessageTemplateRow';
import { StageChecklistViewerDialog } from '@/components/board/StageChecklistViewerDialog';
import { cn } from '@/lib/utils';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  stage: BoardStage | null;
  boardName?: string;
}

type View = { kind: 'task'; idx: number } | { kind: 'templates' };

export function StageChecklistEditor({ open, onOpenChange, stage, boardName }: Props) {
  const stageId = stage?.id;
  const boardId = stage?.board_id;

  const itemsQ = useStageChecklist(stageId);
  const templatesQ = useStageTemplates(stageId);
  const items = useMemo(() => itemsQ.data ?? [], [itemsQ.data]);
  const templates = templatesQ.data ?? [];

  const createItem = useCreateChecklistItem();
  const reorderItems = useReorderChecklistItems();
  const createTemplate = useCreateStageTemplate();

  const [view, setView] = useState<View>({ kind: 'task', idx: 0 });
  const [previewOpen, setPreviewOpen] = useState(false);

  // Reset view ao abrir
  useEffect(() => {
    if (open) setView({ kind: 'task', idx: 0 });
  }, [open, stageId]);

  // Manter idx válido quando lista muda
  useEffect(() => {
    if (view.kind === 'task' && view.idx >= items.length) {
      setView(items.length > 0 ? { kind: 'task', idx: items.length - 1 } : { kind: 'templates' });
    }
  }, [items.length, view]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    if (!stageId) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => i.id === active.id);
    const newIndex = items.findIndex((i) => i.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(items, oldIndex, newIndex);
    reorderItems.mutate({ stage_id: stageId, orderedIds: next.map((i) => i.id) });
    if (view.kind === 'task' && view.idx === oldIndex) setView({ kind: 'task', idx: newIndex });
  };

  const handleAddTask = async () => {
    if (!stageId) return;
    const created = await createItem.mutateAsync({ stage_id: stageId, texto: 'Nova tarefa' });
    // posiciona o foco na nova tarefa
    const newIdx = items.length; // antes da invalidação chegar
    setView({ kind: 'task', idx: newIdx });
    return created;
  };

  const handleAddTemplate = async () => {
    if (!stageId) return;
    await createTemplate.mutateAsync({
      stage_id: stageId,
      titulo: 'Novo template',
      conteudo: 'Olá *{{nome}}*!',
    });
    setView({ kind: 'templates' });
  };

  if (!stage) return null;

  const currentItem =
    view.kind === 'task' && view.idx < items.length ? items[view.idx] : null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-5xl p-0 flex flex-col gap-0"
        >
          {/* Header */}
          <SheetHeader className="px-6 py-4 border-b border-border space-y-1.5">
            <div className="flex items-start gap-3">
              <span className={cn('w-2.5 h-2.5 rounded-full mt-2 shrink-0', stageDotClass(stage.cor))} />
              <div className="flex-1 min-w-0">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Editar checklist {boardName && <>· Funil "{boardName}"</>}
                </p>
                <SheetTitle className="text-lg leading-tight">
                  Etapa: {stage.nome}
                </SheetTitle>
                <SheetDescription className="text-xs">
                  As alterações ficam visíveis para todos os atendentes deste funil.
                </SheetDescription>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setPreviewOpen(true)}
                className="gap-1.5 shrink-0"
              >
                <Eye className="h-4 w-4" /> Pré-visualizar
              </Button>
            </div>
          </SheetHeader>

          {/* Body */}
          <div className="flex-1 grid grid-cols-12 overflow-hidden">
            {/* Sidebar */}
            <aside className="col-span-12 md:col-span-4 border-r border-border bg-muted/20 flex flex-col">
              <ScrollArea className="flex-1">
                <div className="p-3">
                  <div className="flex items-center justify-between px-1 pb-2">
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Tarefas
                    </span>
                    <span className="text-[11px] text-muted-foreground/80">{items.length}</span>
                  </div>

                  {itemsQ.isLoading ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  ) : items.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic px-2 py-3 text-center">
                      Nenhuma tarefa ainda
                    </p>
                  ) : (
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={items.map((i) => i.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        <ul className="space-y-1">
                          {items.map((item, idx) => (
                            <SortableNavItem
                              key={item.id}
                              item={item}
                              idx={idx}
                              active={view.kind === 'task' && view.idx === idx}
                              onClick={() => setView({ kind: 'task', idx })}
                            />
                          ))}
                        </ul>
                      </SortableContext>
                    </DndContext>
                  )}

                  <button
                    type="button"
                    onClick={handleAddTask}
                    disabled={createItem.isPending || !stageId}
                    className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-md border border-dashed border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/30 disabled:opacity-50 transition-colors"
                  >
                    {createItem.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Adicionar tarefa
                  </button>

                  <Separator className="my-4" />

                  <div className="flex items-center justify-between px-1 pb-2">
                    <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
                      Templates de mensagem
                    </span>
                    <span className="text-[11px] text-muted-foreground/80">{templates.length}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setView({ kind: 'templates' })}
                    className={cn(
                      'w-full flex items-start gap-2 px-3 py-2 rounded-md border transition-colors text-left',
                      view.kind === 'templates'
                        ? 'bg-primary/10 border-primary/30'
                        : 'border-transparent hover:bg-accent',
                    )}
                  >
                    <MessageSquareQuote className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p
                        className={cn(
                          'text-sm font-medium leading-snug',
                          view.kind === 'templates' && 'text-primary',
                        )}
                      >
                        Mensagens prontas
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {templates.length} template{templates.length === 1 ? '' : 's'} · WhatsApp
                      </p>
                    </div>
                  </button>

                  <div className="mt-6 px-1 text-[11px] text-muted-foreground leading-snug flex items-start gap-1.5">
                    <Info className="h-3 w-3 shrink-0 mt-0.5" />
                    <span>
                      Arraste pelo <GripVertical className="h-3 w-3 inline align-text-bottom" />{' '}
                      para reordenar.
                    </span>
                  </div>
                </div>
              </ScrollArea>
            </aside>

            {/* Right Panel */}
            <main className="col-span-12 md:col-span-8 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-6">
                  {view.kind === 'task' ? (
                    items.length === 0 ? (
                      <EmptyTasksState onAdd={handleAddTask} pending={createItem.isPending} />
                    ) : currentItem ? (
                      <TaskEditorPanel
                        item={currentItem}
                        idx={view.idx}
                        total={items.length}
                        boardId={boardId!}
                        onPrev={() => setView({ kind: 'task', idx: view.idx - 1 })}
                        onNext={() => setView({ kind: 'task', idx: view.idx + 1 })}
                      />
                    ) : null
                  ) : (
                    <TemplatesPanel
                      stageId={stageId!}
                      templates={templates}
                      isLoading={templatesQ.isLoading}
                      onAdd={handleAddTemplate}
                      pending={createTemplate.isPending}
                    />
                  )}
                </div>
              </ScrollArea>
            </main>
          </div>
        </SheetContent>
      </Sheet>

      {/* Preview reuso o mesmo viewer do atendente */}
      <StageChecklistViewerDialog
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        stage={stage}
      />
    </>
  );
}

// ===========================================================================
// Sortable nav item (sidebar)
// ===========================================================================

function SortableNavItem({
  item,
  idx,
  active,
  onClick,
}: {
  item: ChecklistItem;
  idx: number;
  active: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-start gap-2 px-2 py-2 rounded-md border transition-colors',
        active ? 'bg-primary/10 border-primary/30' : 'border-transparent hover:bg-accent',
      )}
    >
      <button
        type="button"
        className="text-muted-foreground/60 hover:text-foreground cursor-grab active:cursor-grabbing mt-0.5"
        aria-label="Reordenar"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <span
        className={cn(
          'shrink-0 w-5 h-5 rounded-full text-[11px] font-semibold flex items-center justify-center mt-0.5',
          active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
        )}
      >
        {idx + 1}
      </span>
      <button
        type="button"
        onClick={onClick}
        className="flex-1 min-w-0 text-left"
      >
        <p
          className={cn(
            'text-sm leading-snug truncate',
            active ? 'text-primary font-semibold' : 'text-foreground',
          )}
        >
          {item.texto || <span className="italic text-muted-foreground">Sem título</span>}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
          {item.attachments.length > 0 ? (
            <>
              <Paperclip className="h-3 w-3" />
              {item.attachments.length} anexo{item.attachments.length === 1 ? '' : 's'}
            </>
          ) : (
            <span className="italic text-muted-foreground/70">sem anexos</span>
          )}
        </p>
      </button>
    </li>
  );
}

// ===========================================================================
// Task detail panel (right column)
// ===========================================================================

function TaskEditorPanel({
  item,
  idx,
  total,
  boardId,
  onPrev,
  onNext,
}: {
  item: ChecklistItem;
  idx: number;
  total: number;
  boardId: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  const updateMutation = useUpdateChecklistItem();
  const deleteMutation = useDeleteChecklistItem();

  const [titulo, setTitulo] = useState(item.texto);
  const [descricao, setDescricao] = useState(item.descricao ?? '');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setTitulo(item.texto);
  }, [item.texto, item.id]);
  useEffect(() => {
    setDescricao(item.descricao ?? '');
  }, [item.descricao, item.id]);

  const saveTitulo = () => {
    const t = titulo.trim();
    if (!t) {
      setTitulo(item.texto);
      return;
    }
    if (t === item.texto) return;
    updateMutation.mutate({ id: item.id, stage_id: item.stage_id, patch: { texto: t } });
  };

  const saveDescricao = () => {
    if (descricao === (item.descricao ?? '')) return;
    updateMutation.mutate({
      id: item.id,
      stage_id: item.stage_id,
      patch: { descricao: descricao.trim() ? descricao : null },
    });
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Tarefa {idx + 1} de {total}
          </p>
          <h3 className="text-lg font-semibold mt-0.5">Editar passo</h3>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setConfirmDelete(true)}
          className="text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Excluir
        </Button>
      </div>

      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">
            Título
          </label>
          <Input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            onBlur={saveTitulo}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            placeholder="Ex: Cumprimentar e identificar o contato"
            maxLength={120}
          />
          <p className="text-xs text-muted-foreground mt-1">Aparece como cabeçalho do passo no popup do atendente.</p>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">
            Descrição / Instruções
          </label>
          <Textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            onBlur={saveDescricao}
            placeholder="Explique o que o atendente deve fazer neste passo."
            rows={4}
            maxLength={500}
          />
          <p className="text-xs text-muted-foreground mt-1">Até 500 caracteres. Use frases curtas e diretas.</p>
        </div>

        <div>
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide block mb-1">
            Anexos
          </label>
          <AttachmentUploader
            itemId={item.id}
            stageId={item.stage_id}
            boardId={boardId}
            attachments={item.attachments}
          />
        </div>
      </div>

      <Separator className="my-6" />

      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onPrev}
          disabled={idx === 0}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" /> Tarefa anterior
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onNext}
          disabled={idx >= total - 1}
          className="gap-1"
        >
          Próxima tarefa <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tarefa "{item.texto || 'sem título'}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Os anexos vinculados também serão removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                deleteMutation.mutate({ id: item.id, stage_id: item.stage_id });
                setConfirmDelete(false);
              }}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir tarefa
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ===========================================================================
// Templates panel (right column)
// ===========================================================================

function TemplatesPanel({
  stageId,
  templates,
  isLoading,
  onAdd,
  pending,
}: {
  stageId: string;
  templates: { id: string; stage_id: string; titulo: string; conteudo: string; ordem: number; created_by: string | null; created_at: string; updated_at: string }[];
  isLoading: boolean;
  onAdd: () => void;
  pending: boolean;
}) {
  return (
    <div>
      <div className="flex items-start justify-between mb-4 gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Mensagens prontas</p>
          <h3 className="text-lg font-semibold mt-0.5">Templates de WhatsApp</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-md">
            Crie mensagens prontas para o atendente copiar com 1 clique.
          </p>
        </div>
        <Button type="button" size="sm" onClick={onAdd} disabled={pending} className="gap-1.5 shrink-0">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Novo template
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border border-dashed border-border rounded-md">
          <MessageSquareQuote className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
          <p className="font-medium text-foreground">Sem templates ainda</p>
          <p className="text-sm mt-1">Crie mensagens prontas para o atendente copiar com 1 clique.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {templates.map((t) => (
            <MessageTemplateRow key={t.id} template={{ ...t, stage_id: stageId }} />
          ))}
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// Empty state — sem tarefas
// ===========================================================================

function EmptyTasksState({ onAdd, pending }: { onAdd: () => void; pending: boolean }) {
  return (
    <div className="text-center py-16 text-muted-foreground border border-dashed border-border rounded-md">
      <ListChecks className="h-12 w-12 mx-auto mb-3 text-muted-foreground/40" />
      <p className="text-base font-medium text-foreground">Nenhuma tarefa ainda</p>
      <p className="text-sm mt-1">Adicione a primeira tarefa para começar a orientar seu time.</p>
      <Button type="button" onClick={onAdd} disabled={pending} className="mt-4 gap-1.5">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Adicionar primeira tarefa
      </Button>
    </div>
  );
}
