// RAQ-MAND-EM054 — Tipos do Construtor de Formulários Web
//
// NOTA: as tabelas formularios/formulario_campos/formulario_respostas ainda não
// estão em src/integrations/supabase/types.ts (migrations 114-116 pendentes de
// aplicação). Estes tipos locais são a fonte da verdade até o Rodrigo rodar
// `npx supabase gen types typescript --linked > src/integrations/supabase/types.ts`.
// Depois disso, podem ser substituídos por Tables<'formularios'> etc., mas estes
// tipos de domínio (FieldType, DESTINOS_CONTATO, etc.) continuam úteis.

import { supabase } from '@/integrations/supabase/client';

/** Cliente Supabase sem tipagem estrita — usado só para as 3 tabelas novas
 *  até o types.ts ser regenerado. Remover o cast quando os tipos existirem. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const sbForms = supabase as any;

// ── Tipos de campo ────────────────────────────────────────────────
export const FIELD_TYPES = [
  'texto_curto',
  'paragrafo',
  'telefone',
  'email',
  'cpf',
  'escolha_unica',
  'checkboxes',
  'lista',
  'data',
  'imagem',
  'video',
  'secao',
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

/** Tipos decorativos (sem input / não entram no mapeamento nem na validação). */
export const FIELD_TYPES_DECORATIVOS: FieldType[] = ['secao', 'imagem', 'video'];

/** Tipos que possuem lista de opções editáveis. */
export const FIELD_TYPES_COM_OPCOES: FieldType[] = ['escolha_unica', 'checkboxes', 'lista'];

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  texto_curto: 'Texto curto',
  paragrafo: 'Parágrafo',
  telefone: 'Telefone',
  email: 'E-mail',
  cpf: 'CPF',
  escolha_unica: 'Múltipla escolha',
  checkboxes: 'Caixas de seleção',
  lista: 'Lista suspensa',
  data: 'Data',
  imagem: 'Imagem',
  video: 'Vídeo',
  secao: 'Seção / título',
};

/** Ícone lucide sugerido por tipo (nome do ícone). */
export const FIELD_TYPE_ICONS: Record<FieldType, string> = {
  texto_curto: 'Type',
  paragrafo: 'AlignLeft',
  telefone: 'Phone',
  email: 'Mail',
  cpf: 'CreditCard',
  escolha_unica: 'CircleDot',
  checkboxes: 'CheckSquare',
  lista: 'List',
  data: 'Calendar',
  imagem: 'Image',
  video: 'Video',
  secao: 'Heading',
};

// ── Destinos de mapeamento (colunas de contacts permitidas — whitelist) ──
//  DEVE espelhar a whitelist da RPC formulario_processar_resposta (migration 116).
export const DESTINOS_CONTATO = [
  { value: 'nome', label: 'Nome' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'telefone', label: 'Telefone' },
  { value: 'email', label: 'E-mail' },
  { value: 'cpf', label: 'CPF' },
  { value: 'bairro', label: 'Bairro' },
  { value: 'cidade', label: 'Cidade' },
  { value: 'estado', label: 'Estado' },
  { value: 'cep', label: 'CEP' },
  { value: 'logradouro', label: 'Logradouro' },
  { value: 'numero', label: 'Número' },
  { value: 'profissao', label: 'Profissão' },
  { value: 'data_nascimento', label: 'Data de nascimento' },
  { value: 'observacoes', label: 'Observações' },
] as const;

/** Situações booleanas que o formulário pode marcar no contato (whitelist RPC).
 *  NÃO inclui optin_whatsapp/aceita_whatsapp: têm proteção LGPD (trigger mig 076)
 *  e semântica de ranking — não podem ser setados via UPDATE direto da RPC pública. */
export const SITUACOES_CONTATO = [
  { value: 'declarou_voto', label: 'Declarou voto' },
  { value: 'is_favorite', label: 'Favorito' },
  { value: 'e_multiplicador', label: 'É multiplicador' },
] as const;

// ── Status / dedup ───────────────────────────────────────────────
export type FormularioStatus = 'rascunho' | 'agendado' | 'ativo' | 'encerrado';
export const STATUS_LABELS: Record<FormularioStatus, string> = {
  rascunho: 'Rascunho',
  agendado: 'Agendado',
  ativo: 'Ativo',
  encerrado: 'Encerrado',
};

export type DedupCampo = 'whatsapp' | 'cpf' | 'nenhum';
export type DedupAcao = 'mesclar' | 'criar' | 'ignorar';

// ── Estruturas JSON ──────────────────────────────────────────────
export interface OpcaoCampo {
  label: string;
  value: string;
  ranking_pontos?: number;
}

export interface TemaFormulario {
  cor: string;
  cantos: 'arredondado' | 'reto' | 'pilula';
  fundo: 'bege' | 'branco' | 'degrade';
  mostrar_logo: boolean;
}

