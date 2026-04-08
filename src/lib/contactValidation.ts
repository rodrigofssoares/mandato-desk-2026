import { z } from 'zod';

export const contactSchema = z.object({
  // Dados Pessoais
  nome: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(200),
  whatsapp: z.string().max(20).optional().or(z.literal('')),
  em_canal_whatsapp: z.boolean().optional().default(false),
  e_multiplicador: z.boolean().optional().default(false),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  telefone: z.string().max(20).optional().or(z.literal('')),
  genero: z.enum(['masculino', 'feminino', 'outro', 'prefiro_nao_informar']).optional().nullable(),
  data_nascimento: z.string().optional().or(z.literal('')),

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

/** Remove todos os caracteres não-numéricos de um telefone */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/** Formata o nome: capitaliza cada palavra */
export function formatName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .map((word) => {
      if (['de', 'da', 'do', 'das', 'dos', 'e'].includes(word.toLowerCase())) {
        return word.toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}
