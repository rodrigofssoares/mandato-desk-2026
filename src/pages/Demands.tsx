import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Plus, Search } from 'lucide-react';
import { useDemands } from '@/hooks/useDemands';
import { usePermissions } from '@/hooks/usePermissions';
import { DemandKanban } from '@/components/demands/DemandKanban';
import { DemandDialog } from '@/components/demands/DemandDialog';
import { DemandsExportMenu } from '@/components/demands/DemandsExportMenu';
import type { Demand } from '@/hooks/useDemands';

export default function Demands() {
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDemand, setEditingDemand] = useState<Demand | null>(null);
  const { can } = usePermissions();

  const { data: demands = [], isLoading } = useDemands({
    search: search || undefined,
    priority: priorityFilter !== 'all' ? priorityFilter : undefined,
  });

  const handleNewDemand = () => {
    setEditingDemand(null);
    setDialogOpen(true);
  };

  const handleEditDemand = (demand: Demand) => {
    setEditingDemand(demand);
    setDialogOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Demandas</h1>
        <div className="flex items-center gap-2">
          {can.exportData() && <DemandsExportMenu />}
          {can.createDemand() && (
            <Button onClick={handleNewDemand}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Demanda
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar demandas..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as prioridades</SelectItem>
            <SelectItem value="low">Baixa</SelectItem>
            <SelectItem value="medium">Media</SelectItem>
            <SelectItem value="high">Alta</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : demands.length === 0 && !search && priorityFilter === 'all' ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground text-lg">Nenhuma demanda cadastrada</p>
          <p className="text-muted-foreground text-sm mt-1">
            Clique em "Nova Demanda" para começar
          </p>
        </div>
      ) : (
        <DemandKanban demands={demands} onEditDemand={handleEditDemand} />
      )}

      <DemandDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        demand={editingDemand}
      />
    </div>
  );
}
