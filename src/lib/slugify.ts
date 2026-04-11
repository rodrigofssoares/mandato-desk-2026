/**
 * Normaliza uma string para um slug seguro para usar como `chave` em
 * `campos_personalizados.chave`. Remove acentos, caracteres especiais
 * e espaços. Comportamento espelha a função SQL `slugify_campo()`.
 *
 * @example
 *   slugify("Cargo Liderança") // "cargo_lideranca"
 *   slugify("Nº Dependentes")  // "n_dependentes"
 *   slugify("  espaços  ")     // "espacos"
 */
export function slugify(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
