import { useState } from 'react';
import { Download, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { downloadFile, rowsToCSV, downloadXLSX, dateForFilename } from '@/lib/exportUtils';
import type { Contact, ContactFilters } from '@/hooks/useContacts';
import {
  applyContactsClientFilters,
  applyContactsServerFilters,
  buildContactsSelectClause,
  hydrateContactTags,
} from '@/lib/contactsFilters';

interface ExportMenuProps {
  filters: ContactFilters;
}

const COL_WIDTHS = [
  { wch: 36 }, // id
  { wch: 25 }, // Nome
  { wch: 20 }, // Nome WhatsApp
  { wch: 15 }, // WhatsApp
  { wch: 18 }, // Canal WhatsApp
  { wch: 20 }, // Receber WhatsApp
  { wch: 15 }, // Multiplicador
  { wch: 25 }, // Email
  { wch: 15 }, // Telefone
  { wch: 12 }, // Gênero
  { wch: 14 }, // Data Nascimento
  { wch: 30 }, // Logradouro
  { wch: 10 }, // Número
  { wch: 20 }, // Complemento
  { wch: 20 }, // Bairro
  { wch: 20 }, // Cidade
  { wch: 6 },  // Estado
  { wch: 12 }, // CEP
  { wch: 15 }, // Instagram
  { wch: 15 }, // Twitter
  { wch: 15 }, // TikTok
  { wch: 15 }, // YouTube
  { wch: 15 }, // Declarou Voto
  { wch: 8 },  // Ranking
  { wch: 10 }, // Favorito
  { wch: 36 }, // Liderança ID
  { wch: 15 }, // Origem
  { wch: 30 }, // Observações
  { wch: 30 }, // Notas Assessor
  { wch: 20 }, // Último Contato
  { wch: 25 }, // Etiquetas
  { wch: 14 }, // Criado em
  { wch: 14 }, // Atualizado em
];

/**
 * Baixa todos os contatos respeitando os filtros ativos.
 *
 * Usa os MESMOS helpers de `useContacts` para garantir paridade exata entre
 * o que aparece na listagem filtrada e o que vai pro arquivo exportado.
 *
 * Quando `ignoreFilters=true`, ignora paginação/ordenação/sort do usuário e
 * baixa o universo inteiro de contatos (modo "Completo"). Em ambos os casos
 * pagina por batches de 1000 (limite máximo do PostgREST sem RPC) e remove
 * as opções de paginação/sort de UI (page/per_page/sort_by) — exportação
 * deve trazer TODOS os matches, não só a página atual.
 */
async function fetchAllContactsPaginated(
  rawFilters: ContactFilters,
  ignoreFilters = false
): Promise<Contact[]> {
  // Para "Completo": ignora todos os filtros. Para "Filtrado": usa todos
  // EXCETO paginação/sort/per_page (que são da UI, não do escopo do dado).
  const filters: ContactFilters = ignoreFilters
    ? {}
    : { ...rawFilters, page: undefined, per_page: undefined, sort_by: undefined };

  const { selectClause, usingTagFilter, usingBoardFilter } = buildContactsSelectClause(filters);

  const batchSize = 1000;
  let offset = 0;
  let allData: Contact[] = [];

  // Loop de paginação. Cada iteração reconstrói a query base e re-aplica os
  // filtros (algumas sub-queries pequenas se repetem, mas o custo é baixo
  // perto da query principal).
  while (true) {
    let query = supabase.from('contacts').select(selectClause);

    const applied = await applyContactsServerFilters(supabase, query, filters);
    if (applied.empty) {
      return [];
    }
    query = applied.query;

    query = query.order('nome', { ascending: true }).range(offset, offset + batchSize - 1);

    const { data, error } = await query;
    if (error) throw error;
    if (!data || data.length === 0) break;

    // Cast unknown — mesma justificativa de useContacts
    let batch = (data as unknown) as Contact[];

    if (usingTagFilter || usingBoardFilter) {
      batch = await hydrateContactTags(supabase, batch);
    }

    allData = allData.concat(batch);
    if (data.length < batchSize) break;
    offset += batchSize;
  }

  // Filtros que precisam de cálculo client-side (birthday range, etc.)
  return applyContactsClientFilters(allData, filters);
}

function contactsToRows(contacts: any[]) {
  return contacts.map((c: Record<string, unknown>) => ({
    id: c.id ?? '',
    Nome: c.nome ?? '',
    'Nome WhatsApp': c.nome_whatsapp ?? '',
    WhatsApp: c.whatsapp ?? '',
    'Canal WhatsApp': c.em_canal_whatsapp ? 'Sim' : 'Não',
    'Receber WhatsApp': c.aceita_whatsapp ? 'Sim' : 'Não',
    Multiplicador: c.e_multiplicador ? 'Sim' : 'Não',
    Email: c.email ?? '',
    Telefone: c.telefone ?? '',
    'Gênero': c.genero ?? '',
    'Data Nascimento': c.data_nascimento ?? '',
    Logradouro: c.logradouro ?? '',
    'Número': c.numero ?? '',
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
    'Liderança ID': c.leader_id ?? '',
    Origem: c.origem ?? '',
    'Observações': c.observacoes ?? '',
    'Notas Assessor': c.notas_assessor ?? '',
    'Último Contato': c.ultimo_contato ?? '',
    Etiquetas: Array.isArray(c.contact_tags)
      ? (c.contact_tags as Array<{ tags: { nome: string } }>).map((ct) => ct.tags?.nome).filter(Boolean).join(', ')
      : '',
    'Criado em': c.created_at ?? '',
    'Atualizado em': c.updated_at ?? '',
  }));
}

export function ExportMenu({ filters }: ExportMenuProps) {
  const [isExporting, setIsExporting] = useState(false);

  const doExport = async (format: 'csv' | 'xlsx', filtered: boolean) => {
    setIsExporting(true);
    const suffix = filtered ? 'filtrado' : 'completo';
    try {
      const contacts = await fetchAllContactsPaginated(filters, !filtered);
      const rows = contactsToRows(contacts);
      if (rows.length === 0) {
        toast.error('Nenhum contato para exportar');
        return;
      }

      const date = dateForFilename();
      if (format === 'csv') {
        const csv = rowsToCSV(rows);
        downloadFile(csv, `contatos_${date}_${suffix}.csv`, 'text/csv;charset=utf-8;');
      } else {
        await downloadXLSX(rows, `contatos_${date}_${suffix}.xlsx`, 'Contatos', COL_WIDTHS);
      }
      toast.success(`${rows.length} contatos exportados em ${format.toUpperCase()}`);
    } catch (err) {
      toast.error(`Erro ao exportar ${format.toUpperCase()}`);
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
        <DropdownMenuLabel>Filtrados</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => doExport('csv', true)} className="gap-2">
          <FileText className="h-4 w-4" />
          CSV Filtrado
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => doExport('xlsx', true)} className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          XLSX Filtrado
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Completo</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => doExport('csv', false)} className="gap-2">
          <FileText className="h-4 w-4" />
          CSV Completo
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => doExport('xlsx', false)} className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          XLSX Completo
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
