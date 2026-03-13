import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Loader2 } from 'lucide-react';
import { useWebhookLogs } from '@/hooks/useWebhooks';

interface WebhookLogsProps {
  webhookId: string | undefined;
  webhookName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function StatusBadge({ code }: { code: number | null }) {
  if (code === null) return <Badge variant="secondary">-</Badge>;
  if (code >= 200 && code < 300) return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">{code}</Badge>;
  if (code >= 400 && code < 500) return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">{code}</Badge>;
  return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">{code}</Badge>;
}

export function WebhookLogs({ webhookId, webhookName, open, onOpenChange }: WebhookLogsProps) {
  const { data: logs = [], isLoading } = useWebhookLogs(webhookId);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Logs - {webhookName}</SheetTitle>
        </SheetHeader>

        <div className="mt-4">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum log registrado
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Resposta</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('pt-BR')}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {log.event_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <StatusBadge code={log.status_code} />
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <p className="text-xs text-muted-foreground truncate">
                        {log.response_body ?? '-'}
                      </p>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
