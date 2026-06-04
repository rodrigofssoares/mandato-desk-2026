-- Migration: 112_zapi_cleanup_soft_delete
--
-- Feature: EM082 — Limpeza de Histórico de Conversas WhatsApp (lixeira de 7 dias)
--
-- Por que:
--   Toda operação de limpeza de histórico WhatsApp é um soft-delete:
--   os dados ficam ocultos por 7 dias e só então um cron os apaga definitivamente.
--   Isso permite que o admin recupere dados apagados por engano antes do prazo vencer.
--   Esta migration cria toda a infra de banco — nenhuma outra task (EF, hook, UI)
--   pode avançar sem ela.
--
-- O que muda:
--   1. ADD COLUMN deleted_at + deleted_by em 5 tabelas de mensagens/conversas.
--   2. ADD COLUMN deleted_at (sem deleted_by) em zapi_webhook_log (log de sistema).
--   3. Partial indexes WHERE deleted_at IS NULL para performance de listagem.
--   4. Tabela zapi_cleanup_batches: registra cada operação de limpeza como lote
--      identificável para restauração pelo admin.
--   5. RLS em zapi_cleanup_batches: SELECT para privilegiados; escrita bloqueada
--      para client (somente via service_role / Edge Function).
--   6. Cron zapi-purge-trash (03:10 UTC): hard-delete após 7 dias nas 6 tabelas.
--   7. Cron zapi-expire-cleanup-batches (03:15 UTC): marca batches vencidos.
--   8. ATUALIZAR zapi-purge-messages e zapi-purge-webhook-logs (migration 044) para
--      respeitar deleted_at IS NULL — não apagar itens ainda na janela da lixeira.
--
-- Segurança:
--   - RLS de zapi_cleanup_batches: service_role via EF gerencia INSERT/UPDATE/DELETE;
--     client só lê (e apenas se is_zapi_privileged). Previne que usuário restrito
--     forje ou liste batches de outras contas.
--   - deleted_by referencia auth.users (ON DELETE SET NULL): auditoria de quem apagou.
--     Não impede purge definitivo após 7 dias (cron usa service_role).
--   - Defeito corrigido (2026-06-04): initiated_by em zapi_cleanup_batches é NOT NULL.
--     ON DELETE SET NULL seria contraditório — violaria NOT NULL ao deletar o usuário.
--     Correto: ON DELETE RESTRICT (impede exclusão do usuário enquanto há batches;
--     batches expiram em 7 dias, após isso o usuário pode ser excluído normalmente).
--   - Cron purge-trash: deleta na ordem FK-safe (filhos antes do pai).
--
-- RBAC (canDelete / canBulkDelete em 'whatsapp'):
--   A tabela permissoes_perfil já tem os campos pode_deletar e pode_deletar_em_massa.
--   A migration 049 já seed essas flags para a seção 'whatsapp':
--     admin → pode_deletar=TRUE, pode_deletar_em_massa=TRUE
--     demais roles → FALSE para ambas
--   Esta migration reforça o seed via UPSERT para garantir consistência.
--   Os helpers de UI (can.deleteWhatsapp() e can.bulkDeleteWhatsapp()) serão
--   adicionados em usePermissions.tsx nas tasks T06 e T07 respectivamente.
--
-- Rollback:
--   SELECT cron.unschedule('zapi-purge-trash');
--   SELECT cron.unschedule('zapi-expire-cleanup-batches');
--   -- Restaurar crons originais da migration 044 (sem AND deleted_at IS NULL):
--   SELECT cron.unschedule('zapi-purge-messages');
--   SELECT cron.unschedule('zapi-purge-webhook-logs');
--   DROP TABLE IF EXISTS public.zapi_cleanup_batches;
--   ALTER TABLE public.zapi_messages     DROP COLUMN IF EXISTS deleted_at, DROP COLUMN IF EXISTS deleted_by;
--   ALTER TABLE public.zapi_chats        DROP COLUMN IF EXISTS deleted_at, DROP COLUMN IF EXISTS deleted_by;
--   ALTER TABLE public.zapi_chat_notes   DROP COLUMN IF EXISTS deleted_at, DROP COLUMN IF EXISTS deleted_by;
--   ALTER TABLE public.zapi_chat_tags    DROP COLUMN IF EXISTS deleted_at, DROP COLUMN IF EXISTS deleted_by;
--   ALTER TABLE public.zapi_chat_message_flags DROP COLUMN IF EXISTS deleted_at, DROP COLUMN IF EXISTS deleted_by;
--   ALTER TABLE public.zapi_webhook_log  DROP COLUMN IF EXISTS deleted_at;
--
-- Depende de:
--   043_zapi_whatsapp (tabelas base), 044_zapi_purge_cron (jobs originais),
--   057_zapi_tabelas_auxiliares (notes, tags, flags), 111_em080_whatsapp_access_control
--   (is_zapi_privileged helper).
--
-- Referência: RAQ-MAND-EM082 — T01

