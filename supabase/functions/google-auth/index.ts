import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const SCOPES = [
  'https://www.googleapis.com/auth/contacts',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

function redirectResponse(location: string): Response {
  return new Response(null, {
    status: 302,
    headers: { ...corsHeaders, Location: location },
  });
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Gera HMAC-SHA256 do payload usando SUPABASE_JWT_SECRET como chave.
// Protege o parâmetro `state` contra CSRF.
async function hmacSign(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmacVerify(payload: string, signature: string, secret: string): Promise<boolean> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  // signature está em hex — validar formato e converter para Uint8Array
  if (signature.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(signature)) {
    return false;
  }
  const sigBytes = new Uint8Array(
    signature.match(/.{2}/g)!.map((b) => parseInt(b, 16)),
  );
  // crypto.subtle.verify é constant-time por spec — protege contra timing attack
  return crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(payload));
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname;

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
  const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');
  const frontendUrl = Deno.env.get('FRONTEND_URL') ?? 'http://localhost:8080';
  const jwtSecret = Deno.env.get('SUPABASE_JWT_SECRET');

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse(500, { error: 'Configuração incompleta: variáveis Supabase ausentes' });
  }
  if (!clientId || !clientSecret) {
    return jsonResponse(500, { error: 'Configuração incompleta: credenciais Google OAuth ausentes (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)' });
  }
  if (!jwtSecret) {
    return jsonResponse(500, { error: 'Configuração incompleta: SUPABASE_JWT_SECRET ausente' });
  }

  const redirectUri = `${supabaseUrl}/functions/v1/google-auth/callback`;

  // ─── /start ──────────────────────────────────────────────────────────────
  // Requer POST + JWT no header Authorization. Retorna JSON { authorization_url }
  // para que o frontend abra via window.open(url) — evita CSRF por user_id no query param.
  if (path.endsWith('/start')) {
    if (req.method !== 'POST') {
      return jsonResponse(405, { error: 'Método não permitido — use POST' });
    }

    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!anonKey) {
      return jsonResponse(500, { error: 'Configuração do servidor incompleta' });
    }

    const authHeader = req.headers.get('Authorization') ?? '';
    const callerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!callerToken) {
      return jsonResponse(401, { error: 'Token ausente' });
    }

    const caller = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: `Bearer ${callerToken}` } },
    });
    const { data: userData, error: userError } = await caller.auth.getUser(callerToken);
    if (userError || !userData.user) {
      return jsonResponse(401, { error: 'Sessão inválida' });
    }
    // user_id extraído do JWT — NÃO confia em query param
    const userId = userData.user.id;

    // Cria state = nonce:user_id:hmac para proteção CSRF
    const nonce = crypto.randomUUID();
    const payload = `${nonce}:${userId}`;
    const sig = await hmacSign(payload, jwtSecret);
    const state = `${payload}:${sig}`;

    // FIX P-HIGH-2: persistir nonce no banco para one-time-use no callback
    const adminForNonce = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: nonceError } = await adminForNonce
      .from('oauth_state_nonces')
      .insert({ nonce, user_id: userId });
    if (nonceError) {
      return jsonResponse(500, { error: 'Erro ao iniciar OAuth' });
    }

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', clientId);
    authUrl.searchParams.set('redirect_uri', redirectUri);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', SCOPES);
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    authUrl.searchParams.set('state', state);

    return jsonResponse(200, { authorization_url: authUrl.toString() });
  }

  // ─── /callback ───────────────────────────────────────────────────────────
  if (path.endsWith('/callback')) {
    const errorParam = url.searchParams.get('error');
    if (errorParam) {
      return redirectResponse(`${frontendUrl}/google-integration?error=oauth_failed`);
    }

    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');

    if (!code || !state) {
      return redirectResponse(`${frontendUrl}/google-integration?error=oauth_failed`);
    }

    // Verifica HMAC do state
    // state = "<nonce>:<userId>:<hmac>"
    // onde nonce e userId são UUIDs (sem ':'), e hmac é hex
    // Usamos lastIndexOf para separar o hmac do restante
    const lastColon = state.lastIndexOf(':');
    const secondLastColon = state.lastIndexOf(':', lastColon - 1);
    if (lastColon === -1 || secondLastColon === -1) {
      return redirectResponse(`${frontendUrl}/google-integration?error=oauth_failed`);
    }
    const userId = state.slice(secondLastColon + 1, lastColon);
    const stateSignature = state.slice(lastColon + 1);
    const payload = state.slice(0, lastColon);

    const valid = await hmacVerify(payload, stateSignature, jwtSecret);
    if (!valid) {
      return redirectResponse(`${frontendUrl}/google-integration?error=oauth_failed`);
    }

    // FIX P-HIGH-2: consumir nonce atomicamente — garante one-time-use e previne replay
    // Extrai o nonce: state = "<nonce>:<userId>:<hmac>" — nonce é o trecho antes do secondLastColon
    const nonce = state.slice(0, secondLastColon);
    const adminForNonce = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: nonceRow, error: nonceError } = await adminForNonce
      .from('oauth_state_nonces')
      .update({ consumed: true })
      .eq('nonce', nonce)
      .eq('user_id', userId)
      .eq('consumed', false)
      .gt('expires_at', new Date().toISOString())
      .select()
      .maybeSingle();

    if (nonceError || !nonceRow) {
      return redirectResponse(`${frontendUrl}/google-integration?error=oauth_state_invalid`);
    }

    // Troca code por tokens
    let tokenData: {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      token_type: string;
    };

    try {
      const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenResp.ok) {
        console.error('Erro ao trocar code por tokens:', tokenResp.status);
        return redirectResponse(`${frontendUrl}/google-integration?error=oauth_failed`);
      }

      tokenData = await tokenResp.json();
    } catch (err) {
      console.error('Exceção ao trocar code:', err);
      return redirectResponse(`${frontendUrl}/google-integration?error=oauth_failed`);
    }

    if (!tokenData.access_token || !tokenData.refresh_token) {
      return redirectResponse(`${frontendUrl}/google-integration?error=oauth_failed`);
    }

    // Busca email da conta Google
    let googleEmail: string | null = null;
    try {
      const userResp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (userResp.ok) {
        const userInfo = await userResp.json();
        googleEmail = userInfo.email ?? null;
      }
    } catch {
      // email é opcional, não bloqueia o fluxo
    }

    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    // Salva tokens com service_role (bypass RLS) — Edge Function age em nome do usuário
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error: upsertError } = await admin
      .from('google_oauth_tokens')
      .upsert(
        {
          user_id: userId,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: expiresAt,
          google_email: googleEmail,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );

    if (upsertError) {
      console.error('Erro ao salvar token OAuth:', upsertError.message);
      return redirectResponse(`${frontendUrl}/google-integration?error=oauth_failed`);
    }

    // Cria settings padrão se não existir
    await admin
      .from('google_sync_settings')
      .upsert(
        {
          user_id: userId,
          sync_enabled: true,
          bidirectional_sync: false,
          sync_tags: false,
          keep_on_google_delete: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id', ignoreDuplicates: true },
      );

    return redirectResponse(`${frontendUrl}/google-integration?connected=true`);
  }

  return jsonResponse(404, { error: 'Rota não encontrada' });
});
