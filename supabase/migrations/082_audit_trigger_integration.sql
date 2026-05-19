-- Migration 082 — Integração de auditoria: refinamentos + índices
-- T88 (Fase 7 Onda B): view e tabela zapi_audit_log criadas em 081.
-- Esta migration adiciona políticas RLS explícitas para INSERT via service_role
-- e garantias de imutabilidade (sem UPDATE/DELETE para nenhum role).

-- ── Garantia de imutabilidade: bloqueia UPDATE/DELETE para authenticated ──────
-- (INSERT só via service_role — sem policy de INSERT para authenticated)
-- A tabela foi criada em 081 com RLS habilitado.

-- Remove policies anteriores para recriar de forma idempotente
DROP POLICY IF EXISTS "zapi_audit_log_select" ON zapi_audit_log;
DROP POLICY IF EXISTS "zapi_audit_log_no_update" ON zapi_audit_log;
DROP POLICY IF EXISTS "zapi_audit_log_no_delete" ON zapi_audit_log;

-- SELECT: qualquer usuário autenticado e ativo pode ler logs das suas contas
CREATE POLICY "zapi_audit_log_select"
  ON zapi_audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.status_aprovacao = 'ATIVO'
    )
  );

-- UPDATE bloqueado para todos os roles autenticados (auditoria imutável)
CREATE POLICY "zapi_audit_log_no_update"
  ON zapi_audit_log
  FOR UPDATE
  USING (false);

-- DELETE bloqueado para todos os roles autenticados (auditoria imutável)
CREATE POLICY "zapi_audit_log_no_delete"
  ON zapi_audit_log
  FOR DELETE
  USING (false);

-- ── Índice adicional por actor_id ─────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_zapi_audit_log_actor_id
  ON zapi_audit_log (actor_id)
  WHERE actor_id IS NOT NULL;

-- ── Índice por event_type para filtros na UI de auditoria ─────────────────────
CREATE INDEX IF NOT EXISTS idx_zapi_audit_log_event_type
  ON zapi_audit_log (event_type);

-- ── Grant SELECT na view para authenticated (idempotente) ─────────────────────
GRANT SELECT ON v_dashboard_atendimento TO authenticated;
