# Backlog — Ordem Personalizada das Abas da Navegação

**Cliente:** Raquel Auxiliadora — Mandato Desk 2026
**Código QG:** RAQ-MAND-EM064
**Briefing/Refinamento:** RODRIGO/2.FAZENDO/RAQ-MAND-EM064-PO-refinamento.md
**Backlog escrito por:** Agente Backlog — 2026-05-09

---

## Walking Skeleton

T01 — `useNavOrder` hook já entrega persistência+merge defensivo end-to-end. T02 e T03 constroem sobre ele, em ordem estrita de dependência.

## Ordem de execução (dependências + WSJF)

| # | ID | Título | Agente principal | Estimativa | Depende de |
|---|----|--------|-----------------|------------|------------|
| 1 | T01 | Criar `useNavOrder` hook + tipos + storage | hook-writer | S (2pt) | — |
| 2 | T02 | Criar `NavOrderTab` — componente de ordenação na Settings | component-writer | S (2pt) | T01 |
| 3 | T03 | Integrar `useNavOrder` em `AppSidebar.tsx` + `Settings.tsx` | component-writer | S (2pt) | T01, T02 |

**Total estimado:** 6pt — 3 tasks, todas S (2pt)

---

## Tasks

### T01 — Criar `useNavOrder` hook + tipos + storage

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** action, hook
**Depende de:** —
**WSJF score:** (4 + 3 + 2) / 2 = 4,5

#### User story

Como operador do gabinete que vai usar drag-and-drop de abas, quero que o sistema persista minha ordem customizada no navegador e a carregue automaticamente, para que minha preferência sobreviva reloads e sessões sem depender de servidor.

#### Contexto

Esta task cria a única fonte de verdade da feature. Espelha diretamente `src/hooks/useFilterOrder.ts` (RAQ-MAND-EM063), que já está em produção e validado. A diferença principal é que `useNavOrder` **não** tem `canReorder` (qualquer usuário autenticado pode reordenar — decisão fechada no PO) e opera sobre `NavItemKey` (literal union das seções da sidebar) em vez de `FilterSegmentKey`. O merge defensivo garante robustez para novas seções adicionadas ao `NAV_ITEMS` no futuro.

#### Arquivos-alvo

- `src/hooks/useNavOrder.ts` — arquivo novo

#### Critérios de aceite

- [ ] Exporta constante `NAV_ORDER_STORAGE_KEY = 'mandato:nav-order:v1'`
- [ ] Exporta tipo `NavItemKey` — literal union com todas as `secao` presentes no `NAV_ITEMS` de `AppSidebar.tsx` que aparecem na sidebar (exceto `configuracoes`): `'dashboard' | 'contatos' | 'liderancas' | 'board' | 'tarefas' | 'demandas' | 'etiquetas' | 'mapa' | 'importacao' | 'campanha'`
- [ ] Exporta constante `DEFAULT_NAV_ORDER: NavItemKey[]` com a sequência padrão atual do `NAV_ITEMS`
- [ ] Exporta `NAV_ITEM_LABELS: Record<NavItemKey, string>` — mapeamento para exibição no componente
- [ ] Hook `useNavOrder()` retorna `{ order, setOrder, resetOrder }` (sem `canReorder`, sem `isLoading`)
- [ ] `readFromStorage()` lê `localStorage` e aplica merge defensivo: filtra chaves inválidas, appende chaves faltantes ao fim (antes de Configurações) — comportamento idêntico ao `readFromStorage` de `useFilterOrder.ts`
- [ ] `setOrder(next)` persiste em localStorage com merge defensivo de chaves faltantes
- [ ] `resetOrder()` remove a chave do localStorage e volta ao `DEFAULT_NAV_ORDER`
- [ ] Listener de `storage` event sincroniza estado entre abas do mesmo navegador
- [ ] Fallback silencioso quando `localStorage` não está disponível (modo incógnito, SSR): usa `DEFAULT_NAV_ORDER`

#### Hints técnicos

- **Pattern existente:** `src/hooks/useFilterOrder.ts` — copiar estrutura, substituir tipos e constantes
- **Tipos:** `NavItemKey` isolado do tipo `Secao` existente em `src/types/permissions.ts` para não contaminar o contrato de permissões. Use apenas as secoes que de fato têm item na sidebar (exclui `configuracoes`, `usuarios`, `permissoes`, `google`, `api`, `webhooks`, `personalizacao`, `relatorios`, `ordenacao_filtros` — que não aparecem como itens diretos em `NAV_ITEMS`)
- **Sem dependência de Supabase:** hook puro de localStorage + estado React

#### Test plan manual

