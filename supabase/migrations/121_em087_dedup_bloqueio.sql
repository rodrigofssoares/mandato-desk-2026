-- Migration 121 — RAQ-MAND-EM087: bloqueio de envio por duplicidade + critérios ampliados
--
-- Why: Hoje a dedup do formulário (dedup_campo whatsapp|cpf + dedup_acao
--      mesclar|criar|ignorar) só decide o que fazer no CRM — NUNCA recusa o envio.
--      Até "ignorar" grava a resposta. Esta migration adiciona:
--        • ação "bloquear" (recusa o envio, não grava nada, mostra mensagem editável);
--        • critérios de unicidade ampliados (nome, nome+telefone, campo específico);
--        • escopo configurável (checar nos contatos do CRM e/ou nas respostas do
--          próprio formulário — viabiliza votação/pesquisa "1 resposta por pessoa");
--        • toggle capturar_no_crm (votação anônima só registra resposta, sem criar contato);
--        • mensagem de bloqueio editável por formulário.
--      O bloqueio em escopo "respostas" é à prova de corrida via coluna normalizada
--      formulario_respostas.dedup_chave + índice único parcial (form_id, dedup_chave).
-- Reference: RAQ-MAND-EM087
-- Risk: média — adiciona colunas nullable/com default (não toca dados existentes);
--        CREATE OR REPLACE na RPC (mesma assinatura); novo índice único PARCIAL
--        em formulario_respostas só afeta linhas com dedup_chave preenchida.
-- Rollback:
--   ALTER TABLE public.formularios DROP COLUMN IF EXISTS dedup_criterio;
--   ALTER TABLE public.formularios DROP COLUMN IF EXISTS dedup_escopo;
--   ALTER TABLE public.formularios DROP COLUMN IF EXISTS dedup_campo_id;
--   ALTER TABLE public.formularios DROP COLUMN IF EXISTS dedup_mensagem;
--   ALTER TABLE public.formularios DROP COLUMN IF EXISTS capturar_no_crm;
--   ALTER TABLE public.formulario_respostas DROP COLUMN IF EXISTS dedup_chave;
--   DROP INDEX IF EXISTS formulario_respostas_dedup_uniq;
--   DROP FUNCTION IF EXISTS public.formulario_normalizar_texto(text);
--   ALTER TABLE public.formularios DROP CONSTRAINT IF EXISTS formularios_dedup_acao_check;
--   ALTER TABLE public.formularios ADD CONSTRAINT formularios_dedup_acao_check
--     CHECK (dedup_acao IN ('mesclar','criar','ignorar'));
--   -- Para reverter a RPC: reaplicar a migration 120.

-- ============================================================
-- PARTE A — Helper de normalização de texto (sem depender de unaccent)
-- ============================================================

-- Normaliza para comparação de duplicados: minúsculas, sem acentos, espaços
-- colapsados e aparados. IMMUTABLE para poder ser usada em índices/where.
CREATE OR REPLACE FUNCTION public.formulario_normalizar_texto(_t text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT regexp_replace(
           btrim(lower(translate(
             COALESCE(_t, ''),
             'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
             'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
           ))),
           '\s+', ' ', 'g'
         );
$$;

COMMENT ON FUNCTION public.formulario_normalizar_texto(text) IS
  'RAQ-MAND-EM087. Normaliza texto para deduplicação (minúsculas, sem acento, '
  'espaços colapsados). IMMUTABLE — segura para índices funcionais.';

-- ============================================================
-- PARTE B — ALTERs idempotentes em formularios
-- ============================================================

-- B1. dedup_criterio — chave de unicidade (superset do antigo dedup_campo).
--     'nenhum' desliga a deduplicação. 'campo' usa dedup_campo_id.
ALTER TABLE public.formularios
  ADD COLUMN IF NOT EXISTS dedup_criterio text NOT NULL DEFAULT 'nenhum';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.formularios'::regclass
       AND conname  = 'formularios_dedup_criterio_check'
  ) THEN
    ALTER TABLE public.formularios
      ADD CONSTRAINT formularios_dedup_criterio_check
      CHECK (dedup_criterio IN ('nenhum','whatsapp','cpf','nome','nome_telefone','campo'));
  END IF;
