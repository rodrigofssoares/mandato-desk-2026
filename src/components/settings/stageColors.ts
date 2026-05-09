/**
 * Paleta + helpers de cores pra estágios de board e similares.
 *
 * Aceita 2 formatos no campo `cor` (legacy + novo):
 *   - **Legacy**: nome curto Tailwind (`'sky'`, `'violet'`, `'emerald'`, etc.)
 *     ainda no banco de dados pra estágios criados antes da migração.
 *   - **Novo (hex)**: qualquer string `#RRGGBB` — usuário pode escolher
 *     qualquer cor via ColorPicker, não fica preso à paleta fixa.
 *
 * Os componentes de UI consomem essas cores via:
 *   - `stageColorStyle(cor)` → `{ backgroundColor: hex }` inline (preferido — funciona pra hex E legacy)
 *   - `stageDotClass(cor)` / `stageBgClass(cor)` / `stageTextClass(cor)` →
 *     classes Tailwind (mantidos pra compat com legacy paths que ainda
 *     dependem disso). Pra hex novo, retornam string vazia + você usa style inline.
 */

export const STAGE_COLORS = [
  'sky',
  'violet',
  'indigo',
  'emerald',
  'amber',
  'rose',
  'cyan',
  'orange',
] as const;

export type StageColor = (typeof STAGE_COLORS)[number];

/**
 * Mapeamento dos nomes legacy → hex equivalente. Usado por `colorToHex()`
 * pra normalizar cores legacy quando precisamos de style inline.
 */
const STAGE_LEGACY_HEX: Record<StageColor, string> = {
  sky:     '#0EA5E9',
  violet:  '#8B5CF6',
  indigo:  '#6366F1',
  emerald: '#10B981',
  amber:   '#F59E0B',
  rose:    '#F43F5E',
  cyan:    '#06B6D4',
  orange:  '#F97316',
};

/**
 * Paleta sugerida pra novos estágios — agora em hex puro pra integrar
 * com o ColorPicker do design system. Ordem segue a paleta do `STAGE_COLORS`
 * legacy pra manter consistência visual ao migrar.
 */
export const STAGE_HEX_PRESETS = [
  STAGE_LEGACY_HEX.sky,
  STAGE_LEGACY_HEX.violet,
  STAGE_LEGACY_HEX.indigo,
  STAGE_LEGACY_HEX.emerald,
  STAGE_LEGACY_HEX.amber,
  STAGE_LEGACY_HEX.rose,
  STAGE_LEGACY_HEX.cyan,
  STAGE_LEGACY_HEX.orange,
] as const;

const HEX_RE = /^#[0-9A-Fa-f]{6}$/;

function isStageColor(value: string | null | undefined): value is StageColor {
  return !!value && (STAGE_COLORS as readonly string[]).includes(value);
}

function isHex(value: string | null | undefined): value is string {
  return !!value && HEX_RE.test(value);
}

/**
 * Converte cor (legacy ou hex) em hex string. Útil pra usar com `style={{
 * backgroundColor: ... }}` que precisa sempre de hex/rgb. Default cinza.
 */
export function colorToHex(cor: string | null | undefined): string {
  if (isHex(cor)) return cor;
  if (isStageColor(cor)) return STAGE_LEGACY_HEX[cor];
  return '#94A3B8'; // slate-400 fallback
}

/**
 * Retorna estilo inline com a cor de fundo correta. Funciona com hex E
 * legacy nomes. PREFIRA esse helper a stageDotClass quando renderizar
 * um swatch — funciona com qualquer hex que o usuário escolheu.
 */
export function stageColorStyle(cor: string | null | undefined): { backgroundColor: string } {
  return { backgroundColor: colorToHex(cor) };
}

/* ─── Helpers legacy (className) — mantidos pra compat ─────────────────────
 * Componentes antigos usam stageDotClass etc. com Tailwind JIT. Pra cor
 * legacy retornam classes pré-existentes; pra hex, retornam string vazia
 * (caller deve usar stageColorStyle inline).
 */

const BG_CLASS_500: Record<StageColor, string> = {
  sky:     'bg-sky-500',
  violet:  'bg-violet-500',
  indigo:  'bg-indigo-500',
  emerald: 'bg-emerald-500',
  amber:   'bg-amber-500',
  rose:    'bg-rose-500',
  cyan:    'bg-cyan-500',
  orange:  'bg-orange-500',
};

const BG_CLASS_100: Record<StageColor, string> = {
  sky:     'bg-sky-100',
  violet:  'bg-violet-100',
  indigo:  'bg-indigo-100',
  emerald: 'bg-emerald-100',
  amber:   'bg-amber-100',
  rose:    'bg-rose-100',
  cyan:    'bg-cyan-100',
  orange:  'bg-orange-100',
};

const TEXT_CLASS: Record<StageColor, string> = {
  sky:     'text-sky-700',
  violet:  'text-violet-700',
  indigo:  'text-indigo-700',
  emerald: 'text-emerald-700',
  amber:   'text-amber-700',
  rose:    'text-rose-700',
  cyan:    'text-cyan-700',
  orange:  'text-orange-700',
};

/** @deprecated Prefira `stageColorStyle()` (inline) pra suportar hex livre. */
export function stageDotClass(cor: string | null | undefined): string {
  return isStageColor(cor) ? BG_CLASS_500[cor] : '';
}

/** @deprecated Prefira `stageColorStyle()` ou alpha-bg via inline + opacity. */
export function stageBgClass(cor: string | null | undefined): string {
  return isStageColor(cor) ? BG_CLASS_100[cor] : '';
}

/** @deprecated Prefira hex direto via inline. */
export function stageTextClass(cor: string | null | undefined): string {
  return isStageColor(cor) ? TEXT_CLASS[cor] : '';
}

/**
 * Retorna a próxima cor sugerida pra um novo estágio (ciclando pela paleta).
 * Agora retorna hex direto — novos estágios criados serão hex.
 */
export function nextStageColor(index: number): string {
  return STAGE_HEX_PRESETS[index % STAGE_HEX_PRESETS.length];
}
