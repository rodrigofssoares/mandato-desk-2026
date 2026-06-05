-- RAQ-MAND-EM054 — Construtor de formulários web: schema principal
--
-- Why: Permite criar formulários públicos de captação de contatos/respostas
--      integrados ao CRM, com dedup automático, etiquetagem, kanban e RBAC.
-- Reference: RAQ-MAND-EM054
-- Risk: baixa — tabelas novas, sem alteração em tabelas existentes
-- Rollback:
--   DROP TABLE IF EXISTS formulario_respostas CASCADE;
--   DROP TABLE IF EXISTS formulario_campos CASCADE;
--   DROP TABLE IF EXISTS formularios CASCADE;
--   DROP FUNCTION IF EXISTS formulario_incrementar_visita(text);
--   DROP FUNCTION IF EXISTS formularios_fechar_vencidos();
--   SELECT cron.unschedule('formularios-fechar-vencidos');
--   DELETE FROM storage.buckets WHERE id = 'formularios';

-- ============================================================
-- 1. Tabela principal: formularios
-- ============================================================

CREATE TABLE IF NOT EXISTS public.formularios (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identificação
  titulo       TEXT        NOT NULL CHECK (length(trim(titulo)) > 0),
  slug         TEXT        NOT NULL UNIQUE CHECK (
                             slug ~ '^[a-z0-9\-]+$'
                             AND length(slug) >= 3
                             AND length(slug) <= 128
                           ),
  descricao    TEXT,
  capa_url     TEXT,

  -- Ciclo de vida
  status       TEXT        NOT NULL DEFAULT 'rascunho'
                           CHECK (status IN ('rascunho', 'agendado', 'ativo', 'encerrado')),
  publicado    BOOLEAN     NOT NULL DEFAULT false,
  abre_em      TIMESTAMPTZ,
  encerra_em   TIMESTAMPTZ,

  -- Aparência
  tema         JSONB       NOT NULL DEFAULT '{"cor":"#7B1E2E","cantos":"arredondado","fundo":"bege","mostrar_logo":true}'::jsonb,

  -- Mensagem pós-envio
  agradecimento JSONB      NOT NULL DEFAULT '{"titulo":"Obrigado pela sua participação!","mensagem":"Sua resposta foi registrada com sucesso."}'::jsonb,

  -- Deduplicação de contatos
  dedup_campo  TEXT        NOT NULL DEFAULT 'whatsapp'
                           CHECK (dedup_campo IN ('whatsapp', 'cpf', 'nenhum')),
  dedup_acao   TEXT        NOT NULL DEFAULT 'mesclar'
                           CHECK (dedup_acao IN ('mesclar', 'criar', 'ignorar')),

  -- Automações CRM
  aplicar_etiquetas UUID[] NOT NULL DEFAULT '{}'::uuid[],
  mover_stage_id    UUID   REFERENCES public.board_stages(id) ON DELETE SET NULL,
  ranking_pontos    INT    NOT NULL DEFAULT 0,
  marcar_situacao   JSONB  NOT NULL DEFAULT '{}'::jsonb,
  origem            TEXT,

  -- Limitação e métricas
  max_respostas INT,
  total_visitas INT        NOT NULL DEFAULT 0,

  -- Auditoria
  created_by   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.formularios IS 'Formulários web públicos para captação de contatos e respostas. Cada formulário é configurável com campos, dedup e automações CRM.';
COMMENT ON COLUMN public.formularios.slug IS 'Identificador único na URL. Só letras minúsculas, dígitos e hífens (3–128 chars).';
COMMENT ON COLUMN public.formularios.dedup_campo IS 'Campo usado para identificar contato duplicado: whatsapp, cpf ou nenhum.';
COMMENT ON COLUMN public.formularios.dedup_acao IS 'Ação ao detectar duplicata: mesclar (atualiza existente), criar (cria novo) ou ignorar (descarta).';
COMMENT ON COLUMN public.formularios.aplicar_etiquetas IS 'Array de IDs de tags aplicadas automaticamente ao contato ao enviar o formulário.';
COMMENT ON COLUMN public.formularios.mover_stage_id IS 'Stage do kanban para onde o contato é movido automaticamente após resposta.';
COMMENT ON COLUMN public.formularios.ranking_pontos IS 'Pontos de ranking adicionados ao contato ao responder o formulário.';
COMMENT ON COLUMN public.formularios.marcar_situacao IS 'JSON com campos situação a marcar no contato (ex: declarou_voto, is_favorite).';
COMMENT ON COLUMN public.formularios.tema IS 'Configuração visual: cor primária, estilo de cantos, fundo e exibição do logo.';
COMMENT ON COLUMN public.formularios.agradecimento IS 'Título e mensagem exibidos após o envio bem-sucedido do formulário.';
COMMENT ON COLUMN public.formularios.total_visitas IS 'Contador de acessos à página pública do formulário (incrementado via RPC).';

-- ============================================================
-- 2. Trigger updated_at em formularios
-- ============================================================

DROP TRIGGER IF EXISTS formularios_updated_at ON public.formularios;
CREATE TRIGGER formularios_updated_at
  BEFORE UPDATE ON public.formularios
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 3. Tabela de campos: formulario_campos
-- ============================================================

CREATE TABLE IF NOT EXISTS public.formulario_campos (
  id               UUID     PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id          UUID     NOT NULL REFERENCES public.formularios(id) ON DELETE CASCADE,
  ordem            INT      NOT NULL DEFAULT 0,

  tipo             TEXT     NOT NULL
                            CHECK (tipo IN (
                              'texto_curto', 'paragrafo', 'telefone', 'email',
                              'cpf', 'escolha_unica', 'checkboxes', 'lista',
                              'data', 'imagem', 'secao'
                            )),
  rotulo           TEXT     NOT NULL DEFAULT '',
  ajuda            TEXT,
  obrigatorio      BOOLEAN  NOT NULL DEFAULT false,

  -- Validações de texto
  min_chars        INT,
  max_chars        INT,
  validar_formato  BOOLEAN  NOT NULL DEFAULT true,

  -- Opções para campos de seleção (escolha_unica, checkboxes, lista)
  opcoes           JSONB    NOT NULL DEFAULT '[]'::jsonb,

  -- Mapeamento para campos do contato no CRM
  mapear_destino_1 TEXT,
  mapear_destino_2 TEXT,

  -- Layout
  largura          TEXT     NOT NULL DEFAULT '100',

  -- Configurações extras (tipo-específicas)
  config           JSONB    NOT NULL DEFAULT '{}'::jsonb,

  created_at       TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE  public.formulario_campos IS 'Campos configuráveis de cada formulário, ordenados pelo campo ordem.';
COMMENT ON COLUMN public.formulario_campos.tipo IS 'Tipo do campo: texto_curto, paragrafo, telefone, email, cpf, escolha_unica, checkboxes, lista, data, imagem, secao.';
COMMENT ON COLUMN public.formulario_campos.opcoes IS 'JSON array de opções para campos de seleção. Ex: [{"label":"Sim","value":"sim"}].';
COMMENT ON COLUMN public.formulario_campos.mapear_destino_1 IS 'Nome da coluna em contacts para onde o valor do campo é mapeado (ex: nome, telefone, cpf).';
COMMENT ON COLUMN public.formulario_campos.mapear_destino_2 IS 'Segundo destino opcional (ex: campo complementar do CRM).';
COMMENT ON COLUMN public.formulario_campos.config IS 'Configurações específicas do tipo de campo (formato de data, aceitar múltiplas imagens, etc.).';

-- ============================================================
-- 4. Tabela de respostas: formulario_respostas
-- ============================================================

CREATE TABLE IF NOT EXISTS public.formulario_respostas (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id    UUID        NOT NULL REFERENCES public.formularios(id) ON DELETE CASCADE,
  contact_id UUID        REFERENCES public.contacts(id) ON DELETE SET NULL,
  dados      JSONB       NOT NULL DEFAULT '{}'::jsonb,
  ip_hash    TEXT,
  user_agent TEXT,
  status     TEXT        NOT NULL DEFAULT 'processado'
                         CHECK (status IN ('processado', 'erro')),
  erro       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.formulario_respostas IS 'Respostas submetidas pelos respondentes nos formulários públicos. Inserção via Edge Function com service_role.';
COMMENT ON COLUMN public.formulario_respostas.dados IS 'JSON com os valores respondidos, mapeados por field_id ou campo de destino.';
COMMENT ON COLUMN public.formulario_respostas.ip_hash IS 'Hash SHA-256 do IP do respondente para auditoria sem armazenar IP puro (LGPD).';
COMMENT ON COLUMN public.formulario_respostas.contact_id IS 'Contato criado/atualizado no CRM como resultado do processamento desta resposta.';

-- ============================================================
-- 5. Índices estratégicos
-- ============================================================

-- formularios
CREATE UNIQUE INDEX IF NOT EXISTS formularios_slug_idx
  ON public.formularios (slug);

CREATE INDEX IF NOT EXISTS formularios_status_idx
  ON public.formularios (status);

CREATE INDEX IF NOT EXISTS formularios_encerra_em_idx
  ON public.formularios (encerra_em)
  WHERE encerra_em IS NOT NULL;

CREATE INDEX IF NOT EXISTS formularios_created_by_idx
  ON public.formularios (created_by);

-- Partial: formulários publicados e ativos (hot path da página pública)
CREATE INDEX IF NOT EXISTS formularios_publicos_idx
  ON public.formularios (slug, status)
  WHERE publicado = true;

-- formulario_campos
CREATE INDEX IF NOT EXISTS formulario_campos_form_ordem_idx
  ON public.formulario_campos (form_id, ordem);

-- formulario_respostas
CREATE INDEX IF NOT EXISTS formulario_respostas_form_created_idx
  ON public.formulario_respostas (form_id, created_at DESC);

CREATE INDEX IF NOT EXISTS formulario_respostas_contact_idx
  ON public.formulario_respostas (contact_id)
  WHERE contact_id IS NOT NULL;

-- ============================================================
-- 6. RLS — formularios
-- ============================================================

ALTER TABLE public.formularios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "formularios_select" ON public.formularios;
CREATE POLICY "formularios_select" ON public.formularios
  FOR SELECT
  TO authenticated
  USING (
    created_by = auth.uid()
    OR get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'formularios', 'ver')
  );

DROP POLICY IF EXISTS "formularios_insert" ON public.formularios;
CREATE POLICY "formularios_insert" ON public.formularios
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_user_active(auth.uid())
    AND (
      get_current_user_role() = 'admin'
      OR has_permission(auth.uid(), 'formularios', 'criar')
    )
  );

DROP POLICY IF EXISTS "formularios_update" ON public.formularios;
CREATE POLICY "formularios_update" ON public.formularios
  FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'formularios', 'editar')
  )
  WITH CHECK (
    created_by = auth.uid()
    OR get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'formularios', 'editar')
  );

