-- ============================================================================
-- Migration 094: Restringe INSERT em ai_chat_messages_cost a service_role
-- ============================================================================
-- SEC-003 (ALTO) / must-fix 3 do Code Review:
-- A policy "ai_chat_messages_cost: service pode inserir" usava WITH CHECK (true)
-- para o role authenticated — qualquer usuário autenticado podia injetar
-- registros de custo com valores arbitrários, manipulando o budget global e
-- disparando bloqueios falsos do agente.
--
-- Fix: a Edge Function ai-agent-chat usa service_role, que bypassa RLS.
-- Logo, NÃO é necessária nenhuma policy INSERT para authenticated.
-- Removendo a policy, o INSERT via client autenticado passa a ser bloqueado
-- pela ausência de política permissiva (RLS nega por default).
--
-- Adicionalmente, criamos policies explícitas de NO-OP para UPDATE e DELETE
-- de usuários comuns, deixando a intenção documentada no schema.
-- ============================================================================

-- Remove a policy permissiva que permitia inject de custos por qualquer autenticado
DROP POLICY IF EXISTS "ai_chat_messages_cost: service pode inserir"
  ON public.ai_chat_messages_cost;

-- INSERT agora só via service_role (Edge Function). service_role bypassa RLS,
-- portanto não precisa de policy — mas documentamos explicitamente para clareza:
-- NENHUMA policy INSERT existe para authenticated = bloqueado por default.

-- Bloqueia UPDATE explicitamente para authenticated (defense-in-depth)
DROP POLICY IF EXISTS "ai_chat_messages_cost: bloqueia update autenticado"
  ON public.ai_chat_messages_cost;
CREATE POLICY "ai_chat_messages_cost: bloqueia update autenticado"
  ON public.ai_chat_messages_cost
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

-- Bloqueia DELETE explicitamente para authenticated (defense-in-depth)
DROP POLICY IF EXISTS "ai_chat_messages_cost: bloqueia delete autenticado"
  ON public.ai_chat_messages_cost;
CREATE POLICY "ai_chat_messages_cost: bloqueia delete autenticado"
  ON public.ai_chat_messages_cost
  FOR DELETE
  TO authenticated
  USING (false);

COMMENT ON TABLE public.ai_chat_messages_cost IS
  'Registra custo de tokens de cada mensagem processada pela Edge Function ai-agent-chat. INSERT exclusivo via service_role (Edge Function) — authenticated não tem policy INSERT (bloqueado por RLS default). SELECT: admin vê tudo; usuário vê próprios registros.';
