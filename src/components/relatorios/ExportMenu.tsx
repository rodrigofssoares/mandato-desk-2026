import { Download, FileSpreadsheet, FileText, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { exportFunnelToXlsx, exportFunnelToPdf } from '@/lib/exportRelatorio';
import type { FunnelReportStage } from '@/hooks/useFunnelReport';

interface ExportMenuProps {
  stages: FunnelReportStage[];
  boardNome: string;
  isLoading: boolean;
  /** Referência ao container do gráfico para captura no PDF (opcional). */
  chartContainerRef?: HTMLElement | null;
}

export function ExportMenu({
  stages,
  boardNome,
  isLoading,
  chartContainerRef,
}: ExportMenuProps) {
  const disabled = isLoading || stages.length === 0;

  async function handleExcelClick() {
    await exportFunnelToXlsx(stages, boardNome);
  }

  async function handlePdfClick() {
    await exportFunnelToPdf(stages, boardNome, chartContainerRef);
  }

  function handlePrintClick() {
    window.print();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={handleExcelClick}
          disabled={disabled}
          className="gap-2 cursor-pointer"
        >
          <FileSpreadsheet className="h-4 w-4 text-green-600" />
          Exportar Excel
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={handlePdfClick}
          disabled={disabled}
          className="gap-2 cursor-pointer"
        >
          <FileText className="h-4 w-4 text-red-600" />
          Exportar PDF
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handlePrintClick}
          disabled={disabled}
          className="gap-2 cursor-pointer"
        >
          <Printer className="h-4 w-4 text-muted-foreground" />
          Imprimir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
