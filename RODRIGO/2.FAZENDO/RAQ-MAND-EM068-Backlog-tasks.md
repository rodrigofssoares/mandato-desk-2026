# Backlog — Atualização da Matriz de Permissões (Ordem das Abas + Alertas)

**Cliente:** Raquel Auxiliadora — Mandato Desk 2026
**Codigo QG:** RAQ-MAND-EM068
**Briefing refinado:** RODRIGO/2.FAZENDO/RAQ-MAND-EM068-PO-refinamento.md
**Backlog escrito por:** Agente Backlog em 2026-05-11

---

## Walking skeleton (entrega valor end-to-end)

- **EM068-T01** — Migration SQL com UPSERT dos 10 defaults. Apos rodar, a matriz de
  permissoes ja tem os dados certos no banco. PermsTab exibe as 2 novas linhas
  automaticamente (renderizacao dinamica via `SECOES`) — valor visivel para o admin
  sem nenhuma mudanca de codigo adicional.

## Ordem de execucao (WSJF + dependencias)

1. **EM068-T01** — Tipos TypeScript (`SECOES` + `SECAO_LABELS`) + migration SQL [walking skeleton]
2. **EM068-T02** — Guards em `usePermissions.tsx` + sync de `generateDefaultPermissions()`
3. **EM068-T03** — Gate de visibilidade em `Settings.tsx` (aba `nav-ordem`)
4. **EM068-T04** — Estado somente-leitura em `NavOrderTab.tsx` (assistente: ve mas nao arrasta)
5. **EM068-T05** — Gates de exclusao em `AlertasTab.tsx` (individual + massa)

**Dependencias (DAG):**

```
EM068-T01 (types + SQL — base de tudo)
  └── EM068-T02 (guards tipados — dependem do literal Secao estar no SECOES)
        ├── EM068-T03 (Settings.tsx usa can.canViewOrdemAbas() — precisa de T02)
        │     └── EM068-T04 (NavOrderTab usa can.canEditOrdemAbas() — precisa de T02+T03)
        └── EM068-T05 (AlertasTab usa can.canDeleteAlerta() etc — precisa de T02)
```

**Nota sobre range:** 5 tasks (dentro do range ideal 3-8). Cobertura: todas as camadas
afetadas pelo briefing. Nenhuma sub-quebravel — cada task e atomica e cabe em 1 PR curto.

**Security obrigatorio:**
- **EM068-T01** toca `permissoes_perfil` (RLS/RBAC) — dispara agente Security antes do merge.
- **EM068-T02** a **T05** sao mudancas de frontend puras — sem RLS — Security nao obrigatorio,
  mas recomendado validar os guards contra bypass por URL direta (coberto em T03 out-of-scope).

---

## Tasks

---

### EM068-T01 — Adicionar `ordem_abas` e `alertas` ao tipo `Secao` e criar migration 050

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** model, action (tipos + migration)
**Depende de:** —
**WSJF score:** (8 + 5 + 5) / 2 = 9.0 — maior prioridade: desbloqueia todas as demais tasks
**Migration de banco:** SIM
**Security obrigatorio:** SIM (toca `permissoes_perfil` — RBAC)

#### User story

Como administrador do mandato, quero que as secoes "Ordem das Abas" e "Alertas"
apareçam na tabela de permissoes com defaults corretos por role, para que eu veja e
edite essas duas linhas na matriz sem nenhuma intervencao tecnica adicional.

#### Contexto

`src/types/permissions.ts` define `SECOES` como `const` array e `Secao` como union
derivada. `SECAO_LABELS` e um `Record<Secao, string>` exaustivo — se `SECAO_LABELS`
nao cobrir os novos literais, PermsTab exibe `undefined` na coluna de label.
`usePermissoes.ts` usa `Secao` como tipo de parametro das funcoes `canView()` etc —
adicionar os literais torna os novos guards type-safe automaticamente.

A migration segue exatamente o padrao da `049_rbac_ordenacao_filtros_whatsapp.sql`:
INSERT com valores explicitos por role + `ON CONFLICT (role, secao) DO UPDATE SET` para
idempotencia. 10 linhas (5 roles × 2 secoes). Cada coluna booleana e mapeada
conforme os defaults consolidados aprovados por Rodrigo.

PermsTab (`src/pages/Permissoes.tsx`) ja itera `SECOES` dinamicamente — nenhuma
mudanca nesse componente. Confirmar que `SECAO_LABELS` cobre os novos literais antes
de mergear (CA10).

#### Criterios de aceite

