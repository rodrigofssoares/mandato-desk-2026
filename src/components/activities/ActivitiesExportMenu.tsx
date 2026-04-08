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

const TYPE_LABELS: Record<string, string> = {
  create: 'Criação',
  update: 'Atualização',
  delete: 'Exclusão',
  status_change: 'Mudança de Status',
  assignment: 'Atribuição',
  import: 'Importação',
  merge: 'Mesclagem',
  bulk_delete: 'Exclusão em Massa',
};

const ENTITY_LABELS: Record<string, string> = {
  contact: 'Contato',
  demand: 'Demanda',
  tag: 'Etiqueta',
  leader: 'Liderança',
  user: 'Usuário',
  permission: 'Permissão',
  role: 'Perfil',
};

const COL_WIDTHS = [
  { wch: 36 }, // id
  { wch: 18 }, // tipo
  { wch: 40 }, // descricao
  { wch: 15 }, // tipo_entidade
  { wch: 30 }, // entidade_nome
  { wch: 36 }, // entidade_id
  { wch: 25 }, // usuario_nome
  { wch: 36 }, // usuario_id
  { wch: 20 }, // data
];

function activitiesToRows(activities: any[]) {
  return activities.map((a) => ({
    id: a.id,
    tipo: TYPE_LABELS[a.type] ?? a.type ?? '',
    descricao: a.description ?? '',
    tipo_entidade: ENTITY_LABELS[a.entity_type] ?? a.entity_type ?? '',
    entidade_nome: a.entity_name ?? '',
    entidade_id: a.entity_id ?? '',
    usuario_nome: a.profiles?.nome ?? 'Sistema',
    usuario_id: a.responsible_id ?? '',
    data: a.created_at ? new Date(a.created_at).toLocaleString('pt-BR') : '',
  }));
}

export function ActivitiesExportMenu() {
  const [isExporting, setIsExporting] = useState(false);

  const fetchAllActivities = async () => {
    let allData: any[] = [];
    let offset = 0;
    const batchSize = 1000;

    while (true) {
      const { data, error } = await supabase
        .from('activities')
        .select('*, profiles:responsible_id(nome)')
        .order('created_at', { ascending: false })
        .range(offset, offset + batchSize - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      allData = allData.concat(data);
      if (data.length < batchSize) break;
      offset += batchSize;
    }

    return allData;
  };

  const exportCSV = async () => {
    setIsExporting(true);
    try {
      const activities = await fetchAllActivities();
      const rows = activitiesToRows(activities);
      if (rows.length === 0) {
        toast.error('Nenhuma atividade para exportar');
        return;
      }
      const csv = rowsToCSV(rows);
      downloadFile(csv, `atividades_${dateForFilename()}.csv`, 'text/csv;charset=utf-8;');
      toast.success(`${rows.length} atividades exportadas em CSV`);
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
      const activities = await fetchAllActivities();
      const rows = activitiesToRows(activities);
      if (rows.length === 0) {
        toast.error('Nenhuma atividade para exportar');
        return;
      }
      await downloadXLSX(rows, `atividades_${dateForFilename()}.xlsx`, 'Atividades', COL_WIDTHS);
      toast.success(`${rows.length} atividades exportadas em XLSX`);
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
