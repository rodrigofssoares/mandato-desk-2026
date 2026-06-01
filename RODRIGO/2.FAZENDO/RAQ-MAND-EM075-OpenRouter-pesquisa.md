# OpenRouter — Referência técnica para implementação

**Pesquisado em:** 2026-05-21
**Fonte oficial:** https://openrouter.ai/docs/quickstart

---

## 1. Endpoint

```
POST https://openrouter.ai/api/v1/chat/completions
```

Schema **compatível com OpenAI Chat Completions** — facilita reuso de código.

Endpoint auxiliar para listar modelos disponíveis:

```
GET https://openrouter.ai/api/v1/models
```

---

## 2. Headers HTTP

| Header | Obrigatório? | Valor |
|--------|--------------|-------|
| `Authorization` | ✅ | `Bearer <OPENROUTER_API_KEY>` |
| `Content-Type` | ✅ | `application/json` |
| `HTTP-Referer` | ⚠️ recomendado | URL da app (ex: `https://mandato-desk-2026.pages.dev`) — usado pra rankings/analytics da OpenRouter |
| `X-Title` (ou `X-OpenRouter-Title`) | ⚠️ recomendado | Nome legível da app (ex: `Mandato Desk 2026`) |

> ⚠️ Sem `HTTP-Referer` e `X-Title`, a app não aparece no ranking público da OpenRouter — não bloqueia funcionamento, mas perde atribuição.

---

## 3. Body da requisição

```json
{
  "model": "anthropic/claude-3.5-sonnet",
  "messages": [
    { "role": "system", "content": "Você é um assistente do gabinete..." },
    { "role": "user", "content": "Como respondo a um eleitor pedindo asfalto na rua dele?" }
  ],
  "stream": false,
  "max_tokens": 2048,
  "temperature": 0.7
}
```

**Campos suportados** (subset OpenAI):

- `model` — `provider/model-id` (ver §4)
- `messages[]` — array `{ role: 'system' | 'user' | 'assistant', content: string }`
- `stream` — boolean (SSE quando true)
- `max_tokens` — int (default varia por modelo)
- `temperature` — float 0-2
- `top_p`, `top_k`, `presence_penalty`, `frequency_penalty`, `stop`, `tools`, `tool_choice` — todos suportados (ver doc completa)

---

## 4. Formato do `model` ID

Padrão sempre: **`provider/model-name`**.

Modelos populares (lista curada sugerida pra UI):

| Provider | Model ID | Notas |
|----------|----------|-------|
| OpenAI | `openai/gpt-4o` | Multimodal, rápido, barato |
| OpenAI | `openai/gpt-4.1` | Versão mais nova |
| OpenAI | `openai/o3-mini` | Reasoning (mais caro) |
| Anthropic | `anthropic/claude-3.5-sonnet` | Equilíbrio qualidade/preço |
| Anthropic | `anthropic/claude-3.5-haiku` | Mais barato/rápido |
| Anthropic | `anthropic/claude-opus-4` | Topo de linha |
| Meta | `meta-llama/llama-3.3-70b-instruct` | Open source, barato |
| Google | `google/gemini-2.5-flash` | Rápido, contexto longo (1M) |
| Google | `google/gemini-2.5-pro` | Premium, contexto longo |
| DeepSeek | `deepseek/deepseek-chat` | Open source, barato |
| Mistral | `mistralai/mistral-large` | EU-based |

> **Lista completa atualizada:** `GET /api/v1/models` retorna o catálogo vivo.
> **UI:** lista curada acima + campo de texto livre pra `provider/model-id` (input pattern `^[a-z0-9\-]+\/[a-z0-9\-\.]+$`).

---

## 5. Streaming (SSE)

Quando `stream: true`, resposta é **Server-Sent Events** no padrão OpenAI:

```
data: {"id":"...","choices":[{"delta":{"content":"Olá"},"index":0}]}

data: {"id":"...","choices":[{"delta":{"content":", como"},"index":0}]}

data: [DONE]
```

Para o MVP do RAQ-MAND-EM075, **NÃO usaremos streaming no Slice 1** (PO definiu — resposta completa). Slice 3 evolutivo.

---

## 6. Resposta non-stream

```json
{
  "id": "gen-...",
  "model": "anthropic/claude-3.5-sonnet",
  "choices": [
    {
      "message": { "role": "assistant", "content": "Resposta aqui..." },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 145,
    "completion_tokens": 312,
    "total_tokens": 457
  }
}
```

> `usage.total_tokens` é importante pra registrar custo por sessão no banco (campo `total_tokens` em `ai_chat_messages`).

---

## 7. Códigos de erro relevantes

| Código | Significado | Tratamento |
|--------|-------------|------------|
| 401 | API key inválida | Mostrar erro pra admin reconfigurar |
| 402 | Saldo insuficiente | Mostrar erro pra admin recarregar OpenRouter |
| 429 | Rate limit | Backoff + retry 1x, depois falhar |
| 503 | Modelo indisponível | Tentar fallback model (se config) |

---

## 8. Implicação para Edge Function

Para o `supabase/functions/ai-agent-chat/index.ts` (Deno):

```ts
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://mandato-desk-2026.pages.dev',
    'X-Title': 'Mandato Desk 2026',
  },
  body: JSON.stringify({
    model: agent.model,           // ex: 'anthropic/claude-3.5-sonnet'
    messages: [...],
    max_tokens: 2048,
    temperature: 0.7,
  }),
});
```

**Roteamento por provider no MVP:**

| Provider escolhido em `ai_agents.provider` | URL base | Diferença |
|---|---|---|
| `openai` | `https://api.openai.com/v1/chat/completions` | Body idêntico, sem headers HTTP-Referer/X-Title |
| `anthropic` | `https://api.anthropic.com/v1/messages` | Body **diferente** (não usa `messages[]` no formato OpenAI; usa `system` separado + `messages[]` com role user/assistant apenas). Precisa adaptador. |
| `openrouter` | `https://openrouter.ai/api/v1/chat/completions` | Compatível OpenAI |

> **Recomendação para MVP:** padronizar tudo via **OpenRouter** mesmo quando admin escolher OpenAI/Anthropic — OpenRouter expõe ambos modelos com schema OpenAI. Simplifica drasticamente a Edge Function. Mas custa ~5% a mais pela camada OpenRouter.
>
> **Alternativa:** 3 caminhos distintos na Edge Function (OpenAI direto / Anthropic adaptado / OpenRouter direto). Mais código, sem markup OpenRouter. Decisão de Rodrigo.

---

## 9. Limitação importante (Brasil/LGPD)

OpenRouter roteia para múltiplos providers globais (US, EU, possivelmente APAC). Não há garantia de residência de dados no Brasil. Confirma o risco LGPD levantado pelo PO (seção 9 do refinamento — opção A: warning educativo na UI).
