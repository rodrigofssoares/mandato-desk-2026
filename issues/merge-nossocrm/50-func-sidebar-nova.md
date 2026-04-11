# 50 — Sidebar: NAV_ITEMS reorganizado

**Tipo:** Funcional
**Fase:** 6
**Depende de:** 30-func-page-board, 31-func-page-tarefas, 32-func-page-settings-hub
**Desbloqueia:** 51-func-redirects-legacy-settings

## Objetivo
Atualizar o array `NAV_ITEMS` em `src/components/layout/AppSidebar.tsx` para refletir a nova estrutura: adicionar Board, Tarefas e Configurações (hub); remover os 7 itens que viraram abas de Settings.

## Arquivo a modificar
- `src/components/layout/AppSidebar.tsx`

## Diff alvo
```diff
 const NAV_ITEMS = [
   { nome: 'Dashboard',     icon: LayoutDashboard, href: '/',           secao: 'dashboard' },
   { nome: 'Contatos',      icon: Users,           href: '/contacts',   secao: 'contatos' },
   { nome: 'Articuladores', icon: Crown,           href: '/leaders',    secao: 'liderancas' },
+  { nome: 'Board',         icon: KanbanSquare,    href: '/board',      secao: 'board' },
+  { nome: 'Tarefas',       icon: CheckSquare,     href: '/tarefas',    secao: 'tarefas' },
   { nome: 'Demandas',      icon: ClipboardList,   href: '/demands',    secao: 'demandas' },
-  { nome: 'Etiquetas',     icon: Tags,            href: '/tags',       secao: 'etiquetas' },
   { nome: 'Mapa',          icon: MapPin,          href: '/leads-map',  secao: 'mapa' },
   { nome: 'Importação',    icon: Upload,          href: '/bulk-import',secao: 'importacao' },
-  { nome: 'Usuários',      icon: UserCog,         href: '/users',      secao: 'usuarios' },
-  { nome: 'Permissões',    icon: Shield,          href: '/permissoes', secao: 'permissoes' },
-  { nome: 'Google',        icon: Globe,           href: '/google-integration', secao: 'google' },
-  { nome: 'API',           icon: Code,            href: '/api',        secao: 'api' },
-  { nome: 'Webhooks',      icon: Webhook,         href: '/webhooks',   secao: 'webhooks' },
-  { nome: 'Personalização',icon: Palette,         href: '/branding',   secao: 'personalizacao' },
+  // ─── separator ───
+  { nome: 'Configurações', icon: Settings,        href: '/settings',   secao: 'configuracoes' },
 ];
```

## Nota sobre separator
Se o componente da sidebar suportar separators nativamente, usar. Se não, pode ser um item especial com `type: 'separator'`.

## Ícones Lucide
Verificar disponibilidade:
- `KanbanSquare` ✅
- `CheckSquare` ✅
- `Settings` ✅ (já usado em outros lugares)

## Critérios de Aceite
- [ ] Sidebar mostra 9 itens (+ separator) em vez de 13
- [ ] 3 novos itens (Board, Tarefas, Configurações) aparecem na ordem correta
- [ ] Os 7 itens removidos não aparecem
- [ ] Ícones carregam corretamente
- [ ] Item ativo é destacado (active state)
- [ ] Collapse/expand da sidebar continua funcionando
- [ ] Permissões: itens com `secao` que o usuário não tem `pode_ver` ficam ocultos
- [ ] Build passa

## Verificação
- Abrir o app → contar itens da sidebar (deve ser 9)
- Clicar em "Configurações" → abre `/settings`
- Logar com usuário sem permissão em `board` → item Board não aparece
