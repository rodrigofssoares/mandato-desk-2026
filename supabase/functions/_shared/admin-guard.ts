// Helper compartilhado pelas edge functions administrativas.
// Verifica que o JWT do chamador pertence a um perfil com nível de admin
// (role admin/proprietario). Retorna o supabase-client admin pronto pra uso
// ou uma Response de erro 401/403 quando o chamador não é autorizado.

import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Roles com poder administrativo sobre usuários.
const ADMIN_ROLES = new Set(['admin', 'proprietario']);

export interface AdminContext {
  admin: SupabaseClient;
  callerId: string;
  callerRole: string;
}

export async function requireAdmin(req: Request): Promise<AdminContext | Response> {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

  if (!url || !serviceRoleKey || !anonKey) {
    return jsonResponse(500, { error: 'Configuração do servidor incompleta' });
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    return jsonResponse(401, { error: 'Token ausente' });
  }

  // Cliente anônimo para validar o JWT do chamador
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userError } = await caller.auth.getUser(token);
  if (userError || !userData.user) {
    return jsonResponse(401, { error: 'Sessão inválida' });
  }

  // Cliente admin para ler perfil e realizar operações administrativas
  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return jsonResponse(403, { error: 'Perfil do chamador não encontrado' });
  }

  if (!ADMIN_ROLES.has(profile.role)) {
    return jsonResponse(403, { error: 'Sem permissão para esta operação' });
  }

  return { admin, callerId: userData.user.id, callerRole: profile.role };
}
