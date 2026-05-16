// Helpers compartilhados pelas Edge Functions Z-API.

export const ZAPI_BASE = 'https://api.z-api.io/instances';

/** Remove tudo que não é dígito. */
export function digitsOnly(input: string): string {
  return input.replace(/\D+/g, '');
}

/**
 * Normaliza pro formato Z-API canônico (DDI+DDD+número, somente dígitos),
 * fixando SEMPRE o 9º dígito de celulares brasileiros.
 *
 * - "(11) 99999-9999"   → "5511999999999" (anexa 55 quando 10/11 dígitos)
 * - "+55 11 99999-9999" → "5511999999999"
 * - "5511999999999"     → "5511999999999"
 * - "551184299707"      → "5511984299707" (insere o 9 que faltava no celular)
 *
 * Por que canonicalizar o 9º dígito: a Z-API entrega o `phone` de mensagens
 * RECEBIDAS ora com, ora sem o 9 (depende do JID do WhatsApp do contato),
 * enquanto o ENVIO normalmente parte de um número com o 9. Sem fixar uma
 * forma única, inbound e outbound caem em chats diferentes pro mesmo contato.
 * Padronizamos COM o 9 (forma moderna, igual à usada no cadastro de contatos).
 */
export function normalizePhoneForZapi(input: string): string {
  let d = digitsOnly(input);
  // Anexa DDI 55 quando vier só DDD + número (10 ou 11 dígitos).
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  // Celular BR sem o 9: 55 + DDD(2) + local(8) começando com 6-9.
  // (Telefone fixo começa com 2-5 e NÃO recebe o 9.)
  if (d.length === 12 && d.startsWith('55')) {
    const ddd = d.slice(2, 4);
    const local = d.slice(4);
    if (/^[6-9]/.test(local)) d = `55${ddd}9${local}`;
  }
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
