import { HelpCircle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { FunnelReportStage } from '@/hooks/useFunnelReport';

interface FunnelMetricsTableProps {
  stages: FunnelReportStage[];
  isLoading: boolean;
  /** true quando pelo menos um estágio está selecionado no multi-select */
  hasSelection: boolean;
}

function formatPct(value: number | null, isFirst: boolean): string {
  if (isFirst) return '—';
  if (value === null) return 'N/A';
  return `${Math.round(value)}%`;
}

function formatPctTopo(value: number | null): string {
  if (value === null) return 'N/A';
  return `${Math.round(value)}%`;
}

export function FunnelMetricsTable({ stages, isLoading, hasSelection }: FunnelMetricsTableProps) {
  if (isLoading) {
    return (
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Estágio</TableHead>
              <TableHead>Contatos</TableHead>
              <TableHead>% vs. Anterior</TableHead>
              <TableHead>% vs. Topo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[1, 2, 3, 4].map((i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                <TableCell><Skeleton className="h-4 w-12" /></TableCell>
                <TableCell><Skeleton className="h-4 w-14" /></TableCell>
                <TableCell><Skeleton className="h-4 w-14" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (!hasSelection) {
    return (
      <div className="border rounded-lg p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Selecione pelo menos um estágio para visualizar o relatório
        </p>
      </div>
    );
  }

  if (stages.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Funil sem contatos — adicione contatos no Board para visualizar o relatório
        </p>
      </div>
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Estágio</TableHead>
            <TableHead className="text-right">Contatos</TableHead>
            <TableHead className="text-right">
              <div className="flex items-center justify-end gap-1">
                % vs. Anterior
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    Percentual de contatos desta etapa em relação à etapa anterior selecionada
                  </TooltipContent>
                </Tooltip>
              </div>
            </TableHead>
            <TableHead className="text-right">
              <div className="flex items-center justify-end gap-1">
                % vs. Topo
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    Percentual acumulado desde o primeiro estágio selecionado (topo do funil)
                  </TooltipContent>
                </Tooltip>
              </div>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {stages.map((stage, index) => {
            const isFirst = index === 0;
            return (
              <TableRow key={stage.stage_id}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: stage.cor ?? 'hsl(var(--primary))' }}
                    />
                    <span className="font-medium text-sm">{stage.nome}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {stage.count}
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {formatPct(stage.pctVsAnterior, isFirst)}
                </TableCell>
                <TableCell className="text-right text-sm text-muted-foreground">
                  {isFirst ? '100%' : formatPctTopo(stage.pctVsTopo)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
