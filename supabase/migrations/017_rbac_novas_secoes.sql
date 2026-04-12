-- Issue 99 (merge-nossocrm): RBAC para as novas seções board, tarefas, configuracoes
--
-- Contexto:
--   Até a issue 50 o Sidebar ganhou Board/Tarefas/Configurações com
--   `alwaysVisible: true` porque a matriz `permissoes_perfil` ainda não tinha
--   linhas para essas seções. Esta migration planta as linhas para as 5 roles
--   existentes (admin/proprietario/assessor/assistente/estagiario).
--
-- Política de idempotência:
--   `ON CONFLICT (role, secao) DO NOTHING` — preserva linhas já existentes.
--   Durante a pipeline merge-nossocrm algumas rows de `board`/`tarefas` já
--   foram inseridas manualmente; esta migration só completa as lacunas
--   (tipicamente as 5 rows de `configuracoes`).
--
-- Política de default para `configuracoes`:
--   - admin: acesso total
--   - proprietario: view-only (mesmo padrão de `permissoes`/`google`/`api`)
--   - demais roles: nenhum acesso
--   Granularidade por aba (geral/funis/ia/equipe/...) fica fora de escopo aqui
--   e pode ser endereçada pela issue 98.

INSERT INTO permissoes_perfil (role, secao, pode_ver, pode_criar, pode_editar, pode_deletar, pode_deletar_em_massa, so_proprio) VALUES
  -- ==================== BOARD ====================
  ('admin',        'board',         TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  FALSE),
  ('proprietario', 'board',         TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  FALSE),
  ('assessor',     'board',         TRUE,  TRUE,  TRUE,  FALSE, FALSE, FALSE),
  ('assistente',   'board',         TRUE,  FALSE, FALSE, FALSE, FALSE, FALSE),
  ('estagiario',   'board',         TRUE,  FALSE, FALSE, FALSE, FALSE, FALSE),

  -- ==================== TAREFAS ====================
  ('admin',        'tarefas',       TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  FALSE),
  ('proprietario', 'tarefas',       TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  FALSE),
  ('assessor',     'tarefas',       TRUE,  TRUE,  TRUE,  FALSE, FALSE, FALSE),
  ('assistente',   'tarefas',       TRUE,  TRUE,  TRUE,  FALSE, FALSE, TRUE),
  ('estagiario',   'tarefas',       TRUE,  FALSE, FALSE, FALSE, FALSE, FALSE),

  -- ==================== CONFIGURACOES ====================
  ('admin',        'configuracoes', TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  FALSE),
  ('proprietario', 'configuracoes', TRUE,  FALSE, FALSE, FALSE, FALSE, FALSE),
  ('assessor',     'configuracoes', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('assistente',   'configuracoes', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('estagiario',   'configuracoes', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE)
ON CONFLICT (role, secao) DO NOTHING;