END;
$$;

COMMENT ON COLUMN public.formularios.dedup_criterio IS
  'Critério de unicidade do respondente: nenhum (desliga), whatsapp, cpf, nome, '
  'nome_telefone (par nome+telefone) ou campo (campo específico via dedup_campo_id). '
  'EM087 — substitui dedup_campo (mantido só para rollback/dado legado).';

-- B2. dedup_escopo — onde verificar duplicidade. Subconjunto de {crm, respostas}.
--     crm      = checa contra contatos existentes no CRM.
--     respostas= checa contra respostas anteriores DESTE formulário (votação 1x).
ALTER TABLE public.formularios
  ADD COLUMN IF NOT EXISTS dedup_escopo text[] NOT NULL DEFAULT '{crm}'::text[];

COMMENT ON COLUMN public.formularios.dedup_escopo IS
  'Onde verificar duplicidade quando dedup_acao=bloquear: array com crm e/ou respostas. '
  'crm = contatos existentes; respostas = respostas anteriores deste formulário. '
  'EM087.';

-- B3. dedup_campo_id — campo do formulário usado quando dedup_criterio=campo.
ALTER TABLE public.formularios
  ADD COLUMN IF NOT EXISTS dedup_campo_id uuid
    REFERENCES public.formulario_campos(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.formularios.dedup_campo_id IS
  'Campo do formulário cujo valor identifica unicidade quando dedup_criterio=campo '
  '(ex.: matrícula/ID). FK ON DELETE SET NULL. EM087.';

-- B4. dedup_mensagem — frase mostrada ao respondente quando o envio é bloqueado.
ALTER TABLE public.formularios
  ADD COLUMN IF NOT EXISTS dedup_mensagem text;

COMMENT ON COLUMN public.formularios.dedup_mensagem IS
  'Mensagem editável exibida na tela de bloqueio quando dedup_acao=bloquear detecta '
  'duplicidade. NULL usa o texto padrão do front. EM087.';

-- B4.1. CHECK de tamanho em dedup_mensagem (defesa server-side; o front limita a 500).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.formularios'::regclass
       AND conname  = 'formularios_dedup_mensagem_len'
  ) THEN
    ALTER TABLE public.formularios
      ADD CONSTRAINT formularios_dedup_mensagem_len
      CHECK (dedup_mensagem IS NULL OR length(dedup_mensagem) <= 500);
  END IF;
END;
$$;

-- B5. capturar_no_crm — quando false, registra a resposta mas NÃO cria/atualiza
--     contato (votação anônima só por métrica). Default true (comportamento atual).
ALTER TABLE public.formularios
  ADD COLUMN IF NOT EXISTS capturar_no_crm boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.formularios.capturar_no_crm IS
  'Quando true (default), o envio cria/atualiza contato no CRM e dispara automações. '
  'Quando false, só registra formulario_respostas (votação/pesquisa anônima). EM087.';

-- B6. Estende o CHECK de dedup_acao para incluir bloquear.
ALTER TABLE public.formularios
  DROP CONSTRAINT IF EXISTS formularios_dedup_acao_check;
ALTER TABLE public.formularios
  ADD CONSTRAINT formularios_dedup_acao_check
  CHECK (dedup_acao IN ('mesclar','criar','ignorar','bloquear'));

-- B7. Migra o dado legado: dedup_campo → dedup_criterio (uma vez).
--     Só ajusta linhas que ainda estão no default 'nenhum' (não sobrescreve config nova).
UPDATE public.formularios
   SET dedup_criterio = dedup_campo
 WHERE dedup_criterio = 'nenhum'
   AND dedup_campo IN ('whatsapp','cpf');

-- ============================================================
-- PARTE C — formulario_respostas.dedup_chave + índice único parcial
-- ============================================================

-- Chave normalizada da resposta (preenchida só quando o formulário bloqueia por
-- escopo "respostas"). O índice único parcial garante atomicidade contra corrida:
-- duas submissões simultâneas do mesmo respondente — a segunda viola o índice.
ALTER TABLE public.formulario_respostas
  ADD COLUMN IF NOT EXISTS dedup_chave text;