1. Abrir DevTools → Application → localStorage
2. Confirmar que a chave `mandato:nav-order:v1` não existe ainda
3. Chamar `setOrder(['demandas', 'dashboard', ...resto])` via console (ou abrir o componente da T02)
4. Confirmar que a chave foi criada com o array correto
5. Recarregar a página — confirmar que o hook retorna a ordem salva
6. Chamar `resetOrder()` — confirmar que a chave foi removida e `order` volta ao default
7. Abrir segunda aba, alterar ordem na primeira — confirmar que a segunda sincroniza

#### Riscos

- `NavItemKey` pode ficar desatualizada se `NAV_ITEMS` crescer sem atualizar o tipo — mitigação: documentar no hook que ao adicionar item em `NAV_ITEMS` deve-se adicionar a chave em `NavItemKey` e `DEFAULT_NAV_ORDER`
- Conflito de nome com `Secao` — mitigado por ser tipo separado com nome distinto

#### Definition of Done

- [ ] Critérios de aceite acima todos satisfeitos
- [ ] `npm run lint` sem erros
- [ ] `npm run build` sem erros de tipo
- [ ] Smoke test manual executado (itens 1-7 acima)
- [ ] Commit semântico: `feat(nav-order): cria useNavOrder hook com storage e merge defensivo`

---

### T02 — Criar `NavOrderTab` — componente de ordenação na Settings

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** component
**Depende de:** T01
**WSJF score:** (4 + 3 + 2) / 2 = 4,5

#### User story

Como operador do gabinete em Configurações → "Ordem das Abas", quero ver a lista das minhas abas visíveis e arrastá-las para reordenar, para que eu controle visualmente qual seção aparece primeiro na sidebar.

#### Contexto

Espelha `src/components/settings/FilterOrderTab.tsx` com duas diferenças estruturais: (1) item "Configurações" aparece **fora** do `SortableContext` (fixo, com visual de bloqueio — Lock icon + `cursor-not-allowed` + opacidade reduzida na alça) e (2) a lista de itens é filtrada por `usePermissions().can` para exibir exatamente o que o usuário enxerga na sidebar (não há `canReorder` — todos podem). O componente recebe `visibleKeys: NavItemKey[]` como prop ou chama o hook diretamente; optar por chamar o hook diretamente (mesma abordagem do FilterOrderTab).

#### Arquivos-alvo

- `src/components/settings/NavOrderTab.tsx` — arquivo novo

#### Critérios de aceite

- [ ] Componente `NavOrderTab` exportado de `src/components/settings/NavOrderTab.tsx`
- [ ] Lista exibe todos os itens visíveis ao usuário atual (igual ao que `AppSidebar.tsx` exibe), filtrados via `usePermissions().can` + `SECAO_TO_PERMISSION` (a lógica de filtro deve ser coerente com `AppSidebar.tsx`)
- [ ] Item "Configurações" renderizado fora do `SortableContext`, sempre por último, com:
  - Alça `GripVertical` com `disabled={true}` em `useSortable`, classe `cursor-not-allowed opacity-40`
  - Ícone `Lock` visível ao lado ou na alça indicando bloqueio
  - `SidebarSeparator` visual (ou equivalente `hr`/`Separator`) acima do item "Configurações" dentro da lista do componente
- [ ] DnD com `PointerSensor` (activationConstraint: distance 5) + `KeyboardSensor` (sortableKeyboardCoordinates) — mesmo config do `FilterOrderTab`
- [ ] `handleDragEnd` chama `setOrder()` do hook e exibe `toast.success('Ordem das abas atualizada', { duration: 1500 })`
- [ ] Botão "Restaurar padrão" com ícone `RotateCcw`, ao clicar: chama `resetOrder()` e exibe `toast.success('Ordem das abas restaurada ao padrão')`
- [ ] Hint de teclado abaixo da lista: "Dica: use Tab para focar a alça e Espaço + setas para reordenar via teclado." com `<kbd>` formatado
- [ ] Badge numérico de posição em cada item (mesmo padrão do `FilterOrderTab`)
- [ ] Sem estado de loading (hook não tem `isLoading`) — componente renderiza diretamente
- [ ] Sem estado "sem permissão" — todos os usuários autenticados podem reordenar

#### Hints técnicos

- **Pattern:** `src/components/settings/FilterOrderTab.tsx` — copiar estrutura de `SortableRow`, substituir tipos
- **Filtro de visibilidade:** importar `SECAO_TO_PERMISSION` de `AppSidebar.tsx` ou duplicar a lógica de forma coesa. Preferir extrair `SECAO_TO_PERMISSION` para arquivo compartilhado (`src/lib/nav-permissions.ts`) se parecer limpo, ou simplesmente usar `usePermissions()` e checar cada secao da `DEFAULT_NAV_ORDER`
- **Item Configurações fixo:** renderizar um `div` não-sortable com visual idêntico ao `SortableRow` mas com alça disabled + ícone Lock após o `</SortableContext>`
- **Imports:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, lucide-react (`GripVertical`, `RotateCcw`, `Lock`, `LayoutList`), shadcn Card/Button/Badge, sonner

