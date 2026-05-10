// Helpers compartilhados pelas Edge Functions Z-API.

export const ZAPI_BASE = 'https://api.z-api.io/instances';

/** Remove tudo que não é dígito. */
export function digitsOnly(input: string): string {
  return input.replace(/\D+/g, '');
}

/**
 * Normaliza pro formato Z-API (DDI+DDD+número, somente dígitos).
 * - "(11) 99999-9999"   → "5511999999999" (anexa 55 quando 10/11 dígitos)
 * - "+55 11 99999-9999" → "5511999999999"
 * - "5511999999999"     → "5511999999999"
 */
export function normalizePhoneForZapi(input: string): string {
  const d = digitsOnly(input);
  if (d.length === 10 || d.length === 11) return `55${d}`;
  return d;
}

/** Valida formato E.164 sem +: 10-15 dígitos. */
export function isValidPhone(normalized: string): boolean {
  return /^\d{10,15}$/.test(normalized);
}

/** Trunca string preservando intenção. */
export function truncatePreview(text: string, max = 200): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3)}...`;
}

/** Extrai a extensão de um filename (sem o ponto). 'invoice.pdf' → 'pdf'. */
export function extractExtension(filename: string | undefined | null): string {
  if (!filename) return 'any';
  const idx = filename.lastIndexOf('.');
  if (idx <= 0 || idx === filename.length - 1) return 'any';
  return filename.slice(idx + 1).toLowerCase().replace(/[^a-z0-9]/g, '') || 'any';
}

/** Mapa de mime → extensão fallback (quando filename não tem extensão). */
export function extensionFromMime(mime: string | undefined | null): string {
  if (!mime) return 'any';
  const m = mime.toLowerCase();
  if (m.includes('pdf')) return 'pdf';
  if (m.includes('msword') || m.includes('officedocument.wordprocessingml')) return 'docx';
  if (m.includes('excel') || m.includes('spreadsheetml')) return 'xlsx';
  if (m.includes('presentationml') || m.includes('powerpoint')) return 'pptx';
  if (m.includes('zip')) return 'zip';
  if (m.includes('plain')) return 'txt';
  if (m.includes('csv')) return 'csv';
  return 'any';
}
