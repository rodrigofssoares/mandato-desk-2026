import { useMemo } from 'react';
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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, RotateCcw, LayoutList, Lock, Settings } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
  useNavOrder,
  NAV_ITEM_LABELS,
  NAV_ITEM_KEYS,
  type NavItemKey,
} from '@/hooks/useNavOrder';
import { usePermissions } from '@/hooks/usePermissions';
/**
 * Mapeamento parcial de secao → verificador de permissão — apenas as seções
 * que têm item na sidebar (replica a lógica de SECAO_TO_PERMISSION em AppSidebar.tsx).
 * Mantido aqui para não importar de AppSidebar (dependência circular em potencial).
 */
const SECAO_PERMISSION_CHECK: Record<
  NavItemKey,
  (can: ReturnType<typeof usePermissions>['can']) => boolean
> = {
  dashboard: (can) => can.viewDashboard(),
  contatos: (can) => can.viewContacts(),
  liderancas: (can) => can.viewLeaders(),
  board: (can) => can.viewBoard(),
  relatorios: (can) => can.exportData(),
  tarefas: (can) => can.viewTarefas(),
  demandas: (can) => can.viewDemands(),
  etiquetas: (can) => can.viewTags(),
  mapa: (can) => can.viewMap(),
  importacao: (can) => can.importContacts(),
  campanha: (can) => can.viewCampaignFields(),
};

/**
 * Retorna apenas as NavItemKeys que o usuário atual tem permissão de ver
 * (mesma filtragem que AppSidebar.tsx aplica em visibleItems).
 */
function getVisibleNavKeys(
  can: ReturnType<typeof usePermissions>['can']
): NavItemKey[] {
  // Dashboard tem alwaysVisible=true na sidebar; mapeia para viewDashboard() que retorna true
  return (NAV_ITEM_KEYS as readonly NavItemKey[]).filter((key) => {
    const check = SECAO_PERMISSION_CHECK[key];
    return check ? check(can) : false;
  });
}

interface SortableRowProps {
  navKey: NavItemKey;
  index: number;
}

function SortableRow({ navKey, index }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: navKey,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        'flex items-center gap-3 rounded-md border bg-card px-3 py-2.5 transition-shadow',
        isDragging
          ? 'shadow-lg border-primary ring-1 ring-primary/30'
          : 'shadow-sm border-border',
      ].join(' ')}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        aria-label={`Reordenar ${NAV_ITEM_LABELS[navKey]}`}
        className="p-1 rounded text-muted-foreground transition-colors hover:text-foreground hover:bg-muted cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <Badge variant="secondary" className="font-mono text-[10px] min-w-[28px] justify-center">
        {index + 1}
      </Badge>

      <span className="font-medium text-sm flex-1">{NAV_ITEM_LABELS[navKey]}</span>
    </div>
  );
}

/** Item fixo de "Configurações" — não arrastável, sempre ao fim. */
function ConfiguracoesFixedRow() {
  return (
    <div className="flex items-center gap-3 rounded-md border bg-card px-3 py-2.5 shadow-sm border-border opacity-60">
      <button
        type="button"
        disabled
        aria-label="Configurações — posição fixa"
        className="p-1 rounded text-muted-foreground cursor-not-allowed opacity-40"
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <Lock className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />

      <Badge variant="secondary" className="font-mono text-[10px] min-w-[28px] justify-center">
        —
      </Badge>

      <Settings className="h-4 w-4 text-muted-foreground flex-shrink-0" />

      <span className="font-medium text-sm flex-1">Configurações</span>
    </div>
  );
}

export function NavOrderTab() {
  const { order, setOrder, resetOrder } = useNavOrder();
  const { can } = usePermissions();

  // `can` em usePermissions recria-se a cada render (funções inline em usePermissoes).
  // Estabilizamos via signature serializada em vez de dep direta no objeto — evita loop
  // de re-render no useEffect que sincronizaria estado local.
  const visibleKeysSignature = getVisibleNavKeys(can).join('|');
  const visibleKeys = useMemo(
    () => visibleKeysSignature.split('|').filter(Boolean) as NavItemKey[],
    [visibleKeysSignature]
  );

  // Lista exibida — derivada diretamente de order + visibleKeys, sem state local.
  // Reordenação otimística é feita pelo próprio hook via setOrder + dispatchEvent.
  const localOrder = useMemo(
    () => order.filter((k) => visibleKeys.includes(k)),
    [order, visibleKeys]
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localOrder.indexOf(active.id as NavItemKey);
    const newIndex = localOrder.indexOf(over.id as NavItemKey);
    if (oldIndex < 0 || newIndex < 0) return;

    const next = arrayMove(localOrder, oldIndex, newIndex);
    // Passa a ordem completa (incluindo chaves não-visíveis que estavam no localStorage)
    // para que o merge defensivo do hook preserve a posição de itens fora do escopo atual.
    const fullNext = [
      ...next,
      ...order.filter((k) => !visibleKeys.includes(k)),
    ];
    setOrder(fullNext);
    toast.success('Ordem das abas atualizada', { duration: 1500 });
  }

  function handleReset() {
    resetOrder();
    toast.success('Ordem das abas restaurada ao padrão');
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <LayoutList className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Ordem das Abas</CardTitle>
              <CardDescription className="mt-1">
                Arraste as abas para definir a ordem em que aparecem na barra lateral.
                A preferência é salva no seu navegador.
              </CardDescription>
            </div>
          </div>

          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Restaurar padrão
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={localOrder} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2 max-w-xl">
              {localOrder.map((key, idx) => (
                <SortableRow key={key} navKey={key} index={idx} />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* Item Configurações — fixo, fora do SortableContext */}
        <div className="max-w-xl">
          <Separator className="my-1" />
          <ConfiguracoesFixedRow />
        </div>

        <p className="text-xs text-muted-foreground mt-4 max-w-xl">
          Dica: use{' '}
          <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Tab</kbd> para focar a
          alça e{' '}
          <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Espaço</kbd> + setas
          para reordenar via teclado.
        </p>
      </CardContent>
    </Card>
  );
}
