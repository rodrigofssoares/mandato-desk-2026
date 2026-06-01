# Re-Auditoria de Seguranca - RAQ-MAND-EM075 Onda 1.1

**Branch:** rodrigo/feature/RAQ-MAND-EM075-agente-de-ia-integrado-ao-crm-agente
**Commits auditados:** e238d36..755b9f1 (5 commits)
**Data:** 2026-05-21
**Auditor:** Security Agent (defensivo)

---

## Arquivos auditados

| Arquivo | Tipo |
|---------|------|
| supabase/migrations/092_ai_provider_credentials_admin_view.sql | Migration SQL |
| supabase/migrations/093_fix_ai_chat_sessions_limit_trigger.sql | Migration SQL |
| supabase/migrations/094_fix_chat_messages_cost_policy.sql | Migration SQL |
| supabase/migrations/095_fix_public_views_security_invoker.sql | Migration SQL |
| supabase/migrations/096_ai_settings_admin_view.sql | Migration SQL |
| src/hooks/useProviderCredentials.ts | Hook TypeScript |
| src/hooks/useAISettings.ts | Hook TypeScript |
| src/hooks/useAgentSettings.ts | Hook TypeScript (auditado como regressao) |

---

## Status dos Findings Originais

### SEC-001 (CRITICAL) - API key vazando no payload

**Status: FIXADO**

Migration 092 cria ai_provider_credentials_admin_view com security_invoker = true.
A mascara e aplicada no banco via SQL CASE: api_key_masked (ex: sk-...ABCD) e
api_key_set (boolean). A chave real nunca sai do servidor.

Migration 096 aplica o mesmo padrao para ai_settings via ai_settings_admin_view
com security_invoker = true. Ambas as views respeitam RLS das tabelas base.

useAdminProviderCredentials (linha 84) le de ai_provider_credentials_admin_view
selecionando api_key_masked e api_key_set - nunca a coluna api_key real.

useAISettings (linha 107-108) le de ai_settings_admin_view para admins, mapeando
api_key_masked para o campo api_key da interface com comentario explicito.

Nota: tripleGateAI() em _shared/ai-security.ts:77 faz SELECT api_key diretamente
na tabela ai_settings usando cliente service_role (Edge Function). CORRETO e intencional.
A Edge Function precisa da chave real para chamar o provider. Nao e vulnerabilidade.

---
### SEC-002 (HIGH) - VIEWs com security_invoker=false bypassando RLS

**Status: FIXADO (com regressao - ver SEC-004)**

Migration 095 implementou Opcao B com REVOKE SELECT em ai_agents e
ai_provider_credentials para o role authenticated. Views publicas recriadas
com GRANT SELECT expliciito.

A logica: com o REVOKE, usuario autenticado nao consegue SELECT direto na tabela
mesmo que tente bypassar a view. A view security_invoker=false roda como owner
mas expoe apenas colunas nao-sensiveis.

is_admin() ainda funciona com REVOKE? Sim. A funcao consulta profiles, nao tabelas de AI.
O REVOKE nao afeta o helper.

Ressalva: o REVOKE em ai_agents cria regressao para admins no frontend - ver SEC-004.

---

### SEC-003 (HIGH) - Policy WITH CHECK(true) em ai_chat_messages_cost

**Status: FIXADO**

Migration 094:
1. Remove a policy permissiva que usava WITH CHECK (true) para authenticated.
2. Cria policies de bloqueio para UPDATE e DELETE com USING (false) e WITH CHECK (false).
3. INSERT agora e exclusivo via service_role (Edge Function) que bypassa RLS.

Fluxo continua funcional: Edge Function ai-agent-chat usara service_role para inserir
custos sem precisar de policy para authenticated.

---

### Must-fix 2 (Code Review) - Trigger MIN(id) UUID

**Status: FIXADO**

Migration 093 substitui ai_chat_sessions_limit_trigger():
- Antes: MIN(s.id) - UUID v4 aleatorio, resultado imprevisivel
- Depois: ORDER BY created_at ASC, id ASC LIMIT 1 com tiebreaker id ASC
  para resultado estavel em inserts simultaneos.