- [ ] **CA-T01-1** — `SECOES` em `src/types/permissions.ts` contem `'ordem_abas'` e
  `'alertas'` como novos literais (tipo `Secao` passa a incluir ambos)
- [ ] **CA-T01-2** — `SECAO_LABELS` contem entradas `ordem_abas: 'Ordem das Abas'` e
  `alertas: 'Alertas'` — sem `undefined` na PermsTab
- [ ] **CA04** — `SELECT count(*) FROM permissoes_perfil WHERE secao = 'ordem_abas'`
  retorna exatamente 5 (uma linha por role, com os defaults da tabela abaixo)
- [ ] **CA09** — `SELECT count(*) FROM permissoes_perfil WHERE secao = 'alertas'`
  retorna exatamente 5 (uma linha por role, com os defaults da tabela abaixo)
- [ ] **CA-T01-5** — Migration e idempotente: rodar duas vezes nao duplica linhas nem
  gera erro (ON CONFLICT DO UPDATE SET)
- [ ] **CA10** — Apos migration, acessar Configuracoes > Permissoes como admin e
  confirmar que "Ordem das Abas" e "Alertas" aparecem como linhas editaveis na tabela
  sem nenhuma mudanca de codigo no componente PermsTab
- [ ] **Metrica** — `SELECT count(*) FROM permissoes_perfil WHERE secao IN ('ordem_abas','alertas')`
  retorna exatamente 10

**Defaults a gravar (ordem_abas):**

| role         | pode_ver | pode_criar | pode_editar | pode_deletar | pode_deletar_em_massa | so_proprio |
|---|---|---|---|---|---|---|
| admin        | TRUE  | FALSE | TRUE  | FALSE | FALSE | FALSE |
| proprietario | TRUE  | FALSE | TRUE  | FALSE | FALSE | FALSE |
| assessor     | TRUE  | FALSE | TRUE  | FALSE | FALSE | FALSE |
| assistente   | TRUE  | FALSE | FALSE | FALSE | FALSE | FALSE |
| estagiario   | FALSE | FALSE | FALSE | FALSE | FALSE | FALSE |

**Defaults a gravar (alertas):**

| role         | pode_ver | pode_criar | pode_editar | pode_deletar | pode_deletar_em_massa | so_proprio |
|---|---|---|---|---|---|---|
| admin        | TRUE  | FALSE | FALSE | TRUE  | TRUE  | FALSE |
| proprietario | TRUE  | FALSE | FALSE | TRUE  | TRUE  | FALSE |
| assessor     | TRUE  | FALSE | FALSE | TRUE  | FALSE | FALSE |
| assistente   | TRUE  | FALSE | FALSE | TRUE  | FALSE | FALSE |
| estagiario   | TRUE  | FALSE | FALSE | FALSE | FALSE | FALSE |

#### Hints tecnicos (nao-prescritivos)

- **Arquivo de tipos**: `src/types/permissions.ts` — inserir `'ordem_abas'` e `'alertas'`
  no array `SECOES` (linha 20); adicionar as 2 entradas em `SECAO_LABELS` (linhas 28-49)
- **Migration**: `supabase/migrations/050_rbac_ordem_abas_alertas.sql` — replicar header
  e estrutura exata de `049_rbac_ordenacao_filtros_whatsapp.sql`; coluna `pode_criar`
  sera FALSE para ambas as secoes (nao ha CRUD de objetos aqui, apenas permissoes de UI)
- **Mapeamento semantico de flags**: para `ordem_abas`, `pode_editar = true` significa
  "pode salvar nova ordem" (arrastar + salvar); para `alertas`, `pode_deletar = true`
  significa "pode apagar individual" e `pode_deletar_em_massa = true` significa
  "pode usar botoes Apagar todos / Apagar antigos". Documentar no header da migration.
- **generateDefaultPermissions**: esta funcao em `usePermissoesAdmin.ts` e usada pelo
  botao "Restaurar Padrao" — ela itera `SECOES` e aplica defaults por role. Ao adicionar
  os novos literais ao array, a funcao vai incluir as 2 novas secoes automaticamente
  pela logica de fallback (else → todos false). POREM os defaults corretos NAO
  coincidem com o fallback (ex: estagiario tem `pode_ver=true` em alertas, mas o
  fallback retorna false). Fullstack deve adicionar tratamento explícito nos
  `roleDefaults` de cada role afetado dentro da funcao, OU confirmar que os
  valores corretos serao mantidos apenas na migration e o botao "Restaurar Padrao"
  pode sobrescrever com valores incorretos (risco: regressao se admin clicar Restaurar).
  Recomendacao: atualizar `generateDefaultPermissions()` na mesma task — mas Fullstack
  decide se aplica agora ou cria task de followup.
