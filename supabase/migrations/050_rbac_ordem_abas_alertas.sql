-- ============================================================================
-- Migration 050: RBAC para 'ordem_abas' e 'alertas'
-- ============================================================================
-- Define os defaults por role para as seções "Ordem das Abas" e "Alertas"
-- conforme aprovado por Rodrigo em 2026-05-11 (RAQ-MAND-EM068-T01).
--
-- Estratégia: UPSERT (ON CONFLICT DO UPDATE SET) — idempotente, pode ser
-- rodado N vezes sem duplicar linhas nem gerar erro.
--
-- Mapeamento semântico das flags para estas seções:
--
-- ordem_abas:
--   pode_ver              = ver a aba + ver a lista de itens da sidebar
--   pode_editar           = arrastar itens e salvar nova ordem
--   pode_criar            = não usado (FALSE) — não há criação de objetos
--   pode_deletar          = não usado (FALSE)
--   pode_deletar_em_massa = não usado (FALSE)
--   so_proprio            = não aplicável (FALSE)
--
-- alertas:
--   pode_ver              = ver a lista de alertas dispensados
--   pode_deletar          = apagar alerta individual
--   pode_deletar_em_massa = apagar todos / apagar antigos (botões em massa)
--   pode_criar            = não usado (FALSE)
--   pode_editar           = não usado (FALSE)
--   so_proprio            = não aplicável (FALSE)
--
-- Rollback: rodar seed via /settings (botão Restaurar Padrão) ou migration reversa.
-- Reference: RAQ-MAND-EM068, task T01.
-- ============================================================================

INSERT INTO public.permissoes_perfil
  (role, secao, pode_ver, pode_criar, pode_editar, pode_deletar, pode_deletar_em_massa, so_proprio) VALUES
  -- ==================== ORDEM_ABAS ====================
  -- admin, proprietario, assessor: podem ver + editar (arrastar e salvar)
  -- assistente: pode ver mas NÃO editar (somente-leitura)
  -- estagiario: SEM acesso à aba
  ('admin',        'ordem_abas', TRUE,  FALSE, TRUE,  FALSE, FALSE, FALSE),
  ('proprietario', 'ordem_abas', TRUE,  FALSE, TRUE,  FALSE, FALSE, FALSE),
  ('assessor',     'ordem_abas', TRUE,  FALSE, TRUE,  FALSE, FALSE, FALSE),
  ('assistente',   'ordem_abas', TRUE,  FALSE, FALSE, FALSE, FALSE, FALSE),
  ('estagiario',   'ordem_abas', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),

  -- ==================== ALERTAS ====================
  -- admin, proprietario: ver + apagar individual + apagar em massa
  -- assessor: ver + apagar individual, SEM apagar em massa
  -- assistente: ver + apagar individual, SEM apagar em massa
  -- estagiario: somente ver (sem nenhum botão de exclusão)
  ('admin',        'alertas',    TRUE,  FALSE, FALSE, TRUE,  TRUE,  FALSE),
  ('proprietario', 'alertas',    TRUE,  FALSE, FALSE, TRUE,  TRUE,  FALSE),
  ('assessor',     'alertas',    TRUE,  FALSE, FALSE, TRUE,  FALSE, FALSE),
  ('assistente',   'alertas',    TRUE,  FALSE, FALSE, TRUE,  FALSE, FALSE),
  ('estagiario',   'alertas',    TRUE,  FALSE, FALSE, FALSE, FALSE, FALSE)

ON CONFLICT (role, secao) DO UPDATE SET
  pode_ver              = EXCLUDED.pode_ver,
  pode_criar            = EXCLUDED.pode_criar,
  pode_editar           = EXCLUDED.pode_editar,
  pode_deletar          = EXCLUDED.pode_deletar,
  pode_deletar_em_massa = EXCLUDED.pode_deletar_em_massa,
  so_proprio            = EXCLUDED.so_proprio;
