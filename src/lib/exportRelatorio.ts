import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { sanitizarNomeArquivo } from './relatorios';
import type { FunnelReportStage } from '@/hooks/useFunnelReport';

// ============================================================================
// Helpers
// ============================================================================

function formatPct(value: number | null, isFirst: boolean): string {
  if (isFirst) return '—';
  if (value === null) return 'N/A';
  return `${Math.round(value)}%`;
}

function formatPctTopo(value: number | null, isFirst: boolean): string {
  if (isFirst) return '100%';
  if (value === null) return 'N/A';
  return `${Math.round(value)}%`;
}

function nomeArquivo(boardNome: string, ext: 'xlsx' | 'pdf'): string {
  const dataHoje = format(new Date(), 'yyyy-MM-dd');
  const nomeSanitizado = sanitizarNomeArquivo(boardNome) || 'funil';
  return `relatorio-funil-${nomeSanitizado}-${dataHoje}.${ext}`;
}

// ============================================================================
// Exportação Excel
// ============================================================================

/**
 * Gera e faz download de um arquivo .xlsx com os dados do relatório de funil.
 */
export function exportFunnelToXlsx(
  stages: FunnelReportStage[],
  boardNome: string
): void {
  try {
    const cabecalho = ['Estágio', 'Contatos', '% vs. Anterior', '% vs. Topo'];

    const linhas = stages.map((s, index) => [
      s.nome,
      s.count,
      formatPct(s.pctVsAnterior, index === 0),
      formatPctTopo(s.pctVsTopo, index === 0),
    ]);

    const ws = XLSX.utils.aoa_to_sheet([cabecalho, ...linhas]);

    // Larguras de coluna automáticas
    ws['!cols'] = [{ wch: 30 }, { wch: 12 }, { wch: 18 }, { wch: 14 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Relatório');

    XLSX.writeFile(wb, nomeArquivo(boardNome, 'xlsx'));
    toast.success('Excel exportado com sucesso');
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'erro desconhecido';
    toast.error(`Erro ao exportar Excel: ${msg}`);
  }
}

// ============================================================================
// Exportação PDF
// ============================================================================

/**
 * Tenta capturar o SVG do container do gráfico recharts e retornar como
 * data URL PNG. Retorna null se não for possível.
 */
async function capturarGraficoComoPng(
  chartContainerRef?: HTMLElement | null
): Promise<string | null> {
  try {
    if (!chartContainerRef) return null;

    const svgEl = chartContainerRef.querySelector('svg');
    if (!svgEl) return null;

    const svgStr = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    return await new Promise<string | null>((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const rect = svgEl.getBoundingClientRect();
          canvas.width = rect.width || 600;
          canvas.height = rect.height || 300;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            URL.revokeObjectURL(url);
            resolve(null);
            return;
          }
          // Fundo branco para PDF
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/png');
          URL.revokeObjectURL(url);
          resolve(dataUrl);
        } catch {
          URL.revokeObjectURL(url);
          resolve(null);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  } catch {
    return null;
  }
}

/**
 * Gera e faz download de um arquivo .pdf com o relatório de funil.
 * Inclui cabeçalho, tabela de métricas e tentativa de captura do gráfico.
 *
 * @param chartContainerRef Referência ao elemento DOM do container do gráfico (opcional).
 */
export async function exportFunnelToPdf(
  stages: FunnelReportStage[],
  boardNome: string,
  chartContainerRef?: HTMLElement | null
): Promise<void> {
  try {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const dataHoje = format(new Date(), 'dd/MM/yyyy');
    const pageWidth = doc.internal.pageSize.getWidth();

    // Cabeçalho
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Relatório de Funil', 14, 18);

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.text(`Funil: ${boardNome}`, 14, 27);
    doc.text(`Data de geração: ${dataHoje}`, 14, 34);

    let cursorY = 42;

    // Tentativa de captura do gráfico
    const graficoDataUrl = await capturarGraficoComoPng(chartContainerRef);

    if (graficoDataUrl) {
      const imgWidth = pageWidth - 28;
      const imgHeight = imgWidth * 0.5; // proporção 2:1
      doc.addImage(graficoDataUrl, 'PNG', 14, cursorY, imgWidth, imgHeight);
      cursorY += imgHeight + 8;
    } else {
      doc.setFontSize(9);
      doc.setTextColor(120);
      doc.text('Gráfico disponível apenas no sistema', 14, cursorY);
      doc.setTextColor(0);
      cursorY += 8;
    }

    // Tabela de métricas
    autoTable(doc, {
      startY: cursorY,
      head: [['Estágio', 'Contatos', '% vs. Anterior', '% vs. Topo']],
      body: stages.map((s, index) => [
        s.nome,
        String(s.count),
        formatPct(s.pctVsAnterior, index === 0),
        formatPctTopo(s.pctVsTopo, index === 0),
      ]),
      styles: { fontSize: 10, cellPadding: 4 },
      headStyles: { fillColor: [123, 30, 46] }, // vinho primary
      alternateRowStyles: { fillColor: [250, 246, 240] },
      columnStyles: {
        0: { cellWidth: 70 },
        1: { cellWidth: 25, halign: 'right' },
        2: { cellWidth: 35, halign: 'right' },
        3: { cellWidth: 30, halign: 'right' },
      },
    });

    doc.save(nomeArquivo(boardNome, 'pdf'));
    toast.success('PDF exportado');
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'erro desconhecido';
    toast.error(`Erro ao exportar PDF: ${msg}`);
  }
}
