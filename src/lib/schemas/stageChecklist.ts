import { z } from 'zod';

export const checklistItemSchema = z.object({
  texto: z.string().trim().min(1, 'Título obrigatório').max(120, 'Máximo de 120 caracteres'),
  descricao: z.string().max(500, 'Máximo de 500 caracteres').optional().nullable(),
});

export const linkAttachmentSchema = z.object({
  url_externa: z
    .string()
    .trim()
    .url('URL inválida — inclua https://')
    .max(2000, 'URL muito longa'),
  rotulo: z.string().trim().max(120).optional().nullable(),
});

// Conteúdo NÃO usa .trim — preserva quebras/espaços que importam para o WhatsApp.
export const stageTemplateSchema = z.object({
  titulo: z.string().trim().min(1, 'Título obrigatório').max(120, 'Máximo de 120 caracteres'),
  conteudo: z
    .string()
    .min(1, 'Conteúdo obrigatório')
    .max(4000, 'Máximo de 4000 caracteres')
    .refine((s) => s.trim().length > 0, 'Conteúdo não pode ser apenas espaços'),
});

export type ChecklistItemInput = z.infer<typeof checklistItemSchema>;
export type LinkAttachmentInput = z.infer<typeof linkAttachmentSchema>;
export type StageTemplateInput = z.infer<typeof stageTemplateSchema>;
