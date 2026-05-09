# Ordem Personalizada das Abas da Navegação

**Cliente:** Raquel Auxiliadora — Mandato Desk 2026
**Código QG:** RAQ-MAND-EM064
**Prioridade:** média
**Escrito por:** Agente PO — 2026-05-09

---

## 1. Resumo

Como operador do gabinete (assessor, proprietário ou admin), eu quero arrastar as abas da navegação lateral para definir minha própria ordem de acesso, para que as seções que uso com mais frequência fiquem no topo da sidebar sem depender da ordem padrão do sistema.

---

## 2. Persona

**Operador do gabinete** — qualquer usuário autenticado que enxerga a sidebar (todos os roles: admin, proprietário, assessor, assistente, estagiário). A preferência de ordem é pessoal (por usuário, por dispositivo/navegador), não administrativa. Não há diferença de comportamento entre roles; todos reordenam as próprias abas visíveis.

Contexto de uso típico: o assessor acessa Demandas e Tarefas dezenas de vezes por dia, mas Importação e Mapa são raramente usados. A sidebar em ordem padrão o obriga a rolar ou memorizar posições. Não há workaround atual além de decorar a sequência fixa.

---

## 3. Job-to-be-done

Quando acesso o sistema várias vezes ao dia, eu quero que as abas mais importantes para o meu trabalho apareçam no topo da navegação, para que eu chegue onde preciso em menos cliques e sem distração.

---

## 4. Decisões fechadas

| # | Questão | Decisão | Justificativa |
|---|---------|---------|---------------|
| 1 | **Onde persistir a ordem?** | `localStorage` por usuário/navegador, chave `mandato:nav-order:v1` | Mesmo padrão de `useFilterOrder` (`mandato:filter-order:v1`). Cross-device é evolução futura; adicionar camada de DB agora aumenta complexidade sem benefício imediato validado. |
| 2 | **Qualquer usuário pode reordenar?** | Sim — é preferência pessoal de UI, não config administrativa | Não há dado sensível em jogo. Restringir por role criaria burocracia sem valor. Segue o mesmo racional de temas/preferências pessoais. |
| 3 | **Reordenar = mostrar/esconder?** | NÃO. Somente reordenar as abas que já são visíveis ao usuário (visibilidade controlada por RBAC via `usePermissions`) | Fundir as duas operações aumentaria complexidade e criaria risco de usuário "esconder" acesso sem intenção. Manter separação de responsabilidades. |
| 4 | **Aba Configurações** | Fixa no fim, não arrastável. `SidebarSeparator` antes dela se mantém | Conforme briefing original. Configurações é âncora estrutural da sidebar. |
| 5 | **Botão "Restaurar Padrão"** | Sim, presente. Segue UX do `FilterOrderTab` (RotateCcw + toast de confirmação) | Consistência com padrão já existente no projeto. |
| 6 | **Mobile / sidebar collapsed** | Sem mudança de comportamento — ordem é a mesma no modo recolhido | A sidebar collapsed exibe apenas ícones mas mantém a mesma sequência. Não há breakpoint diferente a tratar. |
| 7 | **Biblioteca DnD** | `@dnd-kit/sortable` — já presente no projeto, mesmo padrão de `FilterOrderTab` | Não adicionar dependência nova. Reuso de padrão estabelecido em RAQ-MAND-EM063. |
| 8 | **Storage key** | `mandato:nav-order:v1` | Segue convenção `mandato:<dominio>-order:v<n>`. |

---

## 5. User Stories

### US01 — Reordenar abas via drag-and-drop @must

```gherkin
GIVEN que estou em Configurações → aba "Ordem das Abas"
  AND vejo a lista das abas visíveis para minha conta (exceto Configurações, que está fixada)
WHEN arrasto uma aba para uma nova posição via alça GripVertical
THEN a lista reflete imediatamente a nova posição
  AND a sidebar principal exibe as abas nessa nova ordem
  AND um toast "Ordem das abas atualizada" aparece por 1,5s
```

### US02 — Persistir a ordem entre sessões @must

```gherkin
GIVEN que reorganizei as abas e fechei o navegador
WHEN abro o sistema novamente
THEN a sidebar exibe as abas na ordem que defini anteriormente
  AND a aba Configurações permanece no fim com o separador antes dela
```

### US03 — Restaurar ordem padrão @must

```gherkin
GIVEN que tenho uma ordem personalizada salva
WHEN clico em "Restaurar padrão" na aba "Ordem das Abas"
THEN a lista e a sidebar voltam à ordem original do sistema (NAV_ITEMS default)
  AND a preferência salva em localStorage é removida
  AND um toast "Ordem das abas restaurada ao padrão" aparece
```

### US04 — Aba Configurações fixada no fim @must

```gherkin
GIVEN que estou na aba "Ordem das Abas" em Configurações
WHEN visualizo a lista arrastável
THEN o item "Configurações" aparece sempre em último, com indicador visual de bloqueio (cursor-not-allowed + opacidade reduzida na alça)
  AND a alça de arrastar do item "Configurações" está desabilitada
  AND o separador visual antes de "Configurações" é sempre renderizado independente da ordem dos demais
```

### US05 — Novo item de navegação inserido após ordem customizada @should