DROP POLICY IF EXISTS "formularios_delete" ON public.formularios;
CREATE POLICY "formularios_delete" ON public.formularios
  FOR DELETE
  TO authenticated
  USING (
    get_current_user_role() = 'admin'
    OR has_permission(auth.uid(), 'formularios', 'deletar')
  );

-- ============================================================
-- 7. RLS — formulario_campos
-- ============================================================

ALTER TABLE public.formulario_campos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "formulario_campos_select" ON public.formulario_campos;
CREATE POLICY "formulario_campos_select" ON public.formulario_campos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.formularios f
      WHERE f.id = form_id
        AND (
          f.created_by = auth.uid()
          OR get_current_user_role() = 'admin'
          OR has_permission(auth.uid(), 'formularios', 'ver')
        )
    )
  );

DROP POLICY IF EXISTS "formulario_campos_insert" ON public.formulario_campos;
CREATE POLICY "formulario_campos_insert" ON public.formulario_campos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_user_active(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.formularios f
      WHERE f.id = form_id
        AND (
          get_current_user_role() = 'admin'
          OR has_permission(auth.uid(), 'formularios', 'criar')
        )
    )
  );

DROP POLICY IF EXISTS "formulario_campos_update" ON public.formulario_campos;
CREATE POLICY "formulario_campos_update" ON public.formulario_campos
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.formularios f
      WHERE f.id = form_id
        AND (
          f.created_by = auth.uid()
          OR get_current_user_role() = 'admin'
          OR has_permission(auth.uid(), 'formularios', 'editar')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.formularios f
      WHERE f.id = form_id
        AND (
          f.created_by = auth.uid()
          OR get_current_user_role() = 'admin'
          OR has_permission(auth.uid(), 'formularios', 'editar')
        )
    )
  );