#### Test plan manual

1. Navegar para `/settings?tab=nav-ordem`
2. Confirmar que a aba "Ordem das Abas" aparece na `TabsList` e está acessível
3. Confirmar que a lista exibe apenas os itens visíveis para o usuário logado (se admin, todos; se assessor sem permissão de Mapa, Mapa não aparece)
4. Confirmar que "Configurações" está sempre por último com alça desabilitada (visual distinto)
5. Arrastar "Demandas" para o topo — confirmar toast "Ordem das abas atualizada"
6. Inspecionar localStorage — confirmar que `mandato:nav-order:v1` reflete a nova ordem
7. Clicar "Restaurar padrão" — confirmar toast e lista voltar à ordem padrão
8. Testar navegação via teclado: Tab na alça de um item + Espaço + setas para mover

#### Riscos

- A lógica de filtro de visibilidade pode divergir de `AppSidebar.tsx` se duplicada — mitigação: usar exatamente a mesma chamada de `can.*()` para cada secao
- Item "Configurações" dentro do SortableContext com `disabled` ainda pode receber drop sobre ele — mitigação: renderizar fora do `SortableContext` para eliminar o risco de sortable considerar como posição de destino

#### Definition of Done

- [ ] Critérios de aceite acima todos satisfeitos
- [ ] `npm run lint` sem erros
- [ ] `npm run build` sem erros de tipo
- [ ] Smoke test manual executado (itens 1-8 acima)
- [ ] Commit semântico: `feat(nav-order): cria NavOrderTab com DnD e item Configurações fixo`

---

### T03 — Integrar `useNavOrder` em `AppSidebar.tsx` + `Settings.tsx`

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** component
**Depende de:** T01, T02
**WSJF score:** (5 + 4 + 3) / 2 = 6 (maior por ser a entrega de valor ao usuário final)

#### User story

Como operador do gabinete que já configurou minha ordem de abas, quero que a sidebar principal reflita imediatamente minha preferência e persista entre sessões, para que eu acesse "Demandas" como primeiro item sem precisar rolar até ele.

#### Contexto

Esta task é a cola final: conecta o hook (T01) e o componente de configuração (T02) à sidebar real (`AppSidebar.tsx`) e registra a nova aba em `Settings.tsx`. O principal trabalho em `AppSidebar.tsx` é substituir a lista `visibleItems` hardcoded pela versão reordenada segundo `useNavOrder()`. Garantir que "Configurações" sempre aparece por último com `SidebarSeparator` antes, independente da ordem salva.

#### Arquivos-alvo

- `src/pages/Settings.tsx` — adicionar `'nav-ordem'` ao array `TABS`, importar e renderizar `NavOrderTab`
- `src/components/layout/AppSidebar.tsx` — importar `useNavOrder`, reordenar `visibleItems` antes de renderizar

#### Critérios de aceite

**Settings.tsx:**
- [ ] `'nav-ordem'` adicionado ao array `TABS` (type union atualizado)
- [ ] `<TabsTrigger value="nav-ordem">Ordem das Abas</TabsTrigger>` adicionado à `TabsList`
- [ ] `<TabsContent value="nav-ordem" className="mt-4"><NavOrderTab /></TabsContent>` adicionado
- [ ] A aba é acessível via URL `?tab=nav-ordem` (comportamento de searchParam existente funciona automaticamente)
- [ ] `NavOrderTab` importado de `@/components/settings/NavOrderTab`

**AppSidebar.tsx:**
- [ ] `useNavOrder` importado e chamado dentro de `AppSidebar()`
- [ ] `visibleItems` (lista filtrada por permissões) é reordenada segundo `order` do hook antes de renderizar — itens presentes no `order` aparecem na sequência do `order`; itens visíveis não presentes no `order` (novo item adicionado ao sistema) aparecem ao fim, antes de "Configurações"
- [ ] Item "Configurações" (secao `'configuracoes'`) é sempre extraído da lista ordenada e forçado ao fim — `SidebarSeparator` antes dele se mantém independente da posição dos demais
- [ ] Sidebar reflete a nova ordem **imediatamente** após drag no `NavOrderTab` (sem reload — reatividade via state do hook)
- [ ] Sidebar no modo collapsed (ícones) exibe a mesma sequência reordenada
- [ ] Nenhum item duplicado ou sumido após a reordenação

#### Hints técnicos

- **Algoritmo de reordenação em `AppSidebar.tsx`:**
  ```
  1. visibleItems sem 'configuracoes' → visibleNonConfig
  2. sortedItems = order
       .filter(key => visibleNonConfig tem item com secao === key)
       .map(key => visibleNonConfig.find(i => i.secao === key))
  3. unlisted = visibleNonConfig que não aparecem em order (novos itens)
  4. finalItems = [...sortedItems, ...unlisted, configItem]
  ```
