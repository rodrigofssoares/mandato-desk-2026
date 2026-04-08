import { supabase } from '@/integrations/supabase/client';

interface LogActivityParams {
  type: 'create' | 'update' | 'delete' | 'status_change' | 'assignment' | 'import' | 'merge' | 'bulk_delete';
  entity_type: 'contact' | 'demand' | 'tag' | 'leader' | 'user' | 'permission' | 'role';
  entity_name?: string;
  entity_id?: string;
  description?: string;
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

    const { error } = await supabase.from('activities').insert({
      type: params.type,
      entity_type: params.entity_type,
      entity_name: params.entity_name ?? null,
      entity_id: params.entity_id ?? null,
      description: params.description?.slice(0, 500) ?? null,
      responsible_id: user.id,
    });

    if (error) {
      console.error('[activityLog] Erro ao registrar atividade:', error.message);
    }
  } catch (err) {
    console.error('[activityLog] Erro inesperado:', err);
  }
}
