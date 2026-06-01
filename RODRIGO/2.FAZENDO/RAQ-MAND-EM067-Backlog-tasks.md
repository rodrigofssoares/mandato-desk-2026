# Backlog — Dismiss de Alertas no Dashboard (Snooze Persistido)

**Cliente:** Raquel Auxiliadora — Mandato Desk 2026
**Codigo QG:** RAQ-MAND-EM067
**Briefing refinado:** RODRIGO/2.FAZENDO/RAQ-MAND-EM067-PO-refinamento.md
**Backlog escrito por:** Agente Backlog em 2026-05-09

---

## Resumo

- **Total de tasks:** 4
- **Esforco estimado:** ~14h
- **Ordem de execucao:** T1 → T2 → T3 → T4
- **Walking skeleton:** T1 (migration) + T2 (hook + integracao com useDashboardMetrics) — juntos entregam persistencia real end-to-end; dismiss individual funciona sem UI polida em ~6h

---

## Diagrama de dependencias

```
T1 (model: tabela + RLS + index)
  └── T2 (hook: useDismissedAlerts + mutations + filtro no useDashboardMetrics)
        ├── T3 (component: dismiss individual + dismiss em massa no AlertsModal)
        └── T4 (component: listagem de restauracao em Configuracoes)
```

T3 e T4 dependem de T2, mas podem ser desenvolvidas em paralelo entre si (nao ha dependencia entre UI do modal e UI de configuracoes).

---

## Tasks

---

### T1 — Criar migration da tabela `dashboard_alert_dismissals` com RLS e index

- **Tipo:** model
- **User stories cobertas:** base para US01, US02, US03, US04 (sem esta task nenhuma outra funciona)
- **Estimativa:** 2h
- **Dependencias:** nenhuma
- **Risco:** baixo — migration aditiva, nao toca tabelas existentes

#### User story

Como assessora de gabinete revisando o dashboard, quero que meu dismiss de alertas seja
persistido no banco de dados de forma isolada da visao das outras assessoras, para que eu
nao precise repetir o mesmo dismiss a cada sessao ou compartilhar minha visao de alertas
com colegas.

#### Arquivos provaleis a tocar

- `supabase/migrations/040_dashboard_alert_dismissals.sql` — novo arquivo

#### Criterios de aceite

- [ ] Tabela `dashboard_alert_dismissals` criada com colunas:
  - `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`
  - `user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE`
  - `alert_key TEXT NOT NULL` (ex: `parado-abc123`, `vencida-def456`, `ani-uuid`)
  - `dismissed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - `UNIQUE(user_id, alert_key)` — evita insercao duplicada; segundo dismiss do mesmo alerta e no-op via INSERT ON CONFLICT DO NOTHING
- [ ] RLS habilitado na tabela: users so podem ler/escrever seus proprios registros (`user_id = auth.uid()`)
- [ ] Policies criadas:
  - `SELECT WHERE user_id = auth.uid()`
  - `INSERT WITH CHECK (user_id = auth.uid())`
  - `DELETE USING (user_id = auth.uid())`
- [ ] Index criado em `(user_id, alert_key)` para query de filtro no hook (ja coberto pela constraint UNIQUE, mas confirmar que o index existe como btree)
- [ ] Migration aplica sem erro via `npx supabase db push`
- [ ] Smoke: usuario A insere um dismiss; `SELECT * FROM dashboard_alert_dismissals` retorna apenas o registro do usuario A (isolamento por RLS)

#### Notas tecnicas

- Seguir o padrao de idempotencia das migrations existentes: `CREATE TABLE IF NOT EXISTS`,
  `CREATE INDEX IF NOT EXISTS`, `DROP POLICY IF EXISTS` antes de `CREATE POLICY`.
- A constraint `UNIQUE(user_id, alert_key)` permite usar `INSERT ... ON CONFLICT DO NOTHING`
  no hook, simplificando o tratamento de cliques duplos acidentais.
- `ON DELETE CASCADE` em `user_id` garante que ao deletar um usuario do sistema, todos os
  seus dismissals sao removidos automaticamente — sem orphaos.
- Nao ha coluna `expires_at` na v1 (snooze com prazo e out of scope do PO).

#### Definition of Done

- [ ] Criterios de aceite acima
- [ ] Migration aplica sem erro (`npx supabase db push`)
- [ ] Smoke manual via Supabase Studio: inserir linha como usuario autenticado, confirmar isolamento
- [ ] QA aprovou

---

### T2 — Criar hook `useDismissedAlerts` e integrar filtro no `useDashboardMetrics`

- **Tipo:** hook
- **User stories cobertas:** US01 (persistencia), US02 (dismiss em lote), US03 (restaurar individual), US04 (restaurar todos)
- **Estimativa:** 4h
- **Dependencias:** T1 (tabela precisa existir no banco)
- **Risco:** medio — a integracao com `useDashboardMetrics` exige cuidado para nao criar re-renders excessivos; o filtro de dismissals e feito client-side no retorno do hook para nao alterar as queries existentes. Mitigacao: `useMemo` no array filtrado e `queryKey` estavel.

#### User story

Como assessora de gabinete, quero que ao dispensar um alerta ele desapareça imediatamente
da modal e nao reapareça em reloads, para sentir que a acao teve efeito real e permanente.

#### Arquivos provaleis a tocar

- `src/hooks/useDismissedAlerts.ts` — hook novo
- `src/hooks/useDashboardMetrics.ts` — integrar filtro (sem alterar queries existentes)

#### Interface do hook `useDismissedAlerts`

```ts
// Retorno do hook
interface UseDismissedAlertsReturn {
  dismissedKeys: Set<string>;           // chaves atualmente dispensadas pelo usuario
  dismissOne: (alertKey: string) => Promise<void>;
  dismissMany: (alertKeys: string[]) => Promise<void>;  // insert em lote (US02)
  restoreOne: (alertKey: string) => Promise<void>;
  restoreAll: () => Promise<void>;
  dismissedList: DismissedAlert[];      // lista ordenada para tela de Configuracoes (US03/US04)
  isLoading: boolean;
}

