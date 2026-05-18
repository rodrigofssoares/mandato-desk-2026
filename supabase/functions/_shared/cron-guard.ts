// cron-guard.ts
// Helper de autenticação via CRON_SECRET para Edge Functions chamadas por cron jobs ou pg_net.
// Mitiga CWE-208 (timing side-channel) usando comparação de tempo constante (XOR char a char).

import { corsHeaders } from './admin-guard.ts';

/**
 * Comparação de strings em tempo constante.
 * Itera todos os chars independente de onde a diferença ocorre,
 * eliminando o timing side-channel descrito em CWE-208.
 *
 * Retorna true apenas se `a` e `b` forem idênticos em comprimento e conteúdo.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  // Strings de comprimentos diferentes não são iguais.
  // Ainda assim, continua o loop sobre o comprimento da maior,
  // garantindo que o tempo de execução não vaze o comprimento de `b`.
  let mismatch = a.length !== b.length ? 1 : 0;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    // charCodeAt retorna NaN fora do bounds — NaN ^ NaN === 0, então
    // usamos (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0) para
    // garantir que índice fora do bounds produza mismatch quando comprimentos diferem.
    mismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return mismatch === 0;
}

/**
 * Valida o header Authorization: Bearer <token> contra CRON_SECRET.
 * Retorna uma Response de erro se inválido, ou null se válido.
 *
 * Uso:
 *   const authError = validateCronSecret(req);
 *   if (authError) return authError;
 */
export function validateCronSecret(req: Request): Response | null {
  const cronSecret = Deno.env.get('CRON_SECRET');
  if (!cronSecret) {
    console.error('cron-guard: CRON_SECRET não configurado no Vault');
    return new Response(
      JSON.stringify({ error: 'Configuração incompleta: CRON_SECRET ausente' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!timingSafeEqual(token, cronSecret)) {
    console.warn('cron-guard: token CRON_SECRET inválido');
    return new Response(
      JSON.stringify({ error: 'Acesso negado' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }

  return null; // token válido
}
