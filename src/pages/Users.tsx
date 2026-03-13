import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Plus, Users as UsersIcon } from 'lucide-react';
import { useUsers } from '@/hooks/useUsers';
import { usePermissions } from '@/hooks/usePermissions';
import { UserCard } from '@/components/users/UserCard';
import { CreateUserDialog } from '@/components/users/CreateUserDialog';

type StatusFilter = 'todos' | 'ATIVO' | 'PENDENTE' | 'INATIVO';

export default function Users() {
  const [activeTab, setActiveTab] = useState<StatusFilter>('todos');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const { can } = usePermissions();
  const { data: users = [], isLoading } = useUsers();

  const counts = useMemo(() => ({
    todos: users.length,
    ATIVO: users.filter((u) => u.status_aprovacao === 'ATIVO').length,
    PENDENTE: users.filter((u) => u.status_aprovacao === 'PENDENTE').length,
    INATIVO: users.filter((u) => u.status_aprovacao === 'INATIVO').length,
  }), [users]);

  const filteredUsers = useMemo(() => {
    if (activeTab === 'todos') return users;
    return users.filter((u) => u.status_aprovacao === activeTab);
  }, [users, activeTab]);

  const tabs: { value: StatusFilter; label: string }[] = [
    { value: 'todos', label: 'Todos' },
    { value: 'ATIVO', label: 'Ativos' },
    { value: 'PENDENTE', label: 'Pendentes' },
    { value: 'INATIVO', label: 'Inativos' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <UsersIcon className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Usuários</h1>
        </div>
        {can.accessUsers() && (
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Usuário
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as StatusFilter)}>
          <TabsList>
            {tabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label} ({counts[tab.value]})
              </TabsTrigger>
            ))}
          </TabsList>

          {tabs.map((tab) => (
            <TabsContent key={tab.value} value={tab.value}>
              {filteredUsers.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-muted-foreground">
                    Nenhum usuário encontrado
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredUsers.map((user) => (
                    <UserCard key={user.id} user={user} />
                  ))}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      )}

      <CreateUserDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} />
    </div>
  );
}
