# Auditoria de Segurança — RAQ-MAND-EM075 Onda 3 (UI Configurações do Agente — Layout E)

**Data:** 2026-05-21  
**Branch:** rodrigo/feature/RAQ-MAND-EM075-agente-de-ia-integrado-ao-crm-agente  
**Commits Onda 3:** a62ce60 → 7eeedbb (7 commits)

---

## Escopo

15 arquivos auditados — ver lista na task. Camadas: route/page, component (orchestrator + 6 steps), schema, 5 hooks de mutation + 1 hook de query.

---

## Layer 1 — 13 VibeCoding

| # | Vulnerabilidade | Status | Arquivo:linha |
|---|---|---|---|
| 1 | Race Condition | PARCIAL | useAgentPresetsMutation.ts:24-46 e :93-127 — 2 UPDATEs sequenciais sem transação |
| 2 | IDOR | SEGURO | RLS no banco; mutations filtram pelo id autenticado |
| 3 | SQL Injection | SEGURO | Supabase parametrizado; budgetSchema.parse() |
| 4 | XSS | SEGURO | Sem dangerouslySetInnerHTML; filename via JSX escaped automaticamente |
| 5 | Image Tracker / SSRF | NA | Sem URL de imagem externa nesta onda |
| 6 | Upload Malicioso | PARCIAL | MIME + tamanho validados client; magic bytes apenas na EF (defense-in-depth ok) |
| 7 | Mass Assignment | SEGURO | AgentSettingsInput tipado (4 campos whitelist); budgetSchema.parse() |
| 8 | Input Flooding | SEGURO | name max(100), system_prompt max(32000), budget campos min/max |
| 9 | Enumeração Usuários | NA | Sem fluxo auth nesta onda |
| 10 | Lógica de Negócio | PARCIAL | Toggles yellowEnabled/redEnabled não persistem no banco — Finding M1 |
| 11 | Secrets no Código | SEGURO | PasswordInput para API key; logActivity não loga api_key (confirmado) |
| 12 | JWT Inseguro | NA | Não tocado nesta onda |
| 13 | Bypass URL | NA | Sem campos de URL nesta onda |

---

## Layer 2 — OWASP Top 10 + STRIDE

### A01 — Broken Access Control

PARCIAL — dupla camada OK. Settings.tsx:99 e :133 rendem a aba via condicional em AMBOS TabsList e TabsContent. Assessor que acessa ?tab=agente vê painel em branco silencioso — segurança preservada, UX confusa. Ver B2.

### A02 — Cryptographic Failures

API keys trafegam via HTTPS. Nunca logadas (confirmado useProviderCredentialsMutation.ts:48-53). SEGURO.

### A03 — Injection

Sem dangerouslySetInnerHTML. att.filename em IdentityStep.tsx:232 via JSX — escaped pelo React. Busca em AddModelPicker é filtro client-side em array constante AVAILABLE_MODELS, sem SQL. SEGURO.

### A04 — Insecure Design

Ver M1 (toggles não persistem) e M2 (race condition preset).

### A09 — Security Logging & Monitoring

useUpsertAgentSettings: logActivity correto, sem prompt.  
useUpsertProviderCredential: logActivity correto, sem api_key.  
useUpdateBudget: SEM logActivity — mudanças de orçamento não auditadas.  
useAgentPresetsMutation: SEM logActivity em nenhuma operação.  
→ Finding B1.

---

## Threat Model STRIDE — ConnectionsStep (API keys)

| Categoria | Superfície | Risco | Mitigação |
|---|---|---|---|
| Spoofing | Admin cola chave de outra org | Ativa provider errado | Teste obrigatório via EF antes de salvar |
| Tampering | Assessor altera orçamento via API direta | Aumenta limite de gasto | RLS + canEditAgente (apenas admin) |
| Repudiation | Admin troca preset sem auditoria | Sem rastreio de quem ativou | logActivity ausente — B1 |
| Info Disclosure | API key no DevTools Network tab | Chave visível em POST body | Aceitável — HTTPS + contexto admin confiável |
| DoS | Upload 5 MB × 10 arquivos | Carga na EF de extração | Validação client + EF valida também |
| Elevation | Assessor tenta acessar tab agente por URL | Conteúdo renderizado | TabsContent condicional bloqueia — SEGURO |

---

## Sumário de findings

- CRÍTICAS: 0
- ALTAS: 0
- MÉDIAS: 2 (M1, M2)
- BAIXAS: 3 (B1, B2, B3)