// ── Botões de rede social na tela de agradecimento (v2) ──────────────────────
export type RedeSocial = 'instagram' | 'whatsapp' | 'tiktok' | 'youtube' | 'facebook' | 'site';

export interface BotaoSocial {
  rede: RedeSocial;
  label: string;
  url: string;
}

/** Presets dos botões padrão (ícone lucide + cor da marca). O usuário só cola a URL. */
export const REDES_SOCIAIS: Record<RedeSocial, { label: string; icone: string; cor: string; placeholder: string }> = {
  instagram: { label: 'Instagram', icone: 'Instagram', cor: '#E4405F', placeholder: 'https://instagram.com/...' },
  whatsapp:  { label: 'WhatsApp',  icone: 'MessageCircle', cor: '#25D366', placeholder: 'https://wa.me/55...' },
  tiktok:    { label: 'TikTok',    icone: 'Music2', cor: '#000000', placeholder: 'https://tiktok.com/@...' },
  youtube:   { label: 'YouTube',   icone: 'Youtube', cor: '#FF0000', placeholder: 'https://youtube.com/@...' },
  facebook:  { label: 'Facebook',  icone: 'Facebook', cor: '#1877F2', placeholder: 'https://facebook.com/...' },
  site:      { label: 'Site',      icone: 'Globe', cor: '#7B1E2E', placeholder: 'https://...' },
};

export type MidiaTipo = 'imagem' | 'video';

export interface AgradecimentoFormulario {
  titulo: string;
  mensagem: string;
  midia_url?: string | null;
  midia_tipo?: MidiaTipo | null;
  botoes?: BotaoSocial[];
}

/** Destinos de mapeamento de campo para uma Demanda (whitelist espelha a RPC mig 120). */
export const DESTINOS_DEMANDA = [
  { value: 'title', label: 'Título da demanda' },
  { value: 'description', label: 'Descrição' },
  { value: 'neighborhood', label: 'Bairro' },
] as const;

export type DemandaPriority = 'low' | 'medium' | 'high';
export const DEMANDA_PRIORITY_LABELS: Record<DemandaPriority, string> = {
  low: 'Baixa', medium: 'Média', high: 'Alta',
};

// ── Entidades ────────────────────────────────────────────────────
export interface FormularioCampo {
  id: string;
  form_id: string;
  ordem: number;
  tipo: FieldType;
  rotulo: string;
  ajuda: string | null;
  obrigatorio: boolean;
  min_chars: number | null;
  max_chars: number | null;
  validar_formato: boolean;
  opcoes: OpcaoCampo[];
  mapear_destino_1: string | null;
  mapear_destino_2: string | null;
  /** Destino na Demanda quando o formulário cria demanda (title|description|neighborhood). */
  mapear_demanda: string | null;
  largura: '100' | '50';
  config: Record<string, unknown>;
  created_at?: string;
}