COMMENT ON COLUMN public.formulario_respostas.dedup_chave IS
  'Chave normalizada de unicidade do respondente (EM087). Preenchida só quando o '
  'formulário usa dedup_acao=bloquear com escopo "respostas". Índice único parcial '
  'em (form_id, dedup_chave) impede 2ª resposta da mesma pessoa de forma race-safe.';

CREATE UNIQUE INDEX IF NOT EXISTS formulario_respostas_dedup_uniq
  ON public.formulario_respostas (form_id, dedup_chave)
  WHERE dedup_chave IS NOT NULL AND status = 'processado';

-- ============================================================
-- PARTE C2 — Índice funcional em contacts p/ dedup por nome normalizado
--
-- Why: critério 'nome'/'nome_telefone' com escopo crm faz
--      WHERE formulario_normalizar_texto(nome) = ... — sem este índice seria
--      seq scan em contacts a cada envio (DoS de desempenho em votação de alto
--      volume). A função é IMMUTABLE, então pode indexar. (M1 EM087)
-- ============================================================

CREATE INDEX IF NOT EXISTS contacts_nome_normalizado_idx
  ON public.contacts (public.formulario_normalizar_texto(nome))
  WHERE merged_into IS NULL;

-- ============================================================
-- PARTE D — CREATE OR REPLACE da RPC formulario_processar_resposta
--
-- Base: migration 120. Mudanças EM087 (marcadas com "EM087"):
--   • Computa valores de dedup conforme dedup_criterio (whatsapp/cpf/nome/
--     nome_telefone/campo) a partir do patch e/ou _dados.
--   • Ação "bloquear": checa escopo crm (contato existente) e/ou respostas
--     (dedup_chave anterior); se duplicado, retorna {erro:'ja_respondeu', mensagem}.
--   • Toggle capturar_no_crm=false: pula criação/merge de contato e automações.
--   • INSERT da resposta grava dedup_chave; unique_violation no escopo respostas
--     vira bloqueio (race-safe) em vez de erro interno.
-- ============================================================

DROP FUNCTION IF EXISTS public.formulario_processar_resposta(text, jsonb, text, text);

