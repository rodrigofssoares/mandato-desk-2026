/**
 * Utilitários compartilhados para exportação CSV/XLSX.
 */

/** Baixa conteúdo de texto como arquivo */
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob(['\uFEFF' + content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Neutraliza CSV injection: valores que começam com = + - @ (ou tab/CR) podem
 * ser interpretados como fórmula pelo Excel/LibreOffice. Prefixa com aspa simples.
 */
function escapeCSVFormula(val: string): string {
  return /^[=+\-@\t\r]/.test(val) ? `'${val}` : val;
}

/** Gera CSV com delimitador ; e campos entre aspas duplas (anti-fórmula) */
export function rowsToCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const cell = (raw: string) => `"${escapeCSVFormula(raw).replace(/"/g, '""')}"`;
  const lines = [
    headers.map((h) => cell(String(h))).join(';'),
    ...rows.map((row) =>
      headers.map((h) => cell(String(row[h] ?? ''))).join(';')
    ),
  ];
  return lines.join('\n');
}

/** Gera e baixa arquivo XLSX com larguras de coluna */
export async function downloadXLSX(
  rows: Record<string, unknown>[],
  filename: string,
  sheetName: string,
  colWidths?: { wch: number }[]
) {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.json_to_sheet(rows);
  if (colWidths) {
    ws['!cols'] = colWidths;
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

/** Retorna data formatada para nome de arquivo: YYYY-MM-DD */
export function dateForFilename(): string {
  return new Date().toISOString().split('T')[0];
}
