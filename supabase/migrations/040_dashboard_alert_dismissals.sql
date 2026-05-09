-- Migration: 040_dashboard_alert_dismissals
-- Tabela de alertas dispensados pelo usuário no dashboard (snooze persistido).
-- Permite que cada assessora silencie alertas individualmente sem alterar dados-fonte.
-- Reversível: deletar o registro restaura o alerta na modal.
--
-- Nota de comportamento (documentado no PR):
--   - alert_key = 'ani-<contact_id>' é permanente por contato. Dismiss de aniversariante
--     suprime o alerta em todos os anos futuros. Restauração manual via Configurações > Alertas.
--   - Registros órfãos (fonte resolvida enquanto dismiss ativo) são inofensivos e ficam
--     na tabela indefinidamente. Limpeza periódica é divida técnica da v2.

-- ─── Tabela principal ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.dashboard_alert_dismissals (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_key     TEXT        NOT NULL,
  alert_type    TEXT        NOT NULL DEFAULT '',
  alert_title   TEXT,
  alert_subtitle TEXT,
  dismissed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_alert UNIQUE (user_id, alert_key)
);

COMMENT ON TABLE  public.dashboard_alert_dismissals IS 'Registros de alertas dispensados por usuário no dashboard. Imutável: não há UPDATE. Deletar o registro restaura o alerta.';
COMMENT ON COLUMN public.dashboard_alert_dismissals.alert_key     IS 'Chave sintética do alerta (ex: parado-<uuid>, vencida-<uuid>, ani-<uuid>). Único por usuário.';
COMMENT ON COLUMN public.dashboard_alert_dismissals.alert_type    IS 'Tipo do alerta no momento do dismiss (snapshot): contato_parado | tarefa_vencida | aniversariante_sem_tarefa.';
COMMENT ON COLUMN public.dashboard_alert_dismissals.alert_title   IS 'Título do alerta no momento do dismiss (snapshot) — preserva texto mesmo que fonte seja deletada.';
COMMENT ON COLUMN public.dashboard_alert_dismissals.alert_subtitle IS 'Subtítulo do alerta no momento do dismiss (snapshot).';

-- ─── Índices ──────────────────────────────────────────────────────────────────
-- A constraint UNIQUE já cria um índice btree em (user_id, alert_key).
-- Índice adicional para query de listagem ordenada por dismissed_at DESC.
CREATE INDEX IF NOT EXISTS idx_dashboard_alert_dismissals_user_dismissed
  ON public.dashboard_alert_dismissals (user_id, dismissed_at DESC);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.dashboard_alert_dismissals ENABLE ROW LEVEL SECURITY;

-- Drop defensivo antes de recriar (idempotência)
DROP POLICY IF EXISTS "dismissals_select_own"  ON public.dashboard_alert_dismissals;
DROP POLICY IF EXISTS "dismissals_insert_own"  ON public.dashboard_alert_dismissals;
DROP POLICY IF EXISTS "dismissals_delete_own"  ON public.dashboard_alert_dismissals;

-- SELECT: usuário vê apenas seus próprios dismissals
CREATE POLICY "dismissals_select_own"
  ON public.dashboard_alert_dismissals
  FOR SELECT
  USING (user_id = auth.uid());

-- INSERT: usuário só insere com seu próprio user_id
CREATE POLICY "dismissals_insert_own"
  ON public.dashboard_alert_dismissals
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- DELETE: usuário só deleta seus próprios dismissals
CREATE POLICY "dismissals_delete_own"
  ON public.dashboard_alert_dismissals
  FOR DELETE
  USING (user_id = auth.uid());

-- Não há UPDATE — o registro é imutável (dismiss é um evento, não um estado editável).
-- Para alterar, o usuário deleta e re-insere via UI de restauração.