-- ─── 1. Soft-delete em 5 tabelas principais ───────────────────────────────────
--
-- deleted_at: timestamp do soft-delete; NULL = registro ativo.
-- deleted_by: auditoria de quem disparou a limpeza (pode ser NULL após exclusão do usuário).
-- ON DELETE SET NULL: preserva o registro mesmo se o usuário for removido do sistema.

-- ── 1a. zapi_messages ────────────────────────────────────────────────────────
ALTER TABLE public.zapi_messages
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.zapi_messages.deleted_at IS
  'Timestamp do soft-delete (lixeira). NULL = mensagem ativa. '
  'Hard-delete pelo cron zapi-purge-trash após 7 dias. '
  'Referência: RAQ-MAND-EM082.';

COMMENT ON COLUMN public.zapi_messages.deleted_by IS
  'Usuário que iniciou a operação de limpeza (auditoria). '
  'NULL quando deleted_at IS NULL ou após remoção do usuário. '
  'Referência: RAQ-MAND-EM082.';

-- ── 1b. zapi_chats ───────────────────────────────────────────────────────────
ALTER TABLE public.zapi_chats
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.zapi_chats.deleted_at IS
  'Timestamp do soft-delete (lixeira). NULL = conversa ativa. '
  'Soft-delete do chat implica ocultar todas as mensagens/notas/etiquetas/favoritos. '
  'Hard-delete pelo cron zapi-purge-trash após 7 dias. '
  'Referência: RAQ-MAND-EM082.';

COMMENT ON COLUMN public.zapi_chats.deleted_by IS
  'Usuário que iniciou a operação de limpeza (auditoria). '
  'Referência: RAQ-MAND-EM082.';

-- ── 1c. zapi_chat_notes ──────────────────────────────────────────────────────
ALTER TABLE public.zapi_chat_notes
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.zapi_chat_notes.deleted_at IS
  'Timestamp do soft-delete (lixeira). NULL = nota ativa. '
  'Referência: RAQ-MAND-EM082.';

COMMENT ON COLUMN public.zapi_chat_notes.deleted_by IS
  'Usuário que iniciou a operação de limpeza (auditoria). '
  'Referência: RAQ-MAND-EM082.';

-- ── 1d. zapi_chat_tags ───────────────────────────────────────────────────────
ALTER TABLE public.zapi_chat_tags
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.zapi_chat_tags.deleted_at IS
  'Timestamp do soft-delete (lixeira). NULL = etiqueta ativa. '
  'Referência: RAQ-MAND-EM082.';

COMMENT ON COLUMN public.zapi_chat_tags.deleted_by IS
  'Usuário que iniciou a operação de limpeza (auditoria). '
  'Referência: RAQ-MAND-EM082.';

-- ── 1e. zapi_chat_message_flags ──────────────────────────────────────────────
ALTER TABLE public.zapi_chat_message_flags
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS deleted_by  UUID        REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.zapi_chat_message_flags.deleted_at IS
  'Timestamp do soft-delete (lixeira). NULL = favorito ativo. '
  'Referência: RAQ-MAND-EM082.';

COMMENT ON COLUMN public.zapi_chat_message_flags.deleted_by IS
  'Usuário que iniciou a operação de limpeza (auditoria). '
  'Referência: RAQ-MAND-EM082.';

-- ─── 2. Soft-delete em zapi_webhook_log (só deleted_at, sem deleted_by) ──────
--
-- Motivo: webhook_log é log de sistema gerado automaticamente, sem atribuição de
-- usuário no momento da criação. A coluna deleted_by não faz sentido semântico aqui
-- (quem "apaga" é a EF de limpeza, não um usuário diretamente). Mantemos apenas
-- deleted_at para o cron de purge respeitar a janela da lixeira.

ALTER TABLE public.zapi_webhook_log
  ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMPTZ DEFAULT NULL;

COMMENT ON COLUMN public.zapi_webhook_log.deleted_at IS
  'Timestamp do soft-delete (lixeira). NULL = log ativo. '
  'Sem deleted_by: log de sistema — o usuário é rastreado via zapi_cleanup_batches. '
  'Hard-delete pelo cron zapi-purge-trash após 7 dias. '
  'Referência: RAQ-MAND-EM082.';

-- ─── 2b. Coluna deleted_batch_id nas 6 tabelas (FIX 2 — restore determinístico) ──
--
-- Por que: o restore anterior filtrava por deleted_by = batch.initiated_by, que mistura
-- registros de batches diferentes do mesmo usuário na mesma conta. Com deleted_batch_id
-- o restore é scoped exatamente ao lote — elimina drift completamente.
-- deleted_by é mantido para auditoria.
--
-- ON DELETE SET NULL: se o batch for deletado (cenário de rollback manual), os registros
-- perdem o vínculo com o batch mas mantêm deleted_at (continuam ocultos até o purge-trash).

ALTER TABLE public.zapi_messages
  ADD COLUMN IF NOT EXISTS deleted_batch_id UUID REFERENCES public.zapi_cleanup_batches(id) ON DELETE SET NULL;

