# Code Review - RAQ-MAND-EM075 Onda 2 + 2.1

## Escopo

- Branch: rodrigo/feature/RAQ-MAND-EM075-agente-de-ia-integrado-ao-crm-agente
- Commits: ddff353 ate 834f329 (7 commits: 4 Onda 2 + 3 fixes 2.1)
- Diff: 6 arquivos, +1755 -1 linhas
- Lint/build: 4 erros pre-existentes em normalization.ts e tailwind.config.ts, fora do escopo desta Onda. Arquivos do diff nao introduzem novos erros.

---

## Aprovacao geral

Trabalho bem estruturado e seguro por padrao. Destaques positivos:
- agent-providers.ts abstrai 3 providers com interface unificada (callProvider + ProviderCallOptions + ProviderCallResult)
- AbortSignal.timeout(50s) em todos os fetches externos; guards ?. em todos os paths de resposta
- ai-security.ts: wrapUserContent + antiInjectionInstruction, sanitizeForLog cobrindo todos os providers, rate-limit isolado por EF (fix MED-02 correto)
- Migration 098 exemplar: SECURITY DEFINER + SET search_path =  + REVOKE PUBLIC + REVOKE authenticated + GRANT service_role
- DOCX zip-bomb guard: abort do stream antes de alocar o Uint8Array final
- Comments explicam o por que (MED-01, MED-02, ALTA-02)

---

## MUST-FIX (bloqueiam merge)

[must-fix] agent-providers.ts:7 vs :29 - Inconsistencia no nome da env var
O cabecalho documenta OPENAI_USD_TO_BRL mas o codigo le USD_TO_BRL.
Admin que seguir o comentario vai setar a variavel errada em producao.
A conversao usara fallback R.50 silenciosamente sem nenhum aviso.
Correcao: alinhar cabecalho para USD_TO_BRL, ou adicionar warn:
  console.warn('agent-providers: USD_TO_BRL nao configurada, usando default 5.5');

[must-fix] ai-agent-chat/index.ts:28 vs ai-security.ts:111 - Limite documentado diverge do real
Cabecalho e comentario inline dizem 30 msgs/min mas isRateLimited() usa RATE_LIMIT_PER_MIN = 20.
O limite real aplicado e 20. Mensagem de erro tambem diz 30 - gera falsa expectativa na UI.
Correcao: alinhar constante para 30 (se era a intencao) ou corrigir comentarios + mensagem para 20.

[must-fix] ai-agent-extract-text/index.ts:70-191 - Dead code: extractDocx e decompressDeflate nunca chamadas
O handler real chama extractDocxAsync() (linha 525). As funcoes extractDocx() (linha 70) e
decompressDeflate() (linha 163) nunca sao invocadas. Pior: decompressDeflate() intencionalmente
lanca throw new Error('USE_ASYNC_DECOMPRESS') com codigo morto apos o throw.
Correcao: remover extractDocx() e decompressDeflate(). bytesEqual() pode ser mantida pois
e usada em extractDocxAsync(). Codigo canonico e exclusivamente extractDocxAsync().

[must-fix] ai-agent-chat/index.ts:426 - { error: 'provider_error' } com HTTP 200 quebra o contrato
Todos os outros casos usam { skipped: true, reason: ... } com 200. Este mistura error com
o padrao skipped, quebrando a consistencia do contrato da API. Cliente que nao inspecionar
o corpo vai tratar como sucesso.
Correcao: return jsonResponse(200, { skipped: true, reason: 'provider_error' });

---

## SHOULD-FIX

[suggestion] ai-agent-chat/index.ts:46 - calculateCost importado mas nunca usado
O custo ja vem dentro de providerResult. Remover da linha de import.

[suggestion] ai-security.ts:197 - Parametro label de wrapUserContent nunca usado no corpo
Assinatura recebe label: string mas o corpo ignora. Caller passa 'mensagem_usuario' e a
informacao se perde. Remover o parametro ou usar no fence:
  ---DADOS_EXTERNOS__---

