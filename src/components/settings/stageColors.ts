/**
 * Paleta de cores para estágios de board.
 *
 * As cores são guardadas no banco como strings Tailwind (ex: "sky").
 * Tailwind JIT precisa ver as classes completas no código-fonte para gerá-las,
 * então usamos um map estático em vez de `bg-${cor}-500` dinâmico.
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

const BG_CLASS_500: Record<StageColor, string> = {
  sky: 'bg-sky-500',
  violet: 'bg-violet-500',
  indigo: 'bg-indigo-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  cyan: 'bg-cyan-500',
  orange: 'bg-orange-500',
};

const BG_CLASS_100: Record<StageColor, string> = {
  sky: 'bg-sky-100 dark:bg-sky-900/30',
  violet: 'bg-violet-100 dark:bg-violet-900/30',
  indigo: 'bg-indigo-100 dark:bg-indigo-900/30',
  emerald: 'bg-emerald-100 dark:bg-emerald-900/30',
  amber: 'bg-amber-100 dark:bg-amber-900/30',
  rose: 'bg-rose-100 dark:bg-rose-900/30',
  cyan: 'bg-cyan-100 dark:bg-cyan-900/30',
  orange: 'bg-orange-100 dark:bg-orange-900/30',
};

const TEXT_CLASS: Record<StageColor, string> = {
  sky: 'text-sky-700 dark:text-sky-300',
  violet: 'text-violet-700 dark:text-violet-300',
  indigo: 'text-indigo-700 dark:text-indigo-300',
  emerald: 'text-emerald-700 dark:text-emerald-300',
  amber: 'text-amber-700 dark:text-amber-300',
  rose: 'text-rose-700 dark:text-rose-300',
  cyan: 'text-cyan-700 dark:text-cyan-300',
  orange: 'text-orange-700 dark:text-orange-300',
};

function isStageColor(value: string | null | undefined): value is StageColor {
  return !!value && (STAGE_COLORS as readonly string[]).includes(value);
}

/** Classe Tailwind `bg-{cor}-500` para o dot colorido. */
export function stageDotClass(cor: string | null | undefined): string {
  return isStageColor(cor) ? BG_CLASS_500[cor] : 'bg-slate-400';
}

/** Classe Tailwind `bg-{cor}-100` para o fundo pastel do stage. */
export function stageBgClass(cor: string | null | undefined): string {
  return isStageColor(cor) ? BG_CLASS_100[cor] : 'bg-slate-100 dark:bg-slate-800/40';
}

/** Classe Tailwind `text-{cor}-700` para texto sobre fundo pastel. */
export function stageTextClass(cor: string | null | undefined): string {
  return isStageColor(cor) ? TEXT_CLASS[cor] : 'text-slate-700 dark:text-slate-300';
}

/** Retorna a próxima cor da paleta, ciclando. */
export function nextStageColor(index: number): StageColor {
  return STAGE_COLORS[index % STAGE_COLORS.length];
}
