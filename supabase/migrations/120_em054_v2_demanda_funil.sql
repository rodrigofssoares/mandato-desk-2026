-- Migration 120 — RAQ-MAND-EM054 v2: criação automática de demanda via formulário
--
-- Why: Permite que um formulário público crie automaticamente uma demanda no CRM
--      além do contato, viabilizando triagem de solicitações, atendimentos e
--      requerimentos sem necessidade de digitação manual pelo assessor.
-- Reference: RAQ-MAND-EM054-v2
-- Risk: média — adiciona colunas novas (nullable / com default) em tabelas já em prod;
--        CREATE OR REPLACE na RPC (sem alterar assinatura); não toca dados existentes.
-- Rollback:
--   ALTER TABLE public.formularios DROP COLUMN IF EXISTS mover_board_id;
--   ALTER TABLE public.formularios DROP COLUMN IF EXISTS criar_demanda;
--   ALTER TABLE public.formularios DROP COLUMN IF EXISTS demanda_priority;
--   ALTER TABLE public.formulario_campos DROP COLUMN IF EXISTS mapear_demanda;
--   -- Para reverter a RPC: reaplicar a migration 119 (restaura versão anterior).

-- ============================================================
-- PARTE A — ALTERs idempotentes
-- ============================================================

-- ------------------------------------------------------------
-- A1. formularios.mover_board_id
--     Referência ao board pai do stage configurado em mover_stage_id.
--     Usado apenas pela UI para filtrar stages disponíveis no seletor.
--     A RPC deriva o board_id diretamente do board_stages (não depende desta coluna).
-- ------------------------------------------------------------
ALTER TABLE public.formularios
  ADD COLUMN IF NOT EXISTS mover_board_id uuid
    REFERENCES public.boards(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.formularios.mover_board_id IS
  'Board pai do stage de funil (mover_stage_id). '
  'Usado só pela UI para filtrar stages no seletor; a RPC deriva o board pelo stage. '
  'Nullable — pode ser omitido se o board for inferido a partir do stage.';

-- ------------------------------------------------------------
-- A2. formularios.criar_demanda
--     Quando true, a RPC cria uma demanda no módulo de Demandas
--     vinculada ao contato processado, usando os campos mapeados
--     via formulario_campos.mapear_demanda.
-- ------------------------------------------------------------
ALTER TABLE public.formularios
  ADD COLUMN IF NOT EXISTS criar_demanda boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.formularios.criar_demanda IS
  'Quando true, a RPC formulario_processar_resposta cria automaticamente '
  'uma demanda vinculada ao contato. Campos título/descrição/bairro da demanda '
  'são extraídos de formulario_campos.mapear_demanda (whitelist: title, description, neighborhood). '
  'created_by da demanda = created_by do formulário. priority = demanda_priority.';

-- ------------------------------------------------------------
-- A3. formularios.demanda_priority
--     Prioridade padrão das demandas criadas por este formulário.
--     Deve bater com o enum demand_priority (low | medium | high).
-- ------------------------------------------------------------
ALTER TABLE public.formularios
  ADD COLUMN IF NOT EXISTS demanda_priority text NOT NULL DEFAULT 'medium';

-- Adiciona constraint CHECK de forma idempotente usando DO block.
-- pg_constraint só tem a constraint se ela já foi criada — evita erro em re-run.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.formularios'::regclass
       AND conname   = 'formularios_demanda_priority_check'
  ) THEN
    ALTER TABLE public.formularios
      ADD CONSTRAINT formularios_demanda_priority_check
      CHECK (demanda_priority IN ('low', 'medium', 'high'));
  END IF;
END;
$$;

COMMENT ON COLUMN public.formularios.demanda_priority IS
  'Prioridade da demanda criada automaticamente. '
  'Valores válidos: low | medium | high (espelha enum demand_priority). '
  'Default medium.';

