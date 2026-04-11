/**
 * Helper para testar uma chave de API contra o endpoint de listagem de modelos
 * de cada provider. Usado pela aba "IA" das Configurações para dar feedback
 * imediato ao admin antes de salvar a chave.
 *
 * IMPORTANTE: este é o ÚNICO ponto do frontend que toca diretamente na chave
 * em texto plano — e somente porque o admin acabou de digitá-la na sessão.
 * O uso real da chave em features de IA DEVE acontecer server-side (Supabase
 * Edge Function ou backend com service_role), nunca no browser do usuário
 * final. Ver issue 14-func-ai-key-security-upgrade.md.
 */

export type AIProviderForTest = 'anthropic' | 'openai' | 'google';

export type TestApiKeyResult = { ok: true } | { ok: false; error: string };

export interface TestApiKeyParams {
  provider: AIProviderForTest;
  apiKey: string;
}

export async function testApiKey(params: TestApiKeyParams): Promise<TestApiKeyResult> {
  const { provider, apiKey } = params;

  if (!apiKey || !apiKey.trim()) {
    return { ok: false, error: 'Chave vazia' };
  }

  try {
    if (provider === 'anthropic') {
      const res = await fetch('https://api.anthropic.com/v1/models', {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
      });
      if (res.ok) return { ok: true };
      return { ok: false, error: `Anthropic respondeu HTTP ${res.status}` };
    }

    if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (res.ok) return { ok: true };
      return { ok: false, error: `OpenAI respondeu HTTP ${res.status}` };
    }

    if (provider === 'google') {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1/models?key=${encodeURIComponent(apiKey)}`,
      );
      if (res.ok) return { ok: true };
      return { ok: false, error: `Google respondeu HTTP ${res.status}` };
    }

    return { ok: false, error: 'Provider desconhecido' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha de rede';
    return { ok: false, error: message };
  }
}
