// DemandColumnsDialog.tsx — RAQ-MAND-EM085
// Gestão das colunas configuráveis do kanban de Demandas: criar, renomear,
// mudar cor, reordenar (drag) e excluir. Espelha o BoardStagesManager do Funil,
// mas conta DEMANDAS por coluna e respeita a seção de permissão 'demandas_colunas'.

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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { GripVertical, Plus, Trash2, Loader2, Check, X, Pencil } from 'lucide-react';
import {
  useDemandBoardId,
  useDemandStages,
  useCreateDemandColumn,
  useUpdateDemandColumn,
  useDeleteDemandColumn,
  useReorderDemandColumns,
  useDemandStageCounts,
  type DemandColumn,
} from '@/hooks/useDemandColumns';
import { usePermissions } from '@/hooks/usePermissions';
import { nextStageColor, stageColorStyle, STAGE_HEX_PRESETS } from '@/components/settings/stageColors';
import { ColorPicker } from '@/components/ui-system';

interface DemandColumnsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DemandColumnsDialog({ open, onOpenChange }: DemandColumnsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Gerenciar colunas</DialogTitle>
          <DialogDescription>
            Crie, renomeie, reordene e defina a cor das colunas do kanban de demandas.
          </DialogDescription>
        </DialogHeader>
        <DemandColumnsManager />
      </DialogContent>
    </Dialog>
  );
}

function DemandColumnsManager() {
  const { can } = usePermissions();
  const { data: boardId, isLoading: boardLoading } = useDemandBoardId();
  const { data: stages = [], isLoading } = useDemandStages(boardId);
  const { data: counts = {} } = useDemandStageCounts();
  const createColumn = useCreateDemandColumn();
  const updateColumn = useUpdateDemandColumn();
  const deleteColumn = useDeleteDemandColumn();
  const reorderColumns = useReorderDemandColumns();

  const canCreate = can.createDemandColumn();
  const canEdit = can.editDemandColumn();
  const canDelete = can.deleteDemandColumn();

  const [ordered, setOrdered] = useState<DemandColumn[]>([]);
  const [addingName, setAddingName] = useState('');
  const [deleting, setDeleting] = useState<DemandColumn | null>(null);

  useEffect(() => {
    setOrdered(stages);
  }, [stages]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !boardId) return;

    const oldIndex = ordered.findIndex((s) => s.id === active.id);
    const newIndex = ordered.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const next = arrayMove(ordered, oldIndex, newIndex);
    setOrdered(next);
    reorderColumns.mutate({ boardId, orderedIds: next.map((s) => s.id) });
  };

  const handleAdd = async () => {
    const nome = addingName.trim();
    if (!nome || !boardId) return;
    await createColumn.mutateAsync({
      board_id: boardId,
      nome,
      cor: nextStageColor(ordered.length),
    });
    setAddingName('');
  };

  const handleConfirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteColumn.mutateAsync(deleting.id);
    } catch {
      // toast já disparado pelo hook
    } finally {
      setDeleting(null);
    }
  };

  if (boardLoading || isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Pré-migration: board ainda não existe.
  if (!boardId) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center">
        As colunas configuráveis ainda não foram ativadas neste ambiente.
        Rode a migration 113 (colunas de demandas) para habilitar.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {ordered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Nenhuma coluna ainda. Adicione pelo menos 2.
        </p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={ordered.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {ordered.map((col) => (
                <SortableColumnRow
                  key={col.id}
                  column={col}
                  count={counts[col.id] ?? 0}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  onSave={(patch) => updateColumn.mutate({ id: col.id, patch })}
                  onDelete={() => setDeleting(col)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {canCreate && (
        <div className="flex items-center gap-2 pt-2 border-t">
          <Input
            value={addingName}
            onChange={(e) => setAddingName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
            }}
            placeholder="Nome da nova coluna"
            disabled={createColumn.isPending}
          />
          <Button onClick={handleAdd} disabled={!addingName.trim() || createColumn.isPending} size="sm">
            {createColumn.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </>
            )}
          </Button>
        </div>
      )}

      {!canCreate && !canEdit && !canDelete && (
        <p className="text-xs text-muted-foreground pt-2 border-t">
          Você não tem permissão para gerenciar colunas. Fale com um administrador.
        </p>
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir coluna "{deleting?.nome}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Só é possível excluir colunas sem demandas. Se houver demandas nesta coluna,
              mova-as antes para outra.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteColumn.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteColumn.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteColumn.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir coluna
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SortableColumnRow({
  column,
  count,
  canEdit,
  canDelete,
  onSave,
  onDelete,
}: {
  column: DemandColumn;
  count: number;
  canEdit: boolean;
  canDelete: boolean;
  onSave: (patch: { nome?: string; cor?: string }) => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
  });

  const [isEditing, setIsEditing] = useState(false);
  const [nome, setNome] = useState(column.nome);

  useEffect(() => {
    setNome(column.nome);
  }, [column.nome]);

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleSaveName = () => {
    const trimmed = nome.trim();
    if (trimmed && trimmed !== column.nome) onSave({ nome: trimmed });
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setNome(column.nome);
    setIsEditing(false);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-md border bg-card p-3 hover:bg-muted/40"
    >
      {canEdit ? (
        <button
          type="button"
          className="touch-none text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing"
          aria-label="Reordenar"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5" />
        </button>
      ) : (
        <GripVertical className="h-5 w-5 text-muted-foreground/30" />
      )}

      <Popover>
        <PopoverTrigger asChild disabled={!canEdit}>
          <button
            type="button"
            className="h-6 w-6 rounded-full border-2 border-border hover:scale-110 transition-transform shrink-0 disabled:hover:scale-100 disabled:cursor-default"
            style={stageColorStyle(column.cor)}
            aria-label="Mudar cor"
          />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-3">
          <ColorPicker
            label="Cor da coluna"
            value={column.cor ?? '#94A3B8'}
            onChange={(c) => onSave({ cor: c })}
            presets={STAGE_HEX_PRESETS}
            swatchSize="sm"
          />
        </PopoverContent>
      </Popover>

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
            <span className="font-medium truncate">{column.nome}</span>
            <span className="text-xs text-muted-foreground shrink-0">
              ({count} demanda{count === 1 ? '' : 's'})
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
            {canEdit && (
              <Button variant="ghost" size="icon" onClick={() => setIsEditing(true)} title="Renomear">
                <Pencil className="h-4 w-4" />
              </Button>
            )}
            {canDelete && (
              <Button variant="ghost" size="icon" onClick={onDelete} title="Excluir">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
