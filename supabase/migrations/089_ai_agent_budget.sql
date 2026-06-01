-- ============================================================================
-- Migration 089: Orçamento do agente + rastreio de custos por mensagem
-- ============================================================================
-- Três tabelas:
--
--   ai_agent_budget: configuração de limites mensais + alertas + caps por usuário
--     (singleton por agente — UNIQUE em agent_id)
--
--   ai_chat_messages_cost: registro de custo de cada mensagem processada pela EF.
--     Referencia ai_chat_messages (criada na 090), portanto usa FK diferida —
--     a FK real é adicionada na migration 090 após criar ai_chat_messages.
--
--   ai_budget_alerts_sent: log de alertas enviados para evitar spam (1 por mês
--     por nível de alerta).
--
-- Função SQL:
--   ai_agent_current_spend(agent_id UUID): soma total_cost_brl do mês corrente.
--
-- RLS:
--   ai_agent_budget e ai_budget_alerts_sent: só admin.
--   ai_chat_messages_cost: admin vê tudo; usuário vê só os próprios.
-- ============================================================================

-- ─── Tabela de orçamento ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_agent_budget (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  agent_id                    UUID NOT NULL REFERENCES public.ai_agents(id) ON DELETE CASCADE,

  -- Limite global mensal em BRL
  monthly_limit_brl           DECIMAL(10,2) NOT NULL DEFAULT 50.00
                              CHECK (monthly_limit_brl > 0),

  -- Thresholds de alerta (percentual do limite mensal)
  threshold_yellow_pct        INT NOT NULL DEFAULT 70
                              CHECK (threshold_yellow_pct BETWEEN 50 AND 95),
  threshold_red_pct           INT NOT NULL DEFAULT 90
                              CHECK (threshold_red_pct BETWEEN 70 AND 99),

  -- Comportamento ao atingir 100%: bloqueio rígido (parar chamadas à EF)
  auto_block_at_100           BOOLEAN NOT NULL DEFAULT true,

  -- Caps por mensagem/usuário
  max_tokens_per_response     INT NOT NULL DEFAULT 2048
                              CHECK (max_tokens_per_response BETWEEN 256 AND 32768),
  max_messages_per_user_per_day     INT NOT NULL DEFAULT 50
                              CHECK (max_messages_per_user_per_day BETWEEN 1 AND 1000),
  max_brl_per_user_per_month  DECIMAL(10,2) NOT NULL DEFAULT 25.00
                              CHECK (max_brl_per_user_per_month > 0),

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_agent_budget IS
  'Configuração de orçamento do agente (1 linha por agente). Define limite mensal em BRL, thresholds de alerta (amarelo/vermelho/bloqueio) e caps individuais por usuário.';

COMMENT ON COLUMN public.ai_agent_budget.monthly_limit_brl IS
  'Orçamento mensal total em BRL. Default R$ 50. Ao atingir 100%, auto_block_at_100 determina se bloqueia automaticamente.';

COMMENT ON COLUMN public.ai_agent_budget.auto_block_at_100 IS
  'Bloqueio rígido: quando true, a Edge Function ai-agent-chat rejeita novas mensagens ao atingir 100% do orçamento mensal.';

-- UNIQUE: 1 linha de budget por agente
CREATE UNIQUE INDEX IF NOT EXISTS ai_agent_budget_agent_id_unique
  ON public.ai_agent_budget (agent_id);

-- ─── Trigger updated_at ──────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_ai_agent_budget_updated_at ON public.ai_agent_budget;
CREATE TRIGGER trg_ai_agent_budget_updated_at
  BEFORE UPDATE ON public.ai_agent_budget
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── Tabela de custos por mensagem ───────────────────────────────────────────
-- A FK para ai_chat_messages (message_id) será adicionada na migration 090,
-- após a criação dessa tabela. Por ora, message_id é UUID sem FK.

CREATE TABLE IF NOT EXISTS public.ai_chat_messages_cost (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Referência à mensagem (FK adicionada em 090 após criar ai_chat_messages)
  message_id        UUID,
  user_id           UUID REFERENCES public.profiles(id) ON DELETE SET NULL,

  provider          TEXT,
  model_id          TEXT,

  tokens_input      INT DEFAULT 0,
  tokens_output     INT DEFAULT 0,
  cost_brl_input    DECIMAL(10,6) DEFAULT 0,
  cost_brl_output   DECIMAL(10,6) DEFAULT 0,
  total_cost_brl    DECIMAL(10,6) DEFAULT 0,

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_chat_messages_cost IS
  'Registra custo de tokens de cada mensagem processada pela Edge Function ai-agent-chat. FK message_id adicionada na migration 090. Usado pela função ai_agent_current_spend() para calcular gasto mensal.';

-- Index para consultas de gasto mensal (filtra por data e user)
CREATE INDEX IF NOT EXISTS ai_chat_messages_cost_created_at_idx
  ON public.ai_chat_messages_cost (created_at DESC);

CREATE INDEX IF NOT EXISTS ai_chat_messages_cost_user_month_idx
  ON public.ai_chat_messages_cost (user_id, created_at DESC);

-- ─── Tabela de alertas enviados ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ai_budget_alerts_sent (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  agent_id         UUID REFERENCES public.ai_agents(id) ON DELETE CASCADE,
  threshold_level  TEXT NOT NULL
                   CHECK (threshold_level IN ('yellow', 'red', 'hard_block')),
  sent_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Formato 'YYYY-MM' para impedir alertas duplicados no mesmo mês
  month_year       TEXT NOT NULL CHECK (month_year ~ '^\d{4}-\d{2}$')
);

COMMENT ON TABLE public.ai_budget_alerts_sent IS
  'Log de alertas de orçamento já enviados. Previne spam: verifica se já existe alerta do mesmo nível no mesmo mês antes de disparar novo.';

-- UNIQUE: 1 alerta por nível por mês por agente
CREATE UNIQUE INDEX IF NOT EXISTS ai_budget_alerts_sent_dedup
  ON public.ai_budget_alerts_sent (agent_id, threshold_level, month_year);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

-- ai_agent_budget: só admin
ALTER TABLE public.ai_agent_budget ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_agent_budget: admin pode ver" ON public.ai_agent_budget;
CREATE POLICY "ai_agent_budget: admin pode ver"
  ON public.ai_agent_budget FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "ai_agent_budget: admin pode inserir" ON public.ai_agent_budget;
CREATE POLICY "ai_agent_budget: admin pode inserir"
  ON public.ai_agent_budget FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "ai_agent_budget: admin pode editar" ON public.ai_agent_budget;
CREATE POLICY "ai_agent_budget: admin pode editar"
  ON public.ai_agent_budget FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ai_chat_messages_cost: admin vê tudo; usuário vê só os próprios
ALTER TABLE public.ai_chat_messages_cost ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_chat_messages_cost: admin pode ver tudo" ON public.ai_chat_messages_cost;
CREATE POLICY "ai_chat_messages_cost: admin pode ver tudo"
  ON public.ai_chat_messages_cost FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "ai_chat_messages_cost: usuario ve proprio gasto" ON public.ai_chat_messages_cost;
CREATE POLICY "ai_chat_messages_cost: usuario ve proprio gasto"
  ON public.ai_chat_messages_cost FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "ai_chat_messages_cost: service pode inserir" ON public.ai_chat_messages_cost;
CREATE POLICY "ai_chat_messages_cost: service pode inserir"
  ON public.ai_chat_messages_cost FOR INSERT TO authenticated
  WITH CHECK (true);

-- ai_budget_alerts_sent: só admin
ALTER TABLE public.ai_budget_alerts_sent ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_budget_alerts_sent: admin pode ver" ON public.ai_budget_alerts_sent;
CREATE POLICY "ai_budget_alerts_sent: admin pode ver"
  ON public.ai_budget_alerts_sent FOR SELECT TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "ai_budget_alerts_sent: admin pode inserir" ON public.ai_budget_alerts_sent;
CREATE POLICY "ai_budget_alerts_sent: admin pode inserir"
  ON public.ai_budget_alerts_sent FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());

-- ─── Função: gasto mensal atual do agente ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.ai_agent_current_spend(p_agent_id UUID)
RETURNS DECIMAL(10,6)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  SELECT COALESCE(
    SUM(c.total_cost_brl), 0
  )
  FROM public.ai_chat_messages_cost c
  WHERE c.created_at >= date_trunc('month', now())
    AND c.created_at <  date_trunc('month', now()) + INTERVAL '1 month';
  -- Nota: filtra apenas pelo mês corrente (UTC). agent_id não é coluna aqui —
  -- o agente é singleton, então o total mensal é global à organização.
$$;

COMMENT ON FUNCTION public.ai_agent_current_spend(UUID) IS
  'Retorna o gasto total em BRL do mês corrente (UTC). O parâmetro agent_id é reservado para futura multi-agente — no MVP a organização tem 1 agente, então o filtro é apenas por período.';

-- ─── Seed: cria budget default para o agente singleton ───────────────────────

INSERT INTO public.ai_agent_budget (agent_id)
SELECT id FROM public.ai_agents
WHERE NOT EXISTS (
  SELECT 1 FROM public.ai_agent_budget ab
  WHERE ab.agent_id = ai_agents.id
);
