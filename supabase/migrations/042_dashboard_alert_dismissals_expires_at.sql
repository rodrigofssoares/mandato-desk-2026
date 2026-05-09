-- Migration: 042_dashboard_alert_dismissals_expires_at
--
-- Why: Por padrão, alertas dispensados devem expirar após 30 dias.
--      Após a expiração, o alerta volta a aparecer no dashboard automaticamente.
--      Antes desta migration, os dismissals eram permanentes (sem TTL).
--
-- Reference: RAQ-MAND-EM067 — solicitação do Rodrigo (2026-05-09)
-- Risk: baixa — operação purely additive (ADD COLUMN com DEFAULT). Sem DROP.
--               Clientes antigos que não setam expires_at no INSERT recebem o
--               default automático (dismissed_at + 30 dias). Nenhuma breaking change.
-- Rollback: ALTER TABLE public.dashboard_alert_dismissals DROP COLUMN IF EXISTS expires_at;
--           + DROP INDEX IF EXISTS idx_dashboard_alert_dismissals_user_expires;

-- ─── 1. Adicionar coluna expires_at (nullable primeiro, para backfill seguro) ────
ALTER TABLE public.dashboard_alert_dismissals
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- ─── 2. Backfill dos registros existentes ANTES de tornar NOT NULL ────────────────
-- Registros criados antes desta migration não têm expires_at.
-- Convenção: expiram 30 dias após o dismiss original (dismissed_at).
UPDATE public.dashboard_alert_dismissals
  SET expires_at = dismissed_at + INTERVAL '30 days'
  WHERE expires_at IS NULL;

-- ─── 3. Tornar NOT NULL e definir DEFAULT para inserts futuros ───────────────────
-- Após o backfill acima todos os registros existentes já têm expires_at preenchido,
-- portanto o NOT NULL não vai falhar.
ALTER TABLE public.dashboard_alert_dismissals
  ALTER COLUMN expires_at SET NOT NULL,
  ALTER COLUMN expires_at SET DEFAULT (NOW() + INTERVAL '30 days');

-- ─── 4. Índice em (user_id, expires_at) ─────────────────────────────────────────
-- Usado em dois padrões de query:
--   a) Filtrar dismissals ainda válidos: WHERE expires_at > NOW()
--   b) Listagem ordenada por expiração para a aba Configurações > Alertas
--
-- NOTA: índice parcial com NOW() (ex: WHERE expires_at > NOW()) não é imutável e
-- seria rejeitado pelo Postgres. Por isso usamos índice simples em (user_id, expires_at),
-- que cobre ambos os padrões via index scan + filtro residual de baixíssimo custo.
CREATE INDEX IF NOT EXISTS idx_dashboard_alert_dismissals_user_expires
  ON public.dashboard_alert_dismissals (user_id, expires_at);

-- ─── 5. Comment autodoc ──────────────────────────────────────────────────────────
COMMENT ON COLUMN public.dashboard_alert_dismissals.expires_at IS
  'Quando o dismiss expira, o alerta volta a aparecer no dashboard. '
  'Default: 30 dias após dismissed_at. '
  'Registros com expires_at <= NOW() são tratados como inativos pelo hook useDismissedAlerts.';
