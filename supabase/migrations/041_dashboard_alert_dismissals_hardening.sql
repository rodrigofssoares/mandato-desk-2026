-- Migration: 041_dashboard_alert_dismissals_hardening
-- Endurece a tabela dashboard_alert_dismissals com:
--   1. CHECK constraints de tamanho nas colunas TEXT (Security M3 — defesa contra DoS por payload gigante)
--   2. FORCE ROW LEVEL SECURITY (Security B1 — defesa em profundidade contra owner/superuser)
--
-- Origem: auditoria do agente security em RAQ-MAND-EM067.

-- ─── Limites de tamanho (M3) ──────────────────────────────────────────────────
-- alert_key: ids sintéticos como "parado-<uuid>" (~40 chars). 500 dá folga.
-- alert_title/subtitle: títulos legíveis (nome de contato, "Atrasada há N dias"). 500 dá folga.
ALTER TABLE public.dashboard_alert_dismissals
  ADD CONSTRAINT chk_alert_key_len      CHECK (length(alert_key) <= 500),
  ADD CONSTRAINT chk_alert_type_len     CHECK (length(alert_type) <= 100),
  ADD CONSTRAINT chk_alert_title_len    CHECK (alert_title IS NULL OR length(alert_title) <= 500),
  ADD CONSTRAINT chk_alert_subtitle_len CHECK (alert_subtitle IS NULL OR length(alert_subtitle) <= 500);

-- ─── FORCE RLS (B1) ───────────────────────────────────────────────────────────
-- Aplica RLS também ao dono da tabela. ENABLE ROW LEVEL SECURITY já protegia
-- conexões de roles normais; FORCE garante que mesmo o role `postgres` (caso
-- alguma rotina/Edge Function execute como superuser) seja submetido à RLS.
ALTER TABLE public.dashboard_alert_dismissals FORCE ROW LEVEL SECURITY;
