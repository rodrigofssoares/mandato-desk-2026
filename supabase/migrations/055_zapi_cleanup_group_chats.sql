-- ============================================================================
-- Migration 055: limpeza one-shot de chats de grupo existentes em zapi_chats
-- ============================================================================
-- Objetivo:
--   Remover todos os registros de grupos de WhatsApp acumulados antes da
--   implantação do guard de grupos (T03/054). Sem esta migration, a lista
--   de conversas continua exibindo os ~18 grupos identificados.
--
-- Critério de identificação de grupo (OR de duas condições):
--   1. length(regexp_replace(phone, '[^0-9]', '', 'g')) > 15
--      → Mais de 15 dígitos após extrair apenas dígitos.
--        Telefones BR têm ≤ 13 dígitos; LIDs têm ≤ 15 dígitos.
--        Grupos do WhatsApp têm 16-18 dígitos.
--   2. phone ~ '^\d+-\d+'
--      → Formato JID antigo de grupo: "XXXXXXXX-XXXXXXXXXX" (sem @g.us).
--        Ex: "120363404150361931-group" ou "556199189290-1386251212".
--
-- FK CASCADE:
--   A constraint zapi_messages_chat_id_fkey tem ON DELETE CASCADE (confirmado).
--   Deletar de zapi_chats apaga automaticamente as mensagens vinculadas.
--   Nenhum DELETE explícito em zapi_messages é necessário.
--
-- Idempotência:
--   DELETE WHERE sem linhas correspondentes retorna 0 rowcount — sem erro.
--   Pode ser reaplicada sem efeito colateral.
--
-- Rollback manual: impossível — dados de grupos não são retidos.
--   (Rodrigo confirmou que não há necessidade de retenção.)
--
-- Chats protegidos (NÃO tocados por esta migration):
--   - Telefones BR normais: ≤ 13 dígitos (ex: 556184299707 = 12 dígitos)
--   - LIDs legítimos: ex: '151415313924248@lid' — regexp_replace retorna
--     '151415313924248' = 15 dígitos, não > 15. Padrão \d+-\d+ não casa
--     porque o separador '-' não aparece antes de '@lid'.
--
-- Referência: RAQ-MAND-EM072B — T02.
-- ============================================================================

DO $$
DECLARE
  cnt_grupos   INT;
  cnt_restante INT;
BEGIN
  -- Conta grupos ANTES da deleção para logar
  SELECT count(*)
    INTO cnt_grupos
    FROM public.zapi_chats
   WHERE length(regexp_replace(phone, '[^0-9]', '', 'g')) > 15
      OR phone ~ '^\d+-\d+';

  RAISE NOTICE 'Migration 055: chats de grupo encontrados para deleção: %', cnt_grupos;

  -- Deleta grupos (mensagens cascateiam via FK ON DELETE CASCADE)
  DELETE FROM public.zapi_chats
   WHERE length(regexp_replace(phone, '[^0-9]', '', 'g')) > 15
      OR phone ~ '^\d+-\d+';

  -- Conta restantes para auditoria
  SELECT count(*)
    INTO cnt_restante
    FROM public.zapi_chats;

  RAISE NOTICE 'Migration 055: deleção concluída. Chats restantes: %', cnt_restante;
END
$$;
