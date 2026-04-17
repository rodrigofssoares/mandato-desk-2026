import { useMemo, useState } from 'react';
import RGL from 'react-grid-layout';
import { Pencil, Save, X, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

type Layout = RGL.Layout;
type Layouts = RGL.Layouts;

const Responsive = RGL.Responsive;
const WidthProvider = RGL.WidthProvider;

import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useDashboardLayout } from '@/hooks/useDashboardLayout';
import {
  DASHBOARD_WIDGET_LABELS,
  GRID_BREAKPOINTS,
  GRID_COLS,
  GRID_ROW_HEIGHT,
  type DashboardLayouts,
  type DashboardWidgetId,
} from '@/lib/dashboardLayout';
import { cn } from '@/lib/utils';

import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

const ResponsiveGridLayout = WidthProvider(Responsive);

interface EditableDashboardProps {
  widgets: Record<DashboardWidgetId, React.ReactNode>;
  canEdit: boolean;
}

export function EditableDashboard({ widgets, canEdit }: EditableDashboardProps) {
  const {
    layouts,
    hasDraft,
    updateDraft,
    cancelDraft,
    save,
    reset,
    isSaving,
    isResetting,
  } = useDashboardLayout();

  const [editing, setEditing] = useState(false);

  const widgetIds = useMemo(
    () => Object.keys(widgets) as DashboardWidgetId[],
    [widgets]
  );

  const handleLayoutChange = (_: Layout[], all: Layouts) => {
    if (!editing) return;
    updateDraft(all as DashboardLayouts);
  };

  const handleEnterEdit = () => setEditing(true);

  const handleCancel = () => {
    cancelDraft();
    setEditing(false);
  };

  const handleSave = async () => {
    try {
      await save(layouts);
      setEditing(false);
      toast.success('Layout personalizado salvo.');
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível salvar o layout.');
    }
  };

  const handleReset = async () => {
    try {
      await reset();
      setEditing(false);
      toast.success('Layout padrão restaurado.');
    } catch (err) {
      console.error(err);
      toast.error('Não foi possível restaurar o layout.');
    }
  };

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex items-center justify-end gap-2">
          {!editing ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleEnterEdit}
              className="gap-2"
            >
              <Pencil className="h-4 w-4" />
              Personalizar
            </Button>
          ) : (
            <>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-2 text-muted-foreground"
                    disabled={isResetting}
                  >
                    <RotateCcw className="h-4 w-4" />
                    Restaurar padrão
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Restaurar layout padrão?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Isso descarta sua personalização e volta ao layout
                      original do dashboard. Esta ação não pode ser desfeita.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleReset}>
                      Restaurar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                className="gap-2"
                disabled={isSaving}
              >
                <X className="h-4 w-4" />
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                className="gap-2"
                disabled={isSaving}
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'Salvando...' : 'Salvar'}
              </Button>
            </>
          )}
        </div>
      )}

      {editing && (
        <div className="rounded-md border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-sm text-muted-foreground">
          Arraste pelo cabeçalho dos widgets para reorganizar. Use a alça no
          canto inferior direito para redimensionar.
        </div>
      )}

      <ResponsiveGridLayout
        className={cn('layout', editing && 'is-editing')}
        layouts={layouts as Layouts}
        breakpoints={GRID_BREAKPOINTS}
        cols={GRID_COLS}
        rowHeight={GRID_ROW_HEIGHT}
        margin={[16, 16]}
        containerPadding={[0, 0]}
        isDraggable={editing}
        isResizable={editing}
        draggableHandle=".widget-drag-handle"
        onLayoutChange={handleLayoutChange}
        compactType="vertical"
        preventCollision={false}
      >
        {widgetIds.map((id) => (
          <div
            key={id}
            className={cn(
              'dashboard-widget',
              editing && 'ring-2 ring-primary/40 ring-offset-2 ring-offset-background rounded-lg'
            )}
          >
            {editing && (
              <div className="widget-drag-handle absolute left-0 right-0 top-0 z-10 flex cursor-move items-center justify-between rounded-t-lg bg-primary/90 px-3 py-1 text-xs font-medium text-primary-foreground">
                <span>{DASHBOARD_WIDGET_LABELS[id]}</span>
                <span className="opacity-75">↕ arrastar</span>
              </div>
            )}
            <div className={cn('h-full w-full', editing && 'pt-7')}>
              {widgets[id]}
            </div>
          </div>
        ))}
      </ResponsiveGridLayout>

      {hasDraft && !editing && (
        <div className="rounded-md border border-amber-400/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-200">
          Você tem alterações não salvas no layout. Entre em modo de edição
          para salvar ou descartar.
        </div>
      )}
    </div>
  );
}
