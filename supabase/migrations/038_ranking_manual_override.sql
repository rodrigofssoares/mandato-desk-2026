-- ============================================================================
-- 038 — Override manual do ranking (mantém cálculo automático opcional)
-- ============================================================================
-- A migration 037 substituiu o ranking manual por cálculo automático via
-- trigger. Rodrigo (cliente) pediu pra REINSERIR a possibilidade de edição
-- manual sem perder o cálculo automático: o usuário deve poder discordar
-- da pontuação sugerida e definir um valor próprio, e voltar ao automático
-- quando quiser.
--
-- Estratégia:
--   - Adiciona coluna `ranking_manual_override` (boolean, default false)
--   - Trigger BEFORE em contacts: se override=TRUE, preserva NEW.ranking
--     vindo do payload em vez de recalcular
--   - Trigger AFTER em contact_campaign_values: se contato tem override=TRUE,
--     pula o UPDATE de ranking (campos de campanha não devem sobrescrever
--     decisão manual)
--   - Backfill: contatos existentes ficam em override=FALSE (compor­ta­men­to
--     atual preservado — todos seguem com cálculo automático)
-- ============================================================================
-- Verificação pós-migration:
--   SELECT COUNT(*) FROM contacts WHERE ranking_manual_override = TRUE;
--   -- Espera: 0 (ninguém em override após migration; só após edição manual)
--
--   -- Smoke do override:
--   UPDATE contacts SET ranking = 9, ranking_manual_override = TRUE
--     WHERE id = '<algum-uuid>';
--   SELECT ranking, ranking_manual_override FROM contacts WHERE id = '<id>';
--   -- Espera: ranking=9, override=TRUE (não foi recalculado)
--
--   UPDATE contacts SET ranking_manual_override = FALSE WHERE id = '<id>';
--   SELECT ranking FROM contacts WHERE id = '<id>';
--   -- Espera: ranking recalculado pelo trigger conforme dados do contato
-- ============================================================================

-- 1. Coluna nova (idempotente)
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS ranking_manual_override BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN contacts.ranking_manual_override IS
  'Quando TRUE, o trigger preserva o valor manual de ranking em vez de recalcular pelo SQL. Edição manual via UI seta TRUE; "voltar pro automático" volta a FALSE.';

-- ============================================================================
-- 2. Atualiza trigger BEFORE em contacts pra respeitar o override
-- ============================================================================
-- Comportamento:
--   INSERT:
--     - override=TRUE  → preserva NEW.ranking (vindo do payload)
--     - override=FALSE → calcula via _calc_ranking_from_row(NEW)
--   UPDATE:
--     - override=TRUE                             → preserva NEW.ranking
--     - override mudou de TRUE→FALSE              → recalcula (volta ao auto)
--     - override sempre FALSE + nenhum dos 18+1
--       campos relevantes mudou                   → não faz nada
--     - override sempre FALSE + algum campo mudou → recalcula
--
-- O flag `ranking_manual_override` entra na lista de campos monitorados
-- pra que a transição override TRUE→FALSE dispare recálculo mesmo sem
-- outras mudanças.
-- ============================================================================

CREATE OR REPLACE FUNCTION update_contact_ranking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- INSERT com override TRUE: preserva ranking do payload
  IF TG_OP = 'INSERT' AND NEW.ranking_manual_override IS TRUE THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- UPDATE com override ainda TRUE (incluindo virar TRUE agora):
    -- preserva NEW.ranking — usuário está editando o valor manual.
    IF NEW.ranking_manual_override IS TRUE THEN
      RETURN NEW;
    END IF;

    -- Override é FALSE. Verifica se algum campo que afeta o cálculo mudou.
    -- Inclui o próprio flag pra que a transição TRUE→FALSE dispare recálculo.
    IF NOT (
      (NEW.ranking_manual_override IS DISTINCT FROM OLD.ranking_manual_override) OR
      (NEW.whatsapp IS DISTINCT FROM OLD.whatsapp) OR
      (NEW.telefone IS DISTINCT FROM OLD.telefone) OR
      (NEW.email IS DISTINCT FROM OLD.email) OR
      (NEW.data_nascimento IS DISTINCT FROM OLD.data_nascimento) OR
      (NEW.leader_id IS DISTINCT FROM OLD.leader_id) OR
      (NEW.declarou_voto IS DISTINCT FROM OLD.declarou_voto) OR
      (NEW.e_multiplicador IS DISTINCT FROM OLD.e_multiplicador) OR
      (NEW.aceita_whatsapp IS DISTINCT FROM OLD.aceita_whatsapp) OR
      (NEW.em_canal_whatsapp IS DISTINCT FROM OLD.em_canal_whatsapp) OR
      (NEW.instagram IS DISTINCT FROM OLD.instagram) OR
      (NEW.twitter IS DISTINCT FROM OLD.twitter) OR
      (NEW.tiktok IS DISTINCT FROM OLD.tiktok) OR
      (NEW.youtube IS DISTINCT FROM OLD.youtube) OR
      (NEW.cep IS DISTINCT FROM OLD.cep) OR
      (NEW.logradouro IS DISTINCT FROM OLD.logradouro) OR
      (NEW.bairro IS DISTINCT FROM OLD.bairro) OR
      (NEW.cidade IS DISTINCT FROM OLD.cidade) OR
      (NEW.estado IS DISTINCT FROM OLD.estado)
    ) THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Recalcula a partir de NEW (INSERT sem override OU UPDATE com mudança relevante)
  NEW.ranking := _calc_ranking_from_row(NEW);

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION update_contact_ranking() IS
  'Trigger BEFORE INSERT OR UPDATE em contacts: respeita ranking_manual_override (TRUE preserva valor; FALSE recalcula via _calc_ranking_from_row). Anti-loop: no UPDATE só age quando algum dos 19 campos relevantes muda.';

-- ============================================================================
-- 3. Atualiza trigger AFTER em contact_campaign_values pra respeitar override
-- ============================================================================
-- Quando um campo de campanha muda, o trigger recalculava ranking
-- automaticamente. Com override, contatos com decisão manual precisam ser
-- preservados — o assessor não quer que marcar/desmarcar um campo de
-- campanha "esmague" o valor que ele definiu.
-- ============================================================================

CREATE OR REPLACE FUNCTION recalc_contact_ranking_from_campaign()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_id   UUID;
  v_override     BOOLEAN;
  v_novo_ranking INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_contact_id := OLD.contact_id;
  ELSE
    v_contact_id := NEW.contact_id;
  END IF;

  IF v_contact_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Skip se contato está em override manual: assessor decidiu o valor,
  -- mexer em campos de campanha não deve sobrescrever a decisão.
  SELECT ranking_manual_override INTO v_override
  FROM contacts
  WHERE id = v_contact_id;

  IF v_override IS TRUE THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_novo_ranking := calc_contact_ranking_score(v_contact_id);

  UPDATE contacts
  SET ranking = v_novo_ranking
  WHERE id = v_contact_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMENT ON FUNCTION recalc_contact_ranking_from_campaign() IS
  'Trigger AFTER em contact_campaign_values: recalcula contacts.ranking quando campos de campanha mudam, exceto se contato está em ranking_manual_override=TRUE.';
