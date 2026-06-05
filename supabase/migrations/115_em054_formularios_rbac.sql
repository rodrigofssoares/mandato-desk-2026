-- RAQ-MAND-EM054 — Construtor de formulários web: RBAC (matriz de permissões)
--
-- Why: Planta as 5 linhas de permissão para a seção 'formularios' na matriz
--      permissoes_perfil, habilitando o helper has_permission() e o sidebar
--      a controlar o acesso por cargo.
-- Reference: RAQ-MAND-EM054
-- Risk: baixa — apenas INSERT com ON CONFLICT DO NOTHING
-- Rollback:
--   DELETE FROM permissoes_perfil WHERE secao = 'formularios';
--
-- Política de permissões decidida:
--   admin        → acesso total (ver+criar+editar+deletar+massa)
--   proprietario → acesso total (ver+criar+editar+deletar+massa)
--   assessor     → ver+criar+editar, sem deletar, sem massa
--   assistente   → somente ver
--   estagiario   → sem acesso algum

INSERT INTO public.permissoes_perfil
  (role, secao, pode_ver, pode_criar, pode_editar, pode_deletar, pode_deletar_em_massa, so_proprio)
VALUES
  ('admin',        'formularios', TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  FALSE),
  ('proprietario', 'formularios', TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  FALSE),
  ('assessor',     'formularios', TRUE,  TRUE,  TRUE,  FALSE, FALSE, FALSE),
  ('assistente',   'formularios', TRUE,  FALSE, FALSE, FALSE, FALSE, FALSE),
  ('estagiario',   'formularios', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE)
ON CONFLICT (role, secao) DO NOTHING;
