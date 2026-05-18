-- ============================================================================
-- Migration 070: Tabelas de broadcast segmentado (C17)
-- ============================================================================
-- Objetivo: Infraestrutura para envio em massa segmentado com controle de
-- ritmo, opt-in obrigatório e rastreabilidade total de envios.
--
-- Tabelas:
--   zapi_broadcasts:       campanhas de envio em massa
--   zapi_broadcast_targets: alvos individuais de cada campanha
--
-- Segurança:
--   - RLS restritiva: SELECT por created_by; INSERT/UPDATE BLOQUEADOS no client
--   - Apenas service_role (Edge Functions) pode inserir/atualizar
--   - ritmo_por_minuto limitado a 1–30 (anti-ban)
--   - Constraint condicional: enquete exige poll_question
--
-- Referência: RAQ-MAND-EM073 — T63 (Fase 6 Onda A)
-- ============================================================================

-- ─── 1. Tabela zapi_broadcasts ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.zapi_broadcasts (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id       UUID        NOT NULL REFERENCES public.zapi_accounts(id) ON DELETE CASCADE,
  title            TEXT        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 255),
  body             TEXT        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4096),
  tipo             TEXT        NOT NULL DEFAULT 'mensagem'
                               CHECK (tipo IN ('mensagem', 'enquete')),
  poll_question    TEXT,
  poll_options     JSONB,
  segment_filters  JSONB       NOT NULL DEFAULT '{}',
  status           TEXT        NOT NULL DEFAULT 'rascunho'
                               CHECK (status IN ('rascunho','agendado','enviando','concluido','cancelado','falha')),
  ritmo_por_minuto INT         NOT NULL DEFAULT 10
                               CHECK (ritmo_por_minuto BETWEEN 1 AND 30),
  scheduled_at     TIMESTAMPTZ,
  started_at       TIMESTAMPTZ,
  finished_at      TIMESTAMPTZ,
  total_targets    INT         NOT NULL DEFAULT 0,
  sent_count       INT         NOT NULL DEFAULT 0,
  failed_count     INT         NOT NULL DEFAULT 0,
  created_by       UUID        NOT NULL REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Constraint condicional: enquete exige poll_question
  CONSTRAINT chk_enquete_requires_question
    CHECK (tipo != 'enquete' OR poll_question IS NOT NULL)
);

COMMENT ON TABLE public.zapi_broadcasts IS
  'Campanhas de envio em massa (broadcast) WhatsApp. '
  'INSERT/UPDATE bloqueados no client (RLS WITH CHECK false). '
  'Apenas service_role (EFs zapi-broadcast-create/send) pode escrever. '
  'ritmo_por_minuto controla anti-ban (máx 30/min). '
  'Referência: T63 / Fase 6 Onda A.';

COMMENT ON COLUMN public.zapi_broadcasts.tipo IS
  'mensagem = texto simples; enquete = poll WhatsApp. '
  'Quando enquete, poll_question é obrigatório.';

COMMENT ON COLUMN public.zapi_broadcasts.segment_filters IS
  'Filtros de segmentação em JSON: { tags: [...], bairro: "...", zona_eleitoral: "..." }. '
  'Aplicados pela EF zapi-broadcast-create para resolver contatos elegíveis.';

COMMENT ON COLUMN public.zapi_broadcasts.ritmo_por_minuto IS
  'Mensagens enviadas por minuto pelo cron. Máximo 30. '
  'Anti-ban: distribui envio ao longo do tempo.';

