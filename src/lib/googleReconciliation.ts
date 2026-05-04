import { supabase } from '@/integrations/supabase/client';

export interface ReconciliationProgress {
  processed: number;
  total: number;
  errors: number;
}

/**
 * Busca todos os contatos que precisam ser sincronizados.
 * Retorna contatos sem registro em contact_sync (sync_status != 'synced').
 */
async function fetchContactsForSync(userId: string): Promise<string[]> {
  // Busca todos os contatos não-mesclados visíveis ao usuário. Inclui:
  // (a) os criados pelo próprio usuário (created_by = userId)
  // (b) contatos legados sem created_by (importados em massa antes de o campo
  //     ser populado), que o RLS de contacts permite ao user enxergar e que
  //     também precisam ser sincronizados na reconciliação inicial.
  const { data: allContacts, error: contactsError } = await supabase
    .from('contacts')
    .select('id')
    .or(`created_by.eq.${userId},created_by.is.null`)
    .is('merged_into', null)
    .not('nome', 'is', null);

  if (contactsError) throw contactsError;
  const allIds = (allContacts ?? []).map((c: { id: string }) => c.id);

  if (allIds.length === 0) return [];

  // Busca os que já estão synced para este user
  const { data: syncedRows, error: syncError } = await supabase
    .from('contact_sync')
    .select('contact_id')
    .eq('user_id', userId)
    .eq('sync_status', 'synced');

  if (syncError) throw syncError;

  const syncedSet = new Set((syncedRows ?? []).map((r: { contact_id: string }) => r.contact_id));

  // Retorna apenas os que não estão synced
  return allIds.filter((id: string) => !syncedSet.has(id));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Executa reconciliação em lote: envia todos os contatos não-sincronizados
 * para o Google Contacts via Edge Function.
 *
 * Processa em lotes de 10 com delay de 1s entre lotes (rate limit: 10 req/s).
 * Chama onProgress após cada lote para atualizar UI.
 *
 * Retorna o número de contatos processados com sucesso.
 */
export async function runFullReconciliation(
  userId: string,
  onProgress: (progress: ReconciliationProgress) => void,
): Promise<ReconciliationProgress> {
  const contactIds = await fetchContactsForSync(userId);
  const total = contactIds.length;

  if (total === 0) {
    const result = { processed: 0, total: 0, errors: 0 };
    onProgress(result);
    return result;
  }

  const BATCH_SIZE = 10;
  let processed = 0;
  let errors = 0;

  for (let i = 0; i < contactIds.length; i += BATCH_SIZE) {
    const batch = contactIds.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map((contactId) =>
        supabase.functions.invoke('google-contacts-sync', {
          body: {
            contact_id: contactId,
            user_id: userId,
            operation: 'create',
          },
        }),
      ),
    );

    results.forEach((result) => {
      if (result.status === 'fulfilled') {
        processed++;
      } else {
        errors++;
        processed++;
      }
    });

    onProgress({ processed, total, errors });

    // Respeita rate limit: max 10 req/s
    if (i + BATCH_SIZE < contactIds.length) {
      await sleep(1000);
    }
  }

  return { processed, total, errors };
}