DROP POLICY IF EXISTS "formulario_campos_delete" ON public.formulario_campos;
CREATE POLICY "formulario_campos_delete" ON public.formulario_campos
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.formularios f
      WHERE f.id = form_id
        AND (
          get_current_user_role() = 'admin'
          OR has_permission(auth.uid(), 'formularios', 'deletar')
        )
    )
  );

-- ============================================================
-- 8. RLS — formulario_respostas
-- ============================================================

ALTER TABLE public.formulario_respostas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "formulario_respostas_select" ON public.formulario_respostas;
CREATE POLICY "formulario_respostas_select" ON public.formulario_respostas
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.formularios f
      WHERE f.id = form_id
        AND (
          f.created_by = auth.uid()
          OR get_current_user_role() = 'admin'
          OR has_permission(auth.uid(), 'formularios', 'ver')
        )
    )
  );

-- INSERT de respostas é feito via Edge Function com service_role (bypassa RLS).
-- Esta policy cobre inserção manual por usuários autenticados do CRM (caso excepcional).
DROP POLICY IF EXISTS "formulario_respostas_insert" ON public.formulario_respostas;
CREATE POLICY "formulario_respostas_insert" ON public.formulario_respostas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_user_active(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.formularios f
      WHERE f.id = form_id
        AND (
          get_current_user_role() = 'admin'
          OR has_permission(auth.uid(), 'formularios', 'editar')
        )
    )
  );

