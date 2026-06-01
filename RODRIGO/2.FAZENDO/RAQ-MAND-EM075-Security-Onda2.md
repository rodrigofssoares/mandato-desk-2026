# Auditoria de Seguranca RAQ-MAND-EM075 Onda 2

Data: 2026-05-21
Branch: rodrigo/feature/RAQ-MAND-EM075-agente-de-ia-integrado-ao-crm-agente

## Escopo
- supabase/functions/_shared/agent-providers.ts
- supabase/functions/_shared/ai-security.ts
- supabase/functions/_shared/admin-guard.ts
- supabase/functions/ai-test-provider-key/index.ts
- supabase/functions/ai-agent-extract-text/index.ts
- supabase/functions/ai-agent-chat/index.ts
- supabase/migrations/086_ai_agents.sql
- supabase/migrations/088_ai_agent_model_presets.sql
- supabase/migrations/089_ai_agent_budget.sql
- supabase/migrations/090_ai_chat_schema.sql
- supabase/migrations/091_ai_chat_favorites_and_attachments.sql
- supabase/migrations/092_ai_provider_credentials_admin_view.sql

## Sumario
- CRITICAS: 0
- ALTAS: 2
- MEDIAS: 4
- BAIXAS: 4
- INFO: 2

## Layer 1 — 13 VibeCoding

| # | Vulnerabilidade | Status | Local |
|---|---|---|---|
| 1 | Race Condition | PARCIAL | ai-agent-chat/index.ts:190-214 |
| 2 | IDOR | SEGURO | Session ownership + RLS |
| 3 | SQL Injection | VULNERAVEL | ai-agent-chat/index.ts:214 — userId interpolado em filtro PostgREST raw |
| 4 | XSS | NA | EFs sem HTML rendering |
| 5 | Image Tracker SSRF | SEGURO | URLs hard-coded + validateMediaUrl() allowlist |
| 6 | Upload Malicioso | PARCIAL | ai-agent-extract-text:388-393 sem magic bytes + zip bomb |
| 7 | Mass Assignment | SEGURO | Campos explícitos, sem body spread |
| 8 | Input Flooding | SEGURO | message<=8K, file<=5MB, MAX_TEXT_CHARS=100K |
| 9 | Enumeracao Usuarios | SEGURO | Erros genericos |
| 10 | Logica de Negocio | PARCIAL | Budget sem lock; p_agent_id ignorado |
| 11 | Secrets no Codigo | SEGURO | Deno.env + sanitizeForLog + view mascarada |
| 12 | JWT Inseguro | SEGURO | getUser server-side; sem algoritmo none |
| 13 | Bypass URL | SEGURO | model_id validado contra preset; UUID_REGEX |

## ALTA-01 [OWASP A04/CWE-770] Zip Bomb em DOCX

Arquivo: supabase/functions/ai-agent-extract-text/index.ts:192-215

decompressDeflateAsync() acumula chunks sem limite de bytes totais.
DOCX de 4,9 MB com deflate bomb pode expandir para centenas de MB,
esgotando memoria da Edge Function e causando DoS para todos os usuarios.

Fix: adicionar contador totalBytes com limite MAX_DECOMPRESSED = 20MB
no loop de leitura do reader, lancando erro ao ultrapassar.

## ALTA-02 [VibeCoding #3 / OWASP A03/CWE-89] Padrao SQL injection via interpolacao PostgREST

Arquivo: supabase/functions/ai-agent-chat/index.ts:214

Codigo:
.filter('session_id', 'in', `(SELECT id FROM ai_chat_sessions WHERE user_id = '${userId}')`)

userId vem de auth.uid() (UUID validado), eliminando risco real nesta versao.
Porem o padrao e intrinsecamente inseguro e bloqueia auditoria futura.

Fix: substituir por RPC parametrizada ai_count_user_messages_today(p_user_id, p_since)
usando SECURITY DEFINER com parametros tipados.

## MEDIA-01 [OWASP A04/LLM] Anti-injection incompleto — fenceId descartado

Arquivo: supabase/functions/ai-agent-chat/index.ts:394 + _shared/ai-security.ts:208-210

wrapUserContent() retorna fenceId que e descartado na linha 394:
  const { wrapped: wrappedUserMsg } = wrapUserContent(message, 'mensagem_usuario');

antiInjectionInstruction(fenceId) nunca e inserida no systemText.
O LLM recebe o wrap mas sem instrucao de que o conteudo entre as cercas e dado nao-confiavel.

Fix (2 linhas):
  const { wrapped: wrappedUserMsg, fenceId } = wrapUserContent(message, 'mensagem_usuario');
  systemText = antiInjectionInstruction(fenceId) + '

' + systemText;

## MEDIA-02 [OWASP A04/CWE-400] isRateLimited() sem filtro ef_name

Arquivo: supabase/functions/_shared/ai-security.ts:129-133

Parametro efName existe na assinatura mas nao e usado no WHERE.
Cota de 20/min e compartilhada entre todas as EFs do usuario.

Fix (1 linha): adicionar .eq('ef_name', efName) na query.

## MEDIA-03 [VibeCoding #6 / OWASP A04/CWE-434] Magic bytes nao validados

Arquivo: supabase/functions/ai-agent-extract-text/index.ts:388-393

Validacao apenas por extensao de nome. Arquivo .pdf com conteudo arbitrario passa.

Fix: verificar magic bytes apos ler o buffer:
  PDF: %PDF- (0x25 0x50 0x44 0x46)
  DOCX: PK header (0x50 0x4B 0x03 0x04)

## MEDIA-04 [OWASP A01/CWE-284] RLS INSERT ai_chat_messages_cost com WITH CHECK (true)

Arquivo: supabase/migrations/089_ai_agent_budget.sql:164-167

Qualquer usuario autenticado pode inserir registros de custo com user_id arbitrario,
inflando cap de outros usuarios ou hard cap global.

Fix:
  CREATE POLICY ... FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

## BAIXAS

LOW-01 Rate limit fail-open: isRateLimited() retorna false em erro de DB.
  Aceitar como trade-off consciente, documentar no codigo.

LOW-02 ai_agent_current_spend() ignora p_agent_id.
  Inofensivo no MVP singleton. Documentar limitacao pre-multi-agente.

LOW-03 Historico do banco sem wrap anti-injection.
  Mensagens historicas nao sao wrapped. Inconsistente com modelo de seguranca.

LOW-04 extractZipEntry busca linear byte-a-byte.
  DOCX invalido de 5 MB causa ~5M iteracoes. Adicionar early-exit.

## INFO

INFO-01 CORS * em EFs com JWT: Aceitavel. JWT e a camada de autorizacao real.

INFO-02 Resposta LLM nao sanitizada: verificar que frontend usa markdown sanitizado,
  nao innerHTML raw (auditar componente de chat na Onda 3).

## Veredicto

APROVADO COM RESSALVAS
2 findings altas devem ser corrigidas antes de go-live.
Sem findings criticas que bloqueiem merge em desenvolvimento.

## Ordem de correcao

1. ALTA-01 zip bomb: ~30 min
2. MEDIA-01 anti-injection incompleto: ~10 min
3. ALTA-02 padrao SQL injection: ~1h (nova RPC)
4. MEDIA-02 rate limit ef_name: ~5 min
5. MEDIA-04 RLS INSERT cost: ~15 min
6. MEDIA-03 magic bytes: ~30 min

Pentest recomendado: SIM. Corrigir ALTA-01 e MEDIA-01 antes de disparar.
