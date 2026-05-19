-- ============================================================
-- PASSO 3 de 3 — Conferir o resultado
-- Esperado: webhook_logs em centenas de kB, banco ~52 MB,
-- linhas_restantes ~400.
-- ============================================================

SELECT pg_size_pretty(pg_total_relation_size('webhook_logs')) AS webhook_logs,
       pg_size_pretty(pg_database_size(current_database()))   AS banco,
       (SELECT count(*) FROM webhook_logs)                     AS linhas_restantes;
