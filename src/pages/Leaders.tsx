import { useState } from 'react';
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
import { useLeaders, useDeleteLeader } from '@/hooks/useLeaders';
import { useLeaderTypes } from '@/hooks/useLeaderTypes';
import { usePermissions } from '@/hooks/usePermissions';
import { LeaderCard } from '@/components/leaders/LeaderCard';
import { LeaderDialog } from '@/components/leaders/LeaderDialog';
import type { Leader } from '@/hooks/useLeaders';

export default function Leaders() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLeader, setEditingLeader] = useState<Leader | null>(null);
  const { can } = usePermissions();
  const deleteLeader = useDeleteLeader();
  const { data: leaderTypes = [] } = useLeaderTypes();

  const { data: leaders = [], isLoading } = useLeaders({
    search: search || undefined,
    leader_type_id: typeFilter !== 'all' ? typeFilter : undefined,
    active: statusFilter === 'all' ? undefined : statusFilter === 'active',
  });

  const handleNewLeader = () => {
    setEditingLeader(null);
    setDialogOpen(true);
  };

  const handleEditLeader = (leader: Leader) => {
    setEditingLeader(leader);
    setDialogOpen(true);
  };

  const handleDeleteLeader = async (leader: Leader) => {
    if (!confirm(`Tem certeza que deseja excluir o articulador "${leader.nome}"?`)) return;
    await deleteLeader.mutateAsync(leader.id);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Articuladores</h1>
        {can.createLeader() && (
          <Button onClick={handleNewLeader}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Articulador
          </Button>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar articuladores..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {leaderTypes.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="inactive">Inativo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : leaders.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground text-lg">Nenhum articulador encontrado</p>
          {!search && typeFilter === 'all' && statusFilter === 'all' && (
            <p className="text-muted-foreground text-sm mt-1">
              Clique em "Novo Articulador" para comecar
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {leaders.map((leader) => (
            <LeaderCard
              key={leader.id}
              leader={leader}
              onEdit={() => handleEditLeader(leader)}
              onDelete={() => handleDeleteLeader(leader)}
              canEdit={can.editLeader()}
              canDelete={can.deleteLeader()}
            />
          ))}
        </div>
      )}

      <LeaderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        leader={editingLeader}
      />
    </div>
  );
}