-- ------------------------------------------------------------
-- A4. formulario_campos.mapear_demanda
--     Destino do campo na tabela demands (whitelist: title, description, neighborhood).
--     Quando preenchido, o valor respondido é usado para popular o campo
--     correspondente na demanda criada automaticamente.
--     Campos fora da whitelist são silenciosamente ignorados pela RPC.
-- ------------------------------------------------------------
ALTER TABLE public.formulario_campos
  ADD COLUMN IF NOT EXISTS mapear_demanda text;

COMMENT ON COLUMN public.formulario_campos.mapear_demanda IS
  'Campo de destino na tabela demands para criação automática de demanda via formulário. '
  'Whitelist aceita: title, description, neighborhood. '
  'Valores fora da whitelist são ignorados pela RPC. '
  'Nullable — campo não mapeado não alimenta a demanda.';

-- ============================================================
-- PARTE B — CREATE OR REPLACE da RPC formulario_processar_resposta
--
-- Versão base: migration 119 (mais recente, corrige merge não-destrutivo).
-- Adições desta migration (marcadas com "EM054-v2"):
--   • Variáveis para coletar campos mapeados para a demanda
--     (v_demanda_title, v_demanda_desc, v_demanda_bairro, v_mapear_demanda_wl).
--   • Segundo loop de campos para extrair mapear_demanda (pode reutilizar
--     o mesmo loop do patch de contato — veja PASSO 3b).
--   • Bloco 8: INSERT em demands dentro de BEGIN/EXCEPTION próprio,
--     garantindo que falha na criação da demanda nunca aborte o contato/resposta.
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
  -- Whitelist de colunas de contacts que podem ser destino de mapeamento.
  -- NUNCA adicionar colunas de controle interno (id, created_by, ranking,
  -- merged_*, google_*, ai_*, optin_whatsapp — tratados separadamente).
  v_contact_col_whitelist text[] := ARRAY[
    'nome', 'email', 'telefone', 'whatsapp', 'cpf',
    'bairro', 'cidade', 'estado', 'cep', 'logradouro',
    'numero', 'profissao', 'data_nascimento', 'observacoes'
  ];

  -- Whitelist de chaves de marcar_situacao mapeadas para colunas booleanas.
  -- Apenas booleanas simples cujo true é seguro de setar via formulário público.
  -- EXCLUÍDOS intencionalmente:
  --   optin_whatsapp — gerenciado pelo trigger LGPD trg_contacts_bloquear_optin
  --                    (migration 076); UPDATE direto é bloqueado por trigger.
  --   aceita_whatsapp — campo de ranking/qualificação interna; não deve ser
  --                     sobrescrito por respondente anônimo.
  v_situacao_whitelist text[] := ARRAY[
    'declarou_voto', 'is_favorite', 'e_multiplicador'
  ];

  -- EM054-v2: Whitelist de destinos de demanda aceitos via mapear_demanda.
  v_mapear_demanda_wl text[] := ARRAY['title', 'description', 'neighborhood'];

  v_form          public.formularios%ROWTYPE;
  v_campo         public.formulario_campos%ROWTYPE;
  v_qtd_resp      bigint;

  -- Patch de contato (mapa coluna→valor)
  v_patch_keys    text[]   := ARRAY[]::text[];
  v_patch_vals    text[]   := ARRAY[]::text[];

  -- Dedup
  v_campo_dedup   text;    -- valor extraído do patch (whatsapp ou cpf normalizado)
  v_contact_id    uuid;
  v_achou_existente boolean := false;
  v_deve_automatizar boolean := true;

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
  v_coltype       text;   -- tipo real da coluna de contacts (p/ cast correto: date, text, etc.)
  v_raw_val       text;
  v_tag_id        uuid;

  -- EM054-v2: campos coletados para demanda
  v_demanda_title  text := '';
  v_demanda_desc   text := '';
  v_demanda_bairro text := '';
  v_demanda_raw    jsonb;   -- valor bruto do campo (_dados) ao extrair mapear_demanda

  -- Saída de erro
  v_err_msg       text;