- **Verificacao de usages de Secao**: fazer grep por `switch.*secao\|case.*'ordem\|case.*'alert`
  em src/ para confirmar que nao ha exhaustive checks que quebram com os novos literais.
  Resultado esperado: nenhum (confirmed above — usePermissoes.ts usa lookup por array,
  nao switch; SECAO_LABELS e Record exaustivo mas nao switch).

#### Test cases

- **Happy path**: rodar `npx supabase db push` em ambiente dev, executar SELECT de contagem
  — retorna 10 linhas; abrir PermsTab como admin — 2 novas linhas visiveis com labels corretos
- **Idempotencia**: rodar migration novamente — sem erro, contagem continua 10
- **Regressao**: acessar todas as 8 abas pre-existentes como admin e proprietario — nenhuma
  perde funcionalidade (smoke test pre-merge)
- **TypeScript**: `npm run build` sem erros de tipo apos adicionar os literais a SECOES e SECAO_LABELS

#### Definition of Done

- [ ] Criterios de aceite acima
- [ ] `npm run build` limpo (sem erros de tipo em SECAO_LABELS)
- [ ] Lint OK
- [ ] Migration aplica via `npx supabase db push` sem erro
- [ ] Smoke manual: PermsTab exibe "Ordem das Abas" e "Alertas" como linhas editaveis
- [ ] Security agent revisou (toca permissoes_perfil)
- [ ] QA aprovou

#### Out of scope

- Atualizar `generateDefaultPermissions()` — pode ser nesta task ou followup (Fullstack decide)
- Qualquer mudanca em componentes de UI de Settings — isso e T03, T04, T05
- Criar indices adicionais em `permissoes_perfil` — existente ja tem constraint UNIQUE(role, secao)

---

### EM068-T02 — Adicionar guards tipados em `usePermissions.tsx` e sync de `generateDefaultPermissions()`

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** action (hook de permissoes)
**Depende de:** EM068-T01 (literais `'ordem_abas'` e `'alertas'` precisam existir em `Secao`)
**WSJF score:** (8 + 5 + 3) / 2 = 8.0
**Migration de banco:** NAO
**Security obrigatorio:** NAO (frontend puro — sem RLS)

#### User story

Como desenvolvedor implementando gates nos componentes `Settings.tsx`, `NavOrderTab.tsx`
e `AlertasTab.tsx`, quero ter funcoes nomeadas e type-safe em `usePermissions.tsx`
(`canViewOrdemAbas`, `canEditOrdemAbas`, `canViewAlertas`, `canDeleteAlerta`,
`canBulkDeleteAlertas`) para usar nos guards de renderizacao sem acessar `canView()`/
`canEdit()`/`canDelete()` diretamente com strings literais nos componentes.

#### Contexto

O padrao do projeto e expor guards nomeados em `usePermissions.tsx` (ex:
`accessOrdenacaoFiltros: () => canView('ordenacao_filtros')`) ao inves de usar
`canView('secao')` direto nos componentes. Isso centraliza o mapeamento nome-semântico
→ flag-do-banco e evita que refactors na tabela de permissoes quebrem varios arquivos.

Os 5 guards necessarios (CA12):
- `canViewOrdemAbas` → `canView('ordem_abas')`
- `canEditOrdemAbas` → `canEdit('ordem_abas')`
- `canViewAlertas` → `canView('alertas')`
- `canDeleteAlerta` → `canDelete('alertas')`
- `canBulkDeleteAlertas` → `canBulkDelete('alertas')`

Alem dos guards, se `generateDefaultPermissions()` em `usePermissoesAdmin.ts` nao foi
atualizada em T01, este e o momento. O botao "Restaurar Padrao" usa essa funcao — se
ela nao cobrir os novos defaults corretamente, um admin que clicar "Restaurar" vai
sobrescrever com valores incorretos (ex: estagiario perde `pode_ver=true` em alertas).

#### Criterios de aceite

- [ ] **CA12** — `usePermissions.tsx` exporta (dentro do objeto `can`) as 5 funcoes:
  `canViewOrdemAbas`, `canEditOrdemAbas`, `canViewAlertas`, `canDeleteAlerta`,
  `canBulkDeleteAlertas` — todas retornam `boolean` e usam as primitivas tipadas
  de `usePermissoes` com os literais corretos de `Secao`
