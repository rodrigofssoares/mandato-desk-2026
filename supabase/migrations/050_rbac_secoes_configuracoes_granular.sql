-- ============================================================================
-- Migration 050: RBAC granular para sub-abas de Configurações + Design System
-- ============================================================================
-- Endereça o ponto deixado em aberto pela 017_rbac_novas_secoes.sql:
--   "Granularidade por aba (geral/funis/ia/equipe/...) fica fora de escopo
--    aqui e pode ser endereçada pela issue 98."
--
-- Sub-abas hoje presentes em /settings que ainda não tinham seção própria:
--   - geral  (Campos Personalizados)  → configuracoes_geral
--   - funis  (Gestão de funis)        → configuracoes_funis
--   - ia     (Chaves/modelos de IA)   → configuracoes_ia
--
-- Páginas standalone fora de /settings:
--   - /design-system (catálogo visual dos primitives) → design_system
--
-- Sub-abas NÃO incluídas (preferências pessoais — não precisam RBAC global):
--   - nav-ordem (ordem das abas, salvo em localStorage)
--   - alertas   (dispensas de alerta por usuário)
--
-- Política de idempotência: `ON CONFLICT (role, secao) DO NOTHING`
--   → preserva qualquer ajuste manual já feito via Permission Matrix UI.
--
-- Defaults conservadores:
--   - admin:        CRUD total (acesso de gestão completo)
--   - proprietario: view-only (mesmo padrão de `configuracoes` na 017)
--                   exceto `configuracoes_ia` (chaves de API sensíveis = só admin)
--   - demais roles: nenhum acesso (admin libera via UI quando necessário)
-- ============================================================================

INSERT INTO public.permissoes_perfil
  (role, secao, pode_ver, pode_criar, pode_editar, pode_deletar, pode_deletar_em_massa, so_proprio) VALUES
  -- ==================== CONFIGURACOES_GERAL (Campos Personalizados) ====================
  ('admin',        'configuracoes_geral', TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  FALSE),
  ('proprietario', 'configuracoes_geral', TRUE,  FALSE, FALSE, FALSE, FALSE, FALSE),
  ('assessor',     'configuracoes_geral', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('assistente',   'configuracoes_geral', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('estagiario',   'configuracoes_geral', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),

  -- ==================== CONFIGURACOES_FUNIS ====================
  ('admin',        'configuracoes_funis', TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  FALSE),
  ('proprietario', 'configuracoes_funis', TRUE,  FALSE, FALSE, FALSE, FALSE, FALSE),
  ('assessor',     'configuracoes_funis', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('assistente',   'configuracoes_funis', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('estagiario',   'configuracoes_funis', FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),

  -- ==================== CONFIGURACOES_IA (chaves/modelos — sensível) ====================
  ('admin',        'configuracoes_ia',    TRUE,  TRUE,  TRUE,  TRUE,  TRUE,  FALSE),
  ('proprietario', 'configuracoes_ia',    FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('assessor',     'configuracoes_ia',    FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('assistente',   'configuracoes_ia',    FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('estagiario',   'configuracoes_ia',    FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),

  -- ==================== DESIGN_SYSTEM (catálogo dev — read-only por natureza) ====================
  ('admin',        'design_system',       TRUE,  FALSE, FALSE, FALSE, FALSE, FALSE),
  ('proprietario', 'design_system',       TRUE,  FALSE, FALSE, FALSE, FALSE, FALSE),
  ('assessor',     'design_system',       FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('assistente',   'design_system',       FALSE, FALSE, FALSE, FALSE, FALSE, FALSE),
  ('estagiario',   'design_system',       FALSE, FALSE, FALSE, FALSE, FALSE, FALSE)

ON CONFLICT (role, secao) DO NOTHING;

-- ============================================================================
-- Verificação rápida (executar manualmente após aplicar):
--   SELECT role, COUNT(*) FROM public.permissoes_perfil GROUP BY role;
--   → cada role deve ter o MESMO número de linhas (= total de seções).
-- ============================================================================
