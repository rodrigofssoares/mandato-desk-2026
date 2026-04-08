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

const CATEGORY_LABELS: Record<string, string> = {
  professionals: 'Perfil',
  relationships: 'Interesse',
  demands: 'Campanhas',
  geral: 'Geral',
};

const COL_WIDTHS = [
  { wch: 36 }, // id
  { wch: 25 }, // nome
  { wch: 15 }, // categoria
  { wch: 10 }, // cor
  { wch: 12 }, // criado_em
];

function tagsToRows(tags: any[]) {
  return tags.map((t) => ({
    id: t.id,
    nome: t.nome ?? '',
    categoria: CATEGORY_LABELS[t.categoria] ?? t.categoria ?? '',
    cor: t.cor ?? '',
    criado_em: t.created_at ? new Date(t.created_at).toLocaleDateString('pt-BR') : '',
  }));
}

export function TagsExportMenu() {
  const [isExporting, setIsExporting] = useState(false);

  const fetchTags = async () => {
    const { data, error } = await supabase
      .from('tags')
      .select('*')
      .order('nome', { ascending: true });
    if (error) throw error;
    return data ?? [];
  };

  const exportCSV = async () => {
    setIsExporting(true);
    try {
      const tags = await fetchTags();
      const rows = tagsToRows(tags);
      if (rows.length === 0) {
        toast.error('Nenhuma etiqueta para exportar');
        return;
      }
      const csv = rowsToCSV(rows);
      downloadFile(csv, `etiquetas_${dateForFilename()}.csv`, 'text/csv;charset=utf-8;');
      toast.success(`${rows.length} etiquetas exportadas em CSV`);
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
      const tags = await fetchTags();
      const rows = tagsToRows(tags);
      if (rows.length === 0) {
        toast.error('Nenhuma etiqueta para exportar');
        return;
      }
      await downloadXLSX(rows, `etiquetas_${dateForFilename()}.xlsx`, 'Etiquetas', COL_WIDTHS);
      toast.success(`${rows.length} etiquetas exportadas em XLSX`);
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
