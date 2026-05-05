import { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface TokenRecord {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  is_active: boolean;
}

/**
 * Garante que o access_token esteja válido.
 * Se expirado, usa o refresh_token para renovar e persiste o novo token no banco.
 * Se o refresh falhar (token revogado), marca is_active = false e lança erro.
 *
 * Retorna o access_token válido para uso nas chamadas à People API.
 */
export async function ensureValidToken(
  admin: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data: tokenRecord, error } = await admin
    .from('google_oauth_tokens')
    .select('access_token, refresh_token, expires_at, is_active')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao buscar token OAuth: ${error.message}`);
  }
  if (!tokenRecord || !tokenRecord.is_active) {
    throw new Error('TOKEN_INACTIVE');
  }

  const expiresAt = new Date(tokenRecord.expires_at).getTime();
  const nowWithBuffer = Date.now() + 60_000; // 60s de margem

  if (expiresAt > nowWithBuffer) {
    // Token ainda válido
    return tokenRecord.access_token;
  }

  // Token expirado — tenta renovar
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    throw new Error('Credenciais Google OAuth não configuradas');
  }

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: tokenRecord.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!resp.ok) {
    // Token revogado — marcar como inativo
    await admin
      .from('google_oauth_tokens')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    throw new Error('TOKEN_REVOKED');
  }

  const refreshed = await resp.json();

  if (!refreshed.access_token) {
    await admin
      .from('google_oauth_tokens')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    throw new Error('TOKEN_REVOKED');
  }

  const newExpiresAt = new Date(Date.now() + (refreshed.expires_in ?? 3600) * 1000).toISOString();

  await admin
    .from('google_oauth_tokens')
    .update({
      access_token: refreshed.access_token,
      expires_at: newExpiresAt,
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);

  return refreshed.access_token;
}
