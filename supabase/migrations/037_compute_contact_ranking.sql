-- ============================================================================
-- 037 — Ranking automático de contatos (função + triggers + backfill)
-- ============================================================================
-- Substitui o ranking manual (botões 0-10 na UI) por um valor calculado
-- automaticamente a cada INSERT/UPDATE em contacts ou contact_campaign_values.
--
-- TABELA DE PESOS (escala interna 0-100 → derivado 0-10 via FLOOR(total/10))
-- ============================================================================
--
-- Categoria A — Status de campanha (máx 50 pts)
--   declarou_voto = true          → +20
--   e_multiplicador = true        → +15
--   aceita_whatsapp = true        → +10
--   em_canal_whatsapp = true      → +5
--
-- Categoria B — Dados de contato e pessoais (máx 25 pts)
--   whatsapp preenchido           → +8
--   leader_id preenchido          → +7
--   email preenchido              → +4
--   data_nascimento preenchida    → +3
--   telefone preenchido           → +3
--
-- Categoria C — Endereço (máx 15 pts)
--   bairro + cidade preenchidos   → +7
--   cep preenchido                → +4
--   estado preenchido             → +2
--   logradouro preenchido         → +2
--
-- Categoria D — Redes sociais (máx 5 pts)
--   instagram preenchido          → +3
--   twitter/tiktok/youtube — +1 cada, máx 2 extras
--   (facebook não existe na tabela contacts)
--
-- Categoria E — Campos de campanha customizáveis (máx 5 pts)
--   pts = LEAST(campos_ativos * FLOOR(5/total_campos), 5)
--   Se total_campos = 0 → categoria E = 0 (sem divisão por zero)
--
-- ranking_final = LEAST(FLOOR((A+B+C+D+E) / 10), 10)
-- ============================================================================
-- Exemplos:
--   Contato vazio (só nome)                       →   0 pts → ranking 0
--   declarou_voto=true                            →  20 pts → ranking 2
--   declarou_voto + e_multiplicador               →  35 pts → ranking 3
--   declarou_voto + e_multiplicador + whatsapp    →  43 pts → ranking 4
--   Todos campos máximos                          → 100 pts → ranking 10
-- ============================================================================
-- Verificação pós-migration:
--   SELECT COUNT(*), MIN(ranking), MAX(ranking), AVG(ranking)::NUMERIC(5,2)
--   FROM contacts WHERE merged_into IS NULL;
--   -- Espera: COUNT > 0, MAX <= 10, MIN >= 0
--
--   SELECT COUNT(*) FROM contacts
--   WHERE declarou_voto = true AND e_multiplicador = true AND ranking < 3;
--   -- Espera: 0 (contatos com declarou+multiplicador têm ranking >= 3)
-- ============================================================================

-- 1. Backup do valor manual antes de qualquer recálculo
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS ranking_manual_legado INTEGER;

COMMENT ON COLUMN contacts.ranking_manual_legado IS
  'Valor manual de ranking antes da migration 037 (backup para auditoria). Não usado no cálculo automático.';

-- ============================================================================
-- 2. Função interna: calcula a partir de uma ROW de contacts (composite type)
-- ============================================================================
-- Recebe a linha já carregada (composite `contacts`) — não faz SELECT extra.
-- Isto é crítico para uso em trigger BEFORE INSERT, onde a linha ainda não
-- existe na tabela e um SELECT por id retornaria NOT FOUND.
--
-- Para Categoria E (campos de campanha customizáveis), usa p_contact.id
-- para fazer COUNT em contact_campaign_values. Em BEFORE INSERT, a linha
-- ainda não está em contacts mas o p_contact.id já foi gerado pelo DEFAULT
-- (gen_random_uuid()) — DEFAULT é resolvido antes dos triggers BEFORE.
-- contact_campaign_values também não terá rows para esse id ainda → ptsE=0,
-- comportamento esperado (contato novo sem campos de campanha vinculados).
-- ============================================================================