ALTER TABLE public.zapi_chats
  ADD COLUMN IF NOT EXISTS deleted_batch_id UUID REFERENCES public.zapi_cleanup_batches(id) ON DELETE SET NULL;

ALTER TABLE public.zapi_chat_notes
  ADD COLUMN IF NOT EXISTS deleted_batch_id UUID REFERENCES public.zapi_cleanup_batches(id) ON DELETE SET NULL;

ALTER TABLE public.zapi_chat_tags
  ADD COLUMN IF NOT EXISTS deleted_batch_id UUID REFERENCES public.zapi_cleanup_batches(id) ON DELETE SET NULL;

ALTER TABLE public.zapi_chat_message_flags
  ADD COLUMN IF NOT EXISTS deleted_batch_id UUID REFERENCES public.zapi_cleanup_batches(id) ON DELETE SET NULL;

ALTER TABLE public.zapi_webhook_log
  ADD COLUMN IF NOT EXISTS deleted_batch_id UUID REFERENCES public.zapi_cleanup_batches(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.zapi_messages.deleted_batch_id IS
  'ID do lote de limpeza que gerou este soft-delete. NULL = ativo ou apagado antes do EM082. '
  'Usado pelo restore para reverter exatamente este lote (evita drift com outros batches). '
  'Referência: RAQ-MAND-EM082.';

COMMENT ON COLUMN public.zapi_chats.deleted_batch_id IS
  'ID do lote de limpeza que gerou este soft-delete. Referência: RAQ-MAND-EM082.';

COMMENT ON COLUMN public.zapi_chat_notes.deleted_batch_id IS
  'ID do lote de limpeza que gerou este soft-delete. Referência: RAQ-MAND-EM082.';

COMMENT ON COLUMN public.zapi_chat_tags.deleted_batch_id IS
  'ID do lote de limpeza que gerou este soft-delete. Referência: RAQ-MAND-EM082.';

COMMENT ON COLUMN public.zapi_chat_message_flags.deleted_batch_id IS
  'ID do lote de limpeza que gerou este soft-delete. Referência: RAQ-MAND-EM082.';

COMMENT ON COLUMN public.zapi_webhook_log.deleted_batch_id IS
  'ID do lote de limpeza que gerou este soft-delete. Referência: RAQ-MAND-EM082.';

-- ─── 3. Partial indexes WHERE deleted_at IS NULL ──────────────────────────────
--
-- Partial indexes cobrem apenas registros ativos (99%+ dos acessos) — o planner
-- os usa automaticamente em queries com WHERE deleted_at IS NULL, reduzindo
-- o custo de scan de forma significativa após a adição das colunas de soft-delete.
--
-- Índices existentes (sem filtro de deleted_at) serão mantidos para as queries
-- de purge do cron (que buscam por deleted_at IS NOT NULL).

-- Mensagens ativas por chat (hot path: renderização do histórico de conversa)
CREATE INDEX IF NOT EXISTS idx_zapi_messages_active
  ON public.zapi_messages (chat_id)
  WHERE deleted_at IS NULL;

COMMENT ON INDEX public.idx_zapi_messages_active IS
  'Partial index para queries de listagem de mensagens ativas (deleted_at IS NULL). '
  'Cobre o hot path de renderização do histórico de conversa. '
  'Referência: RAQ-MAND-EM082.';

-- Conversas ativas por conta (hot path: seletor de conversas)
CREATE INDEX IF NOT EXISTS idx_zapi_chats_active
  ON public.zapi_chats (account_id)
  WHERE deleted_at IS NULL;

COMMENT ON INDEX public.idx_zapi_chats_active IS
  'Partial index para queries de listagem de conversas ativas (deleted_at IS NULL). '
  'Cobre o hot path do seletor de conversas. '
  'Referência: RAQ-MAND-EM082.';

-- Conversas ativas por conta ordenadas por última mensagem (listagem principal)
CREATE INDEX IF NOT EXISTS idx_zapi_chats_active_ordered
  ON public.zapi_chats (account_id, last_message_at DESC)
  WHERE deleted_at IS NULL;

COMMENT ON INDEX public.idx_zapi_chats_active_ordered IS
  'Partial index composto para listagem principal de conversas ativas ordenadas '
  'por última mensagem (deleted_at IS NULL). '
  'Referência: RAQ-MAND-EM082.';

-- ─── 4. Tabela zapi_cleanup_batches ──────────────────────────────────────────
--
-- Registra cada operação de limpeza como um lote identificável.
-- Permite que o admin veja o que está na lixeira e restaure o lote inteiro.
-- Sem esta tabela não há como recuperar "o lote que Joana apagou ontem de manhã".
--
-- mode: tipo de limpeza executada
--   'period'   → período de datas (start_date/end_date)
--   'all'      → toda a conta
--   'chats'    → conversas específicas (array de chat_ids)
--   'granular' → itens selecionados (mensagens, notas, etiquetas, favoritos, logs)
--
-- filters: JSONB serializado dos parâmetros de filtro do modo.
--   Exemplos:
--     period:   {"start_date": "2026-01-01", "end_date": "2026-03-31"}
--     all:      {}
--     chats:    {"chat_ids": ["uuid1", "uuid2"]}
--     granular: {"chat_ids": [], "items": ["messages", "notes"]}
--
-- status:
--   'pending'  → na lixeira, disponível para restauração
--   'restored' → restaurado pelo admin antes do prazo
--   'expired'  → prazo de 7 dias expirou; dados já foram hard-deletados pelo cron

CREATE TABLE IF NOT EXISTS public.zapi_cleanup_batches (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id       UUID        NOT NULL REFERENCES public.zapi_accounts(id) ON DELETE CASCADE,
  -- ON DELETE RESTRICT: initiated_by é NOT NULL, logo SET NULL violaria a constraint.
  -- Se o usuário for removido do sistema, o admin deve primeiro transferir ou
  -- arquivar os batches manualmente (ou o cron de expiração os marca como 'expired').
  -- RESTRICT garante integridade sem surpresas silenciosas.
  initiated_by     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  mode             TEXT        NOT NULL CHECK (mode IN ('period', 'all', 'chats', 'granular')),
  filters          JSONB       NOT NULL DEFAULT '{}'::jsonb,
  status           TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'restored', 'expired')),
  row_count_estimate INT       NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days')
);

