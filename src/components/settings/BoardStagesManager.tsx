import { useEffect, useState } from 'react';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { GripVertical, Plus, Trash2, Loader2, Check, X, Pencil } from 'lucide-react';
import {
  useBoardStages,
  useCreateBoardStage,
  useUpdateBoardStage,
  useDeleteBoardStage,
  useReorderBoardStages,
  type BoardStage,
} from '@/hooks/useBoardStages';
import { useBoardItemCounts } from '@/hooks/useBoardItems';
import { STAGE_COLORS, nextStageColor, stageDotClass } from './stageColors';

interface Props {
  boardId: string;
}

export function BoardStagesManager({ boardId }: Props) {
  const { data: stages = [], isLoading } = useBoardStages(boardId);
  const { data: counts = {} } = useBoardItemCounts(boardId);
  const createStage = useCreateBoardStage();
  const updateStage = useUpdateBoardStage();
  const deleteStage = useDeleteBoardStage();
  const reorderStages = useReorderBoardStages();

  const [ordered, setOrdered] = useState<BoardStage[]>([]);
  const [addingName, setAddingName] = useState('');
  const [deleting, setDeleting] = useState<BoardStage | null>(null);

  useEffect(() => {
    setOrdered(stages);
  }, [stages]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = ordered.findIndex((s) => s.id === active.id);
    const newIndex = ordered.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const next = arrayMove(ordered, oldIndex, newIndex);
    setOrdered(next);
    reorderStages.mutate({
      boardId,
      orderedIds: next.map((s) => s.id),
    });
  };

  const handleAddStage = async () => {
    const nome = addingName.trim();
    if (!nome) return;
    await createStage.mutateAsync({
      board_id: boardId,
      nome,
      cor: nextStageColor(ordered.length),
    });
    setAddingName('');
  };

  const handleConfirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteStage.mutateAsync(deleting.id);
    } catch {
      // toast já disparado
    } finally {
      setDeleting(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {ordered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Nenhum estágio ainda. Adicione pelo menos 2.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={ordered.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {ordered.map((stage) => (
                <SortableStageRow
                  key={stage.id}
                  stage={stage}
                  count={counts[stage.id] ?? 0}
                  onSave={(patch) => updateStage.mutate({ id: stage.id, patch })}
                  onDelete={() => setDeleting(stage)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <div className="flex items-center gap-2 pt-2 border-t">
        <Input
          value={addingName}
          onChange={(e) => setAddingName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAddStage();
          }}
          placeholder="Nome do novo estágio"
          disabled={createStage.isPending}
        />
        <Button
          onClick={handleAddStage}
          disabled={!addingName.trim() || createStage.isPending}
          size="sm"
        >
          {createStage.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </>
          )}
        </Button>
      </div>

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir estágio "{deleting?.nome}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Só é possível excluir estágios sem contatos. Se houver contatos neste estágio, mova-os
              antes para outro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteStage.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteStage.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteStage.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir estágio
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SortableStageRow({
  stage,
  count,
  onSave,
  onDelete,
}: {
  stage: BoardStage;
  count: number;
  onSave: (patch: { nome?: string; cor?: string }) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.id,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [nome, setNome] = useState(stage.nome);
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  useEffect(() => {
    setNome(stage.nome);
  }, [stage.nome]);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleSaveName = () => {
    const trimmed = nome.trim();
    if (trimmed && trimmed !== stage.nome) {
      onSave({ nome: trimmed });
    }
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setNome(stage.nome);
    setIsEditing(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-md border bg-card p-3 hover:bg-muted/40"
    >
      <button
        type="button"
        className="touch-none text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
        aria-label="Reordenar"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>

      <div className="relative">
        <button
          type="button"
          onClick={() => setColorPickerOpen((v) => !v)}
          className={`h-6 w-6 rounded-full border-2 border-border hover:scale-110 transition-transform ${stageDotClass(stage.cor)}`}
          aria-label="Mudar cor"
        />
        {colorPickerOpen && (
          <div className="absolute z-50 top-8 left-0 flex gap-1 rounded-md border bg-popover p-2 shadow-md">
            {STAGE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  onSave({ cor: c });
                  setColorPickerOpen(false);
                }}
                className={`h-6 w-6 rounded-full hover:ring-2 hover:ring-primary ${stageDotClass(c)}`}
                aria-label={c}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        {isEditing ? (
          <Input
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveName();
              if (e.key === 'Escape') handleCancelEdit();
            }}
            autoFocus
            className="h-8"
          />
        ) : (
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{stage.nome}</span>
            <span className="text-xs text-muted-foreground shrink-0">
              ({count} contato{count === 1 ? '' : 's'})
            </span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-1">
        {isEditing ? (
          <>
            <Button variant="ghost" size="icon" onClick={handleSaveName} title="Salvar">
              <Check className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleCancelEdit} title="Cancelar">
              <X className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsEditing(true)}
              title="Renomear"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onDelete} title="Excluir">
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
