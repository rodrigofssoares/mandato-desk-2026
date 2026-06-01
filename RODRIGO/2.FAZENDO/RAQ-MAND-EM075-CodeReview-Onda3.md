# Code Review -- RAQ-MAND-EM075 Onda 3

## Escopo
- Commits: a62ce60 -> 7eeedbb (7 commits)
- Diff: +2.646 linhas inseridas, 15 arquivos novos
- Build: verde (tsc -b + vite build OK)
- Lint: 0 erros nos arquivos da Onda 3
- Typecheck: verde

## Aprovacao geral

Wizard de 4 steps bem estruturado, separacao clara por camada.
prop values do RHF para resync automatico, auto-save antes de avancar step, a11y completa.

## MUST-FIX (bloqueiam merge)

### MF-1 -- useAgentBudgetMutation.ts:75
instanceof z.ZodError nunca sera true: parametro onError tipado como (error: Error).
O branch de validacao nunca exibe o toast correto.
Fix: mudar para (error: unknown) e narrowing com instanceof.

### MF-2 -- BudgetStep.tsx:46-47 + 76-77
yellowEnabled e redEnabled nunca sao persistidos.
handleSave hardcoda threshold_yellow_pct: 70 e threshold_red_pct: 90 ignorando os toggles.
Fix: threshold_yellow_pct: yellowEnabled ? 70 : 0 (e mesmo para red).

## SHOULD-FIX

SF-1 useAgentPresetsMutation.ts:21-48: useSetActivePreset nao atomico (2 UPDATEs).
  Se 2o UPDATE falhar, agente fica sem preset ativo. Mesmo problema em useSetDefaultModelInPreset.
  Solucao: rpc() atomico ou documentar o risco.

SF-2 ModelsStep.tsx:447: control._formValues e API interna do RHF.
  Fix: watch("text_only_mode") via useFormContext.

SF-3 BudgetStep.tsx:53-57: hidracao de estado local pode desincronizar.
  Se usuario mexe slider antes da query resolver, estado local nao e resetado quando budget chega.
  Fix: useEffect de hidracao unica.

SF-4 useAgentAttachments.ts: ausencia de realtime listener processing->ready.
  staleTime 30s e insuficiente para feedback de indexacao. Adicionar subscribe em ai_agent_attachments.

SF-5 useAgentPresetsMutation.ts:170: position: 99 hardcoded.
  Varios modelos adicionados terao posicao identica. Extrair para constante nomeada.

## NITPICKS

NIT-1 25 ocorrencias de as never sem comentario TODO(onda-4): regenerar types apos Onda 1.
NIT-2 hsl(351,61%,30%) hardcoded em BudgetStripSticky.tsx e ConnectionsStep.tsx vs var(--primary).
NIT-3 AgentSettingsTab.tsx:77 form.trigger omite system_prompt (tem validacao max 32000).
NIT-4 ModelsStep.tsx 454 linhas -- 4 sub-componentes podem ser arquivos separados (Onda 4).
NIT-5 BudgetStep.tsx: calcMonthlyCost/SCENARIOS sao logica pura, extrair para src/lib/.
NIT-6 IdentityStep.tsx:286: literal 10 duplica prop maxFiles={10}. Extrair MAX_ATTACHMENTS.

## QUESTIONS

Q-1 AgentSettingsTab.tsx:218: botao "Salvar configuracao" no step 4 so salva IdentityForm.
  Usuario pode achar que salvou Orcamento tambem. Intencional? Se sim, clarificar label.

Q-2 useUpsertProviderCredential.ts:40: last_test_status: "valid" hardcoded ao salvar sem testar.
  Deveria ser "unknown" ou null. Confirmado intencional?

## PRAISE

P-1 AgentSettingsTab.tsx:47-54: prop values do RHF -- resync sem useEffect. Elegante.
P-2 FileUploadDropzone.tsx: a11y completa (role, tabIndex, aria-disabled, onKeyDown).
P-3 useProviderCredentialsMutation.ts: api_key nunca logada. Seguranca correta.
P-4 ConnectionsStep.tsx:80-103: handleTest testa->salva em sequencia com try/catch compartilhado.
P-5 useAgentPresetsMutation.ts:138-183: guard de duplicata maybeSingle() antes do INSERT.

## Veredicto

APROVAR COM AJUSTES -- corrigir MF-1 e MF-2 antes do merge.
SF-1 a SF-5 podem ir para Onda 4 se houver prazo.

Blockers:
1. MF-1: branch instanceof z.ZodError morto -- toast de validacao nunca aparece.
2. MF-2: switches Aviso amarelo/vermelho decorativos -- valores nunca chegam ao banco.