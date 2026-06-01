-- ============================================================================
-- Migration 101: RPC ai_record_assistant_message — INSERT atômico de msg+custo
-- ============================================================================
-- PEN-003 [ALTA] Cost insert fail-open silencioso
--
-- O INSERT em ai_chat_messages_cost era best-effort com .catch silencioso.
-- Se falhasse, o custo não era contabilizado e auto_block_at_100 nunca disparava.
-- Atacante poderia consumir ilimitado do budget do provider sem detecção.
--
-- Fix: RPC única que insere a mensagem do assistente E o custo na MESMA transação.
-- Ou ambos entram, ou nenhum. Atomicidade do Postgres garante consistência.
-- A EF passa todos os dados necessários e obtém o ID da mensagem como retorno.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.ai_record_assistant_message(
  p_session_id     UUID,
  p_content        TEXT,
  p_provider       TEXT,
  p_model_id       TEXT,
  p_tokens_input   INT,
  p_tokens_output  INT,
  p_total_tokens   INT,
  p_cost_brl_input  NUMERIC,
  p_cost_brl_output NUMERIC,
  p_total_cost_brl  NUMERIC,
  p_user_id        UUID
)
  RETURNS JSONB
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  v_message_id UUID;
BEGIN
  -- INSERT da mensagem do assistente
  INSERT INTO public.ai_chat_messages (
    session_id,
    role,
    content,
    provider,
    model_id,
    tokens_input,
    tokens_output,
    total_tokens
  )
  VALUES (
    p_session_id,
    'assistant',
    p_content,
    p_provider,
    p_model_id,
    p_tokens_input,
    p_tokens_output,
    p_total_tokens
  )
  RETURNING id INTO v_message_id;

  -- INSERT do custo na mesma transação — se falhar, a mensagem NÃO entra
  INSERT INTO public.ai_chat_messages_cost (
    message_id,
    message_id_fk,
    user_id,
    provider,
    model_id,
    tokens_input,
    tokens_output,
    cost_brl_input,
    cost_brl_output,
    total_cost_brl
  )
  VALUES (
    v_message_id,
    v_message_id,
    p_user_id,
    p_provider,
    p_model_id,
    p_tokens_input,
    p_tokens_output,
    p_cost_brl_input,
    p_cost_brl_output,
    p_total_cost_brl
  );

  RETURN jsonb_build_object('message_id', v_message_id);
END;
$$;

-- Acesso restrito: apenas service_role (usado pela Edge Function)
REVOKE EXECUTE ON FUNCTION public.ai_record_assistant_message FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.ai_record_assistant_message TO service_role;

COMMENT ON FUNCTION public.ai_record_assistant_message IS
  'PEN-003: insere mensagem do assistente e custo atomicamente. Se o INSERT do custo falhar, o da mensagem é revertido — elimina o fail-open silencioso que permitia consumo ilimitado sem rastreamento.';
