# 34 — Aba Funis: Gerenciar boards e estágios

**Tipo:** Funcional
**Fase:** 2
**Depende de:** 20-func-hooks-boards, 32-func-page-settings-hub
**Desbloqueia:** 30-func-page-board (sem isso, não dá para criar boards fora do Board)

## Objetivo
Implementar a aba "Funis" em Settings, permitindo criar/editar/deletar boards e gerenciar os estágios de cada um (reusando `BoardStagesManager`).

## Arquivos a criar/modificar
- `src/components/settings/FunisTab.tsx`
- `src/components/settings/BoardsListPanel.tsx`
- `src/components/settings/BoardFormDialog.tsx` (criar/editar board)

## Layout
```
╔══ Funis ═══════════════════════════════════════════════════╗
║ [+ Novo Board]                                              ║
║                                                             ║
║ ┌─────────────────────────────────────────────────────┐   ║
║ │ 🏁 Seguidores                          ✏ 🗑 ⭐default│   ║
║ │ "Jornada do eleitor da pré-campanha"                │   ║
║ │ 6 estágios · 42 contatos                            │   ║
║ │ ▼ Expandir estágios                                 │   ║
║ │   ═ Novo Seguidor  ═ Pediu Form.  ═ Preencheu ...  │   ║
║ │   [Usar BoardStagesManager aqui dentro]             │   ║
║ └─────────────────────────────────────────────────────┘   ║
║                                                             ║
║ ┌─────────────────────────────────────────────────────┐   ║
║ │ 🚶 Ação de Rua                          ✏ 🗑         │   ║
║ │ 5 estágios · 18 contatos                            │   ║
║ └─────────────────────────────────────────────────────┘   ║
╚════════════════════════════════════════════════════════════╝
```

## Ações
- **+ Novo Board** → dialog: nome, descrição, marcar como default, estágios iniciais (mínimo 2)
- **Expandir** → mostra `BoardStagesManager` inline para drag-drop de estágios
- **✏ Editar board** → dialog com mesmos campos
- **🗑 Deletar board** → confirmação "Isso apagará N posicionamentos de contatos. Continuar?"
- **⭐ default** → marca board como padrão (só 1 pode ser default)

## Critérios de Aceite
- [ ] Listagem de boards real
- [ ] Criar novo board com estágios iniciais
- [ ] Expandir mostra `BoardStagesManager` (reusado do módulo Board)
- [ ] Drag-drop de estágios persiste
- [ ] Editar e deletar funcionam com confirmação
- [ ] Default toggle garante unicidade (só 1 default ativo)
- [ ] Contadores (N estágios · N contatos) corretos
- [ ] Build passa

## Verificação
- Criar board "Teste" com 3 estágios
- Arrastar estágio para reordenar → verificar no Supabase
- Marcar outro board como default → confirmar que o anterior perdeu a flag
- Deletar board → confirmar cascade em `board_items`
