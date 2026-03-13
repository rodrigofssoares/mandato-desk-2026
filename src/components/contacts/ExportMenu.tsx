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
import type { ContactFilters } from '@/hooks/useContacts';

interface ExportMenuProps {
  filters: ContactFilters;
}

async function fetchAllContacts(filters: ContactFilters) {
  let query = supabase
    .from('contacts')
    .select('*, contact_tags(tag_id, tags(nome))');

  if (filters.search && filters.search.trim()) {
    const term = `%${filters.search.trim()}%`;
    query = query.or(`nome.ilike.${term},email.ilike.${term},whatsapp.ilike.${term}`);
  }
  if (filters.is_favorite) query = query.eq('is_favorite', true);
  if (filters.declarou_voto === true) query = query.eq('declarou_voto', true);
  if (filters.declarou_voto === false) query = query.eq('declarou_voto', false);
  if (filters.leader_id) query = query.eq('leader_id', filters.leader_id);
  if (filters.date_from) query = query.gte('created_at', filters.date_from);
  if (filters.date_to) query = query.lte('created_at', `${filters.date_to}T23:59:59`);

  query = query.order('nome', { ascending: true });

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

function contactsToRows(contacts: Awaited<ReturnType<typeof fetchAllContacts>>) {
  return contacts.map((c: Record<string, unknown>) => ({
    Nome: c.nome ?? '',
    WhatsApp: c.whatsapp ?? '',
    Email: c.email ?? '',
    Telefone: c.telefone ?? '',
    Gênero: c.genero ?? '',
    'Data Nascimento': c.data_nascimento ?? '',
    Logradouro: c.logradouro ?? '',
    Número: c.numero ?? '',
    Complemento: c.complemento ?? '',
    Bairro: c.bairro ?? '',
    Cidade: c.cidade ?? '',
    Estado: c.estado ?? '',
    CEP: c.cep ?? '',
    Instagram: c.instagram ?? '',
    Twitter: c.twitter ?? '',
    TikTok: c.tiktok ?? '',
    YouTube: c.youtube ?? '',
    'Declarou Voto': c.declarou_voto ? 'Sim' : 'Não',
    Ranking: c.ranking ?? 0,
    Favorito: c.is_favorite ? 'Sim' : 'Não',
    Origem: c.origem ?? '',
    Observações: c.observacoes ?? '',
    'Notas Assessor': c.notas_assessor ?? '',
    Etiquetas: Array.isArray(c.contact_tags)
      ? (c.contact_tags as Array<{ tags: { nome: string } }>).map((ct) => ct.tags?.nome).filter(Boolean).join(', ')
      : '',
    'Criado em': c.created_at ?? '',
  }));
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob(['\uFEFF' + content], { type: mimeType }); // BOM for Excel UTF-8
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ExportMenu({ filters }: ExportMenuProps) {
  const [isExporting, setIsExporting] = useState(false);

  const exportCSV = async () => {
    setIsExporting(true);
    try {
      const contacts = await fetchAllContacts(filters);
      const rows = contactsToRows(contacts);
      if (rows.length === 0) {
        toast.error('Nenhum contato para exportar');
        return;
      }

      const headers = Object.keys(rows[0]);
      const csvLines = [
        headers.join(';'),
        ...rows.map((row) =>
          headers.map((h) => {
            const val = String((row as Record<string, unknown>)[h] ?? '').replace(/"/g, '""');
            return `"${val}"`;
          }).join(';')
        ),
      ];

      downloadFile(csvLines.join('\n'), `contatos_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv;charset=utf-8;');
      toast.success(`${rows.length} contatos exportados em CSV`);
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
      const contacts = await fetchAllContacts(filters);
      const rows = contactsToRows(contacts);
      if (rows.length === 0) {
        toast.error('Nenhum contato para exportar');
        return;
      }

      const XLSX = await import('xlsx');
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Contatos');
      XLSX.writeFile(wb, `contatos_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast.success(`${rows.length} contatos exportados em XLSX`);
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
