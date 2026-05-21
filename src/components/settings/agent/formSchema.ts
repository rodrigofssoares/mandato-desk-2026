import { z } from 'zod';

// ============================================================================
// Schema por step (split para UX melhor — não valida tudo de uma vez)
// ============================================================================

export const identitySchema = z.object({
  is_active: z.boolean(),
  name: z.string().min(1, 'Nome é obrigatório').max(100, 'Máximo 100 caracteres'),
  system_prompt: z.string().max(32000, 'Máximo 32.000 caracteres').nullable().optional(),
  text_only_mode: z.boolean(),
});

export type AgentIdentityForm = z.infer<typeof identitySchema>;