DROP POLICY IF EXISTS "formulario_respostas_update" ON public.formulario_respostas;
CREATE POLICY "formulario_respostas_update" ON public.formulario_respostas
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.formularios f
      WHERE f.id = form_id
        AND (
          get_current_user_role() = 'admin'
          OR has_permission(auth.uid(), 'formularios', 'editar')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.formularios f
      WHERE f.id = form_id
        AND (
          get_current_user_role() = 'admin'
          OR has_permission(auth.uid(), 'formularios', 'editar')
        )
    )
  );

DROP POLICY IF EXISTS "formulario_respostas_delete" ON public.formulario_respostas;
CREATE POLICY "formulario_respostas_delete" ON public.formulario_respostas
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.formularios f
      WHERE f.id = form_id
        AND (
          get_current_user_role() = 'admin'
          OR has_permission(auth.uid(), 'formularios', 'deletar')
        )
    )
  );

-- ============================================================
-- 9. Storage bucket: formularios
-- ============================================================

-- Bucket público para imagens de capa e uploads de campo imagem.
-- file_size_limit: 5 MB por arquivo (5 × 1024 × 1024 = 5242880 bytes).
-- allowed_mime_types: apenas imagens rasterizadas — SVG e HTML excluídos
--   intencionalmente para prevenir XSS no domínio storage (bucket é público).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'formularios',
  'formularios',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Leitura pública (necessário para imagens de capa e uploads de campo imagem
-- referenciados em formulários públicos — acessados sem autenticação)
DROP POLICY IF EXISTS "formularios_storage_select" ON storage.objects;
CREATE POLICY "formularios_storage_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'formularios');