interface DismissedAlert {
  alert_key: string;
  dismissed_at: string;
}
```

#### Criterios de aceite

- [ ] `useDismissedAlerts` exporta `dismissedKeys`, `dismissOne`, `dismissMany`, `restoreOne`,
  `restoreAll`, `dismissedList` e `isLoading`
- [ ] `dismissedKeys` e um `Set<string>` construido a partir do select em `dashboard_alert_dismissals WHERE user_id = auth.uid()`
- [ ] `dismissOne(key)` faz `INSERT INTO dashboard_alert_dismissals (user_id, alert_key) VALUES (auth.uid(), key) ON CONFLICT DO NOTHING` e invalida a query `['dismissedAlerts']`
- [ ] `dismissMany(keys)` faz insert em lote (upsert de todos os registros de uma vez, nao N requests separados) e invalida a query — aceita array vazio sem erro
- [ ] `restoreOne(key)` faz `DELETE FROM dashboard_alert_dismissals WHERE user_id = auth.uid() AND alert_key = key` e invalida a query
- [ ] `restoreAll()` faz `DELETE FROM dashboard_alert_dismissals WHERE user_id = auth.uid()` e invalida a query
- [ ] `dismissedList` e o array de linhas retornadas pelo select, ordenado por `dismissed_at DESC`
- [ ] Em `useDashboardMetrics`: o hook e chamado com `useDismissedAlerts()` internamente OU o filtro e feito no componente pai (`Dashboard.tsx`) antes de passar `alerts` para `AlertsModal` — Fullstack documenta a escolha no PR. A propriedade observavel e: `metrics.alertas` retorna apenas alertas cujo `id` NAO esta em `dismissedKeys`
- [ ] O badge `AlertsBadge` exibe `count` baseado nos alertas ja filtrados (sem os dismissados)
- [ ] Apos reload completo da pagina, alertas dispensados nao reaparecem (confirmado por query no banco)
- [ ] Erro de rede em `dismissMany` exibe toast de erro via `toast.error()` e nao fecha o dialog de confirmacao (o componente T3 e responsavel pelo dialog, mas o hook deve rejeitar a Promise para que o componente trate)

#### Notas tecnicas

- **Estrategia de filtro:** preferir filtrar em `Dashboard.tsx` antes de passar `alerts` para
  `AlertsModal`, para manter `useDashboardMetrics` sem dependencias adicionais e facilitar
  testes unitarios do hook de metricas. O `useDismissedAlerts` e chamado em `Dashboard.tsx`
  e o array `alerts` e filtrado com `alerts.filter(a => !dismissedKeys.has(a.id))`.
- **queryKey:** `['dismissedAlerts']` — invalida apos cada mutacao.
- **Insert em lote:** usar `.from('dashboard_alert_dismissals').upsert(rows, { onConflict: 'user_id,alert_key', ignoreDuplicates: true })` para o dismiss em massa.
- **Vitest:** o projeto tem infra de testes configurada (package.json confirma vitest ^3.2.4).
  Escrever pelo menos 3 testes unitarios do hook com `vi.mock` do supabase client:
  - `dismissOne` insere e invalida cache
  - `dismissMany` com array vazio nao faz request
  - `restoreAll` deleta todas as linhas do usuario

#### Definition of Done

- [ ] Criterios de aceite acima
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] `npm test` passando (ou testes documentados como manual se vi.mock do supabase gerar custo excessivo de setup — documentar no PR)
- [ ] Smoke manual: dispensar alerta, recarregar pagina, confirmar que nao reaparece
- [ ] QA aprovou

---

### T3 — Adicionar dismiss individual e dismiss em massa no `AlertsModal`

- **Tipo:** component
- **User stories cobertas:** US01 (dismiss individual), US02 (dismiss em massa)
- **Estimativa:** 4h
- **Dependencias:** T2 (hook com mutacoes disponivel)
- **Risco:** baixo — modificacao cirurgica em componente existente, sem alterar logica de agrupamento ou navegacao

#### User story

Como assessora de gabinete com a modal de alertas aberta, quero dispensar alertas que
ja avaliei — um de cada vez ou todos de uma vez — para que a modal so mostre sinais
que ainda precisam da minha atencao nesta sessao.

#### Arquivos provaleis a tocar

- `src/components/dashboard/AlertsModal.tsx` — adicionar botao X por item, botao "Dispensar todos" no rodape, e dialog de confirmacao em massa
- `src/pages/Dashboard.tsx` — passar `dismissOne`, `dismissMany` e `dismissedKeys` como props para `AlertsModal` (ou encapsular o hook dentro do modal — Fullstack documenta a escolha)

#### Criterios de aceite

- [ ] Cada item da lista em `AlertsModal` exibe um botao com icone `X` (lucide `X`) no canto direito, ao lado do `ExternalLink` existente
- [ ] O botao X tem `aria-label="Dispensar alerta"` e e acessivel via teclado
- [ ] Clicar no X chama `dismissOne(alert.id)` e o item desaparece da lista imediatamente (atualizacao otimista OU via invalidacao de query — Fullstack documenta)
- [ ] Os demais alertas permanecem visiveis apos dismiss de um unico item (modal nao fecha)
- [ ] O contador no titulo do dialog ("Alertas (N)") e no badge do header decrescem em 1 apos o dismiss (sem reload)
- [ ] O rodape do `AlertsModal` exibe botao "Dispensar todos" apenas quando `alerts.length > 0`
- [ ] Clicar em "Dispensar todos" abre um `AlertDialog` (shadcn) com titulo "Dispensar todos os alertas?" e descricao "Voce pode restaura-los a qualquer momento em Configuracoes."
- [ ] O `AlertDialog` exibe o numero de alertas afetados: "Dispensar [N] alertas?"
- [ ] Confirmar no `AlertDialog` chama `dismissMany(alerts.map(a => a.id))`; enquanto a mutacao estiver em andamento, o botao de confirmar exibe estado de loading (spinner) e fica desabilitado
- [ ] Apos confirmar com sucesso, a modal exibe estado vazio "Nenhum alerta no momento" e o badge some ou exibe 0
- [ ] Se `dismissMany` falhar (Promise rejeitada), o `AlertDialog` permanece aberto e exibe toast de erro; nenhum dado e alterado na UI
- [ ] Cancelar o `AlertDialog` nao altera nenhum dado nem fecha a modal principal
- [ ] O rodape do modal exibe tambem link/botao "Gerenciar alertas dispensados" que navega para `/settings?tab=alertas` (a rota que T4 vai criar)
- [ ] TypeScript compila sem erros; nenhum `any` novo

#### Notas tecnicas

- `AlertDialog` do shadcn ja e dependencia do projeto (`@radix-ui/react-alert-dialog ^1.1.15`
  no package.json). Usar `AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle` do shadcn.
- Para atualizacao otimista do dismiss individual: remover o item do estado local antes da
  mutacao e reverter em caso de erro — ou simplesmente aguardar invalidacao da query (mais
  simples, com latencia de ~100-200ms aceitavel). Fullstack decide e documenta.
- O link "Gerenciar alertas dispensados" pode ser um `Button variant="link"` com `onClick` que
  navega via `useNavigate` do react-router-dom para `'/settings?tab=alertas'`.

#### Definition of Done

- [ ] Criterios de aceite acima
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke manual: abrir modal, dispensar um alerta, confirmar que some sem fechar o modal; testar "Dispensar todos" com e sem confirmacao; testar link para Configuracoes
- [ ] QA aprovou

---

### T4 — Criar secao "Alertas Dispensados" em Configuracoes com restauracao individual e em massa

- **Tipo:** component
- **User stories cobertas:** US03 (restaurar individual), US04 (restaurar todos)
- **Estimativa:** 4h
- **Dependencias:** T2 (hook com `dismissedList`, `restoreOne`, `restoreAll` disponivel)
- **Risco:** baixo — nova aba nas Configuracoes, sem alterar abas existentes; padrao de tab ja estabelecido

#### User story

Como assessora que dispensou um alerta por engano ou que quer resetar sua visao de alertas,
quero acessar uma lista dos alertas dispensados nas Configuracoes e poder restaura-los
individualmente ou todos de uma vez, para que voltem a aparecer na modal do dashboard.

#### Arquivos provaleis a tocar

- `src/components/settings/AlertasTab.tsx` — componente novo (nova aba de Configuracoes)
- `src/pages/Settings.tsx` — adicionar aba `alertas` na lista `TABS` e renderizar `<AlertasTab />`

#### Criterios de aceite

- [ ] `Settings.tsx` tem nova aba `alertas` com label "Alertas" adicionada a `TABS` e ao `TabsList`
- [ ] Acessar `/settings?tab=alertas` renderiza o componente `AlertasTab`
- [ ] `AlertasTab` usa `useDismissedAlerts()` para obter `dismissedList`, `restoreOne`, `restoreAll` e `isLoading`
- [ ] Quando `isLoading = true`, exibe skeleton ou spinner enquanto carrega
- [ ] Quando `dismissedList.length === 0`, exibe estado vazio: "Nenhum alerta dispensado no momento"
- [ ] Quando ha itens, exibe lista com cada registro mostrando:
  - `alert_key` formatado de forma legivel (ex: "Tarefa vencida", "Contato parado no funil", "Aniversariante sem tarefa") — ver tabela de formatacao abaixo
  - data/hora do dismiss (`dismissed_at`) formatada em pt-BR (ex: "09/05/2026 14:32")
  - botao "Restaurar" por item
- [ ] Clicar em "Restaurar" em um item chama `restoreOne(alert_key)` e remove o item da lista (via invalidacao de query)
- [ ] Exibe botao "Restaurar todos" apenas quando `dismissedList.length > 0`
- [ ] Clicar em "Restaurar todos" abre `AlertDialog` com texto "Restaurar todos os [N] alertas dispensados? Eles voltarao a aparecer na modal do dashboard."
- [ ] Confirmar chama `restoreAll()` e a lista volta para estado vazio
- [ ] Cancelar o `AlertDialog` nao altera nada
- [ ] A contagem exibida no `AlertDialog` de "Restaurar todos" corresponde ao `dismissedList.length` no momento do clique
- [ ] Nenhum campo editavel: esta tela e somente leitura + acoes de restauracao (sem form, sem input)
- [ ] TypeScript compila sem erros

#### Formatacao de alert_key para exibicao

| Prefixo do alert_key | Label legivel |
|---|---|
| `parado-` | Contato parado no funil |
| `vencida-` | Tarefa vencida |
| `ani-` | Aniversariante sem tarefa |
| outros | alert_key bruto (fallback) |

Fullstack pode criar funcao helper `formatAlertKey(key: string): string` em `src/lib/alertUtils.ts`
para manter o componente limpo.

#### Notas tecnicas

- Padrão de aba: ver `src/components/settings/NavOrderTab.tsx` ou `FilterOrderTab.tsx` como
  referencia de estrutura (Card com CardContent, lista com botoes de acao, estado vazio).
- `TABS` em `Settings.tsx` e um `as const` array — adicionar `'alertas'` ao final do array
  e adicionar `<TabsTrigger value="alertas">Alertas</TabsTrigger>` e o `<TabsContent>` correspondente.
- A navegacao a partir do link "Gerenciar alertas dispensados" no `AlertsModal` (T3) aponta para
  `/settings?tab=alertas` — esta task nao precisa criar essa navegacao, apenas garantir que a
  rota funciona.

#### Definition of Done

- [ ] Criterios de aceite acima
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke manual: dispensar 2-3 alertas via modal, navegar para Configuracoes > Alertas, confirmar lista; restaurar um individualmente; restaurar todos; confirmar estado vazio
- [ ] QA aprovou

---

## Consideracoes finais para o Fullstack

### Ordem recomendada dentro de cada task

- **T1:** escrever SQL com DROP POLICY IF EXISTS → CREATE TABLE IF NOT EXISTS → CREATE INDEX IF NOT EXISTS → CREATE POLICY → testar com `npx supabase db push`. Verificar idempotencia rodando duas vezes.
- **T2:** implementar select query primeiro → testar `dismissedKeys` → implementar `dismissOne` → `restoreOne` → `dismissMany` e `restoreAll` em seguida. Integrar filtro em `Dashboard.tsx` so apos o hook estar funcionando isoladamente.
- **T3:** adicionar botao X primeiro (dismiss individual, sem dialog) → testar smoke → adicionar botao "Dispensar todos" com `AlertDialog` → adicionar link para Configuracoes.
- **T4:** estrutura basica da aba com lista vazia → adicionar listagem com `restoreOne` → adicionar `restoreAll` com dialog de confirmacao.

### Decisao de onde chamar `useDismissedAlerts`

Duas opcoes validas — Fullstack documenta a escolha no PR:

- **Opcao A (recomendada):** chamar `useDismissedAlerts()` em `Dashboard.tsx` e filtrar `alerts`
  antes de passar para `AlertsModal`. Props adicionais em `AlertsModal`: `onDismissOne`, `onDismissMany`.
  Vantagem: `useDashboardMetrics` permanece isolado; `AlertsModal` fica mais testavel (aceita dados prontos).
- **Opcao B:** chamar `useDismissedAlerts()` dentro do `AlertsModal`. Vantagem: encapsulamento;
  `Dashboard.tsx` nao precisa saber sobre dismissals. Desvantagem: o badge do header
  (`AlertsBadge`) nao tera acesso ao count filtrado sem lifting state.

A Opcao A e preferida pela Opcao B porque o `AlertsBadge` tambem precisa exibir o count filtrado
(criterio de aceite de US01), e chamar o hook duas vezes (no badge e no modal) geraria requests
duplicados. Alternativa: um contexto compartilhado — mas adiciona complexidade desnecessaria para
esta feature.

### Nota sobre alert_key de aniversariante recorrente

O id `ani-<contact_id>` e permanente por contato. Se a assessora dispensar o alerta de aniversario
de um contato hoje, o alerta nao reaparecera nos anos seguintes (mesmo `alert_key`). Comportamento
documentado como aceitavel na v1 pelo PO. Documentar no PR com instrucoes de como a assessora
pode restaurar (via Configuracoes > Alertas > Restaurar o item correspondente).

### Nota sobre registros orphaos

Alertas cuja fonte foi resolvida (ex: tarefa vencida concluida, contato saiu do funil) enquanto
o dismiss estava ativo geram um registro orphao em `dashboard_alert_dismissals`. O registro e
inofensivo — o join por `alert_key` simplesmente nao retorna nada no hook de metricas. Limpeza
periodica e out of scope da v1 (documentar no PR como divida tecnica conhecida).
