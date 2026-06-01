# Auditoria de Seguranca - RAQ-MAND-EM075 Onda 1
Branch: rodrigo/feature/RAQ-MAND-EM075-agente-de-ia-integrado-ao-crm-agente
Commit: b697b0a
Data: 2026-05-21

---

## Severidade Resumo

| Severidade | Contagem |
|------------|----------|
| CRITICAL | 1 |
| HIGH | 2 |
| MEDIUM | 3 |
| LOW/INFO | 4 |

---

## Layer 1 - 13 VibeCoding

| # | Vulnerabilidade | Status | Arquivo:linha |
|---|---|---|---|
| 1 | Race Condition | PARCIAL | 089:164-167 INSERT cost sem controle de origem |
| 2 | IDOR | SEGURO | RLS com auth.uid() em todas as tabelas de usuario |
| 3 | SQL Injection | SEGURO | Sem SQL dinamico; params via RPC |
| 4 | XSS | NA | Onda 1 nao renderiza HTML |
| 5 | Image Tracker/SSRF | NA | Sem URLs externas nesta onda |
| 6 | Upload Malicioso | PARCIAL | 091: attachments sem magic bytes (Onda 2) |
| 7 | Mass Assignment | VULNERAVEL | 089:164-167 INSERT em ai_chat_messages_cost aberto |
| 8 | Input Flooding | PARCIAL | system_prompt CHECK 32K ok; content sem limite |
| 9 | Enumeracao Usuarios | NA | Sem endpoint de auth nesta onda |
| 10 | Logica de Negocio | PARCIAL | 086:118 VIEW security_invoker incorreto (SEC-002) |
| 11 | Secrets no Codigo | VULNERAVEL | api_key real no payload HTTP antes de maskKey() (SEC-001) |
| 12 | JWT Inseguro | NA | Gerenciado pelo Supabase |
| 13 | Bypass URL | NA | Sem URLs externas nesta onda |

---

## Layer 2 - OWASP Top 10 + STRIDE

A05 - Security Misconfiguration:
VIEWs com security_invoker=false (equivalente a SECURITY DEFINER para views). Bypassa RLS da
tabela base; acesso controlado apenas por GRANT. Padrao mais fragil que RLS.

A09 - Security Logging and Monitoring:
Sem logActivity nos hooks de leitura (esperado, Onda 1 so leitura). Mutations da Onda 3 devem
incluir audit trail obrigatorio para: api_key, system_prompt, orcamento.

STRIDE - ai_provider_credentials:
- I (Information Disclosure): api_key chega ao frontend via payload HTTP antes da mascara JS
- T (Tampering): ai_chat_messages_cost com INSERT aberto permite injecao de custos falsos
- E (Elevation): views com security_invoker=false bypassam RLS da tabela base

---

## Threat Model STRIDE - Superficies Criticas

### ai_provider_credentials (chaves de API de IA)

| Ameaca | Superficie | Mitigacao Atual | Gap |
|--------|-----------|-----------------|-----|
| S | RLS com is_admin() | Presente | OK |
| T | UPDATE so admin | Presente | OK |
| R | Sem audit log de atualizacoes | Ausente | Onda 3 deve cobrir |
| I | Chave raw no payload HTTP antes de maskKey() | Parcial | SEC-001 bloqueante |
| D | Sem rate limit na RPC | Ausente | Edge Function Onda 2 deve impor |
| E | is_admin() com search_path correto | OK | Nenhum |

### ai_chat_messages_cost (rastreio financeiro)

| Ameaca | Superficie | Mitigacao Atual | Gap |
|--------|-----------|-----------------|-----|
| T | INSERT WITH CHECK (true) | Aberto | SEC-003 bloqueante |
| I | SELECT filtrado por user_id | OK | Admin ve tudo (esperado) |

---

## Findings - CRITICO

