// Helper compartilhado pelas edge functions que exigem apenas usuário autenticado
// (sem checar role). Diferente do admin-guard.ts, qualquer usuário com perfil
// ATIVO passa. Usado em fluxos de uso normal do app (ex: enviar mensagem WhatsApp).

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, jsonResponse } from './admin-guard.ts';

export interface AuthContext {
  /** Cliente Supabase com service_role — bypassa RLS. Usar com cuidado. */
  admin: SupabaseClient;
  /** UUID do usuário autenticado. */
  callerId: string;
  /** Email do usuário autenticado (pra logs). */
  callerEmail: string;
  /** Role do usuário (admin/proprietario/assessor/...) — pra audit trail. */
  callerRole: string;
}

export async function requireAuth(req: Request): Promise<AuthContext | Response> {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!url || !serviceRoleKey || !anonKey) {
    return jsonResponse(500, { error: 'Configuração do servidor incompleta (env)' });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    return jsonResponse(401, { error: 'Token ausente' });
  }

  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userError } = await caller.auth.getUser(token);
  if (userError || !userData.user) {
    return jsonResponse(401, { error: 'Sessão inválida' });
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Confirma que o perfil está ATIVO (mesma regra do has_role)
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role, status_aprovacao')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (profileError) {
    return jsonResponse(500, { error: 'Erro ao validar perfil' });
  }
  if (!profile || profile.status_aprovacao !== 'ATIVO') {
    return jsonResponse(403, { error: 'Perfil não autorizado' });
  }

  return {
    admin,
    callerId: userData.user.id,
    callerEmail: userData.user.email ?? '',
    callerRole: profile.role ?? 'desconhecido',
  };
}

export { corsHeaders, jsonResponse };