-- Upload: autenticado com permissão de criar formulários
DROP POLICY IF EXISTS "formularios_storage_insert" ON storage.objects;
CREATE POLICY "formularios_storage_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'formularios'
    AND (
      (SELECT get_current_user_role()) = 'admin'
      OR has_permission(auth.uid(), 'formularios', 'criar')
    )
  );

-- Atualizar: autenticado com permissão de editar formulários
DROP POLICY IF EXISTS "formularios_storage_update" ON storage.objects;
CREATE POLICY "formularios_storage_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'formularios'
    AND (
      (SELECT get_current_user_role()) = 'admin'
      OR has_permission(auth.uid(), 'formularios', 'editar')
    )
  );

-- Deletar: autenticado com permissão de deletar formulários
DROP POLICY IF EXISTS "formularios_storage_delete" ON storage.objects;
CREATE POLICY "formularios_storage_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'formularios'
    AND (
      (SELECT get_current_user_role()) = 'admin'
      OR has_permission(auth.uid(), 'formularios', 'deletar')
    )
  );

-- ============================================================
-- 10. Função RPC: formulario_incrementar_visita
-- ============================================================

CREATE OR REPLACE FUNCTION public.formulario_incrementar_visita(_slug TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.formularios
  SET total_visitas = total_visitas + 1
  WHERE slug = _slug
    AND publicado = true
    AND status IN ('ativo', 'agendado');
END;
$$;

COMMENT ON FUNCTION public.formulario_incrementar_visita(text) IS
  'Incrementa total_visitas do formulário com o slug fornecido. Chamada pela Edge Function pública, sem autenticação. SECURITY DEFINER para contornar RLS.';

-- Revogar acesso irrestrito; a EF usa service_role (bypassa tudo),
-- mas mantemos a função acessível para chamadas anon também (página pública).
REVOKE ALL ON FUNCTION public.formulario_incrementar_visita(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.formulario_incrementar_visita(text) TO anon;
GRANT EXECUTE ON FUNCTION public.formulario_incrementar_visita(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.formulario_incrementar_visita(text) TO service_role;

-- ============================================================
-- 11. Função de automação: formularios_fechar_vencidos
-- ============================================================

CREATE OR REPLACE FUNCTION public.formularios_fechar_vencidos()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Transição agendado → ativo (janela aberta, ainda dentro do prazo ou sem prazo)
  UPDATE public.formularios
  SET status = 'ativo'
  WHERE publicado = true
    AND status = 'agendado'
    AND (abre_em IS NULL OR abre_em <= now())
    AND (encerra_em IS NULL OR encerra_em > now());

  -- Transição ativo/agendado → encerrado (passou do encerra_em)
  UPDATE public.formularios
  SET status = 'encerrado'
  WHERE publicado = true
    AND status IN ('ativo', 'agendado')
    AND encerra_em IS NOT NULL
    AND encerra_em < now();
END;
$$;

COMMENT ON FUNCTION public.formularios_fechar_vencidos() IS
  'Gerencia transições de status automáticas: agendado→ativo quando abre_em chegou; ativo/agendado→encerrado quando encerra_em passou. Executada pelo pg_cron a cada 5 minutos.';

REVOKE ALL ON FUNCTION public.formularios_fechar_vencidos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.formularios_fechar_vencidos() TO service_role;

-- ============================================================
-- 12. pg_cron: fechar formulários vencidos a cada 5 min
-- ============================================================

-- Idempotência: remove o job se já existir antes de recriar,
-- evitando erro "job with same name already exists" em re-runs.
SELECT cron.unschedule('formularios-fechar-vencidos')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'formularios-fechar-vencidos'
);

SELECT cron.schedule(
  'formularios-fechar-vencidos',
  '*/5 * * * *',
  $$ SELECT public.formularios_fechar_vencidos(); $$
);