- [ ] **CA-T02-2** — `generateDefaultPermissions()` em `usePermissoesAdmin.ts` reflete
  os defaults aprovados: estagiario tem `pode_ver=true` em `alertas`; assistente tem
  `pode_ver=true` e `pode_deletar=true` em `alertas` mas `pode_editar=false` em
  `ordem_abas`; assessor tem `pode_ver=true` e `pode_deletar=true` em `alertas` mas
  `pode_deletar_em_massa=false`
- [ ] **CA-T02-3** — `npm run build` sem erros de tipo; os 5 novos guards passam
  typecheck (os literais de Secao sao validos apos T01)
- [ ] **CA11** — Alterar permissao de um role na PermsTab e recarregar a aba Alertas
  como aquele role → os controles de exclusao refletem o novo valor (validacao de
  que o hook busca do banco e nao usa hardcoded)

#### Hints tecnicos (nao-prescritivos)

- **Arquivo**: `src/hooks/usePermissions.tsx` — adicionar 5 entradas no objeto `can`
  dentro do `useMemo`, seguindo o padrao das linhas 74-79:
  ```
  // Ordem das Abas
  canViewOrdemAbas: () => canView('ordem_abas'),
  canEditOrdemAbas: () => canEdit('ordem_abas'),

  // Alertas
  canViewAlertas: () => canView('alertas'),
  canDeleteAlerta: () => canDelete('alertas'),
  canBulkDeleteAlertas: () => canBulkDelete('alertas'),
  ```
- **Arquivo**: `src/hooks/usePermissoesAdmin.ts` — `generateDefaultPermissions()` (linha 87).
  A funcao usa `roleDefaults` com 4 buckets (fullAccess, viewOnly, viewCreate, viewCreateEdit).
  Os novos defaults nao cabem exatamente em nenhum bucket existente (ex: assessor em alertas
  tem `pode_ver=true, pode_deletar=true, pode_deletar_em_massa=false` — nao ha bucket "viewDelete").
  Opcao A: adicionar um bucket `viewDelete` no tipo. Opcao B: tratar as 2 secoes com logica
  condicional explicita apos o loop principal (mais simples, sem mudar o tipo). Fullstack escolhe.

#### Test cases

- **Typecheck**: `tsc --noEmit` sem erros apos adicionar os guards
- **Guard admin**: impersonar admin → todos os 5 guards retornam `true`
- **Guard estagiario**: impersonar estagiario → `canViewOrdemAbas()` = false,
  `canViewAlertas()` = true, `canDeleteAlerta()` = false
- **Guard assistente**: impersonar assistente → `canViewOrdemAbas()` = true,
  `canEditOrdemAbas()` = false, `canDeleteAlerta()` = true, `canBulkDeleteAlertas()` = false
- **Restaurar Padrao**: clicar o botao "Restaurar" como admin → verificar no banco que
  `estagiario/alertas` tem `pode_ver=true` e `pode_deletar=false`

#### Definition of Done

- [ ] Criterios de aceite acima
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke manual: abrir DevTools, impersonar estagiario, confirmar guards retornam
  valores corretos no console (ex: `window.__debug_can?.canViewOrdemAbas()`)
- [ ] QA aprovou (validacao dos guards CA12 + CA11)

#### Out of scope

- Adicionar guards para secoes pre-existentes — sem scope creep
- Renomear guards ja existentes — sem breaking change
- Testes unitarios do hook — sem infra de testes no projeto

---

### EM068-T03 — Aplicar gate de visibilidade da aba `nav-ordem` em `Settings.tsx`

**Tipo:** feature
**Estimativa:** XS (1pt)
**Camadas afetadas:** component (Settings.tsx)
**Depende de:** EM068-T02 (guard `canViewOrdemAbas` precisa existir)
**WSJF score:** (8 + 5 + 2) / 1 = 15.0 — altissimo: barato e resolve CA01/CA03 parcialmente
**Migration de banco:** NAO
**Security obrigatorio:** NAO

#### User story

Como estagiario acessando `/settings`, quero que a aba "Ordem das Abas" nao apareça
no TabsList, para que a interface nao me mostre opcoes que meu perfil nao tem acesso.

#### Contexto

`Settings.tsx` ja tem o padrao correto para `filtros` (linha 97-99):
```tsx
{canAccessFiltros && (
  <TabsTrigger value="filtros">Ordenacao de Filtros</TabsTrigger>
)}
```
O mesmo padrao se aplica a `nav-ordem` usando `canViewOrdemAbas`.

