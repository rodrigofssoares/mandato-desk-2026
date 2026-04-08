const EMOJI_REGEX = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu;

const PREPOSITIONS = ['de', 'da', 'do', 'dos', 'das', 'e'];

/**
 * Normaliza telefone: remove não-dígitos e adiciona prefixo 55 se necessário.
 * Retorna string vazia se input vazio.
 */
export function normalizePhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (!digits.startsWith('55') && (digits.length === 10 || digits.length === 11)) {
    return `55${digits}`;
  }
  return digits;
}

/**
 * Normaliza nome: remove emojis, aplica Title Case respeitando preposições pt-BR.
 * Primeira palavra sempre capitalizada.
 */
export function normalizeName(name: string): string {
  if (!name) return '';
  const cleaned = name
    .replace(EMOJI_REGEX, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return '';

  return cleaned
    .split(' ')
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && PREPOSITIONS.includes(lower)) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

/**
 * Normaliza email: remove emojis, converte para minúsculas, remove espaços.
 */
export function normalizeEmail(email: string): string {
  if (!email) return '';
  return email
    .replace(EMOJI_REGEX, '')
    .replace(/\s/g, '')
    .toLowerCase()
    .trim();
}