CREATE OR REPLACE FUNCTION _calc_ranking_from_row(p_contact contacts)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_score           INTEGER := 0;
  v_pts_a           INTEGER := 0;
  v_pts_b           INTEGER := 0;
  v_pts_c           INTEGER := 0;
  v_pts_d           INTEGER := 0;
  v_redes_extras    INTEGER := 0;
  v_pts_e           INTEGER := 0;
  v_total_campos    INTEGER := 0;
  v_campos_ativos   INTEGER := 0;
  v_pts_por_campo   INTEGER := 0;
BEGIN
  -- -------------------------------------------------------------------------
  -- Categoria A — Status de campanha (máx 50 pts)
  -- -------------------------------------------------------------------------
  IF p_contact.declarou_voto IS TRUE     THEN v_pts_a := v_pts_a + 20; END IF;
  IF p_contact.e_multiplicador IS TRUE   THEN v_pts_a := v_pts_a + 15; END IF;
  IF p_contact.aceita_whatsapp IS TRUE   THEN v_pts_a := v_pts_a + 10; END IF;
  IF p_contact.em_canal_whatsapp IS TRUE THEN v_pts_a := v_pts_a + 5;  END IF;

  -- -------------------------------------------------------------------------
  -- Categoria B — Dados de contato e pessoais (máx 25 pts)
  -- -------------------------------------------------------------------------
  IF p_contact.whatsapp IS NOT NULL AND trim(p_contact.whatsapp) <> '' THEN
    v_pts_b := v_pts_b + 8;
  END IF;
  -- leader_id é UUID: nunca contém '' no banco. Mantemos o check trivial.
  IF p_contact.leader_id IS NOT NULL THEN
    v_pts_b := v_pts_b + 7;
  END IF;
  IF p_contact.email IS NOT NULL AND trim(p_contact.email) <> '' THEN
    v_pts_b := v_pts_b + 4;
  END IF;
  IF p_contact.data_nascimento IS NOT NULL THEN
    v_pts_b := v_pts_b + 3;
  END IF;
  IF p_contact.telefone IS NOT NULL AND trim(p_contact.telefone) <> '' THEN
    v_pts_b := v_pts_b + 3;
  END IF;

  -- -------------------------------------------------------------------------
  -- Categoria C — Endereço (máx 15 pts)
  -- -------------------------------------------------------------------------
  IF p_contact.bairro IS NOT NULL AND trim(p_contact.bairro) <> ''
     AND p_contact.cidade IS NOT NULL AND trim(p_contact.cidade) <> '' THEN
    v_pts_c := v_pts_c + 7;
  END IF;
  IF p_contact.cep IS NOT NULL AND trim(p_contact.cep) <> '' THEN
    v_pts_c := v_pts_c + 4;
  END IF;
  IF p_contact.estado IS NOT NULL AND trim(p_contact.estado) <> '' THEN
    v_pts_c := v_pts_c + 2;
  END IF;
  IF p_contact.logradouro IS NOT NULL AND trim(p_contact.logradouro) <> '' THEN
    v_pts_c := v_pts_c + 2;
  END IF;

  -- -------------------------------------------------------------------------
  -- Categoria D — Redes sociais (máx 5 pts)
  -- -------------------------------------------------------------------------
  IF p_contact.instagram IS NOT NULL AND trim(p_contact.instagram) <> '' THEN
    v_pts_d := v_pts_d + 3;
  END IF;
  IF p_contact.twitter IS NOT NULL AND trim(p_contact.twitter) <> '' THEN
    v_redes_extras := v_redes_extras + 1;
  END IF;
  IF p_contact.tiktok IS NOT NULL AND trim(p_contact.tiktok) <> '' THEN
    v_redes_extras := v_redes_extras + 1;
  END IF;
  IF p_contact.youtube IS NOT NULL AND trim(p_contact.youtube) <> '' THEN
    v_redes_extras := v_redes_extras + 1;
  END IF;
  v_pts_d := v_pts_d + LEAST(v_redes_extras, 2);

  -- -------------------------------------------------------------------------
  -- Categoria E — Campos de campanha customizáveis (máx 5 pts)
  -- App é single-tenant: o COUNT global em campaign_fields representa o
  -- universo de campos disponíveis para todos os usuários.
  -- -------------------------------------------------------------------------
  SELECT COUNT(*) INTO v_total_campos
  FROM campaign_fields;

  -- Em BEFORE INSERT, p_contact.id já tem valor (gerado pelo DEFAULT)
  -- mas contact_campaign_values ainda não tem rows para esse id → 0 ativos,
  -- comportamento desejado.
  SELECT COUNT(*) INTO v_campos_ativos
  FROM contact_campaign_values
  WHERE contact_id = p_contact.id
    AND valor IS TRUE;

  IF v_total_campos = 0 THEN
    v_pts_e := 0;
  ELSE
    v_pts_por_campo := FLOOR(5.0 / v_total_campos);
    v_pts_e := LEAST(v_campos_ativos * v_pts_por_campo, 5);
  END IF;

  -- -------------------------------------------------------------------------
  -- Score final: LEAST(FLOOR(total / 10), 10)
  -- -------------------------------------------------------------------------
  v_score := v_pts_a + v_pts_b + v_pts_c + v_pts_d + v_pts_e;

  RETURN LEAST(FLOOR(v_score / 10), 10);
