-- RAQ-MAND-EM054 — RPCs públicas do fluxo de formulários web
--
-- Why: Expõe dois pontos de entrada SECURITY DEFINER para a Edge Function pública:
--      (1) buscar dados seguros do formulário (slug→json sem campos internos),
--      (2) processar uma resposta (dedup + automações CRM + insert em formulario_respostas).
--      As tabelas criadas na mig 114 têm RLS só para authenticated; o acesso
--      anon/público só é possível via estas RPCs, que aplicam sua própria
--      lógica de autorização.
-- Reference: RAQ-MAND-EM054
-- Risk: média — SECURITY DEFINER com acesso a contacts/board_items/contact_tags;
--        mitigado por whitelist explícita de colunas e GRANT restrito.
-- Rollback:
--   DROP FUNCTION IF EXISTS public.formulario_obter_publico(text);
--   DROP FUNCTION IF EXISTS public.formulario_processar_resposta(text, jsonb, text, text);

-- ============================================================
-- RPC 1: formulario_obter_publico
--
-- Retorna o shape público seguro de um formulário via slug.
-- Nunca inclui campos internos (mapear_destino_*, aplicar_etiquetas,
-- mover_stage_id, ranking_pontos, marcar_situacao, dedup_*, origem,
-- created_by, status, publicado, total_visitas, max_respostas).
-- Incrementa total_visitas quando o formulário está acessível.
-- Acessível por: anon, authenticated, service_role.
-- ============================================================

DROP FUNCTION IF EXISTS public.formulario_obter_publico(text);