[suggestion] ai-agent-chat/index.ts:227-249 - Cap mensal de custo busca N linhas e soma em JS
O cap diario usa RPC parametrizada (otimo). O cap mensal faz SELECT de todas as linhas do mes
e soma em JS. Para usuario ativo pode retornar centenas de linhas.
Considerar RPC ai_sum_user_cost_current_month(p_user_id) fazendo SUM() no banco.

[suggestion] ai-agent-chat/index.ts:147 - SELECT em ai_agents sem filtro
service_role bypassa RLS. Se uma segunda linha existir (bug de seed), retorna resultado arbitrario.
Adicionar comentario explicito ou .limit(1) para deixar a intencao singleton clara.

---

## NITPICKS

[nitpick] ai-agent-extract-text/index.ts:39-42 - Import inline de SupabaseClient dentro de parametro
  admin: import('https://esm.sh/@supabase/supabase-js@2').SupabaseClient
Nao-idiomatico para Deno. Os outros arquivos importam SupabaseClient no topo - padronizar.

[nitpick] agent-providers.ts:249 - claude-opus-4-5 como API name pode confundir sem comentario
PRICING usa anthropic/claude-opus-4 (alias interno), ANTHROPIC_MODEL_MAP mapeia para claude-opus-4-5
(nome real da API). Nao e bug, mas um comentario explicando o sufixo -5 seria util.

[nit] Nenhum dos 3 diretorios de EF tem README.md
Boa pratica Supabase. Nao bloqueia merge.

---

## QUESTIONS

[question] ai-agent-chat/index.ts:117 vs 406 - TOCTOU no rate limit
Entre o check (linha 117) e o registro (linha 406) ha ~15 awaits. Duas requisicoes simultaneas
passarao pelo check antes de qualquer uma registrar. Para MVP em gabinete e aceitavel, mas
vale documentar como decisao consciente ou corrigir com atomic increment.

---

## PRAISE

[praise] supabase/migrations/098_ai_count_user_messages_today.sql
Exemplar: SECURITY DEFINER + SET search_path = '' + REVOKE PUBLIC + REVOKE authenticated
+ GRANT service_role + COMMENT descritivo. Serve de template para RPCs internas do projeto.

[praise] ai-agent-extract-text/index.ts:193-223 - decompressDeflateAsync com zip-bomb guard
Acumula totalBytes durante o stream e aborta com reader.cancel() antes de montar o buffer final.
Economiza memoria nao alocando o Uint8Array gigante antes de perceber que excedeu o limite.

[praise] ai-security.ts - wrapUserContent + antiInjectionInstruction como par inseparavel
Retornar fenceId do wrap e exigir que o caller injete antiInjectionInstruction(fenceId) no
system prompt cria contrato que torna impossivel usar wrap sem instrucao de seguranca.

[praise] _shared/agent-providers.ts - interface publica minima
So callProvider, calculateCost, ProviderError e MULTIMODAL_MODELS sao exportados.
EFs nao precisam saber qual adapter interno e chamado.

---

## Veredicto

APROVAR COM AJUSTES

4 must-fix precisam ser resolvidos antes do merge. Sao todos pequenos (inconsistencia de
documentacao, dead code, 1 linha de response format) e nao envolvem reescritas. Nenhum e
regressao de seguranca - a Onda 2.1 ja fechou as vulnerabilidades criticas.

Resumo para Fullstack:
1. agent-providers.ts: alinhar env var OPENAI_USD_TO_BRL -> USD_TO_BRL no cabecalho (ou warn)
2. ai-agent-chat/index.ts: corrigir 30 msgs/min -> 20 msgs/min (ou ajustar constante para 30)
3. ai-agent-extract-text/index.ts: remover extractDocx() e decompressDeflate() (dead code)
4. ai-agent-chat/index.ts:426: { error: 'provider_error' } -> { skipped: true, reason: 'provider_error' }