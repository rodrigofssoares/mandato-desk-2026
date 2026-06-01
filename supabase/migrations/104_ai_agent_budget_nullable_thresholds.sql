-- ============================================================================
-- Migration 104: torna threshold_yellow_pct e threshold_red_pct nullable
-- ============================================================================
-- Contexto: toggles de aviso amarelo/vermelho em BudgetStep precisam persistir
-- o estado "desabilitado". A opção escolhida é NULL = desabilitado (opção B do
-- finding M1/Security + MF-2/CR), sem adicionar colunas booleanas extras.
--
-- Antes: INT NOT NULL DEFAULT 70 / DEFAULT 90
-- Depois: INT NULL DEFAULT 70 / DEFAULT 90
--
-- O CHECK constraint é mantido para quando o valor não é NULL.
-- A Edge Function ai-agent-chat já testa o threshold antes de enviar alerta;
-- quando NULL, pula o envio (sem necessidade de alteração na EF).
-- ============================================================================

-- Remove NOT NULL e ajusta CHECK para aceitar NULL
ALTER TABLE public.ai_agent_budget
  ALTER COLUMN threshold_yellow_pct DROP NOT NULL;

ALTER TABLE public.ai_agent_budget
  ALTER COLUMN threshold_red_pct DROP NOT NULL;

-- Atualiza comentários das colunas
COMMENT ON COLUMN public.ai_agent_budget.threshold_yellow_pct IS
  'Percentual do limite mensal que dispara aviso amarelo (e-mail ao admin). NULL = aviso desabilitado.';

COMMENT ON COLUMN public.ai_agent_budget.threshold_red_pct IS
  'Percentual do limite mensal que dispara aviso vermelho (push + modal). NULL = aviso desabilitado.';
