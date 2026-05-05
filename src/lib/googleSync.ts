import { supabase } from '@/integrations/supabase/client';
import { QueryClient } from '@tanstack/react-query';
import { googleSyncKeys } from '@/hooks/useGoogleSync';

/**
 * Invoca a Edge Function google-contacts-sync de forma fire-and-forget.
 * Nunca bloqueia a UX — erros são apenas logados no console em dev.
 * Após conclusão, invalida as queries de contadores de sync.
 *
 * FIX P-CRIT-2: google_resource_name NÃO é enviado — a Edge Function busca do banco.
 */
export function triggerGoogleSync(
  operation: 'create' | 'update' | 'delete',
  contactId: string,
  userId: string,
  queryClient: QueryClient,
): void {
  const body: Record<string, string> = {
    contact_id: contactId,
    user_id: userId,
    operation,
  };

  supabase.functions
    .invoke('google-contacts-sync', { body })
    .then(() => {
      queryClient.invalidateQueries({ queryKey: googleSyncKeys.counts() });
      queryClient.invalidateQueries({ queryKey: googleSyncKeys.errors() });
    })
    .catch((err: unknown) => {
      if (import.meta.env.DEV) {
        console.warn('[googleSync] fire-and-forget erro:', err);
      }
    });
}