END;
$$;

COMMENT ON FUNCTION _calc_ranking_from_row(contacts) IS
  'Cálculo interno do ranking a partir de uma linha de contacts. Não faz SELECT — usado por triggers BEFORE e pelo wrapper público calc_contact_ranking_score(UUID).';

-- ============================================================================
-- 3. Função pública por UUID — wrapper que carrega a row e delega
-- ============================================================================
-- Mantida com a assinatura original para preservar callers (backfill,
-- trigger AFTER em contact_campaign_values e código externo que possa chamar).
-- ============================================================================

CREATE OR REPLACE FUNCTION calc_contact_ranking_score(p_contact_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact contacts%ROWTYPE;
BEGIN
  SELECT * INTO v_contact FROM contacts WHERE id = p_contact_id;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  RETURN _calc_ranking_from_row(v_contact);
END;
$$;

COMMENT ON FUNCTION calc_contact_ranking_score(UUID) IS
  'Calcula ranking 0-10 de um contato pelo UUID. Carrega a linha e delega para _calc_ranking_from_row.';

-- ============================================================================
-- 4. Trigger em contacts (BEFORE INSERT OR UPDATE)
-- ============================================================================
-- Estratégia anti-loop: o trigger é BEFORE e altera NEW.ranking diretamente,
-- sem fazer UPDATE extra. Assim não dispara recursão.
-- O trigger em contact_campaign_values é AFTER e faz UPDATE em contacts,
-- o que dispara este trigger BEFORE — mas como é BEFORE, apenas altera
-- NEW.ranking sem novo UPDATE. Sem loop infinito.
--
-- Para INSERT: chama _calc_ranking_from_row(NEW) direto (a linha ainda não
-- existe na tabela; um SELECT por id retornaria NOT FOUND e ranking ficaria
-- sempre em 0).
--
-- Para UPDATE: só recalcula se algum dos 18 campos relevantes mudou.
-- Evita disparar recálculo quando apenas `ranking` muda (auto-loop) ou
-- quando outros campos não-relevantes mudam (ex: notas_assessor).
-- ============================================================================

CREATE OR REPLACE FUNCTION update_contact_ranking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Verifica se algum campo que afeta o ranking mudou
    IF NOT (
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

  -- Calcula direto a partir de NEW (funciona em INSERT e UPDATE)
  NEW.ranking := _calc_ranking_from_row(NEW);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_contacts_ranking ON contacts;

CREATE TRIGGER trg_contacts_ranking
  BEFORE INSERT OR UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_contact_ranking();

COMMENT ON FUNCTION update_contact_ranking() IS
  'Trigger BEFORE INSERT OR UPDATE em contacts: recalcula NEW.ranking via _calc_ranking_from_row(NEW). Anti-loop: no UPDATE só age quando algum dos 18 campos relevantes muda.';

-- ============================================================================
-- 5. Trigger em contact_campaign_values (AFTER INSERT OR UPDATE OR DELETE)
-- ============================================================================
-- Recalcula o ranking do contato pai quando campos de campanha mudam.
-- É AFTER porque precisa que a linha já tenha sido aplicada para o COUNT
-- de campos ativos refletir o novo estado.
-- Dispara o trg_contacts_ranking via UPDATE em contacts — sem loop porque
-- UPDATE em contacts.ranking sozinho não passa pelo WHEN/IF clause.
-- ============================================================================

CREATE OR REPLACE FUNCTION recalc_contact_ranking_from_campaign()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_id UUID;
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

  v_novo_ranking := calc_contact_ranking_score(v_contact_id);

  -- UPDATE direto em contacts — dispara trg_contacts_ranking (BEFORE),
  -- mas como nenhum campo relevante muda (só ranking), o IF clause
  -- retorna NEW imediatamente sem loop.
  UPDATE contacts
  SET ranking = v_novo_ranking
  WHERE id = v_contact_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_campaign_values_ranking ON contact_campaign_values;

CREATE TRIGGER trg_campaign_values_ranking
  AFTER INSERT OR UPDATE OR DELETE ON contact_campaign_values
  FOR EACH ROW
  EXECUTE FUNCTION recalc_contact_ranking_from_campaign();

COMMENT ON FUNCTION recalc_contact_ranking_from_campaign() IS
  'Trigger AFTER em contact_campaign_values: atualiza contacts.ranking quando campos de campanha mudam.';

-- ============================================================================
-- 6. Backfill em lotes de 500
-- ============================================================================
-- Estratégia: copia ranking atual → ranking_manual_legado, depois recalcula
-- ranking com a função. Processa em lotes de 500 com pg_sleep(0.1) entre
-- cada lote para não causar lock longo em produção.
-- ============================================================================

DO $$
DECLARE
  v_offset    INTEGER := 0;
  v_lote      INTEGER := 500;
  v_total     INTEGER;
  v_lotes     INTEGER;
  v_atual     INTEGER := 0;
  v_ids       UUID[];
BEGIN
  SELECT COUNT(*) INTO v_total FROM contacts WHERE merged_into IS NULL;
  v_lotes := CEIL(v_total::FLOAT / v_lote);

  RAISE NOTICE 'Backfill ranking: % contatos em % lotes de %', v_total, v_lotes, v_lote;

  -- Backup: copia valor manual para ranking_manual_legado
  UPDATE contacts
  SET ranking_manual_legado = ranking
  WHERE ranking IS NOT NULL
    AND ranking_manual_legado IS NULL;

  RAISE NOTICE 'Backup de ranking_manual_legado concluído';

  -- Recalcula em lotes
  LOOP
    SELECT ARRAY(
      SELECT id FROM contacts
      WHERE merged_into IS NULL
      ORDER BY id
      LIMIT v_lote OFFSET v_offset
    ) INTO v_ids;

    EXIT WHEN array_length(v_ids, 1) IS NULL OR array_length(v_ids, 1) = 0;

    -- UPDATE em batch (single roundtrip por lote, ao invés de N UPDATEs)
    UPDATE contacts
    SET ranking = calc_contact_ranking_score(id)
    WHERE id = ANY(v_ids);

    v_atual := v_atual + array_length(v_ids, 1);
    v_offset := v_offset + v_lote;

    RAISE NOTICE 'Lote %/% concluído — % contatos processados',
      CEIL(v_atual::FLOAT/v_lote), v_lotes, v_atual;

    PERFORM pg_sleep(0.1);
  END LOOP;

  RAISE NOTICE 'Backfill concluído: % contatos com ranking recalculado', v_atual;
END;
$$;
