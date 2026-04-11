import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
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
import { FolderInput, Palette, Trash2, X, Loader2 } from 'lucide-react';
import { useBulkUpdateTags, useBulkDeleteTags } from '@/hooks/useTags';
import { usePermissions } from '@/hooks/usePermissions';
import type { Tag } from '@/hooks/useTags';
import type { TagGroup } from '@/hooks/useTagGroups';

const PRESET_COLORS = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E',
  '#3B82F6', '#8B5CF6', '#EC4899', '#6B7280',
];

interface TagBulkActionsBarProps {
  selectedTags: Tag[];
  groups: TagGroup[];
  onClearSelection: () => void;
}

export function TagBulkActionsBar({
  selectedTags,
  groups,
  onClearSelection,
}: TagBulkActionsBarProps) {
  const { can } = usePermissions();
  const bulkUpdate = useBulkUpdateTags();
  const bulkDelete = useBulkDeleteTags();
  const [deleteOpen, setDeleteOpen] = useState(false);

  const count = selectedTags.length;
  const totalContacts = selectedTags.reduce((sum, t) => sum + (t.contact_count ?? 0), 0);
  const ids = selectedTags.map((t) => t.id);

  const canBulkDelete = can.bulkDeleteTags();

  const handleMoveTo = async (groupId: string) => {
    await bulkUpdate.mutateAsync({ ids, patch: { group_id: groupId } });
    onClearSelection();
  };

  const handleChangeColor = async (color: string) => {
    await bulkUpdate.mutateAsync({ ids, patch: { cor: color } });
    onClearSelection();
  };

  const handleDelete = async () => {
    await bulkDelete.mutateAsync(ids);
    setDeleteOpen(false);
    onClearSelection();
  };

  if (count === 0) return null;

  const previewNames = selectedTags.slice(0, 10).map((t) => t.nome);
  const extraCount = Math.max(0, count - previewNames.length);

  return (
    <>
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-background border shadow-lg rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap max-w-[calc(100vw-2rem)]">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-semibold h-6 min-w-6 px-2">
            {count}
          </span>
          <span className="text-sm font-medium">selecionada(s)</span>
        </div>

        <div className="h-6 w-px bg-border" />

        {/* Mover para */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <FolderInput className="h-4 w-4" />
              Mover para
            </Button>
          </PopoverTrigger>
          <PopoverContent align="center" className="w-56 p-1">
            <div className="text-xs font-medium text-muted-foreground px-2 py-1.5">
              Escolha o grupo de destino
            </div>
            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-accent transition-colors"
                disabled={bulkUpdate.isPending}
                onClick={() => handleMoveTo(g.id)}
              >
                {g.label}
              </button>
            ))}
          </PopoverContent>
        </Popover>

        {/* Trocar cor */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Palette className="h-4 w-4" />
              Trocar cor
            </Button>
          </PopoverTrigger>
          <PopoverContent align="center" className="w-auto p-2">
            <div className="text-xs font-medium text-muted-foreground px-1 pb-2">
              Escolha a nova cor
            </div>
            <div className="grid grid-cols-4 gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  disabled={bulkUpdate.isPending}
                  className="w-8 h-8 rounded-full border-2 border-transparent hover:scale-110 transition-transform"
                  style={{ backgroundColor: color }}
                  onClick={() => handleChangeColor(color)}
                />
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Excluir */}
        {canBulkDelete && (
          <Button
            variant="destructive"
            size="sm"
            className="gap-2"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4" />
            Excluir
          </Button>
        )}

        <div className="h-6 w-px bg-border" />

        <Button variant="ghost" size="sm" onClick={onClearSelection} className="gap-2">
          <X className="h-4 w-4" />
          Cancelar
        </Button>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {count} etiqueta(s)?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  As seguintes etiquetas serão removidas permanentemente:
                </p>
                <ul className="text-sm bg-muted rounded p-3 max-h-40 overflow-y-auto space-y-1">
                  {previewNames.map((name) => (
                    <li key={name} className="truncate">• {name}</li>
                  ))}
                  {extraCount > 0 && (
                    <li className="text-muted-foreground italic">+ {extraCount} outra(s)</li>
                  )}
                </ul>
                {totalContacts > 0 && (
                  <p className="text-destructive font-medium">
                    {totalContacts} contato(s) perderão essas etiquetas.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={bulkDelete.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDelete.isPending && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Excluir definitivamente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
