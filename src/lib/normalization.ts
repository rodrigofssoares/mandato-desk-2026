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
 * Chave canônica p/ comparar telefones. Normaliza:
 *   1. DDI 55 — `+55`, `55`, sem DDI viram a mesma chave
 *   2. Nono dígito brasileiro — celulares antigos sem 9 batem com pós-2014
 *      (ex: `554891932106` e `5548991932106` são o mesmo numero móvel,
 *      Florianópolis/SC; o 9 só virou obrigatório em 2014)
 *
 * Ex.:
 *   "+5511930423594"  -> "11930423594"
 *   "5511930423594"   -> "11930423594"
 *   "11930423594"     -> "11930423594"
 *   "(11) 93042-3594" -> "11930423594"
 *   "554891932106"    -> "48991932106"  (adiciona 9 — móvel sem)
 *   "5548991932106"   -> "48991932106"
 *   "1140001234"      -> "1140001234"   (fixo: começa com 4, não toca)
 *
 * Retorna string vazia quando não há dígitos suficientes.
 */
export function phoneComparisonKey(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  // 1. Remove DDI 55 quando presente (12 ou 13 dígitos começando com 55)
  let local = digits;
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    local = digits.slice(2);
  }
  // 2. Nono dígito: se vem com 10 dígitos (DDD + 8) e o primeiro depois do DDD
  // é 6, 7, 8 ou 9 — é móvel sem o 9 obrigatório. Insere o 9 pra bater com a
  // versão pós-2014. Fixos (começam com 2, 3, 4 ou 5 após DDD) não tocam.
  if (local.length === 10 && /^\d{2}[6-9]/.test(local)) {
    local = local.slice(0, 2) + '9' + local.slice(2);
  }
  return local;
}

/**
 * Formata telefone p/ exibição visual: remove o DDI 55 e aplica máscara
 * brasileira. Storage no banco fica intocado.
 *   "5511930423594"  -> "(11) 93042-3594"
 *   "+5511930423594" -> "(11) 93042-3594"
 *   "11930423594"    -> "(11) 93042-3594"
 *   "554130001234"   -> "(41) 3000-1234"
 *   "1140001234"     -> "(11) 4000-1234"
 * Para entradas que não batem com formato BR, retorna o valor original.
 */
export function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  // Tira 55 se for BR (12 ou 13 dígitos com prefixo 55)
  const local = (digits.length === 12 || digits.length === 13) && digits.startsWith('55')
    ? digits.slice(2)
    : digits;
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return phone; // formato inesperado — devolve original
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