CREATE OR REPLACE FUNCTION public.formulario_processar_resposta(
  _slug       text,
  _dados      jsonb,     -- {campo_id::text: valor (text ou array)}
  _ip_hash    text,
  _user_agent text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_contact_col_whitelist text[] := ARRAY[
    'nome', 'email', 'telefone', 'whatsapp', 'cpf',
    'bairro', 'cidade', 'estado', 'cep', 'logradouro',
    'numero', 'profissao', 'data_nascimento', 'observacoes'
  ];

  v_situacao_whitelist text[] := ARRAY[
    'declarou_voto', 'is_favorite', 'e_multiplicador'
  ];

  v_mapear_demanda_wl text[] := ARRAY['title', 'description', 'neighborhood'];

  v_form          public.formularios%ROWTYPE;
  v_campo         public.formulario_campos%ROWTYPE;
  v_qtd_resp      bigint;

  v_patch_keys    text[]   := ARRAY[]::text[];
  v_patch_vals    text[]   := ARRAY[]::text[];

  -- Dedup
  v_contact_id    uuid;
  v_achou_existente boolean := false;
  v_deve_automatizar boolean := true;

  -- EM087: cálculo de dedup
  v_dedup_nome    text;     -- nome normalizado
  v_dedup_fone    text;     -- telefone/whatsapp só dígitos
  v_dedup_cpf     text;     -- cpf só dígitos
  v_dedup_chave   text;     -- chave comparável conforme critério
  v_match_crm_id  uuid;     -- contato existente que casa com o critério
  v_bloqueado     boolean := false;

  -- Ranking
  v_ranking_total int := 0;
  v_opcao         jsonb;
  v_valor_campo   jsonb;
  v_opcao_val     text;

  -- Funil
  v_board_id      uuid;

  -- Situacao
  v_sit_key       text;
  v_sit_val       boolean;

  -- Loop
  v_idx           int;
  v_col           text;
  v_coltype       text;
  v_raw_val       text;
  v_tag_id        uuid;

  -- Demanda
  v_demanda_title  text := '';
  v_demanda_desc   text := '';
  v_demanda_bairro text := '';
  v_demanda_raw    jsonb;

  v_err_msg       text;

BEGIN
  -- 1. Carrega formulário
  SELECT * INTO v_form
    FROM public.formularios
   WHERE slug = _slug AND publicado = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('erro', 'nao_encontrado');
  END IF;

  -- 2. Revalida janela e limite
  IF v_form.status = 'encerrado'
     OR (v_form.encerra_em IS NOT NULL AND v_form.encerra_em < now())
  THEN
    RETURN jsonb_build_object(
      'erro', 'encerrado', 'titulo', v_form.titulo, 'agradecimento', v_form.agradecimento
    );
  END IF;

  IF v_form.abre_em IS NOT NULL AND v_form.abre_em > now() THEN
    RETURN jsonb_build_object('erro', 'nao_iniciado', 'abre_em', v_form.abre_em);
  END IF;

  IF v_form.max_respostas IS NOT NULL THEN
    PERFORM 1 FROM public.formularios WHERE id = v_form.id FOR UPDATE;
    SELECT COUNT(*) INTO v_qtd_resp
      FROM public.formulario_respostas WHERE form_id = v_form.id;
    IF v_qtd_resp >= v_form.max_respostas THEN
      RETURN jsonb_build_object('erro', 'limite_atingido');
    END IF;
  END IF;

  -- 3. Monta patch do contato (+ coleta demanda) — igual à v2 (mig 120)
  FOR v_campo IN
    SELECT * FROM public.formulario_campos
     WHERE form_id = v_form.id
       AND (
         mapear_destino_1 IS NOT NULL
         OR mapear_destino_2 IS NOT NULL
         OR (v_form.criar_demanda = true AND mapear_demanda IS NOT NULL)
       )
  LOOP
    v_raw_val := _dados ->> v_campo.id::text;

    IF v_raw_val IS NOT NULL AND length(trim(v_raw_val)) > 0 THEN
      IF v_campo.mapear_destino_1 IS NOT NULL
         AND v_campo.mapear_destino_1 = ANY(v_contact_col_whitelist)
         AND NOT (v_campo.mapear_destino_1 = ANY(v_patch_keys))
      THEN
        v_patch_keys := v_patch_keys || v_campo.mapear_destino_1;
        v_patch_vals := v_patch_vals || v_raw_val;
      END IF;

      IF v_campo.mapear_destino_2 IS NOT NULL
         AND v_campo.mapear_destino_2 = ANY(v_contact_col_whitelist)
         AND NOT (v_campo.mapear_destino_2 = ANY(v_patch_keys))
      THEN
        v_patch_keys := v_patch_keys || v_campo.mapear_destino_2;
        v_patch_vals := v_patch_vals || v_raw_val;
      END IF;
    END IF;

    IF v_form.criar_demanda = true
       AND v_campo.mapear_demanda IS NOT NULL
       AND v_campo.mapear_demanda = ANY(v_mapear_demanda_wl)
    THEN
      v_demanda_raw := _dados -> v_campo.id::text;
      IF v_demanda_raw IS NOT NULL THEN
        DECLARE v_demanda_val text;
        BEGIN
          IF jsonb_typeof(v_demanda_raw) = 'array' THEN
            SELECT string_agg(elem #>> '{}', ', ' ORDER BY ordinality)
              INTO v_demanda_val
              FROM jsonb_array_elements(v_demanda_raw) WITH ORDINALITY AS t(elem, ordinality);
          ELSE
            v_demanda_val := v_demanda_raw #>> '{}';
          END IF;

          IF v_campo.mapear_demanda = 'title' AND length(trim(COALESCE(v_demanda_title, ''))) = 0 THEN
            v_demanda_title := left(trim(COALESCE(v_demanda_val, '')), 500);
          ELSIF v_campo.mapear_demanda = 'description' AND length(trim(COALESCE(v_demanda_desc, ''))) = 0 THEN
            v_demanda_desc := left(trim(COALESCE(v_demanda_val, '')), 5000);
          ELSIF v_campo.mapear_demanda = 'neighborhood' AND length(trim(COALESCE(v_demanda_bairro, ''))) = 0 THEN
            v_demanda_bairro := left(trim(COALESCE(v_demanda_val, '')), 200);
          END IF;
        END;
      END IF;
    END IF;
  END LOOP;

  -- --------------------------------------------------------
  -- 4. EM087: calcula os valores de dedup conforme o critério
  -- --------------------------------------------------------
  -- nome / telefone / cpf vêm do patch (campos mapeados); campo vem de _dados.
  v_idx := array_position(v_patch_keys, 'nome');
  IF v_idx IS NOT NULL THEN
    v_dedup_nome := public.formulario_normalizar_texto(v_patch_vals[v_idx]);
  END IF;

  v_idx := array_position(v_patch_keys, 'whatsapp');
  IF v_idx IS NOT NULL THEN
    v_dedup_fone := regexp_replace(v_patch_vals[v_idx], '\D', '', 'g');
  END IF;
  IF v_dedup_fone IS NULL OR length(v_dedup_fone) = 0 THEN
    v_idx := array_position(v_patch_keys, 'telefone');
    IF v_idx IS NOT NULL THEN
      v_dedup_fone := regexp_replace(v_patch_vals[v_idx], '\D', '', 'g');
    END IF;
  END IF;

  v_idx := array_position(v_patch_keys, 'cpf');
  IF v_idx IS NOT NULL THEN
    v_dedup_cpf := regexp_replace(v_patch_vals[v_idx], '\D', '', 'g');
  END IF;

  -- Monta a chave comparável conforme o critério
  v_dedup_chave := NULL;
  IF v_form.dedup_criterio = 'whatsapp' AND COALESCE(length(v_dedup_fone),0) > 0 THEN
    v_dedup_chave := v_dedup_fone;
  ELSIF v_form.dedup_criterio = 'cpf' AND COALESCE(length(v_dedup_cpf),0) > 0 THEN
    v_dedup_chave := v_dedup_cpf;
  ELSIF v_form.dedup_criterio = 'nome' AND COALESCE(length(v_dedup_nome),0) > 0 THEN
    v_dedup_chave := v_dedup_nome;
  ELSIF v_form.dedup_criterio = 'nome_telefone'
        AND COALESCE(length(v_dedup_nome),0) > 0 AND COALESCE(length(v_dedup_fone),0) > 0 THEN
    v_dedup_chave := v_dedup_nome || '|' || v_dedup_fone;
  ELSIF v_form.dedup_criterio = 'campo' AND v_form.dedup_campo_id IS NOT NULL THEN
    v_dedup_chave := NULLIF(public.formulario_normalizar_texto(_dados ->> v_form.dedup_campo_id::text), '');
  END IF;

  -- --------------------------------------------------------
  -- 5. EM087: encontra contato existente no CRM conforme o critério
  --    (usado tanto p/ bloqueio escopo=crm quanto p/ mesclar/criar/ignorar).
  --    Critério 'campo' não tem coluna no CRM → sem match CRM.
  -- --------------------------------------------------------
  v_match_crm_id := NULL;
  IF v_form.dedup_criterio = 'whatsapp' AND COALESCE(length(v_dedup_fone),0) > 0 THEN
    SELECT id INTO v_match_crm_id FROM public.contacts
     WHERE regexp_replace(COALESCE(whatsapp, telefone, ''), '\D', '', 'g') = v_dedup_fone
       AND merged_into IS NULL LIMIT 1;
  ELSIF v_form.dedup_criterio = 'cpf' AND COALESCE(length(v_dedup_cpf),0) > 0 THEN
    SELECT id INTO v_match_crm_id FROM public.contacts
     WHERE regexp_replace(COALESCE(cpf, ''), '\D', '', 'g') = v_dedup_cpf
       AND merged_into IS NULL LIMIT 1;
  ELSIF v_form.dedup_criterio = 'nome' AND COALESCE(length(v_dedup_nome),0) > 0 THEN
    SELECT id INTO v_match_crm_id FROM public.contacts
     WHERE public.formulario_normalizar_texto(nome) = v_dedup_nome
       AND merged_into IS NULL LIMIT 1;
  ELSIF v_form.dedup_criterio = 'nome_telefone'
        AND COALESCE(length(v_dedup_nome),0) > 0 AND COALESCE(length(v_dedup_fone),0) > 0 THEN
    SELECT id INTO v_match_crm_id FROM public.contacts
     WHERE public.formulario_normalizar_texto(nome) = v_dedup_nome
       AND regexp_replace(COALESCE(whatsapp, telefone, ''), '\D', '', 'g') = v_dedup_fone
       AND merged_into IS NULL LIMIT 1;
  END IF;

  IF v_match_crm_id IS NOT NULL THEN
    v_achou_existente := true;
    v_contact_id := v_match_crm_id;
  END IF;

  -- --------------------------------------------------------
  -- 6. EM087: AÇÃO BLOQUEAR — recusa o envio se houver duplicidade
  --    Checa escopo crm (contato existente) e/ou respostas (chave anterior).
  --    Pré-checagem amigável; o índice único cobre a corrida no INSERT.
  -- --------------------------------------------------------
  IF v_form.dedup_acao = 'bloquear' AND v_form.dedup_criterio <> 'nenhum' THEN
    -- Escopo CRM só vale quando o formulário opera no CRM. Em formulário anônimo
    -- (capturar_no_crm=false) o CRM é irrelevante e não deve bloquear (must-fix EM087).
    IF v_form.capturar_no_crm = true
       AND 'crm' = ANY(v_form.dedup_escopo) AND v_match_crm_id IS NOT NULL THEN
      v_bloqueado := true;
    END IF;

    IF NOT v_bloqueado
       AND 'respostas' = ANY(v_form.dedup_escopo)
       AND v_dedup_chave IS NOT NULL
    THEN
      PERFORM 1 FROM public.formulario_respostas
       WHERE form_id = v_form.id
         AND status = 'processado'
         AND dedup_chave = v_dedup_chave
      LIMIT 1;
      IF FOUND THEN
        v_bloqueado := true;
      END IF;
    END IF;

    IF v_bloqueado THEN
      RETURN jsonb_build_object(
        'erro', 'ja_respondeu',
        'mensagem', v_form.dedup_mensagem
      );
    END IF;
  END IF;

  -- --------------------------------------------------------
  -- 7. Captura no CRM (mesclar/criar/ignorar) — só se capturar_no_crm = true
  --    e a ação NÃO for bloquear (bloquear nunca cria/mescla contato).
  -- --------------------------------------------------------
  IF v_form.capturar_no_crm = true AND v_form.dedup_acao <> 'bloquear' THEN

    IF v_achou_existente THEN
      IF v_form.dedup_acao = 'mesclar' THEN
        FOR v_idx IN 1 .. array_length(v_patch_keys, 1)
        LOOP
          v_col := v_patch_keys[v_idx];
          IF v_col = ANY(v_contact_col_whitelist) THEN
            SELECT format_type(a.atttypid, a.atttypmod) INTO v_coltype
              FROM pg_attribute a
             WHERE a.attrelid = 'public.contacts'::regclass
               AND a.attname = v_col AND NOT a.attisdropped;
            EXECUTE format(
              'UPDATE public.contacts SET %I = COALESCE(NULLIF(trim($1), '''')::%s, %I), updated_at = now() WHERE id = $2',
              v_col, v_coltype, v_col
            ) USING v_patch_vals[v_idx], v_contact_id;
          END IF;
        END LOOP;

      ELSIF v_form.dedup_acao = 'ignorar' THEN
        v_deve_automatizar := false;

      ELSIF v_form.dedup_acao = 'criar' THEN
        v_achou_existente := false;
        v_contact_id := NULL;
      END IF;
    END IF;

    -- Cria novo contato se não achou OU dedup_acao='criar'
    IF NOT v_achou_existente THEN
      DECLARE
        v_nome_insert text;
        v_col_tmp     text;
        v_val_tmp     text;
      BEGIN
        v_idx := array_position(v_patch_keys, 'nome');
        IF v_idx IS NOT NULL THEN
          v_nome_insert := trim(v_patch_vals[v_idx]);
        END IF;
        IF v_nome_insert IS NULL OR length(v_nome_insert) = 0 THEN
          v_nome_insert := 'Respondente ' || to_char(now(), 'DD/MM/YYYY HH24:MI');
        END IF;

        INSERT INTO public.contacts (nome, origem, created_by)
        VALUES (
          v_nome_insert,
          COALESCE(v_form.origem, 'Formulário: ' || v_form.titulo),
          v_form.created_by
        )
        RETURNING id INTO v_contact_id;

        FOR v_idx IN 1 .. COALESCE(array_length(v_patch_keys, 1), 0)
        LOOP
          v_col_tmp := v_patch_keys[v_idx];
          v_val_tmp := v_patch_vals[v_idx];
          IF v_col_tmp <> 'nome' AND v_col_tmp = ANY(v_contact_col_whitelist) THEN
            SELECT format_type(a.atttypid, a.atttypmod) INTO v_coltype
              FROM pg_attribute a
             WHERE a.attrelid = 'public.contacts'::regclass
               AND a.attname = v_col_tmp AND NOT a.attisdropped;
            EXECUTE format(
              'UPDATE public.contacts SET %I = NULLIF(trim($1), '''')::%s, updated_at = now() WHERE id = $2',
              v_col_tmp, v_coltype
            ) USING v_val_tmp, v_contact_id;
          END IF;
        END LOOP;
      END;
    END IF;

    -- 8. Automações (só quando v_deve_automatizar = true)
    IF v_deve_automatizar THEN
      -- 8a. Etiquetas
      IF v_form.aplicar_etiquetas IS NOT NULL
         AND array_length(v_form.aplicar_etiquetas, 1) > 0
      THEN
        FOREACH v_tag_id IN ARRAY v_form.aplicar_etiquetas
        LOOP
          INSERT INTO public.contact_tags (contact_id, tag_id)
          VALUES (v_contact_id, v_tag_id)
          ON CONFLICT (contact_id, tag_id) DO NOTHING;
        END LOOP;
      END IF;

      -- 8b. Funil
      IF v_form.mover_stage_id IS NOT NULL THEN
        SELECT board_id INTO v_board_id
          FROM public.board_stages WHERE id = v_form.mover_stage_id LIMIT 1;

        IF v_board_id IS NOT NULL THEN
          IF EXISTS (
            SELECT 1 FROM public.board_items
             WHERE board_id = v_board_id AND contact_id = v_contact_id
          ) THEN
            UPDATE public.board_items
               SET stage_id = v_form.mover_stage_id, moved_at = now()
             WHERE board_id = v_board_id AND contact_id = v_contact_id;
          ELSE
            INSERT INTO public.board_items (board_id, contact_id, stage_id, ordem, moved_at)
            VALUES (v_board_id, v_contact_id, v_form.mover_stage_id, 0, now());
          END IF;
        END IF;
      END IF;

      -- 8c. Ranking
      v_ranking_total := COALESCE(v_form.ranking_pontos, 0);
      FOR v_campo IN
        SELECT * FROM public.formulario_campos
         WHERE form_id = v_form.id
           AND tipo IN ('escolha_unica', 'checkboxes', 'lista')
           AND opcoes <> '[]'::jsonb
      LOOP
        v_valor_campo := _dados -> v_campo.id::text;
        IF v_valor_campo IS NOT NULL THEN
          FOR v_opcao IN SELECT * FROM jsonb_array_elements(v_campo.opcoes)
          LOOP
            v_opcao_val := v_opcao ->> 'value';
            IF (
              (jsonb_typeof(v_valor_campo) = 'string' AND v_valor_campo #>> '{}' = v_opcao_val)
              OR
              (jsonb_typeof(v_valor_campo) = 'array' AND v_valor_campo @> to_jsonb(v_opcao_val))
            )
            AND (v_opcao ->> 'ranking_pontos') IS NOT NULL
            THEN
              v_ranking_total := v_ranking_total + (v_opcao ->> 'ranking_pontos')::int;
            END IF;
          END LOOP;
        END IF;
      END LOOP;

      IF v_ranking_total <> 0 THEN
        UPDATE public.contacts
           SET ranking = COALESCE(ranking, 0) + v_ranking_total, updated_at = now()
         WHERE id = v_contact_id;
      END IF;

      -- 8d. Situação
      IF v_form.marcar_situacao IS NOT NULL AND v_form.marcar_situacao <> '{}'::jsonb THEN
        FOR v_sit_key IN SELECT key FROM jsonb_each(v_form.marcar_situacao)
        LOOP
          v_sit_val := (v_form.marcar_situacao ->> v_sit_key)::boolean;
          IF v_sit_key = ANY(v_situacao_whitelist) AND v_sit_val IS TRUE THEN
            EXECUTE format(
              'UPDATE public.contacts SET %I = true, updated_at = now() WHERE id = $1',
              v_sit_key
            ) USING v_contact_id;
          END IF;
        END LOOP;
      END IF;
    END IF; -- v_deve_automatizar

  ELSE
    -- capturar_no_crm = false OU ação bloquear (que não bloqueou): não cria contato.
    v_contact_id := NULL;
    v_deve_automatizar := false;
  END IF;

  -- --------------------------------------------------------
  -- 9. Registra a resposta (grava dedup_chave quando bloqueio por respostas).
  --    EM087: o índice único parcial torna o bloqueio escopo=respostas race-safe;
  --    unique_violation vira 'ja_respondeu' em vez de erro interno.
  -- --------------------------------------------------------
  DECLARE
    v_chave_insert text := NULL;
  BEGIN
    IF v_form.dedup_acao = 'bloquear'
       AND 'respostas' = ANY(v_form.dedup_escopo)
       AND v_dedup_chave IS NOT NULL
    THEN
      v_chave_insert := v_dedup_chave;
    END IF;

    INSERT INTO public.formulario_respostas (
      form_id, contact_id, dados, ip_hash, user_agent, status, dedup_chave
    )
    VALUES (
      v_form.id, v_contact_id, _dados, _ip_hash, _user_agent, 'processado', v_chave_insert
    );
  EXCEPTION WHEN unique_violation THEN
    -- Corrida: outro envio idêntico chegou primeiro. Bloqueia amigável.
    RETURN jsonb_build_object('erro', 'ja_respondeu', 'mensagem', v_form.dedup_mensagem);
  END;

  -- 10. Criação automática de demanda (só se houver contato resolvido)
  IF v_form.criar_demanda = true AND v_contact_id IS NOT NULL THEN
    BEGIN
      INSERT INTO public.demands (
        title, description, neighborhood, priority, status, contact_id, created_by
      )
      VALUES (
        COALESCE(NULLIF(v_demanda_title, ''), 'Solicitação via formulário: ' || v_form.titulo),
        NULLIF(v_demanda_desc, ''),
        NULLIF(v_demanda_bairro, ''),
        v_form.demanda_priority::demand_priority,
        'open'::demand_status,
        v_contact_id,
        v_form.created_by
      );
    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err_msg = MESSAGE_TEXT;
      RAISE WARNING 'EM054-v2: falha ao criar demanda (form_id=%, contact_id=%): %',
        v_form.id, v_contact_id, left(COALESCE(v_err_msg, ''), 200);
    END;
  END IF;

  RETURN jsonb_build_object('ok', true, 'contact_id', v_contact_id);

EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS v_err_msg = MESSAGE_TEXT;
  BEGIN
    INSERT INTO public.formulario_respostas (
      form_id, contact_id, dados, ip_hash, user_agent, status, erro
    )
    SELECT f.id, NULL, _dados, _ip_hash, _user_agent, 'erro', left(v_err_msg, 500)
      FROM public.formularios f
     WHERE f.slug = _slug AND f.publicado = true
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN jsonb_build_object('erro', 'interno');
END;
$$;

COMMENT ON FUNCTION public.formulario_processar_resposta(text, jsonb, text, text) IS
  'RAQ-MAND-EM054 v2 + EM087. Processa envio de formulário público. '
  'EM087: critérios de dedup ampliados (whatsapp/cpf/nome/nome_telefone/campo via '
  'dedup_criterio), ação "bloquear" que recusa o envio em duplicidade (escopo crm '
  'e/ou respostas via dedup_escopo) retornando {erro:ja_respondeu, mensagem}; '
  'bloqueio escopo=respostas é race-safe via dedup_chave + índice único parcial '
  '(unique_violation→ja_respondeu); capturar_no_crm=false registra resposta sem '
  'criar contato (votação anônima). Chamada exclusivamente pela Edge Function (service_role).';

REVOKE ALL ON FUNCTION public.formulario_processar_resposta(text, jsonb, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.formulario_processar_resposta(text, jsonb, text, text) TO service_role;
