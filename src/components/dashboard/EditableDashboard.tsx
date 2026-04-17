import { useMemo, useState } from 'react';
import RGL from 'react-grid-layout';
import {
  Pencil,
  Save,
  X,
  RotateCcw,
  EyeOff,
  Eye,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';

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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { useDashboardLayout } from '@/hooks/useDashboardLayout';
import {
  DASHBOARD_WIDGET_IDS,
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

type Layout = RGL.Layout;
type Layouts = RGL.Layouts;

const Responsive = RGL.Responsive;
const WidthProvider = RGL.WidthProvider;
const ResponsiveGridLayout = WidthProvider(Responsive);

interface EditableDashboardProps {
  widgets: Record<DashboardWidgetId, React.ReactNode>;
  canEdit: boolean;
}

export function EditableDashboard({ widgets, canEdit }: EditableDashboardProps) {
  const {
    layouts,
    widgetPrefs,
    hasDraft,
    updateLayouts,
    setHidden,
    cancelDraft,
    save,
    reset,
    isSaving,
    isResetting,
  } = useDashboardLayout();

  const [editing, setEditing] = useState(false);

  const visibleIds = useMemo(
    () =>
      (DASHBOARD_WIDGET_IDS as readonly DashboardWidgetId[]).filter(
        (id) => !widgetPrefs[id]?.hidden
      ),
    [widgetPrefs]
  );

  const hiddenIds = useMemo(
    () =>
      (DASHBOARD_WIDGET_IDS as readonly DashboardWidgetId[]).filter(
        (id) => widgetPrefs[id]?.hidden
      ),
    [widgetPrefs]
  );

  // Filtra layouts para conter apenas widgets visíveis (caso contrário RGL
  // reserva espaço vazio para widgets escondidos).
  const visibleLayouts = useMemo<Layouts>(() => {
    const visibleSet = new Set<string>(visibleIds);
    const filtered: Layouts = {};
    for (const [bp, items] of Object.entries(layouts)) {
      filtered[bp] = (items as Layout[]).filter((l) => visibleSet.has(l.i));
    }
    return filtered;
  }, [layouts, visibleIds]);

  const handleLayoutChange = (_: Layout[], all: Layouts) => {
    if (!editing) return;
    // Mescla de volta com os itens escondidos para não perder o layout salvo
    // deles quando o usuário reexibir no futuro.
    const merged: DashboardLayouts = { ...layouts };
    const breakpoints: (keyof DashboardLayouts)[] = ['lg', 'md', 'sm', 'xs', 'xxs'];
    for (const bp of breakpoints) {
      const incoming = (all as Record<string, Layout[]>)[bp] ?? [];
      const hiddenItems = (layouts[bp] ?? []).filter(
        (l) => !visibleIds.includes(l.i as DashboardWidgetId)
      );
      merged[bp] = [...incoming, ...hiddenItems];
    }
    updateLayouts(merged);
  };

  const handleEnterEdit = () => setEditing(true);

  const handleCancel = () => {
    cancelDraft();
    setEditing(false);
  };

  const handleSave = async () => {
    try {
      await save();
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

  const toggleHidden = (id: DashboardWidgetId, hidden: boolean) => {
    setHidden(id, hidden);
  };

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex items-center justify-end gap-2 flex-wrap">
          {hiddenIds.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <Eye className="h-4 w-4" />
                  Widgets ocultos
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                    {hiddenIds.length}
                  </Badge>
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72 p-2">
                <div className="space-y-1">
                  <p className="px-2 py-1 text-xs text-muted-foreground">
                    Clique para reexibir no dashboard
                  </p>
                  {hiddenIds.map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleHidden(id, false)}
                      className="flex w-full items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-accent"
                    >
                      <span>{DASHBOARD_WIDGET_LABELS[id]}</span>
                      <Plus className="h-4 w-4 text-muted-foreground" />
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}

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
                      Isso descarta sua personalização (layout, ocultação e
                      tipos de gráfico) e volta ao padrão. Esta ação não pode
                      ser desfeita.
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
          canto inferior direito para redimensionar. Clique no{' '}
          <EyeOff className="inline h-3.5 w-3.5" /> para ocultar.
        </div>
      )}

      <ResponsiveGridLayout
        className={cn('layout', editing && 'is-editing')}
        layouts={visibleLayouts}
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
        {visibleIds.map((id) => (
          <div
            key={id}
            className={cn(
              'dashboard-widget',
              editing &&
                'ring-2 ring-primary/40 ring-offset-2 ring-offset-background rounded-lg'
            )}
          >
            {editing && (
              <div className="widget-drag-handle absolute left-0 right-0 top-0 z-10 flex cursor-move items-center justify-between rounded-t-lg bg-primary/90 px-3 py-1 text-xs font-medium text-primary-foreground">
                <span className="truncate">{DASHBOARD_WIDGET_LABELS[id]}</span>
                <div className="flex items-center gap-2">
                  <span className="opacity-75">↕ arrastar</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleHidden(id, true);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-primary-foreground/20"
                    title="Ocultar widget"
                  >
                    <EyeOff className="h-3.5 w-3.5" />
                  </button>
                </div>
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