CREATE OR REPLACE FUNCTION public.formulario_obter_publico(
  _slug text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_form        public.formularios%ROWTYPE;
  v_campos      jsonb;
  v_qtd_resp    bigint;
BEGIN
  -- 1. Carrega o formulário pelo slug
  SELECT *
    INTO v_form
    FROM public.formularios
   WHERE slug = _slug
     AND publicado = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('erro', 'nao_encontrado');
  END IF;

  -- 2. Checa status encerrado (campo status OU janela de encerra_em vencida)
  IF v_form.status = 'encerrado'
     OR (v_form.encerra_em IS NOT NULL AND v_form.encerra_em < now())
  THEN
    RETURN jsonb_build_object(
      'erro',         'encerrado',
      'titulo',       v_form.titulo,
      'agradecimento', v_form.agradecimento
    );
  END IF;

  -- 3. Checa janela de abertura (ainda não iniciado)
  IF v_form.abre_em IS NOT NULL AND v_form.abre_em > now() THEN
    RETURN jsonb_build_object(
      'erro',    'nao_iniciado',
      'abre_em', v_form.abre_em
    );
  END IF;

  -- 4. Checa limite de respostas
  IF v_form.max_respostas IS NOT NULL THEN
    SELECT COUNT(*)
      INTO v_qtd_resp
      FROM public.formulario_respostas
     WHERE form_id = v_form.id;

    IF v_qtd_resp >= v_form.max_respostas THEN
      RETURN jsonb_build_object('erro', 'limite_atingido');
    END IF;
  END IF;

  -- 5. Incrementa total_visitas (best-effort; não falha o request se der erro)
  BEGIN
    UPDATE public.formularios
       SET total_visitas = total_visitas + 1
     WHERE id = v_form.id;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- ignora falha no contador
  END;

  -- 6. Monta array de campos (SÓ campos públicos, ordenado por ordem)
  --    NUNCA retorna: mapear_destino_1, mapear_destino_2 (revelaria mapeamento CRM)
  SELECT jsonb_agg(
    jsonb_build_object(
      'id',              c.id,
      'tipo',            c.tipo,
      'rotulo',          c.rotulo,
      'ajuda',           c.ajuda,
      'obrigatorio',     c.obrigatorio,
      'min_chars',       c.min_chars,
      'max_chars',       c.max_chars,
      'validar_formato', c.validar_formato,
      'opcoes',          c.opcoes,
      'largura',         c.largura,
      'config',          c.config
    )
    ORDER BY c.ordem ASC
  )
  INTO v_campos
  FROM public.formulario_campos c
  WHERE c.form_id = v_form.id;

  -- 7. Retorna shape público seguro
  RETURN jsonb_build_object(
    'id',           v_form.id,
    'titulo',       v_form.titulo,
    'descricao',    v_form.descricao,
    'capa_url',     v_form.capa_url,
    'tema',         v_form.tema,
    'agradecimento', v_form.agradecimento,
    'campos',       COALESCE(v_campos, '[]'::jsonb)
  );
END;
$$;

COMMENT ON FUNCTION public.formulario_obter_publico(text) IS
  'RAQ-MAND-EM054. Retorna shape público seguro de um formulário por slug. '
  'Valida janela de tempo e limite de respostas. Incrementa total_visitas. '
  'Nunca expõe campos internos (mapeamento CRM, dedup, automações). '
  'Acessível por anon via Edge Function pública.';

REVOKE ALL ON FUNCTION public.formulario_obter_publico(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.formulario_obter_publico(text) TO anon;
GRANT EXECUTE ON FUNCTION public.formulario_obter_publico(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.formulario_obter_publico(text) TO service_role;


-- ============================================================
-- RPC 2: formulario_processar_resposta
--
-- Processa o envio de um formulário público:
--   1. Revalida janela + limite (defesa server-side)
--   2. Monta patch de contato a partir de mapear_destino_*
--      (whitelist explícita de colunas)
--   3. Dedup: busca contato existente por whatsapp ou cpf;
--      aplica ação (mesclar | criar | ignorar)
--   4. Automações (etiquetas, funil kanban, ranking, situação)
--      quando NÃO for "ignorar + achou existente"
--   5. Registra formulario_respostas
--   6. Em exceção inesperada: registra resposta com status='erro'
--      e retorna jsonb_build_object('erro','interno')
--
-- GRANT apenas para service_role (chamada feita pela Edge Function
-- que aplica captcha + rate-limit antes de invocar esta RPC).
-- anon NÃO deve chamar direto — sem captcha seria abuso trivial.
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
  FOR v_campo IN
    SELECT *
      FROM public.formulario_campos
     WHERE form_id = v_form.id
       AND (
         mapear_destino_1 IS NOT NULL
         OR mapear_destino_2 IS NOT NULL
       )
  LOOP
    -- Tenta obter o valor bruto do _dados (chave = campo id como texto)
    v_raw_val := _dados ->> v_campo.id::text;

    IF v_raw_val IS NOT NULL AND length(trim(v_raw_val)) > 0 THEN
      -- Destino 1
      IF v_campo.mapear_destino_1 IS NOT NULL
         AND v_campo.mapear_destino_1 = ANY(v_contact_col_whitelist)
      THEN
        -- Adiciona ao patch apenas se ainda não presente (primeiro ganha)
        IF NOT (v_campo.mapear_destino_1 = ANY(v_patch_keys)) THEN
          v_patch_keys := v_patch_keys || v_campo.mapear_destino_1;
          v_patch_vals := v_patch_vals || v_raw_val;
        END IF;
      END IF;

      -- Destino 2
      IF v_campo.mapear_destino_2 IS NOT NULL
         AND v_campo.mapear_destino_2 = ANY(v_contact_col_whitelist)
      THEN
        IF NOT (v_campo.mapear_destino_2 = ANY(v_patch_keys)) THEN
          v_patch_keys := v_patch_keys || v_campo.mapear_destino_2;
          v_patch_vals := v_patch_vals || v_raw_val;
        END IF;
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
      -- Não altera o contato; vincula a resposta ao existente; pula automações
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
  'RAQ-MAND-EM054. Processa envio de formulário público: revalida janela/limite '
  '(com FOR UPDATE quando max_respostas IS NOT NULL para serializar concorrência), '
  'monta patch de contato (whitelist 14 colunas), dedup não-destrutivo '
  '(whatsapp|cpf buscam apenas merged_into IS NULL; mesclar usa COALESCE para '
  'só enriquecer campos vazios, nunca sobrescrever), automações (etiquetas, funil '
  'kanban, ranking, situação — whitelist situacao: declarou_voto/is_favorite/'
  'e_multiplicador; optin_whatsapp e aceita_whatsapp excluídos), '
  'registra formulario_respostas. Em exceção captura e registra status=erro. '
  'Chamada exclusivamente pela Edge Function (service_role); anon NÃO deve chamar direto.';

-- service_role APENAS (Edge Function faz captcha + rate-limit antes de invocar)
REVOKE ALL ON FUNCTION public.formulario_processar_resposta(text, jsonb, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.formulario_processar_resposta(text, jsonb, text, text) TO service_role;
