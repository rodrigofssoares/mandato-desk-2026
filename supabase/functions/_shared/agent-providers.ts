// _shared/agent-providers.ts
//
// Adaptadores de provider de IA para o agente de chat do Mandato Desk 2026.
// Exporta callProvider() — interface unificada para OpenAI, Anthropic e OpenRouter.
//
// Tabela de preços embarcada (USD por 1M tokens) — convertida pra BRL com fator
// configurável via env OPENAI_USD_TO_BRL (default 5.5).
//
// RAQ-MAND-EM075 — Onda 2 (Edge Functions do agente IA)

// ── Tabela de preços (USD por 1M tokens) ─────────────────────────────────────

const PRICING: Record<string, { input: number; output: number }> = {
  'openai/gpt-4o-mini':                  { input: 0.15,  output: 0.60  },
  'openai/gpt-4o':                       { input: 2.50,  output: 10.00 },
  'openai/o3-mini':                      { input: 1.10,  output: 4.40  },
  'anthropic/claude-3.5-haiku':          { input: 0.80,  output: 4.00  },
  'anthropic/claude-3.5-sonnet':         { input: 3.00,  output: 15.00 },
  'anthropic/claude-opus-4':             { input: 15.00, output: 75.00 },
  'meta-llama/llama-3.3-70b-instruct':   { input: 0.13,  output: 0.40  },
  'google/gemini-2.5-flash':             { input: 0.075, output: 0.30  },
  'deepseek/deepseek-chat':              { input: 0.14,  output: 0.28  },
};

// Fallback conservador quando modelo não está na tabela
const PRICING_FALLBACK = { input: 3.00, output: 15.00 };

function getUsdToBrl(): number {
  const env = Deno.env.get('USD_TO_BRL');
  if (env) {
    const parsed = parseFloat(env);
    if (!isNaN(parsed) && parsed > 0) return parsed;
  }
  return 5.5;
}

/**
 * Calcula custo total em BRL dado modelo e contagem de tokens.
 * Usa tabela de preços embarcada. Se modelo desconhecido, aplica fallback conservador.
 */
export function calculateCost(
  modelId: string,
  tokensIn: number,
  tokensOut: number,
): { cost_brl_input: number; cost_brl_output: number; total_cost_brl: number } {
  const usdToBrl = getUsdToBrl();
  const price = PRICING[modelId] ?? PRICING_FALLBACK;

  const cost_brl_input  = (tokensIn  / 1_000_000) * price.input  * usdToBrl;
  const cost_brl_output = (tokensOut / 1_000_000) * price.output * usdToBrl;
  const total_cost_brl  = cost_brl_input + cost_brl_output;

  return { cost_brl_input, cost_brl_output, total_cost_brl };
}

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface ProviderCallOptions {
  /** ID do provider: 'openai' | 'anthropic' | 'openrouter' */
  provider: string;
  /** ID do modelo no formato provider/model-name */
  modelId: string;
  /** Chave de API do provider */
  apiKey: string;
  /** Instrução de sistema (separada das mensagens) */
  systemPrompt: string;
  /** Histórico de mensagens: apenas role user/assistant */
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  /** Limite máximo de tokens na resposta */
  maxTokens: number;
  /** Temperatura (0-2, default 0.7) */
  temperature?: number;
}

export interface ProviderCallResult {
  content: string;
  tokens_input: number;
  tokens_output: number;
  total_tokens: number;
  cost_brl_input: number;
  cost_brl_output: number;
  cost_brl: number;
}

// ── Adapters internos ─────────────────────────────────────────────────────────

async function callOpenAI(opts: ProviderCallOptions): Promise<ProviderCallResult> {
  // OpenAI: sistema via messages[0] com role=system
  const messages = [
    { role: 'system', content: opts.systemPrompt },
    ...opts.messages,
  ];

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${opts.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: opts.modelId,
      messages,
      max_tokens: opts.maxTokens,
      temperature: opts.temperature ?? 0.7,
    }),
    signal: AbortSignal.timeout(50_000), // 50s — Supabase Edge tem limite de 60s
  });

  if (!res.ok) {
    const status = res.status;
    await res.text().catch(() => null);
    throw new ProviderError('openai', status);
  }

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>;
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  };

  const content = data.choices?.[0]?.message?.content ?? '';
  const tokens_input  = data.usage?.prompt_tokens ?? 0;
  const tokens_output = data.usage?.completion_tokens ?? 0;
  const total_tokens  = data.usage?.total_tokens ?? (tokens_input + tokens_output);

  const costs = calculateCost(opts.modelId, tokens_input, tokens_output);

  return {
    content,
    tokens_input,
    tokens_output,
    total_tokens,
    cost_brl_input:  costs.cost_brl_input,
    cost_brl_output: costs.cost_brl_output,
    cost_brl:        costs.total_cost_brl,
  };
}

