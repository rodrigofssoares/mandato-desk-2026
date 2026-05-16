-- ============================================================================
-- Migration 052: Indice de performance para listagem de contatos
-- ============================================================================
-- Bug [RAQ-MAND-EM072]: queries da tabela contacts (24k+ linhas) faziam
-- Seq Scan + sort em memoria, intermitentemente estourando o statement_timeout
-- (~8s) com o erro "canceling statement due to statement timeout".
--
-- Causa confirmada (EXPLAIN ANALYZE + pg_stat_statements):
--   - Nao havia indice em created_at, que e o ORDER BY de useContacts (sort
--     padrao) e da paginacao de useDuplicateCount / useDuplicateGroups.
--   - O unico indice em merged_into era parcial WHERE merged_into IS NOT NULL
--     — polaridade OPOSTA ao filtro real das queries (merged_into IS NULL),
--     portanto inutilizavel por elas.
--   Resultado medido: 1531ms por pagina de 1000 linhas; pg_stat_statements
--   registrou ate 7836ms sob carga.
--
-- Fix: indice parcial em created_at filtrado por merged_into IS NULL. Cobre
-- de uma vez o filtro (merged_into IS NULL) E o ORDER BY (btree e escaneavel
-- nas duas direcoes — serve created_at ASC e DESC). Segue o padrao dos demais
-- indices parciais ja existentes em contacts (idx_contacts_declarou_voto etc).
--
-- Rollback:
--   DROP INDEX IF EXISTS public.idx_contacts_ativos_created_at;
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_contacts_ativos_created_at
  ON public.contacts (created_at)
  WHERE merged_into IS NULL;

COMMENT ON INDEX public.idx_contacts_ativos_created_at IS
  'Acelera listagem e paginacao de contatos ativos (useContacts, '
  'useDuplicateCount, useDuplicateGroups). Parcial WHERE merged_into IS NULL '
  'para casar com o filtro real das queries; cobre o ORDER BY created_at.';
