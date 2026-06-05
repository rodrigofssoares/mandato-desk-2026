// Edge Function: formularios-public-submit
// RAQ-MAND-EM054
//
// Único ponto de entrada para envios públicos de formulários (sem autenticação).
// Recebe { slug, dados, captchaToken? }, valida, verifica captcha (opcional),
// aplica rate-limit por IP e delega TODA lógica de negócio à RPC
// `formulario_processar_resposta` (migration 116) via service_role.
//
// A RPC cuida de: dedup, criar/associar contato, gravar resposta, automações.
// Esta EF cuida de: CORS, validação de input, hashing LGPD, captcha, rate-limit.
//
// CORS: Access-Control-Allow-Origin: * é intencional — formulários públicos
// são compartilhados por link e acessíveis de qualquer domínio (sem cookies/JWT).
//
// verify_jwt = false no config.toml — obrigatório (endpoint sem auth).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Constantes ────────────────────────────────────────────────────────────────

/** Limite máximo do body em bytes (~100 KB). */
const MAX_BODY_BYTES = 100_000;

/** Slug: kebab-case de 3 a 128 chars, apenas letras minúsculas, dígitos e hífen. */
const SLUG_REGEX = /^[a-z0-9\-]{3,128}$/;

/** Rate-limit: máximo de submissões por IP por janela. */
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MINUTES = 10;

// ── CORS — formulário público, sem credenciais ────────────────────────────────
// '*' é aceitável aqui: não há cookies nem Authorization — o endpoint é
// intencionalmente aberto para qualquer origem compartilhar o formulário.
const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

/**
 * Deriva o IP do request de forma defensiva.
 * Prefere `cf-connecting-ip` (Cloudflare) depois o primeiro valor de
 * `x-forwarded-for`. Retorna string vazia se nenhum header estiver presente.
 */
function extractIp(req: Request): string {
  const cf = req.headers.get('cf-connecting-ip');
  if (cf) return cf.trim();
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return '';
}

/**
 * Produz SHA-256 (hex) de (salt + ip) usando Web Crypto.
 * LGPD: nunca armazenamos o IP cru — apenas este hash one-way.
 */
async function hashIp(ip: string): Promise<string> {
  // FORM_RATE_SALT: rotacionar periodicamente invalida hashes antigos (privacy by design).
  // Fallback 'em054' usado apenas em dev/sem configuração.
  const envSalt = Deno.env.get('FORM_RATE_SALT');
  if (!envSalt) {
    console.warn('[formularios-public-submit] FORM_RATE_SALT não configurado — usando fallback inseguro. Configure em produção.');
  }
  const salt = envSalt ?? 'em054';
  const data = new TextEncoder().encode(salt + ip);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// ── Verificação de Captcha (Cloudflare Turnstile) ─────────────────────────────

interface TurnstileResponse {
  success: boolean;
  'error-codes'?: string[];
}

/**
 * Verifica o captchaToken contra a API do Cloudflare Turnstile.
 * Só é chamada se TURNSTILE_SECRET estiver configurada.
 * Em modo dev (sem a env), a verificação é pulada completamente.
 */
async function verifyCaptcha(token: string | undefined, ip: string): Promise<boolean> {
  const secret = Deno.env.get('TURNSTILE_SECRET');

  // Se TURNSTILE_SECRET não estiver configurada, captcha está desabilitado
  // (útil em desenvolvimento local ou formulários internos sem exposição pública).
  if (!secret) return true;

  // Token ausente quando captcha está ativo = rejeitar
  if (!token || typeof token !== 'string' || token.trim().length === 0) return false;

  try {
    const form = new URLSearchParams({
      secret,
      response: token.trim(),
      remoteip: ip,
    });

    // Timeout de 5s para não segurar o worker se o Turnstile ficar lento (anti-DoS indireto).
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    let res: Response;
    try {
      res = await fetch(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: form.toString(),
          signal: controller.signal,
        },
      );
    } finally {
      clearTimeout(timeoutId);
    }

    if (!res.ok) {
      console.error('[formularios-public-submit] turnstile HTTP error:', res.status);
      return false;
    }

    const result: TurnstileResponse = await res.json();
    return result.success === true;
  } catch (err) {
    console.error(
      '[formularios-public-submit] falha ao verificar captcha:',
      err instanceof Error ? err.message : String(err),
    );
    return false;
  }
}