COMMENT ON TABLE public.zapi_cleanup_batches IS
  'Registra cada operação de limpeza de histórico WhatsApp como um lote identificável. '
  'Permite que o admin visualize o que está na lixeira e restaure o lote inteiro '
  'dentro do prazo de 7 dias (expires_at). '
  'Escrita exclusiva via service_role (Edge Functions) — RLS bloqueia client. '
  'Referência: RAQ-MAND-EM082.';

COMMENT ON COLUMN public.zapi_cleanup_batches.account_id IS
  'Conta Z-API afetada pela limpeza. ON DELETE CASCADE: batch removido se conta for deletada.';

COMMENT ON COLUMN public.zapi_cleanup_batches.initiated_by IS
  'Usuário que iniciou a limpeza (auditoria). NOT NULL. '
  'ON DELETE RESTRICT: impede exclusão do usuário enquanto há batches vinculados. '
  'Após 7 dias os batches expiram e o usuário pode ser excluído normalmente.';

COMMENT ON COLUMN public.zapi_cleanup_batches.mode IS
  'Modo de limpeza: period (período), all (tudo), chats (conversas específicas), '
  'granular (itens selecionados por tipo).';

COMMENT ON COLUMN public.zapi_cleanup_batches.filters IS
  'JSONB com os parâmetros do filtro aplicado. '
  'period: {"start_date":"ISO","end_date":"ISO"} | '
  'all: {} | '
  'chats: {"chat_ids":["uuid",...]} | '
  'granular: {"chat_ids":[],"items":["messages","notes","tags","flags","logs"]}. '
  'Usado pela EF zapi-restore-history para re-executar o predicado em sentido inverso.';

COMMENT ON COLUMN public.zapi_cleanup_batches.status IS
  'pending: na lixeira, restaurável | '
  'restored: admin restaurou antes do prazo | '
  'expired: prazo vencido (cron zapi-expire-cleanup-batches marcou após expires_at < now()).';

COMMENT ON COLUMN public.zapi_cleanup_batches.row_count_estimate IS
  'Estimativa de registros afetados pela limpeza (soma de todas as tabelas). '
  'Exibido no painel de lixeira para informar o admin sobre o tamanho do lote.';

COMMENT ON COLUMN public.zapi_cleanup_batches.expires_at IS
  'Data limite para restauração (7 dias após created_at). '
  'Após este prazo, o cron zapi-purge-trash já executou o hard-delete definitivo.';

-- Índices de suporte às queries do painel de lixeira
CREATE INDEX IF NOT EXISTS idx_zapi_cleanup_batches_account
  ON public.zapi_cleanup_batches (account_id, created_at DESC);

-- FIX 4 — Race condition: garante no máximo 1 batch pending por conta
-- (previne que duas requisições simultâneas criem dois batches pending para a mesma conta)
CREATE UNIQUE INDEX IF NOT EXISTS idx_zapi_cleanup_batches_unique_pending
  ON public.zapi_cleanup_batches (account_id)
  WHERE status = 'pending';

COMMENT ON INDEX public.idx_zapi_cleanup_batches_unique_pending IS
  'Garante que cada conta tenha no máximo 1 batch em status pending por vez. '
  'Previne race condition de limpezas simultâneas na mesma conta. '
  'A EF trata violação deste constraint como 409 Conflict. '
  'Referência: RAQ-MAND-EM082.';

CREATE INDEX IF NOT EXISTS idx_zapi_cleanup_batches_status_expires
  ON public.zapi_cleanup_batches (status, expires_at);

COMMENT ON INDEX public.idx_zapi_cleanup_batches_account IS
  'Suporta listagem de batches por conta ordenados por data (painel de lixeira). '
  'Referência: RAQ-MAND-EM082.';

