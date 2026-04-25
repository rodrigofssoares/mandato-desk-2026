import { z } from 'zod';

export const contactSchema = z.object({
  // Dados Pessoais
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(200),
  nome_whatsapp: z.string().max(200).optional().or(z.literal('')),
  whatsapp: z.string().max(20).optional().or(z.literal('')),
  em_canal_whatsapp: z.boolean().optional().default(false),
  aceita_whatsapp: z.boolean().optional().default(false),
  e_multiplicador: z.boolean().optional().default(false),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  telefone: z.string().max(20).optional().or(z.literal('')),
  genero: z.enum(['masculino', 'feminino', 'outro', 'prefiro_nao_informar']).optional().nullable(),
  data_nascimento: z.string().optional().or(z.literal('')),
  ultimo_contato: z.string().optional().or(z.literal('')),

  // Endereço
  logradouro: z.string().max(300).optional().or(z.literal('')),
  numero: z.string().max(20).optional().or(z.literal('')),
  complemento: z.string().max(200).optional().or(z.literal('')),
  bairro: z.string().max(150).optional().or(z.literal('')),
  cidade: z.string().max(150).optional().or(z.literal('')),
  estado: z.string().max(2).optional().or(z.literal('')),
  cep: z.string().max(10).optional().or(z.literal('')),

  // Redes Sociais
  instagram: z.string().max(200).optional().or(z.literal('')),
  twitter: z.string().max(200).optional().or(z.literal('')),
  tiktok: z.string().max(200).optional().or(z.literal('')),
  youtube: z.string().max(200).optional().or(z.literal('')),

  // Político
  declarou_voto: z.boolean().optional().default(false),
  ranking: z.number().min(0).max(10).optional().default(0),
  leader_id: z.string().uuid().optional().nullable().or(z.literal('')),

  // Observações
  origem: z.string().max(200).optional().or(z.literal('')),
  observacoes: z.string().max(5000).optional().or(z.literal('')),
  notas_assessor: z.string().max(5000).optional().or(z.literal('')),

  // Tags
  tag_ids: z.array(z.string().uuid()).optional().default([]),
});

export type ContactFormData = z.infer<typeof contactSchema>;

/** Remove todos os caracteres não-numéricos de um telefone e adiciona prefixo 55 */
export { normalizePhone } from './normalization';

/** Formata o nome: capitaliza cada palavra respeitando preposições pt-BR */
export { normalizeName as formatName } from './normalization';

// --- Schema de Importação ---

export const importContactSchema = z.object({
  nome_completo: z.string().min(1, 'Nome é obrigatório').max(255),
  whatsapp: z.string().max(20).optional().or(z.literal('')),
  whatsapp_habilitado: z.boolean().optional(),
  nome_whatsapp: z.string().max(255).optional(),
  email: z.string().email('E-mail inválido').max(255).optional().or(z.literal('')),
  telefone: z.string().max(20).optional().or(z.literal('')),
  genero: z.enum(['masculino', 'feminino', 'outro']).optional().nullable(),
  endereco: z.string().max(500).optional().or(z.literal('')),
  numero: z.string().max(20).optional().or(z.literal('')),
  complemento: z.string().max(255).optional().or(z.literal('')),
  bairro: z.string().max(255).optional().or(z.literal('')),
  cidade: z.string().max(255).optional().or(z.literal('')),
  uf: z.string().max(2).optional().or(z.literal('')),
  cep: z.string().max(10).optional().or(z.literal('')),
  origem: z.string().max(255).optional().or(z.literal('')),
  observacoes: z.string().max(2000).optional().or(z.literal('')),
  notas_assessor: z.string().max(2000).optional().or(z.literal('')),
  declarou_voto: z.boolean().optional(),
  etiquetas: z.string().optional().or(z.literal('')),
});

export type ImportContactData = z.infer<typeof importContactSchema>;

/**
 * Converte strings em booleanos para campos de importação.
 * Aceita: sim/não, true/false, 1/0, yes/no, s/n
 */
export function parseBoolean(value: string | undefined | null): boolean | undefined {
  if (!value || value.trim() === '') return undefined;
  const lower = value.trim().toLowerCase();
  if (['sim', 'true', '1', 'yes', 's'].includes(lower)) return true;
  if (['nao', 'não', 'false', '0', 'no', 'n'].includes(lower)) return false;
  return undefined;
}