// ── Rate-limit por IP hash ────────────────────────────────────────────────────

/**
 * Conta quantas respostas o ip_hash gerou nos últimos RATE_LIMIT_WINDOW_MINUTES
 * para formulários em geral (sem filtrar por slug — protege toda a superfície).
 *
 * Usa service_role para ler formulario_respostas. Sem tabela auxiliar — apenas
 * uma query simples e direta na tabela de respostas.
 *
 * Retorna true se ainda dentro do limite, false se deve ser bloqueado.
 */
async function checkRateLimit(
  admin: ReturnType<typeof createClient>,
  ipHash: string,
): Promise<boolean> {
  const windowStart = new Date(
    Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60 * 1000,
  ).toISOString();

  const { count, error } = await admin
    .from('formulario_respostas')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('created_at', windowStart);

  if (error) {
    // Se a query falhar, preferir permissivo a travar o formulário legítimo.
    // Loga o erro mas não bloqueia — disponibilidade > rate-limit estrito.
    console.error('[formularios-public-submit] rate-limit query error:', error.message);
    return true;
  }

  return (count ?? 0) < RATE_LIMIT_MAX;
}

// ── Mapeamento RPC → HTTP ────────────────────────────────────────────────────

interface RpcResult {
  ok?: boolean;
  erro?: string;
  contact_id?: string;
  abre_em?: string;
  titulo?: string;
  agradecimento?: string;
}

/**
 * Converte o retorno jsonb da RPC `formulario_processar_resposta` para
 * a resposta HTTP adequada (RFC 7807-like, sem vazar stack/SQLERRM).
 */
function rpcResultToResponse(result: RpcResult): Response {
  if (result.ok === true) {
    return jsonResponse(200, { ok: true });
  }

  switch (result.erro) {
    case 'nao_encontrado':
      return jsonResponse(404, { error: 'nao_encontrado' });

    case 'encerrado':
      return jsonResponse(410, {
        error: 'encerrado',
        titulo: result.titulo ?? null,
        agradecimento: result.agradecimento ?? null,
      });

    case 'nao_iniciado':
      // 425 Too Early — o formulário ainda não está no período de aceite.
      // Incluímos abre_em se a RPC retornar para que o front possa exibir ao usuário.
      return jsonResponse(425, {
        error: 'nao_iniciado',
        abre_em: result.abre_em ?? null,
      });

    case 'limite_atingido':
      // 409 Conflict — dedup detectou resposta duplicada deste IP/contato.
      return jsonResponse(409, { error: 'limite_atingido' });

    case 'interno':
    default:
      // Nunca vazar detalhes internos (SQLERRM, stack trace, etc.) ao cliente.
      return jsonResponse(500, { error: 'interno' });
  }
}

