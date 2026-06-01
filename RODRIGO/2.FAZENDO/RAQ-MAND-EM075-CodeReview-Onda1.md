# Code Review - RAQ-MAND-EM075 Onda 1
Branch: rodrigo/feature/RAQ-MAND-EM075-agente-de-ia-integrado-ao-crm-agente
Commit: b697b0a | Data: 2026-05-21

## Escopo
- Diff: 13 arquivos, +1691 -1
- Build: verde | Lint: zero erros no diff | Typecheck: zero erros

## Sumario
| Tipo | Contagem |
|------|----------|
| must-fix | 3 |
| suggestion | 4 |
| nitpick | 3 |
| praise | 4 |
| question | 2 |

## Top 3 Must-Fix

1. [must-fix] useProviderCredentials.ts:86-88 - Chave de API em texto puro no payload HTTP (confirma SEC-001). Fix: view SQL com mascara no banco.
2. [must-fix] 090_ai_chat_schema.sql:72 - MIN(s.id) em UUID nao cronologico. Fix: ORDER BY created_at ASC LIMIT 1.
3. [must-fix] 089_ai_agent_budget.sql:164-167 - INSERT aberto em ai_chat_messages_cost. Fix: restringir a service_role.

## Findings por Arquivo

### 086_ai_agents.sql

[praise] Cabecalho completo: explica por que separar ai_agents vs ai_settings, singleton, RLS. Padrao ideal.

[praise] Seed idempotente com WHERE NOT EXISTS correto.

[suggestion] 086:73 - set_updated_at() redefine logica identica a update_updated_at_column() de 001_complete_schema.sql. Considere reusar para DRY.

[suggestion] 086:118 e 087:98 - security_invoker = false nas views publicas (SEC-002). Fragil se GRANT mudar para anon. Corrigir para security_invoker = true + policy SELECT para authenticated nas proximas Ondas.

[nitpick] 086:26 - is_admin() centraliza logica quebrando padrao inline existente. Melhoria valida, documentar no historico.md.

### 087_ai_provider_credentials.sql

[must-fix] Raiz no hook useProviderCredentials.ts:86-88. Migration correta. O hook faz .select(api_key) direto na tabela - chave trafega no HTTP antes de maskKey(). Fix: criar view admin com mascara SQL (SQL no Security Report SEC-001), alterar hook.

[praise] Separacao entre hook publico e hook admin e design limpo na intencao.

### 088_ai_agent_model_presets.sql

[praise] Seed com bloco DO idempotente, guards IF EXISTS, RAISE NOTICE - padrao ideal para staging.

[question] 088:34 - preset_key aceita custom no CHECK mas seed nao cria esse preset. Intencional (Onda 3)? Adicionar comentario se sim.

[nitpick] is_active_preset poderia ser is_active mas ambiguidade com ai_agents.is_active justifica nome especifico.

### 089_ai_agent_budget.sql

[must-fix] 089:164-167 - WITH CHECK (true) em INSERT de ai_chat_messages_cost: qualquer autenticado injeta custos falsos. Impacto funcional: useAgentBudgetSpend mostra status errado. Fix: trocar TO authenticated por TO service_role.

[suggestion] 089:184-199 - ai_agent_current_spend(p_agent_id UUID): parametro ignorado. Adicionar comentario: p_agent_id ignorado neste MVP.

[suggestion] 089:84 + 090:129 - message_id (sem FK) e message_id_fk (com FK): duas colunas para o mesmo papel. Consolidar em Onda 2.

### 090_ai_chat_schema.sql

[must-fix] 090:72 - MIN(s.id) em UUID v4 nao e cronologico. Sessao deletada e imprevisivel.

Fix:
  SELECT COUNT(*) INTO v_count FROM public.ai_chat_sessions WHERE user_id = NEW.user_id;
  IF v_count >= 200 THEN
    SELECT id INTO v_oldest_id FROM public.ai_chat_sessions
    WHERE user_id = NEW.user_id ORDER BY created_at ASC LIMIT 1;
    DELETE FROM public.ai_chat_sessions WHERE id = v_oldest_id;
  END IF;

[question] 090:118 - total_tokens calculado pela EF. Existe caso onde total_tokens != tokens_input + tokens_output? Se nao, GENERATED ALWAYS AS seria mais seguro.

[nitpick] COMMENT ON TABLE ai_chat_sessions aparece duas vezes. Unificar.

### 091_ai_chat_favorites_and_attachments.sql

[suggestion] 091:26 - message_id ON DELETE CASCADE: sessoes expiram 30d, deletam mensagens, que deletam favoritos. Comentario diz NAO expiram, mas na pratica sim. Revisar antes da Onda 4.

### src/hooks/useAgentSettings.ts

[praise] Type guard isFullAgentSettings() excelente - estreita tipo com seguranca nos componentes da Onda 4.

[suggestion] Interfaces locais (nao Tables<ai_agents>). Esperado. Registrar TODO: regenerar tipos.

### src/hooks/useProviderCredentials.ts

[must-fix] useProviderCredentials.ts:86 - rawKey tem chave real antes de maskKey(). Fix: trocar query direto pela view admin com mascara SQL (SEC-001).

### src/hooks/useAgentBudget.ts

Design correto: useAgentBudget retorna config, useAgentBudgetSpend compoe config + RPC. Separacao clara.

[suggestion] useAgentBudget.ts:135 - refetchInterval: 60_000 ativo em background. Adicionar refetchIntervalInBackground: false ou invalidar via queryClient na Onda 4.

### src/hooks/useAgentPresets.ts

as never em .from() e pragmatico e correto. Aceitavel para Onda 1.

### src/hooks/useAgentFavorites.ts

Design limpo. FAVORITES_LIMIT como constante exportada evita magic number.

### src/types/permissions.ts + src/components/layout/AppSidebar.tsx

[praise] agente_ia: () => false com comentario sobre Onda 4 - padrao correto para feature flags progressivas sem quebrar RBAC.

## Verificacoes Cross-Cutting

Ordem 086->091 coerente. FK diferida em 089/090 deselegante mas correta.
set_updated_at() duplica update_updated_at_column() de 001 - DRY smell, nao e bug.
Zero erros de build/lint/typecheck nos arquivos do diff.

## Veredicto

[x] BLOQUEAR - 3 must-fix precisam ser resolvidos antes do merge

Blockers:
1. Chave de API em texto puro no payload HTTP (view admin SQL faltando)
2. Trigger deleta sessao errada (MIN(id) em UUID nao e cronologico)
3. INSERT aberto em ai_chat_messages_cost (manipulacao de gastos)

Apos resolucao dos 3 must-fix: aprovado para merge.
As 4 suggestions sao nao bloqueantes - podem ir na Onda 2 ou 3.
