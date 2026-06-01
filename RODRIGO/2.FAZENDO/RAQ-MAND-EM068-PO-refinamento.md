# Atualização da Matriz de Permissões — Novas Seções de Configurações

**Cliente:** Raquel Auxiliadora — Mandato Desk 2026
**Código QG:** RAQ-MAND-EM068
**Prioridade:** média
**Escrito por:** Agente PO em 2026-05-11

---

## Contexto e problema

A tela de Configurações cresceu de 8 para 10 abas com a chegada de "Ordem das Abas"
(`nav-ordem`) e "Alertas" (`alertas`). Ambas foram implementadas como funcionalidades
completas, mas não receberam entradas correspondentes na tabela `permissoes_perfil` nem
no tipo `Secao` de `src/types/permissions.ts`. O resultado prático é que qualquer
usuário que passe pela guarda `canView('configuracoes')` (que bloqueia apenas o acesso
global à página) consegue ver e operar as duas abas sem nenhum controle granular por
perfil — incluindo estagiários e assistentes, que normalmente não têm acesso a funções
administrativas de personalização da interface.

O padrão estabelecido pelas migrations 017 e 049 é claro: cada seção que merece
controle diferenciado ganha sua própria linha em `permissoes_perfil`, seu literal no
array `SECOES` e seu guard em `usePermissions`. As abas `filtros` (migration 049 —
admin-only) e `personalizacao` (migration 017) já seguem esse padrão. "Ordem das Abas"
e "Alertas" precisam ser incorporadas ao mesmo mecanismo.

A ausência de controle hoje não gerou incidente, mas o risco aumenta conforme o time
cresce: um estagiário pode reorganizar a sidebar de todos os outros usuários que
compartilham o mesmo navegador/perfil, ou apagar em massa alertas dispensados que um
assessor precisaria rever.

---

## Job-to-be-done

Quando o administrador do mandato configura os perfis de acesso, quero que as novas
abas de Configurações apareçam na matriz de permissões com defaults sensatos por role,
para que eu possa controlar quem pode ajustar a interface pessoal e quem pode operar
alertas sem precisar de intervenção técnica.

---

## Hipótese de solução (alto nível)

Adicionar duas novas secoes na matriz existente — `ordem_abas` e `alertas` — seguindo
o mesmo padrão das migrations anteriores. Para cada uma: (1) adicionar o literal em
`SECOES` e `SECAO_LABELS` em `permissions.ts`; (2) criar migration SQL com UPSERT
dos defaults por role; (3) expor guards tipados em `usePermissions.tsx`; (4) aplicar
os guards nos componentes `NavOrderTab` e `AlertasTab`; (5) a tela de Permissões
(`PermsTab`) já renderiza dinamicamente todas as seções de `SECOES`, portanto ganha
as novas linhas sem alteração de código.

O controle de "Alertas" usa os flags existentes de forma semântica: `pode_ver` =
visualizar a lista; `pode_deletar` = apagar alerta individual; `pode_deletar_em_massa`
= botões "Apagar todos" e "Apagar antigos". `so_proprio` já está garantido em nível
de RLS (a query filtra por `user_id` automaticamente) — não é necessário gate extra.

"Ordem das Abas" usa `pode_ver` = ver o tab e arrastar; `pode_editar` = salvar nova
ordem (hoje a aba salva em localStorage — se no futuro migrar para Supabase, o flag
`pode_editar` já estará em vigor).

---

## Proposta de defaults por role (PO propõe — Rodrigo confirma)

### Seção `ordem_abas` (NavOrderTab)

| Role | pode_ver | pode_editar | Racional |
|---|---|---|---|
| admin | true | true | Controle total |
| proprietario | true | true | Chefe do mandato customiza a própria visão |
| assessor | true | true | Assessor usa bastante, faz sentido ter controle |
| assistente | true | false | Pode ver a ordem atual, mas não alterar |
| estagiario | false | false | Não precisa mexer em configurações de interface |

**Ponto de atenção:** a ordem hoje persiste em `localStorage` por usuário, então
cada um já tem sua ordem independente. O gate serve para controlar se o usuário
chega a ver a aba e interagir com o drag-and-drop.

### Seção `alertas` (AlertasTab)

| Role | pode_ver | pode_deletar | pode_deletar_em_massa | Racional |
|---|---|---|---|---|
| admin | true | true | true | Controle total |
| proprietario | true | true | true | Gere seus próprios alertas integralmente |
| assessor | true | true | false | Pode apagar individual, mas não limpar tudo em massa |
| assistente | true | true | false | Idem — pode fazer limpeza pontual |
| estagiario | true | false | false | Só visualiza; não apaga (alertas têm valor de auditoria) |

**Observacao sobre `so_proprio`:** a RLS em `dashboard_alert_dismissals` já força
`WHERE user_id = auth.uid()` em todas as operacoes. Nao existe risco de um role
mais restrito apagar alertas de outro usuario. O flag `so_proprio` nao precisa ser
`true` — o isolamento e garantido pelo banco, nao pelo frontend.