- **`order` de `useNavOrder`** contém apenas `NavItemKey` (nunca `'configuracoes'`) — não há risco de "Configurações" entrar no loop
- **Reatividade:** `useNavOrder` usa `useState` + `storage` event — mudança no `NavOrderTab` atualiza `order` no hook, que re-renderiza `AppSidebar` automaticamente (ambos leem o mesmo localStorage via listener)
- **`dividerBefore`:** o item "Configurações" em `NAV_ITEMS` já tem `dividerBefore: true` — a lógica de renderização do separador em `AppSidebar.tsx` não precisa mudar, apenas garantir que `configItem` permanece último na lista final

#### Test plan manual

1. Sem nenhuma preferência salva: abrir o sistema, confirmar que sidebar exibe a ordem padrão do `DEFAULT_NAV_ORDER` seguida de Configurações
2. Ir para Configurações → "Ordem das Abas", arrastar "Demandas" para o topo
3. Observar sidebar em tempo real — "Demandas" deve subir para o topo imediatamente (sem reload)
4. Recarregar a página (`F5`) — confirmar que "Demandas" permanece no topo
5. Fechar o navegador completamente, reabrir — confirmar persistência
6. Clicar "Restaurar padrão" — confirmar que sidebar volta à sequência padrão
7. Recolher a sidebar (modo ícones) — confirmar que a sequência reordenada se mantém
8. Navegar via URL `/settings?tab=nav-ordem` — confirmar que a aba abre corretamente
9. Verificar que "Configurações" NUNCA sai do último lugar, sempre com separador antes

#### Riscos

- Reatividade entre tabs: `AppSidebar` e `NavOrderTab` estão em contextos React separados, mas ambos chamam `useNavOrder()` que tem listener de `storage` event — deve sincronizar. Se ambos estiverem na mesma árvore React, o `useState` compartilhado pode não propagar — mitigação: verificar se ambos são instâncias separadas do hook ou se convém um Context provider (provavelmente não necessário, `storage` event cobre)
- Reatividade na mesma aba: arrastar no NavOrderTab chama `setOrder()` → persiste em localStorage → atualiza state local do hook naquela instância → `AppSidebar` usa outra instância do mesmo hook. O `storage` event só dispara em outras abas, não na mesma. Solução: `setOrder` no hook deve atualizar o `useState` local (já faz isso no padrão do `useFilterOrder`) — as duas instâncias do hook devem atualizar state independentemente quando `setOrder` é chamado na instância do NavOrderTab. Verificar que `AppSidebar` re-renderiza — se não, considerar elevar o hook para Context ou usar um signal compartilhado
- **Mitigação definitiva para reatividade mesma aba:** usar `window.dispatchEvent(new StorageEvent('storage', { key: NAV_ORDER_STORAGE_KEY }))` manual no `setOrder` do hook para forçar sincronização entre instâncias na mesma aba (padrão comum com localStorage)

#### Definition of Done

- [ ] Critérios de aceite acima todos satisfeitos
- [ ] `npm run lint` sem erros
- [ ] `npm run build` sem erros de tipo
- [ ] Smoke test manual completo (itens 1-9 acima)
- [ ] Commit semântico: `feat(nav-order): integra useNavOrder em AppSidebar e registra aba nav-ordem em Settings`

---

## Definition of Ready (DoR) — checklist global

- [x] Persona definida (operador do gabinete — todos os roles)
- [x] User stories com critérios Gherkin (US01–US05 no refinamento PO)
- [x] Decisões fechadas documentadas (tabela §4 no refinamento)
- [x] Padrão de referência identificado (`useFilterOrder` + `FilterOrderTab`)
- [x] Stack confirmada (sem novas deps — @dnd-kit/sortable já instalado)
- [x] Arquivos-alvo mapeados (3 novos + 2 modificados)
- [x] Out of scope explícito (cross-device, show/hide, footer da sidebar)
- [x] Riscos mapeados com mitigação

## Definition of Done (DoD) — checklist global

- [ ] Todas as 3 tasks com critérios de aceite individualmente satisfeitos
- [ ] `npm run lint` sem erros em todos os arquivos tocados
- [ ] `npm run build` concluído sem erros de TypeScript
- [ ] Smoke test manual completo: drag-and-drop + persistência + reset + modo collapsed
- [ ] Aba `?tab=nav-ordem` acessível sem reload forçado
- [ ] "Configurações" permanece último em qualquer cenário
- [ ] Nenhuma regressão visual na sidebar ou em `Settings.tsx` (abas existentes funcionam)
- [ ] 3 commits semânticos em pt-BR na branch `task/raq-mand-em064`
