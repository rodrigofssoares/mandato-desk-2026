// _shared/auth-cache.ts
//
// PEN-008: cache em memória para getUser() + busca de perfil.
// Reduz de 2 round-trips de auth para 0 em request bursts (worker warm).
// TTL de 60s — suficiente para bursts, seguro em relação a revogação de sessão.
//
// Caveat: cache é efêmero (per-worker); cold starts sempre fazem os 2 round-trips.
// Mas em bursts (o cenário de ataque PEN-008) o warm worker serve N requests com 0 DB ops.
//
// RAQ-MAND-EM075 — Pentest Onda 2 fixes

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CACHE_TTL_MS = 60_000; // 60 segundos

interface CachedAuth {
  userId:    string;
  userEmail: string;
  role:      string;
  status:    string;
  expires:   number;
}

// Map em memória por token (efêmero — por worker)
const tokenCache = new Map<string, CachedAuth>();

/**
 * Valida token JWT + busca perfil, com cache em memória por 60s.
 * Retorna { userId, userEmail, role, status } ou lança erro com mensagem descritiva.
 *
 * @param url            - SUPABASE_URL
 * @param anonKey        - SUPABASE_ANON_KEY
 * @param serviceRoleKey - SUPABASE_SERVICE_ROLE_KEY
 * @param token          - Bearer token extraído do header Authorization
 */
export async function cachedGetUser(
  url: string,
  anonKey: string,
  serviceRoleKey: string,
  token: string,
): Promise<CachedAuth> {
  // Verifica cache
  const cached = tokenCache.get(token);
  if (cached && cached.expires > Date.now()) {
    return cached;
  }

  // Cache miss: valida via GoTrue
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userError } = await caller.auth.getUser(token);
  if (userError || !userData.user) {
    throw new Error('sessao_invalida');
  }

  // Busca perfil via service_role
  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('role, status_aprovacao')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (profileError) {
    throw new Error('erro_ao_validar_perfil');
  }
  if (!profile || profile.status_aprovacao !== 'ATIVO') {
    throw new Error('perfil_nao_autorizado');
  }

  const entry: CachedAuth = {
    userId:    userData.user.id,
    userEmail: userData.user.email ?? '',
    role:      (profile.role ?? 'desconhecido') as string,
    status:    profile.status_aprovacao as string,
    expires:   Date.now() + CACHE_TTL_MS,
  };

  tokenCache.set(token, entry);

  // Limpeza passiva: remove entradas expiradas quando o cache cresce demais
  if (tokenCache.size > 200) {
    const now = Date.now();
    for (const [k, v] of tokenCache) {
      if (v.expires <= now) tokenCache.delete(k);
    }
  }

  return entry;
}
