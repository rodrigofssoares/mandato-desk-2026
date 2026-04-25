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

// Níveis de role — espelha src/types/permissions.ts (frontend).
export const ROLE_LEVELS: Record<string, number> = {
  admin: 100,
  proprietario: 80,
  assessor: 50,
  assistente: 30,
  estagiario: 20,
};

// Nível mínimo para operações administrativas (gerenciar usuários).
// Assessor e acima (admin/proprietario) podem criar e resetar senhas.
const MIN_ADMIN_LEVEL = ROLE_LEVELS.assessor;

export interface AdminContext {
  admin: SupabaseClient;
  callerId: string;
  callerRole: string;
  callerLevel: number;
}

export async function requireAdmin(req: Request): Promise<AdminContext | Response> {
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

  if (profileError) {
    return jsonResponse(500, {
      error: `Erro ao buscar perfil (id=${userData.user.id}): ${profileError.message} [code=${profileError.code ?? 'n/a'}]`,
    });
  }
  if (!profile) {
    return jsonResponse(403, {
      error: `Perfil do chamador não encontrado (id=${userData.user.id}, email=${userData.user.email})`,
    });
  }

  const callerLevel = ROLE_LEVELS[profile.role] ?? 0;
  if (callerLevel < MIN_ADMIN_LEVEL) {
    return jsonResponse(403, {
      error: `Sem permissão — role "${profile.role}" (nível ${callerLevel}) é menor que o mínimo ${MIN_ADMIN_LEVEL}`,
    });
  }

  return { admin, callerId: userData.user.id, callerRole: profile.role, callerLevel };
}

// Verifica se o chamador tem nível estritamente maior que o do alvo.
// Espelha a regra `canManage` do frontend (UserCard.tsx).
export async function assertCanManage(
  ctx: AdminContext,
  targetUserId: string,
): Promise<Response | null> {
  if (ctx.callerId === targetUserId) {
    return jsonResponse(400, { error: 'Use o fluxo de troca da própria senha' });
  }
  const { data: target, error } = await ctx.admin
    .from('profiles')
    .select('role')
    .eq('id', targetUserId)
    .maybeSingle();
  if (error || !target) {
    return jsonResponse(404, { error: 'Usuário alvo não encontrado' });
  }
  const targetLevel = ROLE_LEVELS[target.role] ?? 0;
  if (ctx.callerLevel <= targetLevel) {
    return jsonResponse(403, {
      error: 'Sem permissão sobre este usuário (nível igual ou superior)',
    });
  }
  return null;
}