---

## Findings médias

### M1 — [VibeCoding #10 / OWASP A04 / CWE-840] Toggles de alerta (amarelo/vermelho) não persistem

**Arquivo:linha:** src/components/settings/agent/BudgetStep.tsx:70-85

**Descrição:** Os switches yellowEnabled e redEnabled controlam estado React local mas NÃO são incluídos no payload de handleSave. O objeto enviado hardcoda threshold_yellow_pct: 70 e threshold_red_pct: 90 independentemente do estado dos toggles.

**Impacto:** Admin desativa aviso amarelo, clica Salvar, na próxima sessão o toggle reaparece ativo — o banco nunca recebeu o estado desabilitado. Admin acredita ter desabilitado o alerta mas ele continua ativo no sistema.

**Como corrigir — opção A (null para desabilitado, requer ajuste schema):**

threshold_yellow_pct: yellowEnabled ? 70 : null,
threshold_red_pct: redEnabled ? 90 : null,

**Como corrigir — opção B (colunas booleanas):**

Adicionar alert_yellow_enabled boolean e alert_red_enabled boolean na migration ai_agent_budget, incluir no budgetSchema e no payload de handleSave.

---

### M2 — [VibeCoding #1 / OWASP A04 / CWE-362] Race condition em useSetActivePreset e useSetDefaultModelInPreset

**Arquivo:linha:** src/hooks/useAgentPresetsMutation.ts:24-46 e :93-127

**Descrição:** Ambas as operações usam 2 UPDATEs sequenciais sem transação. Cliques duplos rápidos em "Usar este preset" podem resultar em 0 ou 2 presets com is_active_preset=true.

**Impacto:** Estado incoerente — agente usa preset errado até próxima recarga. Não exploitável por terceiros; requer cliques duplos muito rápidos do admin.

**Como corrigir — RPC atômica no banco:**

```
CREATE OR REPLACE FUNCTION set_active_preset(p_agent_id uuid, p_preset_key text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE ai_agent_model_presets
  SET is_active_preset = (preset_key = p_preset_key)
  WHERE agent_id = p_agent_id;
END;
$$;
```

Substituir os 2 UPDATEs por: supabase.rpc('set_active_preset', { p_agent_id, p_preset_key })
Mesma abordagem para set_default_model.

---

## Findings baixas

### B1 — [OWASP A09] Audit trail ausente em presets e orçamento

logActivity não chamado em: useUpdateBudget, useSetActivePreset, useAddModelToPreset, useToggleModelInPreset, useRemoveModelFromPreset.

Recomendação: adicionar logActivity no onSuccess de useUpdateBudget (mudança financeira), useSetActivePreset e useAddModelToPreset pelo menos.

---

### B2 — [OWASP A01] Sem feedback quando tab agente acessada sem permissão via URL

Settings.tsx:99,133 — Assessor que acessa ?tab=agente vê página em branco silenciosa. Segurança real preservada pelo RLS + condicional TabsContent. Problema é de UX.

Recomendação: redirecionar para tab padrão quando activeTab === 'agente' && !canEditAgente.

---

### B3 — [VibeCoding #6 / OWASP A04] Magic bytes não validados client-side

FileUploadDropzone.tsx:55 — Validação usa file.type (MIME spoofável). EF ai-agent-extract-text já valida magic bytes server-side (Onda 2, auditada). Sem vulnerabilidade real — ausência de defense-in-depth client.

Recomendação de baixa prioridade: lib file-type ou check manual dos primeiros bytes do ArrayBuffer.

---

## Veredicto

APROVADO COM RESERVAS — 0 críticas/altas. 2 médias documentadas.

M1 (toggles não persistem) — maior prioridade. Causa inconsistência de configuração visível para o admin. Corrigir antes do go-live da aba Agente.
M2 (race condition preset/modelo) — impacto baixo na prática, mas correto resolver com RPC atômica na Onda 4.

## Próximos passos

| Prioridade | Ação | Finding |
|---|---|---|
| Alta (antes go-live) | Incluir yellowEnabled/redEnabled no handleSave — ajustar schema se necessário | M1 |
| Média (Onda 4) | RPC atômica set_active_preset + set_default_model | M2 |
| Baixa | logActivity em useUpdateBudget e useSetActivePreset | B1 |
| Baixa | Redirect quando tab agente acessada sem permissão via URL | B2 |
| Baixa | Magic bytes client-side no dropzone | B3 |
