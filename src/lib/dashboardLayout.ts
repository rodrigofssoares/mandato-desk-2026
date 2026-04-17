import type RGL from 'react-grid-layout';

export type Layout = RGL.Layout;
export type Layouts = RGL.Layouts;

/**
 * IDs estáveis dos widgets editáveis do dashboard.
 * Os 4 StatCards ficam FIXOS no topo e não entram no grid.
 */
export const DASHBOARD_WIDGET_IDS = [
  'funnel',
  'tarefas',
  'aniversarios',
  'saude-base',
  'crescimento',
  'atividades',
  'tags',
  'voto',
] as const;

export type DashboardWidgetId = (typeof DASHBOARD_WIDGET_IDS)[number];

export const DASHBOARD_WIDGET_LABELS: Record<DashboardWidgetId, string> = {
  funnel: 'Funil do Board',
  tarefas: 'Tarefas de Hoje',
  aniversarios: 'Aniversariantes',
  'saude-base': 'Saúde da Base',
  crescimento: 'Crescimento de Contatos',
  atividades: 'Atividades Recentes',
  tags: 'Distribuição por Tags',
  voto: 'Declaração de Voto',
};

/**
 * Layout padrão em breakpoints lg (>=1024px). Grid de 12 colunas.
 * minW/minH/maxW/maxH previnem tamanhos inviáveis durante o resize.
 */
export const DEFAULT_LAYOUT_LG: Layout[] = [
  { i: 'funnel',       x: 0, y: 0,  w: 8,  h: 8, minW: 4, minH: 6, maxW: 12, maxH: 14 },
  { i: 'tarefas',      x: 8, y: 0,  w: 4,  h: 4, minW: 3, minH: 3, maxW: 6,  maxH: 8  },
  { i: 'aniversarios', x: 8, y: 4,  w: 4,  h: 4, minW: 3, minH: 3, maxW: 6,  maxH: 8  },
  { i: 'saude-base',   x: 0, y: 8,  w: 12, h: 5, minW: 4, minH: 4, maxW: 12, maxH: 8  },
  { i: 'crescimento',  x: 0, y: 13, w: 8,  h: 6, minW: 4, minH: 4, maxW: 12, maxH: 10 },
  { i: 'atividades',   x: 8, y: 13, w: 4,  h: 6, minW: 3, minH: 4, maxW: 6,  maxH: 12 },
  { i: 'tags',         x: 0, y: 19, w: 6,  h: 5, minW: 3, minH: 4, maxW: 12, maxH: 10 },
  { i: 'voto',         x: 6, y: 19, w: 6,  h: 5, minW: 3, minH: 4, maxW: 12, maxH: 10 },
];

export const DEFAULT_LAYOUT_MD: Layout[] = [
  { i: 'funnel',       x: 0, y: 0,  w: 10, h: 8, minW: 4, minH: 6 },
  { i: 'tarefas',      x: 0, y: 8,  w: 5,  h: 4, minW: 3, minH: 3 },
  { i: 'aniversarios', x: 5, y: 8,  w: 5,  h: 4, minW: 3, minH: 3 },
  { i: 'saude-base',   x: 0, y: 12, w: 10, h: 5, minW: 4, minH: 4 },
  { i: 'crescimento',  x: 0, y: 17, w: 10, h: 6, minW: 4, minH: 4 },
  { i: 'atividades',   x: 0, y: 23, w: 10, h: 6, minW: 3, minH: 4 },
  { i: 'tags',         x: 0, y: 29, w: 5,  h: 5, minW: 3, minH: 4 },
  { i: 'voto',         x: 5, y: 29, w: 5,  h: 5, minW: 3, minH: 4 },
];

export const DEFAULT_LAYOUT_SM: Layout[] = [
  { i: 'funnel',       x: 0, y: 0,  w: 6, h: 8 },
  { i: 'tarefas',      x: 0, y: 8,  w: 6, h: 4 },
  { i: 'aniversarios', x: 0, y: 12, w: 6, h: 4 },
  { i: 'saude-base',   x: 0, y: 16, w: 6, h: 5 },
  { i: 'crescimento',  x: 0, y: 21, w: 6, h: 6 },
  { i: 'atividades',   x: 0, y: 27, w: 6, h: 6 },
  { i: 'tags',         x: 0, y: 33, w: 6, h: 5 },
  { i: 'voto',         x: 0, y: 38, w: 6, h: 5 },
];

export const DEFAULT_LAYOUT_XS: Layout[] = DEFAULT_LAYOUT_SM.map((l) => ({
  ...l,
  w: 4,
}));

export const DEFAULT_LAYOUT_XXS: Layout[] = DEFAULT_LAYOUT_SM.map((l) => ({
  ...l,
  w: 2,
}));

export type DashboardLayouts = {
  lg: Layout[];
  md: Layout[];
  sm: Layout[];
  xs: Layout[];
  xxs: Layout[];
};

export const DEFAULT_LAYOUTS: DashboardLayouts = {
  lg: DEFAULT_LAYOUT_LG,
  md: DEFAULT_LAYOUT_MD,
  sm: DEFAULT_LAYOUT_SM,
  xs: DEFAULT_LAYOUT_XS,
  xxs: DEFAULT_LAYOUT_XXS,
};

export const GRID_BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
export const GRID_COLS = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 };
export const GRID_ROW_HEIGHT = 40;

/**
 * Sanitiza um Layouts vindo do banco: garante que tem todos os widgets
 * (preenchendo com default quem faltar) e remove IDs desconhecidos.
 * Isso deixa a feature tolerante a adição/remoção de widgets no futuro.
 */
export function normalizeLayouts(raw: unknown): DashboardLayouts {
  const empty: DashboardLayouts = { ...DEFAULT_LAYOUTS };
  if (!raw || typeof raw !== 'object') return empty;

  const breakpoints: (keyof DashboardLayouts)[] = ['lg', 'md', 'sm', 'xs', 'xxs'];
  const out: DashboardLayouts = { lg: [], md: [], sm: [], xs: [], xxs: [] };

  for (const bp of breakpoints) {
    const incoming = Array.isArray((raw as Record<string, unknown>)[bp])
      ? ((raw as Record<string, Layout[]>)[bp] as Layout[])
      : [];
    const known = incoming.filter((l) =>
      (DASHBOARD_WIDGET_IDS as readonly string[]).includes(l.i)
    );
    const presentIds = new Set(known.map((l) => l.i));
    const missing = DEFAULT_LAYOUTS[bp].filter((l) => !presentIds.has(l.i));
    out[bp] = [...known, ...missing];
  }

  return out;
}