COMMENT ON INDEX public.idx_zapi_cleanup_batches_status_expires IS
  'Suporta job zapi-expire-cleanup-batches (filtro status + expires_at) e '
  'query de batches pendentes no painel de lixeira. '
  'Referência: RAQ-MAND-EM082.';

-- ─── 4b. Helper can_access_zapi_account (FIX 1 — IDOR cross-account) ────────
--
-- Por que aqui e não na migration 111:
--   A migration 111 criou is_zapi_privileged(_uid) para controle de acesso ao painel
--   de abas/contas do WhatsApp. Este helper é específico para o contexto de limpeza:
--   valida que UM usuário específico pode operar EM UMA conta específica.
--
-- Lógica espelhando a RLS de zapi_accounts_select (migration 111):
--   - Privilegiados (admin/proprietário ATIVOS): acesso a TODAS as contas.
--   - Restritos (assessor/assistente/estagiário ATIVOS): somente contas com vínculo
--     explícito em zapi_account_users.
--
-- Usado pelas EFs zapi-cleanup-history e zapi-restore-history para verificar
-- se o caller tem permissão de operar na conta informada no payload.
-- Sem este check um usuário restrito com pode_deletar=true poderia passar
-- qualquer account_id arbitrário e apagar dados de qualquer conta (IDOR).

CREATE OR REPLACE FUNCTION public.can_access_zapi_account(
  _uid        UUID,
  _account_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  _role TEXT;
  _status TEXT;
BEGIN
  -- Lê role e status do perfil
  SELECT role, status_aprovacao
    INTO _role, _status
    FROM public.profiles
   WHERE id = _uid;

  -- Perfil inativo ou inexistente: sem acesso
  IF _status IS DISTINCT FROM 'ATIVO' THEN
    RETURN FALSE;
  END IF;

  -- Privilegiados: acesso irrestrito (espelho de is_zapi_privileged)
  IF _role IN ('admin', 'proprietario') THEN
    RETURN TRUE;
  END IF;

  -- Restritos: verifica vínculo na tabela de controle de acesso criada pelo EM080
  RETURN EXISTS (
    SELECT 1
      FROM public.zapi_account_users
     WHERE account_id = _account_id
       AND user_id    = _uid
  );
END;
$$;

COMMENT ON FUNCTION public.can_access_zapi_account(UUID, UUID) IS
  'Verifica se o usuário _uid pode operar na conta _account_id. '
  'Privilegiados (admin/proprietário) têm acesso irrestrito. '
  'Restritos (assessor/assistente/estagiário) precisam de vínculo em zapi_account_users. '
  'Usado pelas EFs de limpeza/restauração para prevenir IDOR cross-account. '
  'Referência: RAQ-MAND-EM082.';

-- ─── 5. RLS em zapi_cleanup_batches ──────────────────────────────────────────
--
-- Estratégia de segurança:
--   SELECT: apenas is_zapi_privileged (admin ou proprietário ATIVO).
--           Usuário restrito (assessor/assistente/agente) não enxerga a lixeira
--           mesmo que tenha iniciado a limpeza — quem gerencia lixeira é o admin.
--   INSERT/UPDATE/DELETE: bloqueado para client (USING false / WITH CHECK false).
--           Somente a Edge Function rodando como service_role pode escrever.
--           Isso previne que o client forge batches ou altere status diretamente.
--
-- Nota: is_zapi_privileged foi criado na migration 111_em080_whatsapp_access_control.

ALTER TABLE public.zapi_cleanup_batches ENABLE ROW LEVEL SECURITY;

-- Leitura: apenas privilegiados (admin / proprietário ATIVO)
DROP POLICY IF EXISTS "zapi_cleanup_batches_select" ON public.zapi_cleanup_batches;
CREATE POLICY "zapi_cleanup_batches_select"
  ON public.zapi_cleanup_batches
  FOR SELECT
  TO authenticated
  USING ( public.is_zapi_privileged(auth.uid()) );

-- Escrita: bloqueada para client (service_role via EF gerencia)
-- INSERT bloqueado
DROP POLICY IF EXISTS "zapi_cleanup_batches_insert" ON public.zapi_cleanup_batches;
CREATE POLICY "zapi_cleanup_batches_insert"
  ON public.zapi_cleanup_batches
  FOR INSERT
  TO authenticated
  WITH CHECK ( false );

-- UPDATE bloqueado
DROP POLICY IF EXISTS "zapi_cleanup_batches_update" ON public.zapi_cleanup_batches;
CREATE POLICY "zapi_cleanup_batches_update"
  ON public.zapi_cleanup_batches
  FOR UPDATE
  TO authenticated
  USING ( false )
  WITH CHECK ( false );

-- DELETE bloqueado
DROP POLICY IF EXISTS "zapi_cleanup_batches_delete" ON public.zapi_cleanup_batches;
CREATE POLICY "zapi_cleanup_batches_delete"
  ON public.zapi_cleanup_batches
  FOR DELETE
  TO authenticated
  USING ( false );

-- GRANT de leitura para authenticated (RLS faz o gate fino via is_zapi_privileged)
-- service_role já tem acesso irrestrito por padrão — não precisa de GRANT explícito.
GRANT SELECT ON public.zapi_cleanup_batches TO authenticated;

-- ─── 6. Cron: zapi-purge-trash (hard-delete após 7 dias) ─────────────────────
--
-- Executa às 03:10 UTC diariamente (após os crons de 03:00 e 03:05 da migration 044).
-- Hard-deleta registros com deleted_at < now() - 7 days em todas as 6 tabelas afetadas.
--
-- Ordem de deleção (respeita FKs):
--   1. Filhas de zapi_messages (nenhuma neste projeto — zapi_messages é folha)
--   2. zapi_chat_message_flags  → FK para zapi_chats (ON DELETE CASCADE)
--   3. zapi_chat_tags           → FK para zapi_chats (ON DELETE CASCADE)
--   4. zapi_chat_notes          → FK para zapi_chats (ON DELETE CASCADE)
--   5. zapi_messages            → FK para zapi_chats (ON DELETE CASCADE)
--   6. zapi_chats               → pai das 4 tabelas acima
--   7. zapi_webhook_log         → independente (sem FK para zapi_chats)
--
-- Nota: mesmo que o CASCADE já cubra filhos ao deletar chats, o cron opera por
-- deleted_at individual — um registro filho pode ter sido soft-deletado no modo
-- granular SEM que o chat pai tenha sido soft-deletado. O delete explícito de cada
-- tabela pelo próprio deleted_at é necessário para cobrir este caso.
--
-- Idempotência: unschedule antes de recriar (padrão da migration 044).

SELECT cron.unschedule('zapi-purge-trash')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'zapi-purge-trash');