export interface Formulario {
  id: string;
  titulo: string;
  slug: string;
  descricao: string | null;
  capa_url: string | null;
  status: FormularioStatus;
  publicado: boolean;
  abre_em: string | null;
  encerra_em: string | null;
  tema: TemaFormulario;
  agradecimento: AgradecimentoFormulario;
  dedup_campo: DedupCampo;
  dedup_acao: DedupAcao;
  aplicar_etiquetas: string[];
  mover_board_id: string | null;
  mover_stage_id: string | null;
  ranking_pontos: number;
  marcar_situacao: Record<string, boolean>;
  origem: string | null;
  criar_demanda: boolean;
  demanda_priority: DemandaPriority;
  max_respostas: number | null;
  total_visitas: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Formulário com a contagem de respostas (para a lista/métricas). */
export interface FormularioComMetricas extends Formulario {
  total_respostas: number;
}

/** Uma resposta enviada (aba Resultados). */
export interface FormularioResposta {
  id: string;
  form_id: string;
  contact_id: string | null;
  dados: Record<string, string | string[]>;
  status: 'processado' | 'erro';
  erro: string | null;
  created_at: string;
  /** Nome do contato vinculado (join opcional). */
  contato_nome?: string | null;
}

export interface FormularioInput {
  titulo: string;
  slug?: string;
  descricao?: string | null;
  /** Campos pré-construídos (usado por modelos prontos). */
  campos?: CampoTemplate[];
}

// ── Preenchimento inteligente: defaults por tipo de campo ────────────────────

export interface CampoPadrao {
  rotulo: string;
  ajuda?: string | null;
  validar_formato?: boolean;
  mapear_destino_1?: string | null;
  obrigatorio?: boolean;
  opcoes?: OpcaoCampo[];
}

/** Rótulo/ajuda/mapeamento padrão sugeridos ao adicionar um campo (tudo editável). */
export function camposPadraoPorTipo(tipo: FieldType): CampoPadrao {
  switch (tipo) {
    case 'email':
      return { rotulo: 'E-mail', validar_formato: true, mapear_destino_1: 'email' };
    case 'cpf':
      return { rotulo: 'CPF', validar_formato: true, mapear_destino_1: 'cpf' };
    case 'telefone':
      return {
        rotulo: 'WhatsApp (com DDD)',
        ajuda: 'Por favor, digite o DDD, depois o número.',
        validar_formato: true,
        mapear_destino_1: 'whatsapp',
      };
    case 'data':
      return { rotulo: 'Data' };
    default:
      // texto_curto, paragrafo, escolha_unica, checkboxes, lista, imagem, video, secao
      return { rotulo: '' };
  }
}

// ── Modelos prontos de formulário ("formulários padrão") ─────────────────────

export interface CampoTemplate extends CampoPadrao {
  tipo: FieldType;
}

export interface FormularioTemplate {
  id: string;
  nome: string;
  descricao: string;
  /** Nome de ícone lucide. */
  icone: string;
  campos: CampoTemplate[];
}

export const FORMULARIO_TEMPLATES: FormularioTemplate[] = [
  {
    id: 'branco',
    nome: 'Em branco',
    descricao: 'Comece do zero e monte do seu jeito.',
    icone: 'FilePlus2',
    campos: [],
  },
  {
    id: 'captacao',
    nome: 'Captação de contato',
    descricao: 'Nome, WhatsApp, e-mail e bairro — já mapeados para o contato.',
    icone: 'UserPlus',
    campos: [
      { tipo: 'texto_curto', rotulo: 'Nome completo', obrigatorio: true, mapear_destino_1: 'nome' },
      { tipo: 'telefone', rotulo: 'WhatsApp (com DDD)', ajuda: 'Por favor, digite o DDD, depois o número.', obrigatorio: true, validar_formato: true, mapear_destino_1: 'whatsapp' },
      { tipo: 'email', rotulo: 'E-mail', validar_formato: true, mapear_destino_1: 'email' },
      { tipo: 'texto_curto', rotulo: 'Bairro', mapear_destino_1: 'bairro' },
    ],
  },
  {
    id: 'pesquisa',
    nome: 'Pesquisa / votação',
    descricao: 'Nome, WhatsApp e uma pergunta de escolha única.',
    icone: 'ListChecks',
    campos: [
      { tipo: 'texto_curto', rotulo: 'Nome completo', obrigatorio: true, mapear_destino_1: 'nome' },
      { tipo: 'telefone', rotulo: 'WhatsApp (com DDD)', ajuda: 'Por favor, digite o DDD, depois o número.', obrigatorio: true, validar_formato: true, mapear_destino_1: 'whatsapp' },
      {
        tipo: 'escolha_unica',
        rotulo: 'Qual a sua prioridade?',
        obrigatorio: true,
        opcoes: [
          { label: 'Opção 1', value: 'opcao_1' },
          { label: 'Opção 2', value: 'opcao_2' },
          { label: 'Opção 3', value: 'opcao_3' },
        ],
      },
    ],
  },
  {
    id: 'evento',
    nome: 'Inscrição em evento',
    descricao: 'Nome, WhatsApp, e-mail e confirmação de presença.',
    icone: 'CalendarCheck',
    campos: [
      { tipo: 'texto_curto', rotulo: 'Nome completo', obrigatorio: true, mapear_destino_1: 'nome' },
      { tipo: 'telefone', rotulo: 'WhatsApp (com DDD)', ajuda: 'Por favor, digite o DDD, depois o número.', obrigatorio: true, validar_formato: true, mapear_destino_1: 'whatsapp' },
      { tipo: 'email', rotulo: 'E-mail', validar_formato: true, mapear_destino_1: 'email' },
      {
        tipo: 'escolha_unica',
        rotulo: 'Você vai comparecer?',
        obrigatorio: true,
        opcoes: [
          { label: 'Sim, confirmo presença', value: 'sim' },
          { label: 'Talvez', value: 'talvez' },
          { label: 'Não poderei ir', value: 'nao' },
        ],
      },
    ],
  },
];

// ── Shape público (retorno de formulario_obter_publico) ──────────
export interface CampoPublico {
  id: string;
  tipo: FieldType;
  rotulo: string;
  ajuda: string | null;
  obrigatorio: boolean;
  min_chars: number | null;
  max_chars: number | null;
  validar_formato: boolean;
  opcoes: OpcaoCampo[];
  largura: '100' | '50';
  config: Record<string, unknown>;
}

export interface FormularioPublico {
  id: string;
  titulo: string;
  descricao: string | null;
  capa_url: string | null;
  tema: TemaFormulario;
  agradecimento: AgradecimentoFormulario;
  campos: CampoPublico[];
}

export type RetornoPublico =
  | FormularioPublico
  | { erro: 'nao_encontrado' }
  | { erro: 'encerrado'; titulo?: string; agradecimento?: AgradecimentoFormulario }
  | { erro: 'nao_iniciado'; abre_em?: string }
  | { erro: 'limite_atingido' };

/** Gera um slug a partir de um título. */
export function slugify(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 120);
}