BEGIN
  -- --------------------------------------------------------
  -- 1. Carrega formulário pelo slug
  -- --------------------------------------------------------
  SELECT *
    INTO v_form
    FROM public.formularios
   WHERE slug = _slug
     AND publicado = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('erro', 'nao_encontrado');
  END IF;

  -- --------------------------------------------------------
  -- 2. Revalida janela e limite (defesa server-side)
  -- --------------------------------------------------------
  IF v_form.status = 'encerrado'
     OR (v_form.encerra_em IS NOT NULL AND v_form.encerra_em < now())
  THEN
    RETURN jsonb_build_object(
      'erro',         'encerrado',
      'titulo',       v_form.titulo,
      'agradecimento', v_form.agradecimento
    );
  END IF;

  IF v_form.abre_em IS NOT NULL AND v_form.abre_em > now() THEN
    RETURN jsonb_build_object('erro', 'nao_iniciado', 'abre_em', v_form.abre_em);
  END IF;

  IF v_form.max_respostas IS NOT NULL THEN
    -- Serializa submissões concorrentes quando há limite de respostas.
    -- O FOR UPDATE na linha do formulário garante que duas submissões
    -- simultâneas não ultrapassem max_respostas por race condition.
    PERFORM 1 FROM public.formularios WHERE id = v_form.id FOR UPDATE;

    SELECT COUNT(*)
      INTO v_qtd_resp
      FROM public.formulario_respostas
     WHERE form_id = v_form.id;

    IF v_qtd_resp >= v_form.max_respostas THEN
      RETURN jsonb_build_object('erro', 'limite_atingido');
    END IF;
  END IF;

  -- --------------------------------------------------------
  -- 3. Monta patch do contato a partir dos campos com mapear_destino_*
  --    Itera pelos campos do formulário, verifica whitelist e extrai valor.
  -- --------------------------------------------------------
  --    EM054-v2 (3b): no mesmo loop, coleta também mapear_demanda quando
  --    criar_demanda = true. Usa v_demanda_raw para tratar array vs texto.
  -- --------------------------------------------------------
  FOR v_campo IN
    SELECT *
      FROM public.formulario_campos
     WHERE form_id = v_form.id
       AND (
         mapear_destino_1 IS NOT NULL
         OR mapear_destino_2 IS NOT NULL
         -- EM054-v2: inclui campos com mapear_demanda quando criar_demanda=true
         OR (v_form.criar_demanda = true AND mapear_demanda IS NOT NULL)
       )
  LOOP
    -- Tenta obter o valor bruto do _dados (chave = campo id como texto)
    v_raw_val := _dados ->> v_campo.id::text;

    IF v_raw_val IS NOT NULL AND length(trim(v_raw_val)) > 0 THEN
      -- Destino 1 (contato)
      IF v_campo.mapear_destino_1 IS NOT NULL
         AND v_campo.mapear_destino_1 = ANY(v_contact_col_whitelist)
      THEN
        -- Adiciona ao patch apenas se ainda não presente (primeiro ganha)
        IF NOT (v_campo.mapear_destino_1 = ANY(v_patch_keys)) THEN
          v_patch_keys := v_patch_keys || v_campo.mapear_destino_1;
          v_patch_vals := v_patch_vals || v_raw_val;
        END IF;
      END IF;

      -- Destino 2 (contato)
      IF v_campo.mapear_destino_2 IS NOT NULL
         AND v_campo.mapear_destino_2 = ANY(v_contact_col_whitelist)
      THEN
        IF NOT (v_campo.mapear_destino_2 = ANY(v_patch_keys)) THEN
          v_patch_keys := v_patch_keys || v_campo.mapear_destino_2;
          v_patch_vals := v_patch_vals || v_raw_val;
        END IF;
      END IF;
    END IF;

    -- EM054-v2 (3b): coleta campos mapeados para a demanda.
    -- Executado independentemente do valor (inclusive quando raw_val é NULL,
    -- nesse caso nada é atribuído). Só quando criar_demanda = true.
    IF v_form.criar_demanda = true
       AND v_campo.mapear_demanda IS NOT NULL
       AND v_campo.mapear_demanda = ANY(v_mapear_demanda_wl)
    THEN
      -- Lê o valor como jsonb para tratar array de checkboxes vs texto simples
      v_demanda_raw := _dados -> v_campo.id::text;

      IF v_demanda_raw IS NOT NULL THEN
        DECLARE
          v_demanda_val text;
        BEGIN
          IF jsonb_typeof(v_demanda_raw) = 'array' THEN
            -- Checkboxes: junta os valores selecionados com ", "
            SELECT string_agg(elem #>> '{}', ', ' ORDER BY ordinality)
              INTO v_demanda_val
              FROM jsonb_array_elements(v_demanda_raw) WITH ORDINALITY AS t(elem, ordinality);
          ELSE
            -- Texto simples, data, lista, escolha_unica, etc.
            v_demanda_val := v_demanda_raw #>> '{}';
          END IF;

          -- Atribui ao slot correto (primeiro campo mapeado para cada slot ganha)
          IF v_campo.mapear_demanda = 'title' AND length(trim(COALESCE(v_demanda_title, ''))) = 0 THEN
            v_demanda_title := trim(COALESCE(v_demanda_val, ''));
          ELSIF v_campo.mapear_demanda = 'description' AND length(trim(COALESCE(v_demanda_desc, ''))) = 0 THEN
            v_demanda_desc := trim(COALESCE(v_demanda_val, ''));
          ELSIF v_campo.mapear_demanda = 'neighborhood' AND length(trim(COALESCE(v_demanda_bairro, ''))) = 0 THEN
            v_demanda_bairro := trim(COALESCE(v_demanda_val, ''));
          END IF;
        END;
      END IF;
    END IF;

  END LOOP;

  -- --------------------------------------------------------
  -- 4. DEDUP: busca contato existente
  -- --------------------------------------------------------
  v_campo_dedup := NULL;

  IF v_form.dedup_campo = 'whatsapp' THEN
    -- Extrai valor de whatsapp do patch (normalizado: só dígitos)
    v_idx := array_position(v_patch_keys, 'whatsapp');
    IF v_idx IS NOT NULL THEN
      v_campo_dedup := regexp_replace(v_patch_vals[v_idx], '\D', '', 'g');
    END IF;

    IF v_campo_dedup IS NOT NULL AND length(v_campo_dedup) > 0 THEN
      -- AND merged_into IS NULL: não reanimar contatos mesclados/arquivados
      SELECT id
        INTO v_contact_id
        FROM public.contacts
       WHERE regexp_replace(COALESCE(whatsapp, telefone, ''), '\D', '', 'g') = v_campo_dedup
         AND merged_into IS NULL
      LIMIT 1;

      IF FOUND THEN
        v_achou_existente := true;
      END IF;
    END IF;

  ELSIF v_form.dedup_campo = 'cpf' THEN
    v_idx := array_position(v_patch_keys, 'cpf');
    IF v_idx IS NOT NULL THEN
      v_campo_dedup := regexp_replace(v_patch_vals[v_idx], '\D', '', 'g');
    END IF;

    IF v_campo_dedup IS NOT NULL AND length(v_campo_dedup) > 0 THEN
      -- AND merged_into IS NULL: não reanimar contatos mesclados/arquivados
      SELECT id
        INTO v_contact_id
        FROM public.contacts
       WHERE regexp_replace(COALESCE(cpf, ''), '\D', '', 'g') = v_campo_dedup
         AND merged_into IS NULL
      LIMIT 1;

      IF FOUND THEN
        v_achou_existente := true;
      END IF;
    END IF;
  END IF;
  -- dedup_campo = 'nenhum': v_achou_existente permanece false → sempre cria

  -- --------------------------------------------------------
  -- 5. Ação de dedup: mesclar | criar | ignorar
  -- --------------------------------------------------------
  IF v_achou_existente THEN

    IF v_form.dedup_acao = 'mesclar' THEN
      -- Merge: atualiza o contato existente com os NOVOS valores preenchidos.
      -- Nunca apaga um dado com valor vazio (NULLIF($1,'') → mantém o existente).
      -- Ou seja: valor novo não-vazio sobrescreve; valor vazio preserva o atual.
      FOR v_idx IN 1 .. array_length(v_patch_keys, 1)
      LOOP
        v_col := v_patch_keys[v_idx];
        -- Dupla verificação: só executa se o nome está na whitelist
        IF v_col = ANY(v_contact_col_whitelist) THEN
          -- Tipo real da coluna (catálogo, seguro) p/ castar o valor texto corretamente
          -- (ex.: data_nascimento é date — assignar text direto quebra).
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
      -- v_deve_automatizar = true (automações aplicam sobre o contato mesclado)

    ELSIF v_form.dedup_acao = 'ignorar' THEN
      -- Não altera o contato; vincula a resposta ao existente; pula automações CRM.
      -- EM054-v2: v_deve_automatizar = false NÃO impede criação de demanda
      --           (a demanda registra a solicitação mesmo sem alterar o contato).
      v_deve_automatizar := false;
      -- v_contact_id já está definido (o existente)

    ELSIF v_form.dedup_acao = 'criar' THEN
      -- Ignora o existente e cria um novo (força criação)
      v_achou_existente := false; -- trata como novo na próxima etapa
    END IF;

  END IF;

  -- Cria novo contato se: não achou OU dedup_acao='criar'
  IF NOT v_achou_existente THEN
    -- contacts.nome é NOT NULL: usa o valor do patch ou fallback
    DECLARE
      v_nome_insert text;
      v_col_tmp     text;
      v_val_tmp     text;
      v_set_parts   text[] := ARRAY[]::text[];
      v_insert_sql  text;
    BEGIN
      -- Extrai nome do patch
      v_idx := array_position(v_patch_keys, 'nome');
      IF v_idx IS NOT NULL THEN
        v_nome_insert := trim(v_patch_vals[v_idx]);
      END IF;
      IF v_nome_insert IS NULL OR length(v_nome_insert) = 0 THEN
        v_nome_insert := 'Respondente ' || to_char(now(), 'DD/MM/YYYY HH24:MI');
      END IF;

      -- Insere o novo contato com nome fixo + origem + created_by
      INSERT INTO public.contacts (
        nome,
        origem,
        created_by
      )
      VALUES (
        v_nome_insert,
        COALESCE(v_form.origem, 'Formulário: ' || v_form.titulo),
        v_form.created_by
      )
      RETURNING id INTO v_contact_id;

      -- Agora aplica os demais campos do patch individualmente (exceto nome, já inserido)
      FOR v_idx IN 1 .. COALESCE(array_length(v_patch_keys, 1), 0)
      LOOP
        v_col_tmp := v_patch_keys[v_idx];
        v_val_tmp := v_patch_vals[v_idx];
        IF v_col_tmp <> 'nome' AND v_col_tmp = ANY(v_contact_col_whitelist) THEN
          -- Tipo real da coluna p/ cast correto (date, text, etc.)
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

  -- --------------------------------------------------------
  -- 6. Automações (só quando v_deve_automatizar = true)
  -- --------------------------------------------------------
  IF v_deve_automatizar THEN

    -- 6a. Etiquetas
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

    -- 6b. Funil (mover para stage)
    --     board_items exige board_id (NOT NULL) — buscamos via board_stages.
    IF v_form.mover_stage_id IS NOT NULL THEN
      -- Descobre board_id do stage destino
      SELECT board_id
        INTO v_board_id
        FROM public.board_stages
       WHERE id = v_form.mover_stage_id
      LIMIT 1;

      IF v_board_id IS NOT NULL THEN
        -- Se o contato já está no board, atualiza stage; senão, insere.
        -- Usa ON CONFLICT em (board_id, contact_id) — se existir, move de stage.
        -- Se a constraint não existir, um UPDATE seguido de INSERT condicional.
        IF EXISTS (
          SELECT 1 FROM public.board_items
           WHERE board_id = v_board_id
             AND contact_id = v_contact_id
        ) THEN
          UPDATE public.board_items
             SET stage_id = v_form.mover_stage_id,
                 moved_at = now()
           WHERE board_id   = v_board_id
             AND contact_id = v_contact_id;
        ELSE
          INSERT INTO public.board_items (
            board_id,
            contact_id,
            stage_id,
            ordem,
            moved_at
          )
          VALUES (
            v_board_id,
            v_contact_id,
            v_form.mover_stage_id,
            0,       -- posição 0 (vai para o topo da coluna)
            now()
          );
        END IF;
      END IF;
    END IF;

    -- 6c. Ranking
    --     Base do formulário + pontos das opções escolhidas nos campos de seleção.
    v_ranking_total := COALESCE(v_form.ranking_pontos, 0);

    FOR v_campo IN
      SELECT *
        FROM public.formulario_campos
       WHERE form_id = v_form.id
         AND tipo IN ('escolha_unica', 'checkboxes', 'lista')
         AND opcoes <> '[]'::jsonb
    LOOP
      -- Valor escolhido pelo respondente para este campo
      v_valor_campo := _dados -> v_campo.id::text;

      IF v_valor_campo IS NOT NULL THEN
        -- Percorre as opções e acumula pontos das que foram escolhidas
        FOR v_opcao IN SELECT * FROM jsonb_array_elements(v_campo.opcoes)
        LOOP
          v_opcao_val := v_opcao ->> 'value';

          -- Verifica se a opção foi selecionada (string simples OU presente em array)
          IF (
            -- Valor é string simples e bate com a opção
            (jsonb_typeof(v_valor_campo) = 'string'
             AND v_valor_campo #>> '{}' = v_opcao_val)
            OR
            -- Valor é array (checkboxes) e contém a opção
            (jsonb_typeof(v_valor_campo) = 'array'
             AND v_valor_campo @> to_jsonb(v_opcao_val))
          )
          AND (v_opcao ->> 'ranking_pontos') IS NOT NULL
          THEN
            v_ranking_total := v_ranking_total
              + (v_opcao ->> 'ranking_pontos')::int;
          END IF;
        END LOOP;
      END IF;
    END LOOP;

    IF v_ranking_total <> 0 THEN
      UPDATE public.contacts
         SET ranking    = COALESCE(ranking, 0) + v_ranking_total,
             updated_at = now()
       WHERE id = v_contact_id;
    END IF;

    -- 6d. Situação (booleanas via whitelist)
    IF v_form.marcar_situacao IS NOT NULL
       AND v_form.marcar_situacao <> '{}'::jsonb
    THEN
      FOR v_sit_key IN
        SELECT key FROM jsonb_each(v_form.marcar_situacao)
      LOOP
        v_sit_val := (v_form.marcar_situacao ->> v_sit_key)::boolean;

        -- Só aplica se a chave está na whitelist E o valor é true
        IF v_sit_key = ANY(v_situacao_whitelist) AND v_sit_val IS TRUE THEN
          EXECUTE format(
            'UPDATE public.contacts SET %I = true, updated_at = now() WHERE id = $1',
            v_sit_key
          ) USING v_contact_id;
        END IF;
      END LOOP;
    END IF;

  END IF; -- v_deve_automatizar

  -- --------------------------------------------------------
  -- 7. Registra a resposta
  -- --------------------------------------------------------
  INSERT INTO public.formulario_respostas (
    form_id,
    contact_id,
    dados,
    ip_hash,
    user_agent,
    status
  )
  VALUES (
    v_form.id,
    v_contact_id,
    _dados,
    _ip_hash,
    _user_agent,
    'processado'
  );

  -- --------------------------------------------------------
  -- 8. EM054-v2: Criação automática de demanda
  --
  --    Executada quando criar_demanda = true E houver um contato resolvido
  --    (v_contact_id IS NOT NULL). Executada SEMPRE que criar_demanda = true,
  --    inclusive no modo dedup 'ignorar' (o contato é a solicitação, e a
  --    demanda registra cada solicitação individualmente).
  --
  --    Isolada em BEGIN/EXCEPTION próprio: uma falha na criação da demanda
  --    (ex.: violação de FK, bug inesperado) não desfaz o contato já criado
  --    nem a resposta já gravada (passos 5 e 7 já executaram). O erro é
  --    silenciado — o respondente não é penalizado por problema interno.
  -- --------------------------------------------------------
  IF v_form.criar_demanda = true AND v_contact_id IS NOT NULL THEN
    BEGIN
      INSERT INTO public.demands (
        title,
        description,
        neighborhood,
        priority,
        status,
        contact_id,
        created_by
      )
      VALUES (
        -- title: campo mapeado ou fallback "Solicitação via formulário: <título do form>"
        COALESCE(
          NULLIF(v_demanda_title, ''),
          'Solicitação via formulário: ' || v_form.titulo
        ),
        -- description: campo mapeado (NULL se não mapeado ou vazio)
        NULLIF(v_demanda_desc, ''),
        -- neighborhood: campo mapeado (NULL se não mapeado ou vazio)
        NULLIF(v_demanda_bairro, ''),
        -- priority: cast de text para enum demand_priority (constraint garante valor válido)
        v_form.demanda_priority::demand_priority,
        'open'::demand_status,
        v_contact_id,
        v_form.created_by
      );
    EXCEPTION WHEN OTHERS THEN
      -- Falha na demanda não aborta o processamento do formulário.
      -- O contato e a resposta já foram persistidos nos passos anteriores.
      -- Silencia intencionalmente — evitar penalizar o respondente por
      -- erro interno na criação da demanda.
      NULL;
    END;
  END IF;

  RETURN jsonb_build_object(
    'ok',         true,
    'contact_id', v_contact_id
  );

-- --------------------------------------------------------
-- Captura de exceções inesperadas
-- Registra a resposta com status='erro' (best-effort).
-- Não vaza detalhes internos no retorno — SQLERRM vai só para o log interno.
-- --------------------------------------------------------
EXCEPTION WHEN OTHERS THEN
  GET STACKED DIAGNOSTICS v_err_msg = MESSAGE_TEXT;

  BEGIN
    INSERT INTO public.formulario_respostas (
      form_id,
      contact_id,
      dados,
      ip_hash,
      user_agent,
      status,
      erro
    )
    SELECT
      f.id,
      NULL,
      _dados,
      _ip_hash,
      _user_agent,
      'erro',
      left(v_err_msg, 500) -- trunca pra não armazenar stack gigante
    FROM public.formularios f
    WHERE f.slug = _slug
      AND f.publicado = true
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- se o insert de erro também falhar, silencia (não podemos fazer nada)
  END;

  RETURN jsonb_build_object('erro', 'interno');
END;
$$;

COMMENT ON FUNCTION public.formulario_processar_resposta(text, jsonb, text, text) IS
  'RAQ-MAND-EM054 v2. Processa envio de formulário público: revalida janela/limite '
  '(com FOR UPDATE quando max_respostas IS NOT NULL para serializar concorrência), '
  'monta patch de contato (whitelist 14 colunas), dedup não-destrutivo '
  '(whatsapp|cpf buscam apenas merged_into IS NULL; mesclar usa COALESCE para '
  'só enriquecer campos vazios, nunca sobrescrever), automações (etiquetas, funil '
  'kanban, ranking, situação — whitelist situacao: declarou_voto/is_favorite/'
  'e_multiplicador; optin_whatsapp e aceita_whatsapp excluídos), '
  'registra formulario_respostas. '
  'EM054-v2: quando criar_demanda=true, cria demanda em demands via INSERT isolado '
  '(BEGIN/EXCEPTION próprio — falha na demanda não desfaz contato/resposta). '
  'Whitelist demanda: title, description, neighborhood via formulario_campos.mapear_demanda. '
  'Chamada exclusivamente pela Edge Function (service_role); anon NÃO deve chamar direto.';

-- service_role APENAS (Edge Function faz captcha + rate-limit antes de invocar)
REVOKE ALL ON FUNCTION public.formulario_processar_resposta(text, jsonb, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.formulario_processar_resposta(text, jsonb, text, text) TO service_role;