Atualmente o TabsTrigger e TabsContent de `nav-ordem` sao renderizados para todos os
usuarios que passam pelo guard global `canAccess` (accessSettings). Apos esta task,
so roles com `pode_ver=true` em `ordem_abas` verao a aba.

**Edge case de URL direta**: se estagiario navegar para `/settings?tab=nav-ordem`,
o componente deve cair no tab padrao (`geral`) — o `isValidTab()` continua retornando
true para `nav-ordem` (a string e valida no enum), mas o `TabsContent` nao vai ser
renderizado. Isso significa que o usuario ve a aba `geral` mesmo que a URL diga
`nav-ordem` — comportamento correto e alinhado com o padrao dos `filtros`. Fullstack
deve confirmar que nao ha estado em branco (TabsContent de `geral` e renderizado
incondicionalmente).

#### Criterios de aceite

- [ ] **CA01** — Dado usuario com role `estagiario`, quando acessa `/settings`, a aba
  "Ordem das Abas" nao aparece no TabsList (guard `canViewOrdemAbas()` retorna false;
  o TabsTrigger nao e montado no DOM)
- [ ] **CA-T03-2** — Dado usuario com role `assessor`, quando acessa `/settings`, a aba
  "Ordem das Abas" aparece no TabsList e e clicavel
- [ ] **CA-T03-3** — Dado estagiario que navega diretamente para `/settings?tab=nav-ordem`,
  a aba exibida e `geral` (ou a primeira aba visivel) — sem tela em branco
- [ ] **CA-T03-4** — As demais abas (geral, funis, equipe, permissoes, integracoes, ia,
  personalizacao, alertas) continuam visiveis para todos os roles que ja as viam
  (smoke test de regressao)

#### Hints tecnicos (nao-prescritivos)

- **Arquivo**: `src/pages/Settings.tsx`
  - Linha 45: adicionar `const canViewOrdemAbas = can.canViewOrdemAbas();`
  - Linha 100: envolver `<TabsTrigger value="nav-ordem">` em `{canViewOrdemAbas && (...)}`
  - Linha 130: envolver `<TabsContent value="nav-ordem">` em `{canViewOrdemAbas && (...)}`
  - Nota: aba `alertas` nao precisa de gate de visibilidade aqui — todos os roles tem
    `pode_ver=true` em `alertas`. O controle de alertas e dentro do componente (T05).
- **Padrao de referencia**: linhas 97-99 e 125-129 de Settings.tsx (gate de `filtros`)

#### Test cases

- **Estagiario**: `/settings` sem aba nav-ordem no DOM; `/settings?tab=nav-ordem`
  redireciona para geral sem erro
- **Assessor**: aba nav-ordem presente e funcional
- **Admin**: aba nav-ordem presente; todas as outras abas tambem presentes
- **Regressao**: abas geral/funis/equipe/permissoes/integracoes/ia/personalizacao/alertas
  visiveis para roles que ja as viam — nenhuma quebra

#### Definition of Done

- [ ] Criterios de aceite acima
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke manual: logar como estagiario (impersonar), confirmar que nav-ordem sumiu;
  logar como assessor, confirmar que esta la
- [ ] QA aprovou (CA01)

#### Out of scope

- Gate de visibilidade para aba `alertas` — todos os roles podem ver a aba (gate e so
  nos botoes de exclusao, que e escopo de T05)
- Redirect semantico para geral quando URL invalida — o comportamento atual de cair
  no geral ja e aceitavel
- Qualquer mudanca dentro de NavOrderTab — isso e T04

---

### EM068-T04 — Estado somente-leitura em `NavOrderTab.tsx` (assistente ve, nao arrasta)

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** component (NavOrderTab.tsx)
**Depende de:** EM068-T02 (guard `canEditOrdemAbas`), EM068-T03 (aba ja gateada por visibilidade)
**WSJF score:** (5 + 3 + 3) / 2 = 5.5
**Migration de banco:** NAO
**Security obrigatorio:** NAO

#### User story

Como assistente que acessa a aba "Ordem das Abas", quero ver a lista de itens da
sidebar com sua ordem atual, mas nao conseguir arrastar os itens nem clicar em
"Restaurar padrao", para que eu visualize a configuracao sem risco de altera-la.

#### Contexto

`NavOrderTab.tsx` renderiza uma lista de `SortableRow` dentro de `DndContext`. Quando
`canEditOrdemAbas()` retorna false (assistente), o componente precisa de um modo
"display only": itens visiveis, alças de drag desabilitadas, botao "Restaurar padrao"
oculto ou desabilitado.

