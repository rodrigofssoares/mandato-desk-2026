# 01 — Protótipo: Board (Funis Configuráveis)

**Tipo:** Protótipo visual (sem dados reais, só layout)
**Fase:** 3
**Depende de:** —
**Desbloqueia:** 30-func-page-board

## Objetivo
Construir a página `/board` com layout do Kanban, dropdown de boards, cards fake, drag-drop visual funcionando (sem persistir). Serve de esqueleto para a implementação funcional.

## Wireframe de referência
```
╔══ BOARD ═══════════════════════════════════════════════════╗
║ Board: Seguidores ▼  [+ Novo Board] [⚙ Editar Estágios]   ║
║ 🔍 Buscar  |  Articulador: Todos ▼  |  [Kanban|Lista]      ║
╠════════════════════════════════════════════════════════════╣
║ NOVO SEG. │ PEDIU FORM│ PREENCHEU │ CONTATO │ DECLAROU    ║
║   (42)    │   (28)    │   (19)    │   (11)  │   (7)       ║
║ ┌───────┐ │ ┌───────┐ │ ┌───────┐ │ ┌─────┐ │ ┌───────┐   ║
║ │Maria S│ │ │João M │ │ │Ana P  │ │ │Carlo│ │ │Luis R │   ║
║ │📍Sul  │ │ │📍Cent │ │ │📍Barra│ │ │📍Les│ │ │📍Norte│   ║
║ │🏷saúde│ │ │🏷educ │ │ │⭐favor│ │ │✅dec│ │ │🏷infra│   ║
║ │2 tar. │ │       │ │ │⚠5d    │ │ │     │ │ │       │   ║
║ └───────┘ │ └───────┘ │ └───────┘ │ └─────┘ │ └───────┘   ║
╚════════════════════════════════════════════════════════════╝
```

## Arquivos a criar
- `src/pages/Board.tsx`
- `src/components/board/BoardKanban.tsx`
- `src/components/board/BoardColumn.tsx`
- `src/components/board/BoardCard.tsx`
- `src/components/board/BoardSelector.tsx`

## Critérios de Aceite
- [ ] Rota `/board` declarada em `src/App.tsx`
- [ ] Layout renderiza com 5 colunas mockadas
- [ ] 4-6 cards fake por coluna
- [ ] Drag-drop entre colunas funcional (só estado local, sem Supabase)
- [ ] Seletor de board mostra 2 opções mockadas ("Seguidores", "Ação de Rua")
- [ ] Toggle Kanban/Lista visível (Lista pode ser stub)
- [ ] Responsivo no mobile (scroll horizontal)

## Como testar
- `npm run dev` → acessar `/board`
- Arrastar card → deve mover
- Trocar board no dropdown → deve re-renderizar colunas mockadas