SELECT cron.schedule(
  'zapi-purge-trash',
  '10 3 * * *',
  $$
    -- Hard-delete de itens na lixeira há mais de 7 dias — ordem FK-safe

    -- 1. Favoritos (filha de zapi_chats, sem filhas próprias)
    DELETE FROM public.zapi_chat_message_flags
    WHERE deleted_at IS NOT NULL
      AND deleted_at < now() - INTERVAL '7 days';

    -- 2. Etiquetas de conversa (filha de zapi_chats, sem filhas próprias)
    DELETE FROM public.zapi_chat_tags
    WHERE deleted_at IS NOT NULL
      AND deleted_at < now() - INTERVAL '7 days';

    -- 3. Notas internas (filha de zapi_chats, sem filhas próprias)
    DELETE FROM public.zapi_chat_notes
    WHERE deleted_at IS NOT NULL
      AND deleted_at < now() - INTERVAL '7 days';

    -- 4. Mensagens (filha de zapi_chats, sem filhas próprias)
    DELETE FROM public.zapi_messages
    WHERE deleted_at IS NOT NULL
      AND deleted_at < now() - INTERVAL '7 days';

    -- 5. Conversas (pai das 4 acima — deletar por último)
    --    ON DELETE CASCADE cobre filhos não-soft-deletados que ainda restarem
    DELETE FROM public.zapi_chats
    WHERE deleted_at IS NOT NULL
      AND deleted_at < now() - INTERVAL '7 days';

    -- 6. Log de webhook (independente, sem FK para zapi_chats)
    DELETE FROM public.zapi_webhook_log
    WHERE deleted_at IS NOT NULL
      AND deleted_at < now() - INTERVAL '7 days';
  $$
);

-- ─── 7. Cron: zapi-expire-cleanup-batches ────────────────────────────────────
--
-- Executa às 03:15 UTC diariamente (5 minutos após o purge-trash).
-- Marca como 'expired' os batches cujo prazo de restauração venceu.
-- Executar APÓS o purge-trash garante consistência: quando o admin ver 'expired',
-- os dados já foram definitivamente removidos pelo cron anterior.

SELECT cron.unschedule('zapi-expire-cleanup-batches')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'zapi-expire-cleanup-batches');

SELECT cron.schedule(
  'zapi-expire-cleanup-batches',
  '15 3 * * *',
  $$
    UPDATE public.zapi_cleanup_batches
    SET status = 'expired'
    WHERE status = 'pending'
      AND expires_at < now();
  $$
);

-- ─── 8. Atualizar crons existentes (migration 044) ───────────────────────────
--
-- PROBLEMA: os jobs zapi-purge-messages e zapi-purge-webhook-logs da migration 044
-- deletam por created_at / received_at < 90 dias SEM checar deleted_at.
-- Com soft-delete, um item que foi enviado para a lixeira há 1 dia (deleted_at=hoje)
-- mas foi criado há 95 dias (created_at=95 dias atrás) seria deletado pelo cron de
-- 90 dias ANTES do prazo de 7 dias da lixeira vencer — apagando a chance de restauração.
--
-- CORREÇÃO: adicionar AND deleted_at IS NULL nos WHEREs dos dois crons.
-- Isso garante que o purge de 90 dias só toca registros ATIVOS (não na lixeira).
-- O purge definitivo dos itens na lixeira fica exclusivamente com zapi-purge-trash
-- (que opera por deleted_at < now() - 7 days).
--
-- Implementação: unschedule + schedule (padrão idempotente da migration 044).
-- Os horários são mantidos: 03:00 e 03:05 UTC.