A abordagem mais simples: prop `readOnly` passada para `SortableRow` que desabilita
`{...listeners}` e `{...attributes}` na alca, troca `cursor-grab` por `cursor-not-allowed`,
e aplica `pointer-events-none opacity-40` no botao de alca. O `DndContext` continua
montado (evita condicional que remontaria a lista) mas os eventos nao disparam porque
os listeners nao estao registrados.

O botao "Restaurar padrao" no `CardHeader` deve ser ocultado (`{canEditOrdemAbas && <Button...>}`)
— nao faz sentido mostrar um botao que o usuario nao pode usar.

#### Criterios de aceite

- [ ] **CA03** — Dado usuario com role `assistente`, quando acessa a aba "Ordem das Abas",
  os itens da lista sao visiveis (ordem atual exibida) e as alças de arrasto estao
  desabilitadas — tentativas de arrastar nao produzem efeito
- [ ] **CA-T04-2** — O botao "Restaurar padrao" nao aparece no DOM para assistente
  (`canEditOrdemAbas() = false`)
- [ ] **CA-T04-3** — Dado assessor (canEditOrdemAbas = true), o drag-and-drop funciona
  normalmente e o toast "Ordem das abas atualizada" aparece apos arrasto
- [ ] **CA02** — Dado assessor, ao arrastar um item e soltar, a nova ordem e salva no
  localStorage com sucesso
- [ ] **CA-T04-5** — A mudanca nao quebra o comportamento de roles com `canEditOrdemAbas=true`
  (admin, proprietario, assessor) — drag-and-drop continua 100% funcional para eles

#### Hints tecnicos (nao-prescritivos)

- **Arquivo**: `src/components/settings/NavOrderTab.tsx`
- **Abordagem para SortableRow**: adicionar prop `disabled?: boolean`. Quando `disabled=true`:
  - `{...listeners}` e `{...attributes}` nao sao espalhados no botao da alca
    (substituir por `aria-disabled="true"`)
  - Classe do botao: remover `cursor-grab active:cursor-grabbing hover:text-foreground hover:bg-muted`
    e adicionar `cursor-not-allowed opacity-40`
  - `useSortable` ainda e chamado (evita violacao de ordem de hooks), mas os listeners
    ficam sem uso — nao ha side effect
- **Botao Restaurar**: `{canEditOrdemAbas && <Button variant="outline"...>Restaurar padrao</Button>}`
- **Sem DndContext condicional**: manter `<DndContext>` sempre montado; o `onDragEnd`
  nunca dispara porque os listeners nao foram registrados nos itens
- **Impersonacao para teste**: usar o seletor de impersonacao em Configuracoes > Permissoes
  para testar como assistente sem criar usuario real

#### Test cases

- **Assistente — visual**: itens da lista visiveis com ordem atual; alca tem cursor
  `not-allowed` e nao responde ao drag; botao "Restaurar" ausente
- **Assistente — teclado**: Tab navega pelos itens mas Espaco + setas nao reordenam
- **Assessor — drag**: arrastar item de posicao 3 para posicao 1 → lista reordena →
  toast aparece → localStorage atualizado
- **Admin — reset**: clicar "Restaurar padrao" → ordem volta ao default → toast confirma
- **Regressao config fixa**: item "Configuracoes" (ConfiguracoesFixedRow) continua
  fixo e nao arrastavel independente do role

#### Definition of Done

- [ ] Criterios de aceite acima
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke manual: impersonar assistente → confirmar alças desabilitadas e botao ausente;
  impersonar assessor → confirmar drag funcional
- [ ] QA aprovou (CA02 + CA03)

#### Out of scope

- Mensagem explicativa "Voce nao tem permissao para reordenar" — nao solicitado pelo PO,
  pode ser followup se UX pedir
- Estado de loading diferenciado para o modo somente-leitura — desnecessario
- Persistencia da ordem em Supabase — out of scope explicito do briefing (segue localStorage)

---

### EM068-T05 — Gates de exclusao em `AlertasTab.tsx` (individual + em massa)

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** component (AlertasTab.tsx)
**Depende de:** EM068-T02 (guards `canDeleteAlerta` e `canBulkDeleteAlertas`)
**WSJF score:** (8 + 5 + 3) / 5 = 3.2
**Migration de banco:** NAO
**Security obrigatorio:** NAO (RLS de `dashboard_alert_dismissals` ja isola por user_id)

#### User story

