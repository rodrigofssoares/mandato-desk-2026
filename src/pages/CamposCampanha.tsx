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
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import {
  ClipboardCheck,
  GripVertical,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  useCampaignFields,
  useCreateCampaignField,
  useUpdateCampaignField,
  useDeleteCampaignField,
  useReorderCampaignFields,
  type CampaignField,
} from '@/hooks/useCampaignFields';
import { usePermissions } from '@/hooks/usePermissions';

// ============================================================
// Item arrastável (cada linha)
// ============================================================
function SortableFieldRow({
  field,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  field: CampaignField;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (f: CampaignField) => void;
  onDelete: (f: CampaignField) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id, disabled: !canEdit });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-md border bg-card p-3 hover:bg-muted/40"
    >
      <button
        type="button"
        className={`touch-none text-muted-foreground hover:text-foreground ${
          canEdit ? 'cursor-grab active:cursor-grabbing' : 'cursor-not-allowed opacity-40'
        }`}
        aria-label="Reordenar"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>

      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{field.label}</p>
        <p className="text-xs text-muted-foreground truncate">{field.slug}</p>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onEdit(field)}
          disabled={!canEdit || field.is_system}
          title={field.is_system ? 'Campo de sistema' : 'Renomear'}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onDelete(field)}
          disabled={!canDelete || field.is_system}
          title={field.is_system ? 'Campo de sistema' : 'Excluir'}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ============================================================
// Página principal
// ============================================================
export default function CamposCampanha() {
  const { can, isLoading: isPermLoading } = usePermissions();
  const { data: fields = [], isLoading } = useCampaignFields();

  const createField = useCreateCampaignField();
  const updateField = useUpdateCampaignField();
  const deleteField = useDeleteCampaignField();
  const reorderFields = useReorderCampaignFields();

  // Estado local de ordenação (otimista)
  const [orderedFields, setOrderedFields] = useState<CampaignField[]>([]);
  useEffect(() => {
    setOrderedFields(fields);
  }, [fields]);

  // Dialogs
  const [createOpen, setCreateOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [editingField, setEditingField] = useState<CampaignField | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [deletingField, setDeletingField] = useState<CampaignField | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const canCreate = can.createCampaignField();
  const canEdit = can.editCampaignField();
  const canDelete = can.deleteCampaignField();
  const canViewPage = can.viewCampaignFields();

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = orderedFields.findIndex((f) => f.id === active.id);
    const newIndex = orderedFields.findIndex((f) => f.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const next = arrayMove(orderedFields, oldIndex, newIndex);
    // Atualização otimista
    setOrderedFields(next);
    // Persiste no banco — cada item recebe a nova ordem
    reorderFields.mutate(
      next.map((f, idx) => ({ id: f.id, ordem: idx })),
    );
  };

  const handleCreateSubmit = () => {
    if (!newLabel.trim()) return;
    createField.mutate(
      { label: newLabel.trim() },
      {
        onSuccess: () => {
          setNewLabel('');
          setCreateOpen(false);
        },
      },
    );
  };

  const handleEditOpen = (field: CampaignField) => {
    setEditingField(field);
    setEditLabel(field.label);
  };

  const handleEditSubmit = () => {
    if (!editingField || !editLabel.trim()) return;
    updateField.mutate(
      { id: editingField.id, label: editLabel.trim() },
      {
        onSuccess: () => {
          setEditingField(null);
          setEditLabel('');
        },
      },
    );
  };

  const handleDeleteConfirm = () => {
    if (!deletingField) return;
    deleteField.mutate(deletingField.id, {
      onSuccess: () => setDeletingField(null),
    });
  };

  if (isPermLoading || isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!canViewPage) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Você não tem permissão para acessar esta página.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <ClipboardCheck className="h-6 w-6" />
        <div>
          <h1 className="text-2xl font-bold">Campos de Campanha</h1>
          <p className="text-sm text-muted-foreground">
            Crie checkboxes customizados que aparecem na aba Campanha de cada contato
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div className="space-y-1">
            <CardTitle className="text-lg">Campos</CardTitle>
            <CardDescription>
              Arraste pelo ícone <GripVertical className="inline h-3.5 w-3.5 align-text-bottom" /> para reordenar.
              A ordem aqui é a mesma usada no cartão de contato e nos filtros.
            </CardDescription>
          </div>
          <Button
            onClick={() => setCreateOpen(true)}
            disabled={!canCreate}
            title={!canCreate ? 'Sem permissão' : undefined}
          >
            <Plus className="h-4 w-4 mr-2" />
            Novo campo
          </Button>
        </CardHeader>
        <CardContent>
          {orderedFields.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Nenhum campo criado ainda. Clique em <strong>Novo campo</strong> para começar.
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={orderedFields.map((f) => f.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {orderedFields.map((field) => (
                    <SortableFieldRow
                      key={field.id}
                      field={field}
                      canEdit={canEdit}
                      canDelete={canDelete}
                      onEdit={handleEditOpen}
                      onDelete={setDeletingField}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {/* Dialog: Criar */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo campo de campanha</DialogTitle>
            <DialogDescription>
              Ex: "Enviou material físico", "Confirmou presença no evento"
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="new-label">Nome do campo</Label>
            <Input
              id="new-label"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Digite o nome do campo"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateSubmit();
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateSubmit}
              disabled={!newLabel.trim() || createField.isPending}
            >
              {createField.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Renomear */}
      <Dialog open={!!editingField} onOpenChange={(open) => !open && setEditingField(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renomear campo</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="edit-label">Nome do campo</Label>
            <Input
              id="edit-label"
              value={editLabel}
              onChange={(e) => setEditLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleEditSubmit();
              }}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingField(null)}>
              Cancelar
            </Button>
            <Button
              onClick={handleEditSubmit}
              disabled={!editLabel.trim() || updateField.isPending}
            >
              {updateField.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog: Confirmar exclusão */}
      <AlertDialog
        open={!!deletingField}
        onOpenChange={(open) => !open && setDeletingField(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campo</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o campo <strong>{deletingField?.label}</strong>?
              Todos os valores marcados em contatos serão removidos. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