-- ─── 2. Tabela zapi_broadcast_targets ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.zapi_broadcast_targets (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id     UUID        NOT NULL REFERENCES public.zapi_broadcasts(id) ON DELETE CASCADE,
  contact_id       UUID        REFERENCES public.contacts(id) ON DELETE SET NULL,
  phone            TEXT        NOT NULL CHECK (char_length(phone) BETWEEN 1 AND 32),
  status           TEXT        NOT NULL DEFAULT 'pendente'
                               CHECK (status IN ('pendente','enviado','falha','bloqueado')),
  bloqueio_motivo  TEXT,
  sent_at          TIMESTAMPTZ,
  error_msg        TEXT        CHECK (char_length(error_msg) <= 1024),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.zapi_broadcast_targets IS
  'Alvos individuais de cada campanha broadcast. '
  '1 linha por contato por campanha. '
  'INSERT/UPDATE/DELETE bloqueados no client (RLS WITH CHECK false). '
  'status=bloqueado: contato sem opt-in ou inválido. '
  'Referência: T63 / Fase 6 Onda A.';

COMMENT ON COLUMN public.zapi_broadcast_targets.bloqueio_motivo IS
  'Motivo do bloqueio quando status=bloqueado: '
  'sem_optin = contato sem optin_whatsapp, '
  'merged = contato foi mesclado, '
  'invalid_phone = telefone inválido.';

-- ─── 3. Índices ───────────────────────────────────────────────────────────────

-- Índice principal para o cron (zapi-broadcast-send): busca targets pendentes
CREATE INDEX IF NOT EXISTS idx_zapi_broadcast_targets_pendente
  ON public.zapi_broadcast_targets (broadcast_id, status)
  WHERE status = 'pendente';

-- Índice para dashboard de campanhas: lista por conta/status
CREATE INDEX IF NOT EXISTS idx_zapi_broadcasts_account
  ON public.zapi_broadcasts (account_id, status);

-- Índice para busca de targets por broadcast (detalhes/relatório)
CREATE INDEX IF NOT EXISTS idx_zapi_broadcast_targets_broadcast
  ON public.zapi_broadcast_targets (broadcast_id);

COMMENT ON INDEX public.idx_zapi_broadcast_targets_pendente IS
  'Índice parcial para a EF zapi-broadcast-send: busca targets pendentes por broadcast. '
  'WHERE status=''pendente'' — exclui já enviados/bloqueados do índice.';

-- ─── 4. RLS: zapi_broadcasts ─────────────────────────────────────────────────

ALTER TABLE public.zapi_broadcasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "zapi_broadcasts_select" ON public.zapi_broadcasts;
DROP POLICY IF EXISTS "zapi_broadcasts_insert" ON public.zapi_broadcasts;
DROP POLICY IF EXISTS "zapi_broadcasts_update" ON public.zapi_broadcasts;
DROP POLICY IF EXISTS "zapi_broadcasts_delete" ON public.zapi_broadcasts;

-- SELECT: apenas o criador pode ver as suas campanhas
CREATE POLICY "zapi_broadcasts_select"
  ON public.zapi_broadcasts
  FOR SELECT
  USING (created_by = auth.uid());

-- INSERT: bloqueado no client — APENAS service_role (EF zapi-broadcast-create)
CREATE POLICY "zapi_broadcasts_insert"
  ON public.zapi_broadcasts
  FOR INSERT
  WITH CHECK (false);

COMMENT ON POLICY "zapi_broadcasts_insert" ON public.zapi_broadcasts IS
  'INSERT bloqueado no client. Apenas EF zapi-broadcast-create (service_role) insere. '
  'Garante validação de opt-in e account_id antes de criar campanha.';

-- UPDATE: bloqueado no client — APENAS service_role (EF zapi-broadcast-send)
CREATE POLICY "zapi_broadcasts_update"
  ON public.zapi_broadcasts
  FOR UPDATE
  USING (false);

COMMENT ON POLICY "zapi_broadcasts_update" ON public.zapi_broadcasts IS
  'UPDATE bloqueado no client. Apenas EFs de broadcast (service_role) atualizam contadores/status.';

-- DELETE: pelo criador (cancelamento de rascunho)
CREATE POLICY "zapi_broadcasts_delete"
  ON public.zapi_broadcasts
  FOR DELETE
  USING (created_by = auth.uid() AND status = 'rascunho');

COMMENT ON POLICY "zapi_broadcasts_delete" ON public.zapi_broadcasts IS
  'DELETE apenas para rascunhos do próprio criador.';

-- ─── 5. RLS: zapi_broadcast_targets ──────────────────────────────────────────

ALTER TABLE public.zapi_broadcast_targets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "zapi_broadcast_targets_select" ON public.zapi_broadcast_targets;
DROP POLICY IF EXISTS "zapi_broadcast_targets_insert" ON public.zapi_broadcast_targets;
DROP POLICY IF EXISTS "zapi_broadcast_targets_update" ON public.zapi_broadcast_targets;
DROP POLICY IF EXISTS "zapi_broadcast_targets_delete" ON public.zapi_broadcast_targets;

-- SELECT: usuário autenticado pode ver targets de broadcasts que criou
CREATE POLICY "zapi_broadcast_targets_select"
  ON public.zapi_broadcast_targets
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.zapi_broadcasts b
      WHERE b.id = broadcast_id
        AND b.created_by = auth.uid()
    )
  );

-- INSERT: bloqueado no client
CREATE POLICY "zapi_broadcast_targets_insert"
  ON public.zapi_broadcast_targets
  FOR INSERT
  WITH CHECK (false);

COMMENT ON POLICY "zapi_broadcast_targets_insert" ON public.zapi_broadcast_targets IS
  'INSERT bloqueado no client. Apenas EF zapi-broadcast-create (service_role) insere targets.';

-- UPDATE: bloqueado no client
CREATE POLICY "zapi_broadcast_targets_update"
  ON public.zapi_broadcast_targets
  FOR UPDATE
  USING (false);

-- DELETE: bloqueado no client
CREATE POLICY "zapi_broadcast_targets_delete"
  ON public.zapi_broadcast_targets
  FOR DELETE
  USING (false);

-- ─── Log ──────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  RAISE NOTICE 'Migration 070: '
    'zapi_broadcasts criada (RLS: SELECT por created_by, INSERT/UPDATE bloqueados), '
    'zapi_broadcast_targets criada (RLS: SELECT via broadcast, INSERT/UPDATE/DELETE bloqueados), '
    'índices criados (pendente, account+status, broadcast). '
    'Referência: T63 Fase 6 Onda A.';
END
$$;
