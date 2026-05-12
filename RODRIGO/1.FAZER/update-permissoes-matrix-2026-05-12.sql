-- ============================================================================
-- /rbac-atualizar — 2026-05-12 — Mandato Desk 2026
-- ============================================================================
-- Para rodar manualmente no Supabase SQL Editor caso `supabase db push` não
-- esteja disponível (variant standalone da migration 050).
--
-- Re-escaneamento detectou 4 seções novas:
--   1. configuracoes_geral  — Configurações › Geral (Campos Personalizados)
--   2. configuracoes_funis  — Configurações › Funis
--   3. configuracoes_ia     — Configurações › IA
--   4. design_system        — Design System (catálogo dev)
--
-- Sub-abas descartadas (preferências pessoais — não RBAC):
--   - nav-ordem (localStorage)
--   - alertas (dispensas por usuário)
--
-- Idempotência: ON CONFLICT DO NOTHING → preserva ajustes manuais.
-- Pós-execução: mover este arquivo para RODRIGO/3.FEITO/
-- ============================================================================

INSERT INTO public.permissoes_perfil
  (role, secao, pode_ver, pode_criar, pode_editar, pode_deletar, pode_deletar_em_massa, so_proprio) VALUES
  ('admin',        'configuracoes_geral', TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  FALSE),
  ('proprietario', 'configuracoes_geral', TRUE,  FALSE, FALSE, FALSE, FALSE, FALSE),
  ('assessor',     'configuracoes_geral', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('assistente',   'configuracoes_geral', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('estagiario',   'configuracoes_geral', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),

  ('admin',        'configuracoes_funis', TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  FALSE),
  ('proprietario', 'configuracoes_funis', TRUE,  FALSE, FALSE, FALSE, FALSE, FALSE),
  ('assessor',     'configuracoes_funis', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('assistente',   'configuracoes_funis', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('estagiario',   'configuracoes_funis', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),

  ('admin',        'configuracoes_ia',    TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  FALSE),
  ('proprietario', 'configuracoes_ia',    FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('assessor',     'configuracoes_ia',    FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('assistente',   'configuracoes_ia',    FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('estagiario',   'configuracoes_ia',    FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),

  ('admin',        'design_system',       TRUE,  FALSE, FALSE, FALSE, FALSE, FALSE),
  ('proprietario', 'design_system',       TRUE,  FALSE, FALSE, FALSE, FALSE, FALSE),
  ('assessor',     'design_system',       FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('assistente',   'design_system',       FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('estagiario',   'design_system',       FALSE, FALSE, FALSE, FALSE, FALSE, FALSE)

ON CONFLICT (role, secao) DO NOTHING;

-- Verificação:
SELECT role, COUNT(*) AS total FROM public.permissoes_perfil GROUP BY role ORDER BY role;