async function callAnthropic(opts: ProviderCallOptions): Promise<ProviderCallResult> {
  // Anthropic: system é campo separado (não dentro de messages[]).
  // O model_id no banco está como 'anthropic/claude-3.5-haiku' —
  // a API Anthropic espera apenas 'claude-3-5-haiku-20241022', então mapeamos.
  const modelName = mapAnthropicModel(opts.modelId);

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': opts.apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelName,
      system: opts.systemPrompt,
      messages: opts.messages,
      max_tokens: opts.maxTokens,
    }),
    signal: AbortSignal.timeout(50_000),
  });

  if (!res.ok) {
    const status = res.status;
    await res.text().catch(() => null);
    throw new ProviderError('anthropic', status);
  }

  const data = await res.json() as {
    content: Array<{ text: string }>;
    usage: { input_tokens: number; output_tokens: number };
  };

  const content = data.content?.[0]?.text ?? '';
  const tokens_input  = data.usage?.input_tokens ?? 0;
  const tokens_output = data.usage?.output_tokens ?? 0;
  const total_tokens  = tokens_input + tokens_output;

  const costs = calculateCost(opts.modelId, tokens_input, tokens_output);

  return {
    content,
    tokens_input,
    tokens_output,
    total_tokens,
    cost_brl_input:  costs.cost_brl_input,
    cost_brl_output: costs.cost_brl_output,
    cost_brl:        costs.total_cost_brl,
  };
}

async function callOpenRouter(opts: ProviderCallOptions): Promise<ProviderCallResult> {
  // OpenRouter: schema OpenAI-compatível, com headers extras de atribuição
  const messages = [
    { role: 'system', content: opts.systemPrompt },
    ...opts.messages,
  ];

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${opts.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://mandato-desk-2026.pages.dev',
      'X-Title': 'Mandato Desk 2026',
    },
    body: JSON.stringify({
      model: opts.modelId,
      messages,
      max_tokens: opts.maxTokens,
      temperature: opts.temperature ?? 0.7,
    }),
    signal: AbortSignal.timeout(50_000),
  });

  if (!res.ok) {
    const status = res.status;
    await res.text().catch(() => null);
    throw new ProviderError('openrouter', status);
  }

  const data = await res.json() as {
    choices: Array<{ message: { content: string } }>;
    usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  };

  const content = data.choices?.[0]?.message?.content ?? '';
  const tokens_input  = data.usage?.prompt_tokens ?? 0;
  const tokens_output = data.usage?.completion_tokens ?? 0;
  const total_tokens  = data.usage?.total_tokens ?? (tokens_input + tokens_output);

  const costs = calculateCost(opts.modelId, tokens_input, tokens_output);

  return {
    content,
    tokens_input,
    tokens_output,
    total_tokens,
    cost_brl_input:  costs.cost_brl_input,
    cost_brl_output: costs.cost_brl_output,
    cost_brl:        costs.total_cost_brl,
  };
}

// ── Mapeamento de model IDs Anthropic ────────────────────────────────────────
// Banco armazena 'anthropic/claude-3.5-haiku'.
// API Anthropic espera o nome do modelo sem prefixo de provider.

const ANTHROPIC_MODEL_MAP: Record<string, string> = {
  'anthropic/claude-3.5-haiku':  'claude-3-5-haiku-20241022',
  'anthropic/claude-3.5-sonnet': 'claude-3-5-sonnet-20241022',
  'anthropic/claude-opus-4':     'claude-opus-4-5',
};

function mapAnthropicModel(modelId: string): string {
  if (ANTHROPIC_MODEL_MAP[modelId]) return ANTHROPIC_MODEL_MAP[modelId];
  // Tenta remover prefixo 'anthropic/' como fallback
  if (modelId.startsWith('anthropic/')) return modelId.slice('anthropic/'.length);
  return modelId;
}

// ── Classe de erro tipada ─────────────────────────────────────────────────────

export class ProviderError extends Error {
  constructor(
    public readonly provider: string,
    public readonly httpStatus: number,
  ) {
    super(`${provider} HTTP ${httpStatus}`);
    this.name = 'ProviderError';
  }
}

// ── Interface pública ─────────────────────────────────────────────────────────

/**
 * Chama o provider de IA apropriado com interface unificada.
 * Roteia para o adapter correto baseado em opts.provider.
 * Lança ProviderError em caso de falha HTTP.
 */
export async function callProvider(opts: ProviderCallOptions): Promise<ProviderCallResult> {
  switch (opts.provider) {
    case 'openai':
      return callOpenAI(opts);
    case 'anthropic':
      return callAnthropic(opts);
    case 'openrouter':
      return callOpenRouter(opts);
    default:
      throw new ProviderError(opts.provider, 0);
  }
}

// ── Lista de modelos multimodais (bloqueados por text_only_mode) ──────────────
// Esses modelos têm capacidade de visão/áudio. Se text_only_mode=true, são rejeitados.

export const MULTIMODAL_MODELS = new Set([
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
  'openai/gpt-4-vision-preview',
  'google/gemini-2.5-flash',
  'google/gemini-2.5-pro',
  'google/gemini-1.5-pro',
  'google/gemini-1.5-flash',
  'anthropic/claude-3-opus-20240229',
  'anthropic/claude-opus-4',
]);
