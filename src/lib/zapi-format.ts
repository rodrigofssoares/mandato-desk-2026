/** Formata um telefone Z-API (5511999998888 ou similar) pro display BR. */
export function formatPhone(raw: string): string {
  const d = raw.replace(/\D+/g, '');
  if (d.startsWith('55') && d.length >= 12) {
    const ddd = d.slice(2, 4);
    const num = d.slice(4);
    if (num.length === 9) return `+55 (${ddd}) ${num.slice(0, 5)}-${num.slice(5)}`;
    if (num.length === 8) return `+55 (${ddd}) ${num.slice(0, 4)}-${num.slice(4)}`;
  }
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return raw;
}

/**
 * Retorna true se o phone NÃO é um telefone real — isto é, é um LID ou
 * identificador de grupo/canal com mais de 13 dígitos.
 *
 * Critério: phone contém '@lid' OU após remover não-dígitos tem > 13 chars.
 * Telefones BR reais têm ≤ 13 dígitos (5511999998888 = 13).
 * LIDs têm 15 dígitos; grupos têm 16-18 dígitos.
 *
 * Uso: evitar exibir o identificador numérico cru como subtítulo.
 */
export function isNonRealPhone(phone: string): boolean {
  if (phone.includes('@lid')) return true;
  const digitsOnly = phone.replace(/\D+/g, '');
  return digitsOnly.length > 13;
}