-- ── 8a. zapi-purge-messages (reescrito) ──────────────────────────────────────
SELECT cron.unschedule('zapi-purge-messages')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'zapi-purge-messages');

SELECT cron.schedule(
  'zapi-purge-messages',
  '0 3 * * *',
  $$
    -- Purge de mensagens ATIVAS (não na lixeira) com mais de 90 dias.
    -- AND deleted_at IS NULL: garante que itens em lixeira (deleted_at NOT NULL)
    -- não sejam apagados aqui — eles serão tratados pelo cron zapi-purge-trash.
    DELETE FROM public.zapi_messages
    WHERE created_at < now() - INTERVAL '90 days'
      AND deleted_at IS NULL;
  $$
);

-- ── 8b. zapi-purge-webhook-logs (reescrito) ──────────────────────────────────
SELECT cron.unschedule('zapi-purge-webhook-logs')
  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'zapi-purge-webhook-logs');

SELECT cron.schedule(
  'zapi-purge-webhook-logs',
  '5 3 * * *',
  $$
    -- Purge de logs de webhook ATIVOS (não na lixeira) com mais de 90 dias.
    -- AND deleted_at IS NULL: idem ao cron de mensagens.
    DELETE FROM public.zapi_webhook_log
    WHERE received_at < now() - INTERVAL '90 days'
      AND deleted_at IS NULL;
  $$
);

-- ─── 9. RBAC: garantir flags canDelete / canBulkDelete para 'whatsapp' ────────
--
-- A tabela permissoes_perfil e os campos pode_deletar / pode_deletar_em_massa já
-- existem desde a migration 001 / 049. A seção 'whatsapp' foi seedada na migration
-- 049 com admin=TRUE e demais roles=FALSE para essas flags.
--
-- Esta migration reforça o seed via UPSERT idempotente para garantir que, mesmo em
-- ambientes onde a migration 049 não foi aplicada ou foi revertida, o estado correto
-- seja estabelecido.
--
-- Mapeamento RBAC → usePermissions.tsx:
--   pode_deletar         → canDelete('whatsapp')       → can.deleteWhatsapp()   (T06)
--   pode_deletar_em_massa → canBulkDelete('whatsapp') → can.bulkDeleteWhatsapp() (T07)
--
-- Regra de negócio:
--   admin: pode_deletar=TRUE, pode_deletar_em_massa=TRUE (pode limpar E restaurar lixeira)
--   proprietário: FALSE para ambas (não pode limpar — admin habilita manualmente se necessário)
--   assessor/assistente/estagiário: FALSE para ambas (idem)
--
-- NOTA IMPORTANTE: os helpers de UI can.deleteWhatsapp() e can.bulkDeleteWhatsapp()
-- NÃO existem ainda em usePermissions.tsx. Eles serão adicionados nas tasks T06 e T07
-- respectivamente, seguindo o padrão dos demais helpers (ex: deleteContact, bulkDeleteContacts).
-- O gating de UI ficará em:
--   T06 → CleanupHistoryDialog (deleteWhatsapp)
--   T07 → TrashPanel (bulkDeleteWhatsapp)