Como assistente acessando a aba "Alertas Dispensados", quero poder apagar alertas
individualmente clicando no botao "Apagar" de cada linha, mas nao quero ver os botoes
"Apagar todos" e "Apagar antigos (N)" — para fazer limpeza pontual sem risco de apagar
tudo por engano.

Como estagiario acessando a mesma aba, quero ver minha lista de alertas dispensados
sem nenhum botao de exclusao — para visualizar o historico sem poder alterar nada.

#### Contexto

`AlertasTab.tsx` hoje renderiza:
1. Botao "Apagar antigos (N)" — condicional `{expiredCount > 0 && <Button...>}` (linha 137)
2. Botao "Apagar todos" — condicional `{totalCount > 0 && <Button...>}` (linha 148)
3. Botao "Apagar" individual — um por linha de `dismissedList.map(...)` (linha 209)

Os 3 botoes precisam de gates:
- Botoes de massa (1 e 2): renderizar apenas se `canBulkDeleteAlertas()` retorna true
- Botao individual (3): renderizar apenas se `canDeleteAlerta()` retorna true

Regra de composicao: se `canBulkDeleteAlertas=false` mas `canDeleteAlerta=true`, o
`div` wrapper dos botoes de massa (linha 134: `{totalCount > 0 && <div...>}`) pode
ficar vazio — verificar se o wrapper deve ser omitido tambem quando ambos os botoes
de massa estao ocultos (evitar `<div>` vazio no DOM).

Os AlertDialogs de confirmacao (apagar todos e apagar antigos) permanecem no DOM mas
so sao acessados via click nos botoes de massa — como os botoes so aparecem com
`canBulkDeleteAlertas=true`, os dialogs nunca abrem para roles sem essa permissao.

#### Criterios de aceite

- [ ] **CA05** — Dado estagiario, quando acessa a aba "Alertas" com pelo menos 1 item
  na lista, nenhum botao de "Apagar" (individual ou em massa) aparece no DOM
  (`canDeleteAlerta=false, canBulkDeleteAlertas=false`)
- [ ] **CA06** — Dado assistente, quando acessa a aba "Alertas" com pelo menos 1 alerta
  e pelo menos 1 alerta expirado, o botao "Apagar" individual esta visivel e funcional
  em cada linha; os botoes "Apagar todos" e "Apagar antigos (N)" nao aparecem no DOM
- [ ] **CA07** — Dado assessor, quando acessa a aba "Alertas", o botao "Apagar" individual
  esta visivel por linha; os botoes "Apagar todos" e "Apagar antigos (N)" nao aparecem
  no DOM (`canBulkDeleteAlertas=false` para assessor)
- [ ] **CA08** — Dado admin ou proprietario, quando clica "Apagar todos" e confirma no
  AlertDialog, todos os alertas sao removidos e a lista exibe o estado vazio
  (comportamento existente nao deve regredir)
- [ ] **CA-T05-5** — Estado vazio ("Nenhum alerta dispensado no momento") aparece
  corretamente para todos os roles independente dos gates de exclusao
- [ ] **CA-T05-6** — Nenhum `<div>` vazio residual no DOM quando ambos os botoes de
  massa estao ocultos (ex: assistente com alertas na lista)

#### Hints tecnicos (nao-prescritivos)

- **Arquivo**: `src/components/settings/AlertasTab.tsx`
- **Importar guards**: `const { can } = usePermissions();` ja esta importado (linha 141 do
  NavOrderTab — verificar se AlertasTab ja importa usePermissions; se nao, adicionar)
- **Botoes de massa** (dentro do `{totalCount > 0 && <div...>}` no CardHeader):
  - Envolver cada botao com `{canBulkDeleteAlertas && (...)}`
  - Ou: substituir o wrapper `{totalCount > 0 && <div...>}` por
    `{totalCount > 0 && canBulkDeleteAlertas && <div...>}` (mais simples se ambos os
    botoes de massa seguem a mesma permissao)
  - Botao "Apagar antigos": `{expiredCount > 0 && canBulkDeleteAlertas && <Button...>}`
  - Botao "Apagar todos": `{canBulkDeleteAlertas && <Button...>}` (o `totalCount > 0`
    ja controla o wrapper pai)
- **Botao individual** (dentro do `dismissedList.map()`):
  - Envolver o `<Button variant="ghost"...>Apagar</Button>` com `{canDeleteAlerta && (...)}`
- **AlertDialogs**: permanecem no DOM — nao precisam de gate pois so abrem via os botoes
  de massa que ja estao gateados
- **Impersonacao**: usar seletor de roles em Configuracoes > Permissoes para testar sem
  criar usuarios reais