---

## Novo Finding Introduzido pelas Correcoes

### SEC-004 (ALTA) - REVOKE em ai_agents quebra acesso admin via frontend

**VibeCoding #2 / OWASP A01 / CWE-285**

**Arquivos:**
- supabase/migrations/095_fix_public_views_security_invoker.sql:34 (REVOKE)
- src/hooks/useAgentSettings.ts:57 (SELECT direto na tabela, branch admin)

**Descricao:**

Migration 095 executa REVOKE SELECT ON public.ai_agents FROM authenticated.
Porem, useAgentSettings.ts no branch admin (linhas 54-75) faz SELECT direto na tabela.

O cliente Supabase no frontend usa JWT do usuario autenticado (role authenticated).
Apos o REVOKE, mesmo o admin recebe erro de permissao ao tentar SELECT direto
na tabela ai_agents via frontend.

Por que ocorreu: o REVOKE e correto para ai_provider_credentials porque o admin
usa a admin_view (092). Mas nao foi criada ai_agents_admin_view equivalente.

Impacto: A sub-aba de configuracao do agente (Onda 3) ficara quebrada para admins.
O admin nao consegue ler system_prompt, text_only_mode ou dados completos.

**Como corrigir (Opcao A - preferida):**

Migration 097:

    CREATE OR REPLACE VIEW public.ai_agents_admin_view
    WITH (security_invoker = true)
    AS
      SELECT id, name, system_prompt, is_active, text_only_mode,
             created_by, updated_by, created_at, updated_at
      FROM public.ai_agents;

    REVOKE ALL ON public.ai_agents_admin_view FROM PUBLIC;
    GRANT SELECT ON public.ai_agents_admin_view TO authenticated;

useAgentSettings.ts branch admin: mudar .from(ai_agents) para .from(ai_agents_admin_view).
A view com security_invoker = true respeita a policy admin-only da tabela base.

Opcao B (alternativa): GRANT SELECT de volta para authenticated em ai_agents e deixar
a RLS restringir. Funciona mas e inconsistente com o modelo adotado em 095.

Recomendacao: Opcao A. Mantem o padrao REVOKE + view para todas as tabelas de AI.

---

## Analise de Side-Channels

**Timing attack em api_key_set:** Nao aplicavel. Booleano (api_key IS NOT NULL)
nao permite inferir o valor da chave. Informacao legitima para UI exibir status.

**GRANT SELECT na admin_view para todo authenticated e seguro?**
Sim, porque as views admin usam security_invoker = true - elas RESPEITAM a RLS da tabela
base. A policy SELECT usa USING (public.is_admin()). Nao-admin recebe resultado vazio.
O GRANT e necessario para o cliente consultar a view; restricao feita pela RLS.

---

## Sumario de Findings

| ID | Severidade | Status original | Status Onda 1.1 |
|----|-----------|-----------------|-----------------|
| SEC-001 | CRITICAL | ABERTO | FIXADO |
| SEC-002 | HIGH | ABERTO | FIXADO (com regressao SEC-004) |
| SEC-003 | HIGH | ABERTO | FIXADO |
| must-fix 2 | MEDIUM | ABERTO | FIXADO |
| SEC-004 | ALTA (novo) | - | ABERTO - regressao introduzida |

---

## Veredicto

APROVADO COM RESSALVAS

Os 3 findings originais (1 CRITICAL + 2 HIGH) foram corrigidos corretamente.
O must-fix do trigger tambem esta correto.

A correcao do SEC-002 introduziu regressao de permissao (SEC-004 - ALTA) que quebra
o acesso admin ao system_prompt e dados completos do agente no frontend.
A regressao bloquearia a sub-aba de configuracao do agente (Onda 3).

Proximo passo obrigatorio antes do merge:
- Criar migration 097 com ai_agents_admin_view (Opcao A acima)
- Atualizar src/hooks/useAgentSettings.ts branch admin para ler da nova view
- Sem essa correcao, a pagina de configuracao do agente fica quebrada para admins

Os demais findings MEDIUM/LOW do relatorio original permanecem com status anterior.