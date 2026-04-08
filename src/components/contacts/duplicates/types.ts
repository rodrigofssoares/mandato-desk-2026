export interface DuplicateContactTag {
  id: string;
  nome: string;
  cor?: string | null;
  categoria?: string | null;
}

export type MergeableFieldKey =
  | 'nome' | 'whatsapp' | 'email' | 'telefone' | 'genero' | 'data_nascimento'
  | 'logradouro' | 'numero' | 'complemento' | 'bairro' | 'cidade' | 'estado' | 'cep'
  | 'instagram' | 'twitter' | 'tiktok' | 'youtube'
  | 'declarou_voto' | 'ranking' | 'leader_id' | 'origem'
  | 'observacoes' | 'notas_assessor' | 'is_favorite' | 'ultimo_contato' | 'em_canal_whatsapp';

export const MERGEABLE_FIELDS: { key: MergeableFieldKey; label: string }[] = [
  { key: 'nome', label: 'Nome' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'email', label: 'E-mail' },
  { key: 'telefone', label: 'Telefone' },
  { key: 'genero', label: 'Genero' },
  { key: 'data_nascimento', label: 'Data de Nascimento' },
  { key: 'logradouro', label: 'Logradouro' },
  { key: 'numero', label: 'Numero' },
  { key: 'complemento', label: 'Complemento' },
  { key: 'bairro', label: 'Bairro' },
  { key: 'cidade', label: 'Cidade' },
  { key: 'estado', label: 'Estado' },
  { key: 'cep', label: 'CEP' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'twitter', label: 'Twitter' },
  { key: 'tiktok', label: 'TikTok' },
  { key: 'youtube', label: 'YouTube' },
  { key: 'declarou_voto', label: 'Declarou Voto' },
  { key: 'ranking', label: 'Ranking' },
  { key: 'leader_id', label: 'Articulador' },
  { key: 'origem', label: 'Origem' },
  { key: 'observacoes', label: 'Observacoes' },
  { key: 'notas_assessor', label: 'Notas do Assessor' },
  { key: 'is_favorite', label: 'Favorito' },
  { key: 'ultimo_contato', label: 'Ultimo Contato' },
  { key: 'em_canal_whatsapp', label: 'Em Canal WhatsApp' },
];