### SEC-001 - CRITICO
[VibeCoding #11 / OWASP A02 / CWE-312]
Chave de API retornada em texto puro ao frontend antes da mascara JavaScript

Arquivo:linha: src/hooks/useProviderCredentials.ts:86-88 e src/hooks/useAISettings.ts:115

Descricao:
useAdminProviderCredentials faz .select(... api_key ...), instruindo o Supabase a enviar a
chave real no payload JSON HTTP. maskKey() e aplicada DEPOIS que o dado chega ao browser.
A chave completa trafega pelo canal HTTPS/WebSocket Supabase ate o browser.

Chave visivel em:
- Network tab do DevTools (qualquer admin ve a chave completa no response JSON)
- React Query DevTools (cache da query contem o dado antes da mascara)
- Erros de log que serializam o objeto de resposta
- Extensoes de browser com acesso a rede interceptando responses

O mesmo padrao existe em useAISettings.ts:115 (tabela ai_settings legada).

Cenario de ataque:
Admin abre DevTools > Network > filtra por ai_provider_credentials >
ve api_key: sk-proj-... completa no response JSON.
Extensao de browser maliciosa intercepta response HTTP com a chave em texto puro.

Recomendacao - fix antes do merge:

Criar migration com view admin que aplica mascara SQL no banco:

  CREATE OR REPLACE VIEW public.ai_provider_credentials_admin_view
  WITH (security_invoker = true)
  AS
    SELECT id, provider, is_active, last_test_status, last_tested_at, created_at, updated_at,
      CASE
        WHEN api_key IS NULL THEN NULL
        WHEN length(api_key) <= 8 THEN repeat(chr(8226), 8)
        ELSE left(api_key, 3) || repeat(chr(8226), 12) || right(api_key, 4)
      END AS api_key_masked,
      (api_key IS NOT NULL) AS api_key_set
    FROM public.ai_provider_credentials;

  REVOKE ALL ON public.ai_provider_credentials_admin_view FROM PUBLIC;
  GRANT SELECT ON public.ai_provider_credentials_admin_view TO authenticated;

No hook useAdminProviderCredentials:
  Substituir .from(ai_provider_credentials).select(id, provider, api_key, ...)
  por .from(ai_provider_credentials_admin_view).select(id, provider, api_key_masked, api_key_set, ...)
  Remover import { maskKey } (nao necessario apos a correcao)

---

## Findings - ALTO

### SEC-002 - ALTO
[OWASP A01 / CWE-284]
VIEWs publicas com security_invoker=false bypassam RLS da tabela base

Arquivo:linha: 086_ai_agents.sql:118-121 e 087_ai_provider_credentials.sql:97-101

Descricao:
WITH (security_invoker = false) faz a view executar com permissoes do owner (postgres),
nao do usuario chamador. RLS da tabela base NAO e avaliada ao consultar a view.
Acesso controlado apenas pelo GRANT - camada de defesa mais fragil que RLS.

Riscos:
1. Coluna sensivel adicionada por engano a view: bypassa RLS completamente
2. GRANT alterado para anon: acesso anonimo sem autenticacao a dados do agente
3. Comentario no codigo (SECURITY DEFINER via GRANTS) indica incompreensao do mecanismo

Cenario de ataque:
GRANT inadvertidamente alterado para anon + security_invoker=false = acesso anonimo sem
autenticacao a dados do agente (id/name/is_active) ou status de credenciais.

Recomendacao:

  -- Migration 086 - corrigir view de agentes:
  CREATE OR REPLACE VIEW public.ai_agents_public_view
  WITH (security_invoker = true)
  AS SELECT id, name, is_active FROM public.ai_agents;

  -- Policy SELECT necessaria para security_invoker=true funcionar:
  CREATE POLICY ai_agents_autenticado_ve_info_publica
    ON public.ai_agents FOR SELECT TO authenticated USING (true);

  -- Migration 087 - mesma correcao:
  CREATE OR REPLACE VIEW public.ai_provider_credentials_public_view
  WITH (security_invoker = true)
  AS SELECT provider, is_active, last_test_status FROM public.ai_provider_credentials;

  CREATE POLICY ai_provider_credentials_autenticado_ve_status
    ON public.ai_provider_credentials FOR SELECT TO authenticated USING (true);

---

### SEC-003 - ALTO
[VibeCoding #7 / OWASP A01 / CWE-284]
INSERT em ai_chat_messages_cost aberto a qualquer usuario autenticado

Arquivo:linha: supabase/migrations/089_ai_agent_budget.sql:164-167

Descricao:
  Policy: ai_chat_messages_cost service pode inserir
    ON public.ai_chat_messages_cost FOR INSERT TO authenticated
    WITH CHECK (true)  -- qualquer autenticado insere com valores arbitrarios

Cenario de ataque:
  supabase.from(ai_chat_messages_cost).insert({
    user_id: uuid-de-outro-usuario,
    total_cost_brl: 999.99
  })

Resultado: (1) Esgota orcamento global bloqueando todos os usuarios;
(2) Inflaciona gasto de usuario-alvo ativando cap individual;
(3) Dispara alertas falsos (amarelo/vermelho/bloqueio).
ai_agent_current_spend() soma esses valores falsos sem discriminar origem.

Recomendacao:
  DROP POLICY ai_chat_messages_cost_service_pode_inserir ON public.ai_chat_messages_cost;
  Insercao deve vir EXCLUSIVAMENTE da Edge Function ai-agent-chat via service_role.
  service_role bypassa RLS - sem policy INSERT necessaria para authenticated.

---

## Findings - MEDIO

### SEC-004 - MEDIO
[OWASP A09 / CWE-778] Sem audit log para operacoes sensiveis

Localizacao: mutations futuras em useProviderCredentials.ts, useAgentSettings.ts, useAgentBudget.ts

Mutations da Onda 3 devem incluir logActivity para: atualizacao de api_key, alteracao de
system_prompt, alteracao de limites de orcamento. Requisito obrigatorio, nao opcional.

---

### SEC-005 - MEDIO
[OWASP A04 / CWE-770] ai_chat_messages.content sem CHECK constraint de tamanho no banco

Arquivo:linha: 090_ai_chat_schema.sql:101

content TEXT NOT NULL sem limite. Usuario pode enviar mensagens massivas inflando storage e
tokens antes que a Edge Function valide. Padrao do system_prompt (CHECK 32K) nao replicado.

Recomendacao:
  ALTER TABLE public.ai_chat_messages
    ADD CONSTRAINT ai_chat_messages_content_max
    CHECK (char_length(content) <= 32000);

---

### SEC-006 - MEDIO
[OWASP A04 / CWE-840] Bug em trigger de limite de sessoes: MIN(id) nao identifica sessao mais antiga

Arquivo:linha: 090_ai_chat_schema.sql:74-79

MIN(s.id) retorna UUID lexicograficamente menor, nao a primeira linha ordenada por data.
UUID v4 e aleatorio - sem ordenacao temporal. Sessao recente pode ser deletada em vez da mais antiga.

Recomendacao - substituir SELECT COUNT(*), MIN(s.id) por:
  SELECT COUNT(*) INTO v_count FROM public.ai_chat_sessions WHERE user_id = NEW.user_id;

  IF v_count >= 200 THEN
    SELECT id INTO v_oldest_id FROM public.ai_chat_sessions
    WHERE user_id = NEW.user_id ORDER BY last_message_at ASC LIMIT 1;
    DELETE FROM public.ai_chat_sessions WHERE id = v_oldest_id;
  END IF;

---

## Findings - LOW / INFO

### SEC-007 - LOW
is_admin() usa SET search_path = public, pg_catalog - funcional e seguro
086_ai_agents.sql:29. Nao vulneravel ao CVE-2023-22621.
Padrao mais restrito: SET search_path = (vazio) com referencias fully-qualified. Apenas informativo.

### SEC-008 - LOW
pg_cron job de purge sem registro de execucao
090_ai_chat_schema.sql:214-221. Cron deleta sessoes sem registrar quantas linhas removidas.

### SEC-009 - LOW
Colunas message_id (sem FK) e message_id_fk (com FK) coexistem em ai_chat_messages_cost
089:82 e 090:128. Tech debt: coluna legada sem integridade referencial. Cleanup na Onda 3/4.

### SEC-010 - INFO
maskKey() expoe 3 chars iniciais que identificam tipo de chave (sk-, sk-ant-)
src/hooks/useAISettings.ts:66-70. Risco muito baixo. Apenas informativo.

---

## Veredicto

BLOQUEADO - 1 CRITICO + 2 ALTOS precisam corrigir antes de mergear

| Finding | Severidade | Bloqueia merge | Corrigir antes go-live |
|---------|-----------|----------------|----------------------|
| SEC-001 Chave de API em texto puro no payload HTTP | CRITICO | Sim | Sim |
| SEC-002 VIEWs security_invoker=false bypassa RLS | ALTO | Sim | Sim |
| SEC-003 INSERT aberto em ai_chat_messages_cost | ALTO | Sim | Sim |
| SEC-004 Sem audit log para operacoes sensiveis | MEDIO | Nao | Sim Onda 3 |
| SEC-005 content sem CHECK de tamanho | MEDIO | Nao | Recomendado |
| SEC-006 Bug no trigger de limite de sessoes | MEDIO | Nao | Recomendado |
| SEC-007 search_path style | LOW | Nao | Nao |
| SEC-008 cron sem log | LOW | Nao | Nao |
| SEC-009 colunas message_id duplas | LOW | Nao | Nao |
| SEC-010 maskKey expoe prefixo | INFO | Nao | Nao |

---

## Proximos Passos para Fullstack

Para corrigir antes de merge (bloqueantes):

1. SEC-001 - Criar migration com view ai_provider_credentials_admin_view aplicando mascara SQL
   no banco. Atualizar useAdminProviderCredentials para usar nova view (sem api_key direto).
   Verificar e corrigir padrao identico em useAISettings.ts:115 (tabela ai_settings legada).

2. SEC-002 - Migration de correcao: alterar security_invoker=false para security_invoker=true
   nas duas views (086 e 087). Adicionar policies SELECT abertas para authenticated nas tabelas
   ai_agents e ai_provider_credentials (necessarias para as views funcionarem com invoker=true).

3. SEC-003 - Dropar policy ai_chat_messages_cost service pode inserir WITH CHECK (true).
   Insercao via Edge Function ai-agent-chat exclusivamente usando service_role.

Para documentar como issues da Onda 3:
- SEC-004: logActivity obrigatorio nas mutations de api_key, system_prompt, orcamento
- SEC-005: CHECK constraint em ai_chat_messages.content (max 32000 chars)
- SEC-006: Corrigir bug trigger (MIN(id) -> ORDER BY last_message_at ASC LIMIT 1)