#### Test cases

- **Estagiario com 3 alertas (1 expirado)**: lista de 3 itens visiveis; zero botoes de
  exclusao no DOM (inspecionar elemento confirma ausencia)
- **Assistente com 3 alertas (1 expirado)**: botoes individuais "Apagar" visiveis em
  cada linha; wrapper de botoes de massa ausente do DOM
- **Assistente — click individual**: clicar "Apagar" em 1 alerta → alerta removido da
  lista → toast de sucesso (comportamento existente nao regride)
- **Assessor com 3 alertas**: idem assistente — so botoes individuais
- **Admin — apagar todos**: clicar "Apagar todos" → AlertDialog abre → confirmar →
  lista vazia → toast "Apagado com sucesso"
- **Admin — apagar antigos**: clicar "Apagar antigos (N)" com N expirados → AlertDialog
  abre → confirmar → apenas alertas nao-expirados permanecem
- **Estado vazio para todos roles**: usuario sem alertas ve mensagem padrao (sem quebra)

#### Definition of Done

- [ ] Criterios de aceite acima
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke manual: impersonar estagiario → zero botoes; impersonar assistente → so
  botoes individuais; impersonar admin → todos os botoes; confirmar que click nos botoes
  funcionais ainda dispara a acao correta
- [ ] QA aprovou (CA05, CA06, CA07, CA08)

#### Out of scope

- Mensagem "Voce nao tem permissao para apagar" quando botao esta oculto — silenciar e
  o padrao para restricoes de UI (nao mostrar o que o usuario nao pode fazer)
- Alterar a RLS de `dashboard_alert_dismissals` — ja esta correta (isolamento por user_id)
- Adicionar confirmacao extra para o botao individual — nao solicitado pelo PO
- Gate de visibilidade da aba `alertas` em Settings.tsx — todos os roles tem `pode_ver=true`

---

## Consideracoes finais para o Fullstack

### Ordem recomendada dentro de cada task

**T01**: editar `permissions.ts` primeiro → rodar `npm run build` para confirmar que
`SECAO_LABELS` cobre os novos literais antes de escrever a migration → escrever SQL →
`npx supabase db push` → verificar contagem no banco → checar PermsTab visualmente.

**T02**: adicionar guards em `usePermissions.tsx` → adicionar tratamento em
`generateDefaultPermissions()` → rodar typecheck → testar impersonando cada role via
seletor de impersonacao em Settings > Permissoes.

**T03 → T04 → T05**: podem ser implementadas em sequencia rapida (cada uma < 1h de
coding efetivo). T03 e prerequisito estrito de T04 (se a aba nao e renderizada,
NavOrderTab nao monta); T05 e independente de T03/T04.

### Mapeamento de flags para semantica de UI

A tabela `permissoes_perfil` usa flags genericos (`pode_ver`, `pode_editar`,
`pode_deletar`, `pode_deletar_em_massa`). Para `ordem_abas` e `alertas`, o
mapeamento semantico e:

| Flag no banco | Semantica em ordem_abas | Semantica em alertas |
|---|---|---|
| `pode_ver` | Ver a aba e a lista de itens | Ver a lista de alertas dispensados |
| `pode_editar` | Arrastar itens e salvar nova ordem | — (nao usado) |
| `pode_deletar` | — (nao usado) | Apagar alerta individual |
| `pode_deletar_em_massa` | — (nao usado) | Apagar todos / Apagar antigos |

Documentar esse mapeamento no header da migration 050 para rastreabilidade futura.

### Sync SQL ↔ codigo (dois lugares)

Os defaults existem em 2 lugares: (1) migration SQL que inicializa o banco, (2)
`generateDefaultPermissions()` que e chamada pelo botao "Restaurar Padrao". Qualquer
divergencia entre os dois gera inconsistencia se o admin clicar "Restaurar". Conferir
que ambos estao alinhados antes do merge de T01/T02.

### Impersonacao para QA

O seletor de impersonacao em Configuracoes > Permissoes permite simular qualquer role
sem criar usuarios reais. Usar para todos os smoke tests das tasks T03, T04 e T05.

### Verificacao de exhaustive checks em `Secao`

Grep confirmou que nao ha `switch` sobre `Secao` no codebase — `usePermissoes.ts` usa
`array.find()`, `PermsTab` usa iteracao dinamica. O unico ponto de risco era
`SECAO_LABELS` (Record exaustivo) — coberto pela CA-T01-2 e pelo `npm run build` limpo.
