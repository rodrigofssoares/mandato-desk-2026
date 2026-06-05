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
  'secao',
] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

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

/** Situações booleanas que o formulário pode marcar no contato (whitelist RPC). */
export const SITUACOES_CONTATO = [
  { value: 'declarou_voto', label: 'Declarou voto' },
  { value: 'is_favorite', label: 'Favorito' },
  { value: 'e_multiplicador', label: 'É multiplicador' },
  { value: 'aceita_whatsapp', label: 'Aceita WhatsApp' },
  { value: 'optin_whatsapp', label: 'Opt-in WhatsApp' },
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

export interface AgradecimentoFormulario {
  titulo: string;
  mensagem: string;
}

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
  mover_stage_id: string | null;
  ranking_pontos: number;
  marcar_situacao: Record<string, boolean>;
  origem: string | null;
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

export interface FormularioInput {
  titulo: string;
  slug?: string;
  descricao?: string | null;
}

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
