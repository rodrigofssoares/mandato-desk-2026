-- ============================================================================
-- Migration 049: RBAC para 'ordenacao_filtros' e 'whatsapp' — somente admin
-- ============================================================================
-- Define a regra solicitada pelo Rodrigo: apenas administradores podem ver e
-- editar as seções "Ordenação de Filtros" e "WhatsApp". As demais roles
-- (proprietario, assessor, assistente, estagiario) ficam sem nenhum acesso.
--
-- Estratégia: UPSERT (DO UPDATE SET) — força o estado correto mesmo se
-- linhas anteriores já existirem com flags abertas (ex: seed antigo dava
-- ordenacao_filtros para proprietario e assessor).
--
-- Reference: pedido direto do Rodrigo após implementação Z-API.
-- Rollback: rodar seed via /permissoes (botão Restaurar Padrão).
-- ============================================================================

INSERT INTO public.permissoes_perfil
  (role, secao, pode_ver, pode_criar, pode_editar, pode_deletar, pode_deletar_em_massa, so_proprio) VALUES
  -- ==================== ORDENACAO_FILTROS ====================
  ('admin',        'ordenacao_filtros', TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  FALSE),
  ('proprietario', 'ordenacao_filtros', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('assessor',     'ordenacao_filtros', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('assistente',   'ordenacao_filtros', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('estagiario',   'ordenacao_filtros', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),

  -- ==================== WHATSAPP ====================
  ('admin',        'whatsapp',          TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  FALSE),
  ('proprietario', 'whatsapp',          FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('assessor',     'whatsapp',          FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('assistente',   'whatsapp',          FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('estagiario',   'whatsapp',          FALSE, FALSE, FALSE, FALSE, FALSE, FALSE)

ON CONFLICT (role, secao) DO UPDATE SET
  pode_ver              = EXCLUDED.pode_ver,
  pode_criar            = EXCLUDED.pode_criar,
  pode_editar           = EXCLUDED.pode_editar,
  pode_deletar          = EXCLUDED.pode_deletar,
  pode_deletar_em_massa = EXCLUDED.pode_deletar_em_massa,
  so_proprio            = EXCLUDED.so_proprio;
