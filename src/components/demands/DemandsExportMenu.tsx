import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { downloadFile, rowsToCSV, downloadXLSX, dateForFilename } from '@/lib/exportUtils';

const STATUS_LABELS: Record<string, string> = {
  open: 'Aberta',
  in_progress: 'Em Andamento',
  resolved: 'Resolvida',
};

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
};

const COL_WIDTHS = [
  { wch: 36 }, // id
  { wch: 30 }, // titulo
  { wch: 40 }, // descricao
  { wch: 15 }, // status
  { wch: 12 }, // prioridade
  { wch: 20 }, // bairro
  { wch: 25 }, // contato_nome
  { wch: 36 }, // contato_id
  { wch: 12 }, // criado_em
  { wch: 12 }, // atualizado_em
  { wch: 25 }, // etiquetas
];

function demandsToRows(demands: any[]) {
  return demands.map((d) => ({
    id: d.id,
    titulo: d.title ?? '',
    descricao: d.description ?? '',
    status: STATUS_LABELS[d.status] ?? d.status ?? '',
    prioridade: PRIORITY_LABELS[d.priority] ?? d.priority ?? '',
    bairro: d.neighborhood ?? '',
    contato_nome: d.contact?.nome ?? '',
    contato_id: d.contact_id ?? '',
    criado_em: d.created_at ? new Date(d.created_at).toLocaleDateString('pt-BR') : '',
    atualizado_em: d.updated_at ? new Date(d.updated_at).toLocaleDateString('pt-BR') : '',
    etiquetas: Array.isArray(d.demand_tags)
      ? d.demand_tags.map((dt: any) => dt.tags?.nome).filter(Boolean).join(', ')
      : '',
  }));
}

export function DemandsExportMenu() {
  const [isExporting, setIsExporting] = useState(false);

  const fetchDemands = async () => {
    const { data, error } = await supabase
      .from('demands')
      .select('*, contact:contacts(nome), demand_tags(tag_id, tags(nome))')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  };

  const exportCSV = async () => {
    setIsExporting(true);
    try {
      const demands = await fetchDemands();
      const rows = demandsToRows(demands);
      if (rows.length === 0) {
        toast.error('Nenhuma demanda para exportar');
        return;
      }
      const csv = rowsToCSV(rows);
      downloadFile(csv, `demandas_${dateForFilename()}.csv`, 'text/csv;charset=utf-8;');
      toast.success(`${rows.length} demandas exportadas em CSV`);
    } catch (err) {
      toast.error('Erro ao exportar CSV');
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  const exportXLSX = async () => {
    setIsExporting(true);
    try {
      const demands = await fetchDemands();
      const rows = demandsToRows(demands);
      if (rows.length === 0) {
        toast.error('Nenhuma demanda para exportar');
        return;
      }
      await downloadXLSX(rows, `demandas_${dateForFilename()}.xlsx`, 'Demandas', COL_WIDTHS);
      toast.success(`${rows.length} demandas exportadas em XLSX`);
    } catch (err) {
      toast.error('Erro ao exportar XLSX');
      console.error(err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={isExporting} className="gap-2">
          {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportCSV} className="gap-2">
          <FileText className="h-4 w-4" />
          Exportar CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportXLSX} className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Exportar XLSX
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