// ── Handler principal ─────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  // ── Preflight OPTIONS ─────────────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 200, headers: CORS_HEADERS });
  }

  // ── Só aceita POST ────────────────────────────────────────────────────────
  if (req.method !== 'POST') {
    return jsonResponse(405, { error: 'method_not_allowed', detail: 'Use POST' });
  }

  try {
    // ── 1. Limit size do body ───────────────────────────────────────────────
    const contentLength = parseInt(req.headers.get('content-length') ?? '0', 10);
    if (contentLength > MAX_BODY_BYTES) {
      return jsonResponse(413, { error: 'payload_too_large', detail: `Limite: ${MAX_BODY_BYTES} bytes` });
    }

    // ── 2. Parse do body (defensivo) ────────────────────────────────────────
    let body: { slug?: unknown; dados?: unknown; captchaToken?: unknown };
    try {
      body = await req.json();
    } catch {
      return jsonResponse(400, { error: 'invalid_json', detail: 'Body deve ser JSON válido' });
    }

    // Verificação adicional de tamanho via conteúdo serializado (caso content-length ausente).
    if (JSON.stringify(body).length > MAX_BODY_BYTES) {
      return jsonResponse(413, { error: 'payload_too_large' });
    }

    // ── 3. Validação de slug ────────────────────────────────────────────────
    if (typeof body.slug !== 'string' || !SLUG_REGEX.test(body.slug)) {
      return jsonResponse(400, {
        error: 'validation_error',
        field: 'slug',
        detail: 'slug deve ter 3-128 chars (letras minúsculas, números, hífen)',
      });
    }
    const slug = body.slug;

    // ── 4. Validação de dados ───────────────────────────────────────────────
    if (
      body.dados === null ||
      typeof body.dados !== 'object' ||
      Array.isArray(body.dados)
    ) {
      return jsonResponse(400, {
        error: 'validation_error',
        field: 'dados',
        detail: 'dados deve ser um objeto com mapa campo_id → valor',
      });
    }
    const dados = body.dados as Record<string, unknown>;

    // ── 5. IP e hash LGPD ──────────────────────────────────────────────────
    const ip = extractIp(req);
    const ipHash = await hashIp(ip);

    // ── 6. Verificação de captcha ──────────────────────────────────────────
    // Pulada se TURNSTILE_SECRET não estiver configurada (dev/sem captcha).
    const captchaToken = typeof body.captchaToken === 'string' ? body.captchaToken : undefined;
    const captchaOk = await verifyCaptcha(captchaToken, ip);
    if (!captchaOk) {
      return jsonResponse(403, { error: 'captcha_invalido' });
    }

    // ── 7. Criação do client service_role ──────────────────────────────────
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      console.error('[formularios-public-submit] env SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente');
      return jsonResponse(500, { error: 'interno' });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // ── 8. Rate-limit por IP hash ──────────────────────────────────────────
    const withinLimit = await checkRateLimit(admin, ipHash);
    if (!withinLimit) {
      console.log(`[formularios-public-submit] rate-limit atingido — ip_hash=${ipHash.slice(0, 8)}... slug=${slug}`);
      return jsonResponse(429, { error: 'rate_limited' });
    }

    // ── 9. User-Agent (para audit trail na RPC) ────────────────────────────
    const userAgent = (req.headers.get('user-agent') ?? '').slice(0, 512);

    // ── 10. Chama a RPC (toda lógica de negócio é dela) ───────────────────
    // A RPC `formulario_processar_resposta` só pode ser chamada com service_role
    // e é responsável por: validar slug, checar período, dedup, criar contato,
    // gravar resposta e disparar automações — atomicamente.
    const { data: rpcData, error: rpcError } = await admin.rpc(
      'formulario_processar_resposta',
      {
        _slug: slug,
        _dados: dados,
        _ip_hash: ipHash,
        _user_agent: userAgent,
      },
    );

    if (rpcError) {
      // Erro de infraestrutura (conexão, timeout, bug de SQL) — logar mas não vazar.
      console.error(
        '[formularios-public-submit] rpc error:',
        rpcError.message,
        '| slug:', slug,
        '| ip_hash:', ipHash.slice(0, 8) + '...',
      );
      return jsonResponse(500, { error: 'interno' });
    }

    // ── 11. Mapeia retorno da RPC para HTTP ────────────────────────────────
    return rpcResultToResponse(rpcData as RpcResult);

  } catch (err) {
    // Catch-all: nunca vazar stack trace ao cliente.
    console.error(
      '[formularios-public-submit] erro inesperado:',
      err instanceof Error ? err.message : String(err),
    );
    return jsonResponse(500, { error: 'interno' });
  }
});
