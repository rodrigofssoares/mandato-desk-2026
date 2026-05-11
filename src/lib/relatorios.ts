/**
 * Constantes e tipos específicos da feature de Relatórios.
 * Mantido separado de dashboardLayout.ts para não afetar widgets do Dashboard
 * (que persistem ChartViewType e validam via CHART_VIEW_TYPES).
 */

export const REPORT_CHART_VIEW_TYPES = [
  'bar-horizontal',
  'bar-vertical',
  'pie',
  'funnel',
] as const;

export type ReportChartViewType = (typeof REPORT_CHART_VIEW_TYPES)[number];

export const REPORT_CHART_VIEW_LABELS: Record<ReportChartViewType, string> = {
  'bar-horizontal': 'Barras horizontais',
  'bar-vertical': 'Barras verticais',
  pie: 'Pizza',
  funnel: 'Funil',
};

/**
 * Sanitiza um nome para uso em nome de arquivo de download.
 * Remove / \ ? * : | < > " e substitui espaços por traços.
 */
export function sanitizarNomeArquivo(nome: string): string {
  return nome
    .replace(/[/\\?*:|<>"]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
}
