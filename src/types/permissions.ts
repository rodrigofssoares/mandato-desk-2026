export const ROLES = ['admin', 'proprietario', 'assessor', 'assistente', 'estagiario'] as const;
export type Role = typeof ROLES[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrador',
  proprietario: 'Proprietario',
  assessor: 'Assessor',
  assistente: 'Assistente',
  estagiario: 'Estagiario',
};

export const ROLE_LEVELS: Record<Role, number> = {
  admin: 100,
  proprietario: 80,
  assessor: 50,
  assistente: 30,
  estagiario: 20,
};

export const SECOES = [
  'dashboard', 'contatos', 'liderancas', 'demandas', 'etiquetas',
  'mapa', 'importacao', 'usuarios', 'google', 'api',
  'webhooks', 'personalizacao', 'permissoes', 'relatorios'
] as const;
export type Secao = typeof SECOES[number];

export const SECAO_LABELS: Record<Secao, string> = {
  dashboard: 'Dashboard',
  contatos: 'Contatos',
  liderancas: 'Liderancas',
  demandas: 'Demandas',
  etiquetas: 'Etiquetas',
  mapa: 'Mapa de Leads',
  importacao: 'Importacao',
  usuarios: 'Usuarios',
  google: 'Google Contacts',
  api: 'API',
  webhooks: 'Webhooks',
  personalizacao: 'Personalizacao',
  permissoes: 'Permissoes',
  relatorios: 'Relatorios',
};
