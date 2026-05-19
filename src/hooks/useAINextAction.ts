// Hook: useAINextAction
//
// Chama a EF zapi-ai-next-action para um contato.
// Invalida a query do contato após sucesso para exibir a sugestão atualizada.
//
// Referência: RAQ-MAND-EM073 — T86 (Fase 7 Onda A)

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface NextActionResult {
  next_action?: string;
  contact_id?: string;
  skipped?: boolean;
  reason?: string;
  error?: string;
  message?: string;
}

export function useAINextAction(contactId: string | null, accountId: string | null) {
  const queryClient = useQueryClient();

  return useMutation<NextActionResult, Error, void>({
    mutationFn: async () => {
      if (!contactId || !accountId) throw new Error('contactId e accountId são obrigatórios');

      const { data, error } = await supabase.functions.invoke('zapi-ai-next-action', {
        body: { contact_id: contactId, account_id: accountId },
      });

      if (error) throw new Error(error.message);
      return (data as NextActionResult) ?? {};
    },
    onSuccess: () => {
      // Invalida query do contato para refletir ai_next_action atualizado
      if (contactId) {
        queryClient.invalidateQueries({ queryKey: ['contact', contactId] });
        queryClient.invalidateQueries({ queryKey: ['contacts'] });
      }
    },
  });
}