INSERT INTO public.permissoes_perfil
  (role, secao, pode_ver, pode_criar, pode_editar, pode_deletar, pode_deletar_em_massa, so_proprio) VALUES
  -- admin: acesso total ao WhatsApp incluindo limpeza e restauração de lixeira
  ('admin',        'whatsapp', TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  FALSE),
  -- proprietário: acessa o módulo mas NÃO limpa nem restaura (admin delega se necessário)
  ('proprietario', 'whatsapp', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  -- assessor: sem acesso (migration 049 — sem alteração intencional)
  ('assessor',     'whatsapp', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  -- assistente: sem acesso
  ('assistente',   'whatsapp', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  -- estagiário (agente de relacionamento): sem acesso
  ('estagiario',   'whatsapp', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE)

ON CONFLICT (role, secao) DO UPDATE SET
  -- Forçar apenas as flags de deleção — não alterar pode_ver/criar/editar/so_proprio
  -- pois o admin pode ter customizado esses valores na matriz de permissões.
  -- EXCEÇÃO: admin sempre tem pode_deletar=TRUE e pode_deletar_em_massa=TRUE
  --          para garantir que alguém sempre pode restaurar a lixeira.
  pode_deletar          = CASE
                            WHEN EXCLUDED.role = 'admin' THEN TRUE
                            ELSE EXCLUDED.pode_deletar
                          END,
  pode_deletar_em_massa = CASE
                            WHEN EXCLUDED.role = 'admin' THEN TRUE
                            ELSE EXCLUDED.pode_deletar_em_massa
                          END;

-- ─── 10. Verificação final ────────────────────────────────────────────────────

DO $$
BEGIN
  -- Coluna deleted_at em zapi_messages
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'zapi_messages'
      AND column_name  = 'deleted_at'
  ) THEN
    RAISE EXCEPTION 'FALHA: coluna deleted_at não adicionada em zapi_messages';
  END IF;

  -- Coluna deleted_at em zapi_chats
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'zapi_chats'
      AND column_name  = 'deleted_at'
  ) THEN
    RAISE EXCEPTION 'FALHA: coluna deleted_at não adicionada em zapi_chats';
  END IF;

  -- Coluna deleted_at em zapi_chat_notes
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'zapi_chat_notes'
      AND column_name  = 'deleted_at'
  ) THEN
    RAISE EXCEPTION 'FALHA: coluna deleted_at não adicionada em zapi_chat_notes';
  END IF;

  -- Coluna deleted_at em zapi_chat_tags
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'zapi_chat_tags'
      AND column_name  = 'deleted_at'
  ) THEN
    RAISE EXCEPTION 'FALHA: coluna deleted_at não adicionada em zapi_chat_tags';
  END IF;

  -- Coluna deleted_at em zapi_chat_message_flags
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'zapi_chat_message_flags'
      AND column_name  = 'deleted_at'
  ) THEN
    RAISE EXCEPTION 'FALHA: coluna deleted_at não adicionada em zapi_chat_message_flags';
  END IF;

  -- Coluna deleted_at em zapi_webhook_log
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'zapi_webhook_log'
      AND column_name  = 'deleted_at'
  ) THEN
    RAISE EXCEPTION 'FALHA: coluna deleted_at não adicionada em zapi_webhook_log';
  END IF;

  -- Tabela zapi_cleanup_batches
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name   = 'zapi_cleanup_batches'
  ) THEN
    RAISE EXCEPTION 'FALHA: tabela zapi_cleanup_batches não criada';
  END IF;

  -- RLS em zapi_cleanup_batches
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'zapi_cleanup_batches'
      AND policyname = 'zapi_cleanup_batches_select'
  ) THEN
    RAISE EXCEPTION 'FALHA: policy zapi_cleanup_batches_select não criada';
  END IF;

  -- Cron zapi-purge-trash
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'zapi-purge-trash'
  ) THEN
    RAISE EXCEPTION 'FALHA: cron job zapi-purge-trash não criado';
  END IF;

  -- Cron zapi-expire-cleanup-batches
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'zapi-expire-cleanup-batches'
  ) THEN
    RAISE EXCEPTION 'FALHA: cron job zapi-expire-cleanup-batches não criado';
  END IF;

  -- Cron zapi-purge-messages (deve existir — foi recriado na seção 8a)
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'zapi-purge-messages'
  ) THEN
    RAISE EXCEPTION 'FALHA: cron job zapi-purge-messages não recriado';
  END IF;

  -- Cron zapi-purge-webhook-logs (deve existir — foi recriado na seção 8b)
  IF NOT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'zapi-purge-webhook-logs'
  ) THEN
    RAISE EXCEPTION 'FALHA: cron job zapi-purge-webhook-logs não recriado';
  END IF;

  -- Partial index idx_zapi_messages_active
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename  = 'zapi_messages'
      AND indexname  = 'idx_zapi_messages_active'
  ) THEN
    RAISE EXCEPTION 'FALHA: partial index idx_zapi_messages_active não criado';
  END IF;

  -- Partial index idx_zapi_chats_active
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename  = 'zapi_chats'
      AND indexname  = 'idx_zapi_chats_active'
  ) THEN
    RAISE EXCEPTION 'FALHA: partial index idx_zapi_chats_active não criado';
  END IF;

  -- Helper can_access_zapi_account
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'can_access_zapi_account'
  ) THEN
    RAISE EXCEPTION 'FALHA: função can_access_zapi_account não criada';
  END IF;

  -- Unique index de batch pending
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename  = 'zapi_cleanup_batches'
      AND indexname  = 'idx_zapi_cleanup_batches_unique_pending'
  ) THEN
    RAISE EXCEPTION 'FALHA: unique index idx_zapi_cleanup_batches_unique_pending não criado';
  END IF;

  -- Coluna deleted_batch_id em zapi_messages
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'zapi_messages'
      AND column_name  = 'deleted_batch_id'
  ) THEN
    RAISE EXCEPTION 'FALHA: coluna deleted_batch_id não adicionada em zapi_messages';
  END IF;

  RAISE NOTICE 'Migration 112_zapi_cleanup_soft_delete aplicada com sucesso. '
               '6 tabelas com deleted_at + deleted_batch_id, zapi_cleanup_batches criada '
               'com RLS + unique index pending, helper can_access_zapi_account criado, '
               '4 cron jobs configurados (purge-trash, expire-batches, '
               'purge-messages atualizado, purge-webhook-logs atualizado).';
END;
$$;
