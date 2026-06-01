-- ============================================================================
-- Migration 102: CHECK constraint em ai_chat_messages.content
-- ============================================================================
-- PEN-004 [ALTA] Resposta do LLM sem CHECK de tamanho — XSS persistente cross-user
--
-- A coluna content era TEXT NOT NULL sem limite de tamanho.
-- LLM controlado via prompt injection (PEN-001) poderia gerar 50KB+ de conteúdo
-- malicioso que travaria o renderer do frontend (DoS no DOM).
-- Junto com sanitização na EF, este CHECK é a defesa em profundidade no banco.
-- ============================================================================

ALTER TABLE public.ai_chat_messages
  ADD CONSTRAINT ai_chat_messages_content_len
  CHECK (char_length(content) <= 50000);

COMMENT ON CONSTRAINT ai_chat_messages_content_len ON public.ai_chat_messages IS
  'PEN-004: limita content a 50.000 chars. Previne DoS no DOM do frontend via resposta gigante do LLM manipulado.';
