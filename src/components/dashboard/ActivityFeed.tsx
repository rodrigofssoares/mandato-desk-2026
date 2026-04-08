import { useState } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  ArrowRightLeft,
  UserCheck,
  Upload,
  GitMerge,
  Loader2,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useRecentActivities, useProfilesList } from '@/hooks/useDashboard';
import { usePermissions } from '@/hooks/usePermissions';
import { ActivitiesExportMenu } from '@/components/activities/ActivitiesExportMenu';

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  create: Plus,
  update: Pencil,
  delete: Trash2,
  status_change: ArrowRightLeft,
  assignment: UserCheck,
  import: Upload,
  merge: GitMerge,
  bulk_delete: Trash2,
};

const ACTIVITY_LABELS: Record<string, string> = {
  create: 'Criação',
  update: 'Atualização',
  delete: 'Exclusão',
  status_change: 'Mudança de Status',
  assignment: 'Atribuição',
  import: 'Importação',
  merge: 'Mesclagem',
  bulk_delete: 'Exclusão em Massa',
};

export function ActivityFeed() {
  const [page, setPage] = useState(0);
  const [activityType, setActivityType] = useState<string>('');
  const [responsibleId, setResponsibleId] = useState<string>('');

  const { can } = usePermissions();

  const { data: activities, isLoading } = useRecentActivities(page, {
    activityType: activityType || undefined,
    responsibleId: responsibleId || undefined,
  });
  const { data: profiles } = useProfilesList();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between"><CardTitle className="text-lg">Atividades Recentes</CardTitle>{can.exportData() && <ActivitiesExportMenu />}</div>
        <div className="flex flex-col sm:flex-row gap-2 mt-2">
          <Select value={activityType} onValueChange={(v) => { setActivityType(v === 'all' ? '' : v); setPage(0); }}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Tipo de atividade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              {Object.entries(ACTIVITY_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={responsibleId} onValueChange={(v) => { setResponsibleId(v === 'all' ? '' : v); setPage(0); }}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {(profiles ?? []).map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome || p.id.slice(0, 8)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1 space-y-1">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : !activities || activities.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma atividade registrada
          </p>
        ) : (
          <>
            <ul className="space-y-3">
              {activities.map((a) => {
                const Icon = ACTIVITY_ICONS[a.type] ?? Plus;
                return (
                  <li key={a.id} className="flex items-start gap-3">
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted shrink-0">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm leading-snug">
                        <span className="font-medium">{a.responsibleName}</span>{' '}
                        {a.description || `${ACTIVITY_LABELS[a.type] ?? a.type} - ${a.entityType}`}
                        {a.entityName && (
                          <span className="text-muted-foreground"> ({a.entityName})</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatDistanceToNow(new Date(a.createdAt), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>

            {activities.length >= (page + 1) * 10 && (
              <div className="mt-4 text-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => p + 1)}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : null}
                  Carregar mais
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
