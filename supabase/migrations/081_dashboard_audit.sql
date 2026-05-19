-- Migration 081 — Dashboard de atendimento + Auditoria WhatsApp
-- Cria VIEW v_dashboard_atendimento e tabela zapi_audit_log.

-- ── Tabela de auditoria ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS zapi_audit_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  UUID        REFERENCES zapi_accounts(id) ON DELETE SET NULL,
  chat_id     UUID        REFERENCES zapi_chats(id)    ON DELETE SET NULL,
  contact_id  UUID        REFERENCES contacts(id)      ON DELETE SET NULL,
  event_type  TEXT        NOT NULL,
  actor_id    UUID        REFERENCES auth.users(id)    ON DELETE SET NULL,
  old_value   JSONB,
  new_value   JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para queries do dashboard e auditoria
CREATE INDEX IF NOT EXISTS idx_zapi_audit_log_chat_id
  ON zapi_audit_log (chat_id);

CREATE INDEX IF NOT EXISTS idx_zapi_audit_log_account_created
  ON zapi_audit_log (account_id, created_at DESC);

-- RLS: auditoria imutável — sem UPDATE/DELETE. INSERT apenas via service_role.
ALTER TABLE zapi_audit_log ENABLE ROW LEVEL SECURITY;

-- SELECT: usuários autenticados veem logs das contas às quais têm acesso
-- (mesmo padrão das demais tabelas zapi_*)
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

-- Sem política de INSERT no client (apenas service_role insere via EF)
-- Sem políticas de UPDATE/DELETE (auditoria imutável)

-- ── VIEW de dashboard de atendimento ─────────────────────────────────────────
-- Calcula métricas de atendimento por conta.
-- Usa query direta (não materializada) — adequado ao volume atual.

CREATE OR REPLACE VIEW v_dashboard_atendimento AS
WITH
  -- Conversas abertas (não finalizadas) por conta
  abertas AS (
    SELECT
      account_id,
      COUNT(*)::INT AS conversas_abertas
    FROM zapi_chats
    WHERE archived = false
      AND status != 'finalizada'
    GROUP BY account_id
  ),

  -- Conversas finalizadas hoje por conta
  finalizadas_hoje AS (
    SELECT
      account_id,
      COUNT(*)::INT AS conversas_finalizadas_hoje
    FROM zapi_audit_log
    WHERE event_type = 'finalization'
      AND created_at >= CURRENT_DATE
      AND created_at <  CURRENT_DATE + INTERVAL '1 day'
    GROUP BY account_id
  ),

  -- Conversas por atendente (somente abertas/em atendimento)
  por_atendente AS (
    SELECT
      c.account_id,
      jsonb_agg(
        jsonb_build_object(
          'assigned_to', c.assigned_to,
          'nome', p.nome,
          'count', c.cnt
        )
        ORDER BY c.cnt DESC
      ) AS conversas_por_atendente
    FROM (
      SELECT account_id, assigned_to, COUNT(*)::INT AS cnt
      FROM zapi_chats
      WHERE archived = false
        AND status != 'finalizada'
        AND assigned_to IS NOT NULL
      GROUP BY account_id, assigned_to
    ) c
    LEFT JOIN profiles p ON p.id = c.assigned_to
    GROUP BY c.account_id
  ),

  -- Tempo médio de resposta: diferença entre mensagem recebida e a próxima enviada
  tempos AS (
    SELECT
      zc.account_id,
      AVG(
        EXTRACT(EPOCH FROM (m_sent.sent_at - m_recv.sent_at)) / 60.0
      )::NUMERIC(10,2) AS tempo_medio_resposta_min
    FROM zapi_chats zc
    JOIN LATERAL (
      SELECT zm1.sent_at, zm1.chat_id
      FROM zapi_messages zm1
      WHERE zm1.chat_id = zc.id
        AND zm1.direction = 'received'
    ) m_recv ON true
    JOIN LATERAL (
      SELECT zm2.sent_at
      FROM zapi_messages zm2
      WHERE zm2.chat_id = m_recv.chat_id
        AND zm2.direction = 'sent'
        AND zm2.sent_at > m_recv.sent_at
      ORDER BY zm2.sent_at ASC
      LIMIT 1
    ) m_sent ON true
    GROUP BY zc.account_id
  ),

  -- Lista de contas para garantir que todas apareçam mesmo sem dados
  contas AS (
    SELECT id AS account_id FROM zapi_accounts
  )

SELECT
  co.account_id,
  COALESCE(a.conversas_abertas,           0)    AS conversas_abertas,
  COALESCE(f.conversas_finalizadas_hoje,  0)    AS conversas_finalizadas_hoje,
  COALESCE(pa.conversas_por_atendente,    '[]'::jsonb) AS conversas_por_atendente,
  t.tempo_medio_resposta_min
FROM contas co
LEFT JOIN abertas          a  ON a.account_id  = co.account_id
LEFT JOIN finalizadas_hoje f  ON f.account_id  = co.account_id
LEFT JOIN por_atendente    pa ON pa.account_id = co.account_id
LEFT JOIN tempos           t  ON t.account_id  = co.account_id;

-- Permissão de SELECT na view para usuários autenticados
GRANT SELECT ON v_dashboard_atendimento TO authenticated;
