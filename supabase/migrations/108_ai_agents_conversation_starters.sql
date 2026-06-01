-- 108_ai_agents_conversation_starters.sql
-- 2026-05-21 — Editor de iniciadores de conversa do agente
--
-- Adiciona coluna conversation_starters JSONB em ai_agents com array de
-- { icon, title, text, prompt } para os botoes da welcome screen.
-- Seed com os 4 iniciadores default da feature original.
--
-- Schema do JSON:
--   [
--     { "icon": "Home"|"FileText"|"Briefcase"|"CheckSquare"|"MessageCircle"|...,
--       "title": "string (max 60 chars)",
--       "text":  "string (max 120 chars)",
--       "prompt":"string (max 500 chars, enviado ao agente ao clicar)" }
--   ]
-- Limite pratico: 8 iniciadores (UI suporta 2-3 colunas).

ALTER TABLE public.ai_agents
  ADD COLUMN IF NOT EXISTS conversation_starters JSONB
    DEFAULT '[
      {"icon":"Home","title":"Atender pedido de obra pública","text":"Roteiro padrão para eleitor pedindo asfalto, iluminação, calçada...","prompt":"Como respondo a um eleitor pedindo asfalto?"},
      {"icon":"FileText","title":"Redigir ofício institucional","text":"Estrutura formal para Secretaria, Câmara, Ministério Público...","prompt":"Qual o modelo de ofício para Secretaria Municipal?"},
      {"icon":"Briefcase","title":"Classificar demanda jurídica","text":"Categorização, encaminhamento e priorização de casos legais.","prompt":"Como classificar uma demanda jurídica do eleitor?"},
      {"icon":"CheckSquare","title":"Organizar evento de campo","text":"Logística, segurança, mobilização e cobertura de imprensa.","prompt":"Checklist completo para evento no bairro"}
    ]'::JSONB;

-- Backfill: garante que linhas existentes recebam o default (caso a coluna ja
-- exista por algum motivo, ou o DEFAULT nao tenha sido aplicado nas linhas atuais)
UPDATE public.ai_agents
  SET conversation_starters = '[
    {"icon":"Home","title":"Atender pedido de obra pública","text":"Roteiro padrão para eleitor pedindo asfalto, iluminação, calçada...","prompt":"Como respondo a um eleitor pedindo asfalto?"},
    {"icon":"FileText","title":"Redigir ofício institucional","text":"Estrutura formal para Secretaria, Câmara, Ministério Público...","prompt":"Qual o modelo de ofício para Secretaria Municipal?"},
    {"icon":"Briefcase","title":"Classificar demanda jurídica","text":"Categorização, encaminhamento e priorização de casos legais.","prompt":"Como classificar uma demanda jurídica do eleitor?"},
    {"icon":"CheckSquare","title":"Organizar evento de campo","text":"Logística, segurança, mobilização e cobertura de imprensa.","prompt":"Checklist completo para evento no bairro"}
  ]'::JSONB
  WHERE conversation_starters IS NULL;

-- Atualiza a view admin pra expor a nova coluna
DROP VIEW IF EXISTS public.ai_agents_admin_view;
CREATE VIEW public.ai_agents_admin_view
  WITH (security_invoker = true)
  AS
  SELECT
    id, name, system_prompt, is_active, text_only_mode,
    conversation_starters,
    created_by, updated_by, created_at, updated_at
  FROM public.ai_agents;

GRANT SELECT ON public.ai_agents_admin_view TO authenticated;

-- View publica tambem expoe os starters (todos usuarios precisam ler pra renderizar a welcome)
DROP VIEW IF EXISTS public.ai_agents_public_view;
CREATE VIEW public.ai_agents_public_view
  WITH (security_invoker = false)
  AS
  SELECT id, name, is_active, conversation_starters
  FROM public.ai_agents;

GRANT SELECT ON public.ai_agents_public_view TO authenticated;

COMMENT ON COLUMN public.ai_agents.conversation_starters IS
  'Iniciadores de conversa exibidos na welcome screen do agente. Editavel pelo admin em Configuracoes -> Agente -> Identidade. Limite UX: 8 itens.';
