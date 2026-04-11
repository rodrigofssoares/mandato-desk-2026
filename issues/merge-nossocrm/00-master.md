# 00 — Master: Merge Nosso CRM → Mandato Desk 2026

> Plano completo (com mockups, schema, justificativas): `~/.claude/plans/synchronous-waddling-pillow.md`

## Objetivo
Trazer 4 módulos do projeto "Nosso CRM — Thales Laray" (Next.js) para o Mandato Desk 2026 (Vite + React + Supabase): **Board**, **Tarefas**, **Visão Geral**, **Configurações** — mais **Campos Personalizados** como feature transversal.

## Decisões fechadas
1. **Board** = funis configuráveis de **contatos**, múltiplos boards, estágios customizáveis (drag-drop para reordenar).
2. **Tarefas** = tabela nova `tarefas` (NÃO mexer em `activities` que é audit log). Vista Lista + Calendário.
3. **Visão Geral** = evoluir Dashboard atual (rota `/`) com StatCards comparativos + funil do board ativo + feed de tarefas + alertas.
4. **Configurações** = hub `/settings` com abas absorvendo as 7 páginas dispersas atuais + abas novas (Funis, IA, Campos Personalizados).
5. **Campos Personalizados** = gerenciados em Settings → Geral, aparecem na aba "Personalizados" do contato, filtráveis na listagem.

## Sidebar
Antes: 13 itens. Depois: 9 itens (Dashboard, Contatos, Articuladores, Board🆕, Tarefas🆕, Demandas, Mapa, Importação, Configurações🆕).

## Novas tabelas Supabase
- `boards`, `board_stages`, `board_items`
- `tarefas`
- `campos_personalizados`, `campos_personalizados_valores`
- `ai_settings`

## Ordem de execução (Fases)
- **Fase 0 — Fundação (migrations)**: 10 → 11 → 12 → 13 (+ 14 Parte A junto com 13)
- **Fase 1 — Infra de testes + Hooks**: **15** → 20 → 21 → 22
- **Fase 2 — Settings Hub**: 32 → 33 → 34 → 35 (+ absorver abas existentes)
- **Fase 3 — Board**: 30 → 30b → 41
- **Fase 4 — Tarefas**: 31 → 31b → 42
- **Fase 5 — Visão Geral**: 40
- **Fase 6 — Fechamento**: 50 → 51 → 99 → 43

### Opcionais / Futuras (não bloqueantes do MVP)
- **14 Parte B** — Upgrade da `api_key` de texto plano para Supabase Vault/pgsodium. Executar só quando houver trigger real (compliance, incidente, multi-admin sensível).
- **98** — Sub-seções `configuracoes.*` no RBAC. Executar só quando o cliente pedir granularidade por aba.

## Convenções
- `/plan merge-nossocrm/NN` → enriquecer issue antes de executar
- `/execute merge-nossocrm/NN` → implementar
- Commit + push direto na `main` após cada issue
- Regenerar `src/integrations/supabase/types.ts` após cada migration
- **Dependências novas (apenas na issue 15)**: `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`. Nenhuma para o código de produção.
- `@dnd-kit`, `recharts`, `framer-motion`, `react-query`, `shadcn/ui` já instalados — sem instalação adicional para os módulos funcionais.

## Fora do escopo
- IA gerando conteúdo automaticamente (só infra de Central de IA)
- Multi-tenant
- Importação de tarefas em massa
- Sparkline nos StatCards