---

## User stories

- **US01** — Como admin do mandato, quero que as abas "Ordem das Abas" e "Alertas"
  apareçam na matriz de permissões editável, para que eu possa controlar quem acessa
  cada uma sem precisar de intervenção no código.

- **US02** — Como assessor, quero poder reordenar as abas da sidebar a minha maneira,
  para que eu encontre as seções que mais uso com menos cliques.

- **US03** — Como estagiário, quero que a aba "Ordem das Abas" não apareça para mim
  em Configurações (pois não tenho `pode_ver = true`), para que a interface não me
  mostre opções que não posso usar.

- **US04** — Como assistente, quero poder apagar alertas dispensados individualmente
  na aba Alertas, mas não consigo acionar os botões de exclusão em massa ("Apagar
  todos" / "Apagar antigos"), para que eu faça limpeza pontual sem risco de apagar
  tudo por engano.

- **US05** — Como estagiário, quero conseguir ver minha lista de alertas dispensados
  em Configurações, mas não vejo nenhum botão de exclusão (nem individual nem em
  massa), para que eu visualize o histórico sem poder alterar nada.

---

## Critérios de aceite

### Seção `ordem_abas`

- [ ] **CA01** — Dado um usuário com role `estagiario`, quando ele acessa `/settings`,
  a aba "Ordem das Abas" não aparece no TabsList (guard `canView('ordem_abas')` retorna
  `false`).

- [ ] **CA02** — Dado um usuário com role `assessor`, quando ele acessa `/settings?tab=nav-ordem`,
  a aba exibe o drag-and-drop funcional e ao arrastar um item a ordem é salva em
  localStorage com sucesso (toast "Ordem das abas atualizada" aparece).

- [ ] **CA03** — Dado um usuário com role `assistente`, quando ele acessa a aba
  "Ordem das Abas", os itens da lista estão visíveis mas as alças de arrasto estão
  desabilitadas (`pointer-events: none` ou `disabled`) e nenhuma interação de
  reordenação funciona.

- [ ] **CA04** — A tabela `permissoes_perfil` contém exatamente 5 linhas para `secao = 'ordem_abas'`
  (uma por role), com os valores definidos nos defaults acima.

### Seção `alertas`

- [ ] **CA05** — Dado um usuário com role `estagiario`, quando ele acessa a aba
  "Alertas", a lista de alertas dispensados é exibida mas nenhum botão de "Apagar"
  (individual ou em massa) aparece no DOM.

- [ ] **CA06** — Dado um usuário com role `assistente`, quando ele acessa a aba
  "Alertas" com pelo menos 1 alerta na lista, o botão "Apagar" individual está visível
  e funcional; os botões "Apagar todos" e "Apagar antigos (N)" não aparecem no DOM.

- [ ] **CA07** — Dado um usuário com role `assessor`, quando ele acessa a aba
  "Alertas" com 3+ alertas (sendo 1 expirado), o botão "Apagar" individual está
  visível; os botões de exclusão em massa NÃO aparecem (assessor tem
  `pode_deletar_em_massa = false` nesta proposta — confirmar com Rodrigo).

- [ ] **CA08** — Dado um usuário com role `admin` ou `proprietario`, quando ele
  clica "Apagar todos" e confirma no AlertDialog, todos os alertas são removidos e
  a lista exibe o estado vazio.

- [ ] **CA09** — A tabela `permissoes_perfil` contém exatamente 5 linhas para
  `secao = 'alertas'` (uma por role), com os valores definidos nos defaults acima.

### Matriz de permissões (PermsTab)

- [ ] **CA10** — Quando o admin acessa Configurações > Permissões, as seções
  "Ordem das Abas" e "Alertas" aparecem como linhas editáveis na tabela de permissões,
  sem nenhuma alteração de código no componente `PermsTab` (renderização dinâmica
  via `SECOES`).

- [ ] **CA11** — Quando o admin altera o default de um role para `alertas` na tela
  de Permissões e salva, um usuário daquele role que recarrega a aba Alertas passa a
  ver (ou não ver) os controles de exclusão conforme o novo valor.

### CRUD completo (regra Rodrigo)

- [ ] **CA12** — Os guards adicionados em `usePermissions.tsx` cobrem todos os
  flags relevantes das novas seções: `canViewOrdemAbas`, `canEditOrdemAbas`,
  `canViewAlertas`, `canDeleteAlerta`, `canBulkDeleteAlertas`.

---

## Edge cases conhecidos

- **Usuário com permissão negada acessa URL direta** (`/settings?tab=nav-ordem` com
  role sem `pode_ver`): o componente `Settings.tsx` deve renderizar a aba padrão
  (`geral`) ou exibir mensagem de acesso negado — não pode travar em tela em branco.
- **Migration com UPSERT em conflito**: se linhas de `ordem_abas` ou `alertas` já
  existirem no banco (seed antigo ou migration mal executada), o ON CONFLICT DO UPDATE
  deve sobrescrever. Testar com `SELECT count(*) FROM permissoes_perfil WHERE secao IN ('ordem_abas','alertas')` antes e depois.
- **`SECOES` como `const` array**: ao adicionar os dois novos literais, qualquer
  lookup por `Secao` existente que use switch/exhaustive check pode emitir erro de
  TypeScript se não for atualizado. Backlog deve revisar usages de `Secao`.
- **PermsTab renderiza dinamicamente**: verificar se `SECAO_LABELS` cobre os novos
  literais — caso contrário, o label aparece como `undefined` na matriz visual.
- **localStorage de nav-order é por navegador, não por usuário**: se dois usuários
  usam o mesmo navegador/perfil de SO, a ordem compartilha storage. O gate de
  permissão protege quem pode alterar, mas não isola o storage key entre usuários.
  Fora do escopo desta task, mas vale documentar.

---

## Nao-objetivos (out of scope)

- Migrar o armazenamento de `ordem_abas` de localStorage para Supabase (pode ser
  task futura, mas não é requisito desta).
- Alterar a lógica de RLS de `dashboard_alert_dismissals` (já está correta e
  isolada por `user_id`).
- Criar novas abas em Configurações ou refatorar as existentes.
- Granularizar permissões das demais abas já existentes (`geral`, `funis`, `equipe`,
  `integracoes`, `ia`) — elas continuam protegidas apenas pelo guard global
  `canView('configuracoes')`.
- Adicionar auditoria de log para ações de exclusão de alertas.

---

## Metricas de sucesso

- **Quantitativa:** após a migration, `SELECT count(*) FROM permissoes_perfil WHERE secao IN ('ordem_abas','alertas')` retorna exatamente 10 linhas (5 roles × 2 seções).
- **Funcional observavel:** um usuário com role `estagiario` criado em ambiente de staging não vê a aba "Ordem das Abas" e não vê botões de exclusão em "Alertas" — verificado manualmente pelo Rodrigo em 1 sessão de teste.
- **Regressao:** nenhuma das 8 abas pré-existentes de Configurações perde funcionalidade para as roles que já tinham acesso (smoke test: admin e proprietario conseguem acessar todas as abas normalmente).

---

## Riscos identificados

- **Valor:** baixo risco de não uso — a matrix de permissões já é usada ativamente e as novas seções simplesmente fecham lacunas de controle existentes.
- **Usabilidade:** o guard de `assistente` na aba "Ordem das Abas" (pode_ver=true, pode_editar=false) exige que o componente `NavOrderTab` desabilite as alças sem esconder a aba. Esse estado "somente leitura" ainda não está implementado no componente. Backlog precisa contemplar essa variação de UI.
- **Feasibility:** padrão 100% estabelecido pelas migrations 017 e 049. Risco técnico mínimo.
- **Business:** nenhum conflito com objetivos de produto. A mudança só restringe — não quebra funcionalidades existentes para roles que já tinham acesso.

---

## Dependencias tecnicas

- `src/types/permissions.ts` — adicionar `'ordem_abas'` e `'alertas'` ao array `SECOES` e ao record `SECAO_LABELS`.
- Nova migration `050_rbac_ordem_abas_alertas.sql` com UPSERT dos 10 defaults.
- `src/hooks/usePermissions.tsx` — adicionar 5 novos guards: `canViewOrdemAbas`, `canEditOrdemAbas`, `canViewAlertas`, `canDeleteAlerta`, `canBulkDeleteAlertas`.
- `src/pages/Settings.tsx` — aplicar `canViewOrdemAbas` na condicional que renderiza o tab trigger e tab content de `nav-ordem` (padrão identico ao `canAccessFiltros` já existente).
- `src/components/settings/NavOrderTab.tsx` — adicionar estado "somente leitura" quando `canViewOrdemAbas=true` mas `canEditOrdemAbas=false` (desabilitar alças e botão Restaurar).
- `src/components/settings/AlertasTab.tsx` — aplicar `canDeleteAlerta` nos botões individuais e `canBulkDeleteAlertas` nos botões de massa.

---

## Perguntas em aberto (requerem confirmacao de Rodrigo antes do Backlog)

1. **Assessor pode apagar em massa?** A proposta diz `pode_deletar_em_massa = false`
   para assessor. Se assessores gerenciam rotineiramente seus alertas, pode ser mais
   prático liberar. Confirmar antes de gravar na migration.

2. **Assistente pode arrastar (pode_editar)?** A proposta diz `false` para assistente.
   Se assistentes passam a usar o sistema como power-users no futuro, pode ser
   restritivo. Confirmar o critério de distinção entre assistente e assessor aqui.

3. **`estagiario` pode ver a aba Alertas?** A proposta diz `pode_ver = true` para
   estagiario em `alertas`. Se a politica do mandato for "estagiario não vê nada
   além do operacional", vale colocar `false` e esconder a aba também.
