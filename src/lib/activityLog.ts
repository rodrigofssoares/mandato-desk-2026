import { supabase } from '@/integrations/supabase/client';
import { QueryClient } from '@tanstack/react-query';

interface LogActivityParams {
  type: 'create' | 'update' | 'delete' | 'status_change' | 'assignment' | 'import' | 'merge' | 'bulk_delete';
  entity_type: 'contact' | 'demand' | 'tag' | 'tag_group' | 'leader' | 'leader_type' | 'user' | 'permission' | 'role' | 'campaign_field';
  entity_name?: string;
  entity_id?: string;
  description?: string;
}

// Referencia global ao queryClient para invalidar cache do dashboard
let _queryClient: QueryClient | null = null;

export function setActivityLogQueryClient(qc: QueryClient) {
  _queryClient = qc;
}

/**
 * Registra uma atividade na tabela activities.
 * Fire-and-forget — não lança erro se falhar.
 */
export async function logActivity(params: LogActivityParams): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      console.error('[activityLog] Usuário não autenticado');
      return;
    }

    // entity_id deve ser UUID valido ou null
    const entityId = params.entity_id && params.entity_id.length > 0 ? params.entity_id : null;

    const { error } = await supabase.from('activities').insert({
      type: params.type,
      entity_type: params.entity_type,
      entity_name: params.entity_name || null,
      entity_id: entityId,
      description: params.description?.slice(0, 500) ?? null,
      responsible_id: user.id,
    });

    if (error) {
      console.error('[activityLog] Erro ao registrar atividade:', error.message);
    } else {
      // Invalida cache do dashboard para o ActivityFeed atualizar
      _queryClient?.invalidateQueries({ queryKey: ['dashboard', 'activities'] });
    }
  } catch (err) {
    console.error('[activityLog] Erro inesperado:', err);
  }
}