```gherkin
GIVEN que tenho uma ordem personalizada salva
  AND um novo item de nav é adicionado ao NAV_ITEMS pelo sistema
WHEN abro o sistema
THEN o novo item aparece ao fim da lista de itens arrastáveis (antes do separador de Configurações)
  AND os itens que eu havia ordenado mantêm suas posições relativas
```

---

## 6. Critérios de Aceite Globais

- [ ] Nova aba "Ordem das Abas" existe em `Settings.tsx` com chave `nav-ordem` adicionada ao array `TABS`
- [ ] A tab é acessível via `?tab=nav-ordem` na URL (padrão searchParam existente)
- [ ] A lista exibe exatamente os mesmos itens visíveis ao usuário atual que a sidebar renderiza (filtrados por `usePermissions`) — nem mais, nem menos
- [ ] Item "Configurações" aparece por último na lista com alça desabilitada (`disabled={true}` no `useSortable`) e opacidade visual reduzida
- [ ] `SidebarSeparator` antes de "Configurações" é sempre renderizado na sidebar, independente da posição dos outros itens
- [ ] Ao arrastar e soltar qualquer item (exceto Configurações), a sidebar principal reflete a nova ordem **imediatamente** (sem necessidade de reload)
- [ ] A ordem persiste após reload completo da página (lida de `localStorage`, chave `mandato:nav-order:v1`)
- [ ] Merge defensivo: se um item de nav existir na sidebar mas não estiver salvo no localStorage (ex: novo item adicionado), ele aparece ao fim da lista (antes de Configurações), sem quebrar a ordem dos demais
- [ ] Merge defensivo: chaves inválidas no localStorage são descartadas silenciosamente
- [ ] Botão "Restaurar padrão" presente, ao clicar: lista volta ao NAV_ITEMS default, localStorage removido, toast exibido
- [ ] Navegação por teclado funcional: Tab foca a alça, Espaço + setas reordenam (padrão @dnd-kit/sortable com KeyboardSensor)
- [ ] Hint textual sobre atalhos de teclado visível abaixo da lista (mesmo padrão do FilterOrderTab)
- [ ] CRUD: não aplicável (não há entidade criável/editável individualmente nesta feature — a "entidade" é a lista inteira, com save implícito por drag e reset explícito por botão)

---

## 7. Métrica de Sucesso

- **Validação funcional (Rodrigo):** consegue arrastar "Demandas" para o topo, recarregar a página e verificar que "Demandas" aparece como primeiro item na sidebar
- **Persistência:** fechar o navegador completamente, reabrir e confirmar que a ordem customizada foi mantida
- **Reset:** clicar "Restaurar padrão" e confirmar que a sidebar volta à ordem original do sistema

Não há métrica quantitativa de uso (single-user, sem telemetria). A métrica é observacional: o próprio Rodrigo usa a feature para reordenar sua sidebar na primeira semana após entrega.

---

## 8. Out of Scope

- **Cross-device / multi-device:** sincronização via Supabase — evolução futura (v2)
- **Mostrar/ocultar abas via UI:** visibilidade continua sendo responsabilidade exclusiva do RBAC (`usePermissions`)
- **Reordenar as tabs internas da página de Configurações** (Geral, Funis, Equipe…) — fora desta task
- **Reordenar itens do SidebarFooter** (botão Sair, versão) — estrutura fixa
- **Animação de transição na sidebar** ao aplicar nova ordem — não solicitado
- **Confirmação modal antes de restaurar padrão** — toast simples é suficiente (segue padrão FilterOrderTab)
- **Admin configurar ordem para outros usuários** — cada usuário gerencia só a própria preferência

---

## 9. Riscos e Pontos de Atenção

| Risco | Impacto | Mitigação |
|-------|---------|-----------|
| **Novo item adicionado ao NAV_ITEMS no futuro** — onde aparece para usuário com ordem custom? | Médio — usuário pode não notar item novo se ele for inserido "invisível" no meio da lista salva | Merge defensivo obrigatório: chaves não presentes no storage aparecem ao fim (antes de Configurações). Documentar padrão no hook. |
| **Item removido do NAV_ITEMS** (seção desativada/permissão revogada) — chave fica órfã no localStorage | Baixo — sem impacto visual; item não é mais visível de qualquer forma | Merge defensivo: filtrar `storedOrder` contra `visibleItems` antes de renderizar. Chave inválida descartada. |
| **Usuário sem permissão pra ver Configurações** não pode acessar a tab de reordenação | Baixo — usuário sem `configuracoes` não vê a sidebar item nem a página | Comportamento já tratado por `can.accessSettings()` em Settings.tsx. Não há workaround necessário. |
| **Dois itens com `secao` diferente mas mesmo `href`** — conflito de id no DndContext | Baixo — NAV_ITEMS atual não tem duplicatas de href | Usar `item.secao` como id do sortable (mais estável que `href`) para evitar colisão futura. |
| **Sidebar no modo collapsed (ícones)** renderiza a ordem correta? | Baixo — mesma lista de `visibleItems`, apenas estilo diferente | Garantir que o hook `useNavOrder` retorne a lista já ordenada e AppSidebar.tsx consuma esse hook no lugar do NAV_ITEMS filtrado hardcoded. |
| **localStorage desabilitado / modo incógnito** | Muito baixo | Falha silenciosa → fallback para ordem padrão (mesmo comportamento do useFilterOrder). |
