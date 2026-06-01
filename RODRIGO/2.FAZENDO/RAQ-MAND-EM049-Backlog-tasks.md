# Backlog — Ranking Automático de Engajamento de Contatos

**Cliente:** Raquel Auxiliadora — Mandato Desk 2026
**Codigo QG:** RAQ-MAND-EM049
**Briefing refinado:** RODRIGO/2.FAZENDO/RAQ-MAND-EM049-PO-refinamento.md
**Backlog escrito por:** Agente Backlog em 2026-05-08

---

## Walking skeleton (entrega valor end-to-end)

- **EM049-T01** — Migration de trigger + backfill: cria a fonte de verdade automatica. Apos rodar,
  todos os 6k+ contatos ja tem ranking calculado. Valor imediato: sort e filtro existentes
  passam a refletir dado real sem mudar nenhum codigo de UI.

## Ordem de execucao (WSJF + dependencias)

1. **EM049-T01** — Migration: funcao + triggers + backfill em lotes [walking skeleton]
2. **EM049-T02** — Helper client-side `computeRanking()` (espelho da funcao SQL)
3. **EM049-T03** — UI: badge read-only + popover de breakdown na aba Campanha
4. **EM049-T04** — Ordenacao `ranking_desc` no sort existente
5. **EM049-T05** — Import CSV: desabilitar mapeamento de `ranking` como input
6. **EM049-T06** — Testes unitarios de `computeRanking()` e smoke da migration

**Dependencias (DAG):**

```
EM049-T01 (SQL — source of truth)
  ├── EM049-T02 (lib pura — espelha T01)
  │     └── EM049-T03 (UI usa T02 para preview otimista)
  ├── EM049-T04 (sort — nao depende de T02/T03, so de T01 estar no banco)
  ├── EM049-T05 (import — independente de T02/T03)
  └── EM049-T06 (testes de T02; smoke de T01+T03+T04+T05)
```

**Nota sobre range de tasks:** 6 tasks (dentro do range ideal 3-8). T07 de documentacao
foi incorporado como criterio de aceite em T01 (comentario na migration) e T03 (JSDoc
no componente) — manter doc acoplada ao codigo evita drift. Nao ha task separada de docs.

---

## Tasks

---

### EM049-T01 — Criar migration de ranking automatico (funcao SQL + triggers + backfill)

**Tipo:** feature
**Estimativa:** L (8pt)
**Camadas afetadas:** model
**Depende de:** —
**WSJF score:** (8 + 8 + 5) / 8 = 2.6 — maior prioridade: bloqueia tudo mais

#### User story

Como gestora da base de dados do gabinete, quero que todos os contatos tenham
o ranking recalculado automaticamente ao salvar qualquer dado, para que a base
inteira reflita engajamento real sem intervencao manual em nenhum dos 6.000+ registros.

#### Contexto

Hoje `contacts.ranking` e preenchido manualmente via botoes 0-10 na UI. O dado nao
e confiavel (contatos nunca editados ficam em 0 mesmo com WhatsApp + votos declarados).
Esta task cria a fonte de verdade: uma funcao PostgreSQL `calc_contact_ranking(contact_id)`
que soma pontos conforme a tabela de pesos do PO, um trigger em `contacts` (BEFORE INSERT
OR UPDATE) e um segundo trigger em `contact_campaign_values` (AFTER INSERT OR UPDATE OR
DELETE) que dispara o recalculo do contato pai. Alem disso, a migration faz backup do
valor manual em `ranking_manual_legado` e recalcula todos os registros em lotes de 500.

O padrao de trigger SQL ja existe no projeto: ver `036_trigger_sync_multiplicador_to_leader.sql`
— idempotencia com `IF NEW.x IS DISTINCT FROM OLD.x`, SECURITY DEFINER, DROP TRIGGER IF
EXISTS antes de CREATE. Replicar o mesmo padrao.

#### Criterios de aceite

- [ ] Migration `037_compute_contact_ranking.sql` existe em `supabase/migrations/`
- [ ] Coluna `ranking_manual_legado INTEGER` criada em `contacts` (nullable) e populada
  com o valor de `ranking` antes de qualquer recalculo
- [ ] Funcao `calc_contact_ranking(p_contact_id UUID) RETURNS INTEGER` criada, retorna
  valor 0-10 conforme tabela de pesos: A=50pts, B=25pts, C=15pts, D=5pts, E=5pts
- [ ] Trigger `trg_contacts_ranking` em `contacts` (BEFORE INSERT OR UPDATE) recalcula
  `NEW.ranking` chamando `calc_contact_ranking(NEW.id)` — exceto quando apenas a coluna
  `ranking` muda (evita loop)
- [ ] Trigger `trg_campaign_values_ranking` em `contact_campaign_values` (AFTER INSERT OR
  UPDATE OR DELETE) chama `calc_contact_ranking(contact_id)` e faz UPDATE em
  `contacts SET ranking = ...` para o contato afetado
- [ ] Backfill em lotes de 500 com `pg_sleep(0.1)` entre lotes; comentario no SQL explica
  a estrategia e inclui comando de verificacao pos-migration
- [ ] Divisao por zero tratada: quando tenant tem 0 campos de campanha ativos, categoria E
  retorna 0 (usar `CASE WHEN total_campos = 0 THEN 0 ELSE FLOOR(5 / total_campos) END`)
- [ ] Apos rodar migration, `SELECT COUNT(*) FROM contacts WHERE ranking > 0` retorna
  numero maior que zero (confirmacao de que backfill rodou)
- [ ] Contatos com `declarou_voto = true AND e_multiplicador = true` tem `ranking >= 3`
  (ponto de verificacao de consistencia: 20 + 15 = 35pts -> FLOOR(35/10) = 3)
- [ ] Update de um contato individual completa em menos de 50ms em media
  (validar com EXPLAIN ANALYZE antes de rodar em prod)

#### Tabela de pesos para implementar na funcao SQL

```
Categoria A — Status campanha (max 50pts)
  declarou_voto = true     → +20
  e_multiplicador = true   → +15
  aceita_whatsapp = true   → +10
  em_canal_whatsapp = true → +5

Categoria B — Contato e pessoal (max 25pts)
  whatsapp IS NOT NULL AND whatsapp <> ''    → +8
  leader_id IS NOT NULL                      → +7
  email IS NOT NULL AND email <> ''          → +4
  data_nascimento IS NOT NULL                → +3
  telefone IS NOT NULL AND telefone <> ''    → +3

Categoria C — Endereco (max 15pts)
  bairro IS NOT NULL AND cidade IS NOT NULL  → +7
  cep IS NOT NULL AND cep <> ''             → +4
  estado IS NOT NULL AND estado <> ''       → +2
  logradouro IS NOT NULL AND logradouro <> '' → +2

Categoria D — Redes sociais (max 5pts)
  instagram IS NOT NULL AND instagram <> ''  → +3
  facebook/twitter/tiktok/youtube — +1 cada, maximo 2 extras somados

Categoria E — Campos de campanha (max 5pts)
  total_campos = COUNT DISTINCT de campaign_fields ativos no tenant
  campos_ativos_contato = COUNT de contact_campaign_values WHERE valor=true AND contact_id = p
  pts_e = LEAST(campos_ativos_contato * CASE WHEN total_campos=0 THEN 0
               ELSE FLOOR(5/total_campos) END, 5)

ranking_final = LEAST(FLOOR((A+B+C+D+E) / 10), 10)
```

#### Hints tecnicos (nao-prescritivos)

- **Model**: `supabase/migrations/037_compute_contact_ranking.sql`
- **Pattern existente**: `036_trigger_sync_multiplicador_to_leader.sql` — replicar
  estrutura de SECURITY DEFINER, DROP TRIGGER IF EXISTS, comentario de header
- **Loop trigger**: usar `WHEN (pg_trigger_depth() = 0)` OU condicao
  `IF NEW.ranking IS DISTINCT FROM valor_calculado THEN` antes do UPDATE em contacts.
  O trigger em `contacts` e BEFORE (nao precisa de UPDATE extra — altera NEW.ranking
  diretamente). O trigger em `contact_campaign_values` e AFTER e precisa de UPDATE
  em contacts — ai SIM pode disparar o trigger de contacts, mas como e BEFORE e so
  altera NEW.ranking (nao faz UPDATE), nao ha loop infinito. Documentar isso no SQL.
- **Backfill em lotes**: usar DO $$ DECLARE ... loop com OFFSET/LIMIT, pg_sleep(0.1)

#### Test cases

- **Happy path**: contato com `declarou_voto=true, e_multiplicador=true, whatsapp='31999'`
  → pontos = 20+15+8 = 43 → ranking = FLOOR(43/10) = 4
- **Contato vazio (so nome)**: todos campos null/false → pontos = 0 → ranking = 0
- **Todos os campos**: todos preenchidos, todos boolean true → pontos = 100 → ranking = 10
- **Divisao por zero**: tenant sem campos de campanha → categoria E = 0, sem erro
- **Loop trigger**: UPDATE de `contacts.ranking` diretamente nao dispara novo recalculo
- **Cascata campaign_values**: marcar campo boolean de campanha via toggle →
  `contact_campaign_values` INSERT → trigger AFTER → UPDATE em contacts.ranking → UI
  atualiza sem reload manual

#### Definition of Done

- [ ] Criterios de aceite acima
- [ ] Migration aplica sem erro via `npx supabase db push`
- [ ] Lint OK (sem SQL invalido)
- [ ] EXPLAIN ANALYZE documentado no comentario do PR (update individual < 50ms)
- [ ] Smoke test manual: editar um contato, marcar `declarou_voto`, salvar, confirmar
  que ranking sobe conforme esperado no Supabase Studio
- [ ] QA aprovou

#### Out of scope

- Interface admin para configurar pesos — v2
- Migration de indices adicionais alem do necessario para o trigger
- Qualquer mudanca em UI nesta task — somente SQL

---

### EM049-T02 — Criar helper `computeRanking()` client-side (espelho da funcao SQL)

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** action (lib pura)
**Depende de:** EM049-T01 (tabela de pesos finalizada e testada no SQL antes de espelhar)
**WSJF score:** (5 + 3 + 5) / 2 = 6.5 — alto: desbloqueia T03

#### User story

Como assessora editando o perfil de um contato, quero ver o ranking atualizar em
tempo real conforme preencho os campos no formulario, para entender o impacto de
cada dado antes de salvar.

#### Contexto

O trigger SQL e a fonte de verdade, mas a UI precisa de um preview otimista: mostrar
ao usuario o ranking que vai resultar conforme ele edita o form, antes de salvar. Para
isso, a logica de calculo precisa existir tambem no client-side como funcao TypeScript
pura. Este helper **deve espelhar exatamente** a funcao `calc_contact_ranking` do SQL —
qualquer divergencia gera preview incorreto. O comentario no arquivo deve deixar isso
claro e incluir link para a migration correspondente.

#### Criterios de aceite

- [ ] Arquivo `src/lib/contactRanking.ts` criado com funcao exportada
  `computeRanking(contact: Partial<ContactFormData>, campaignValues: Record<string, boolean>, totalCampaignFields: number): number`
- [ ] Funcao retorna inteiro 0-10, calculado identicamente ao SQL
- [ ] Divisao por zero tratada: `totalCampaignFields = 0` → categoria E = 0
- [ ] Funcao e pura (sem side effects, sem imports de supabase, sem useState)
- [ ] JSDoc no arquivo documenta que e espelho de `calc_contact_ranking` da migration 037
  e que toda mudanca de peso deve ser aplicada em ambos
- [ ] TypeScript compila sem erros (`npm run build` limpo)

#### Hints tecnicos (nao-prescritivos)

- **Arquivo**: `src/lib/contactRanking.ts`
- **Tipo de entrada**: reutilizar `ContactFormData` de `src/lib/contactValidation.ts`
  para os campos do contato principal; `Record<string, boolean>` para campaign_values
  (chave = field_id, valor = marcado/nao-marcado)
- **Pattern existente**: `src/lib/normalization.ts` e `src/lib/activityLog.ts` como
  exemplos de funcoes puras utilitarias sem dependencias pesadas

#### Test cases

- `computeRanking({declarou_voto:true, e_multiplicador:true, whatsapp:'31999'}, {}, 0)` → 4
- `computeRanking({}, {}, 0)` → 0
- `computeRanking({declarou_voto:true, e_multiplicador:true, aceita_whatsapp:true, em_canal_whatsapp:true, whatsapp:'31999', leader_id:'uuid', email:'a@b.com', data_nascimento:'1990-01-01', telefone:'319', bairro:'Centro', cidade:'BH', cep:'30000', estado:'MG', logradouro:'Rua X', instagram:'@a', twitter:'@b', tiktok:'@c'}, {'field1':true}, 2)` → 10
- `computeRanking({}, {'f1':true}, 0)` → 0 (divisao por zero tratada)

#### Definition of Done

- [ ] Criterios de aceite acima
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke: importar funcao em console do browser e testar com objeto de contato real
- [ ] QA aprovou

#### Out of scope

- Nenhuma UI nesta task
- Nenhuma chamada ao Supabase (funcao pura)
- Calculo de "potencial" (campos faltando) — isso e responsabilidade do componente T03

---

### EM049-T03 — UI: substituir botoes de ranking por badge read-only + popover de breakdown

**Tipo:** feature
**Estimativa:** M (5pt)
**Camadas afetadas:** component
**Depende de:** EM049-T01 (campo calculado no banco), EM049-T02 (preview client-side)
**WSJF score:** (8 + 5 + 3) / 5 = 3.2

#### User story

Como assessora revisando o perfil de um contato na aba Campanha, quero ver o ranking
calculado com um popover explicando de onde vieram os pontos, para saber exatamente o
que preencher para aumentar a pontuacao sem precisar decifrar o numero isolado.

#### Contexto

Atualmente `ContactDialog.tsx` exibe um grid de botoes 0-10 que permitem setar o
`ranking` manualmente via `form.setValue('ranking', val)`. Com o trigger SQL, o valor
e calculado — os botoes devem ser removidos e substituidos por um badge read-only
mostrando o ranking atual + um popover de breakdown.

O popover exibe duas secoes:
1. **Contribuindo**: campos preenchidos com pontuacao ganha (ex: "+20 Declarou voto")
2. **Potencial**: campos vazios com pontuacao disponivel (ex: "E-mail: nao preenchido — +4")

O preview e **otimista**: usa `computeRanking()` (T02) com os valores atuais do form
RHF enquanto o form nao foi salvo — assim o usuario ve o ranking subir/descer conforme
edita. Apos salvar, a query de contacts e invalidada e o valor vem do banco.

O campo `ranking` continua no schema Zod e no `ContactFormData`, mas fica **readonly**
no form — o usuario nao pode mais modificar diretamente. Ao criar/salvar o contato, o
campo nao e enviado no payload (o trigger determina o valor). Ao abrir um contato
existente, o valor do banco e exibido no badge.

#### Criterios de aceite

- [ ] Botoes 0-10 (`RANKING_VALUES.map(...)`) removidos de `ContactDialog.tsx` aba Campanha
- [ ] Badge read-only exibe o ranking atual com cor por faixa:
  - 0-3: cinza/neutro
  - 4-6: azul/medio
  - 7-9: verde/alto
  - 10: dourado/maximo
- [ ] Icone de informacao (Info do lucide-react) ao lado do badge abre popover
- [ ] Popover lista campos que contribuiram com label e pontos (ex: "+20 Declarou voto")
- [ ] Popover lista campos faltando com pontos potenciais (ex: "E-mail — +4 disponivel")
- [ ] Contato com ranking 0 e nenhum campo preenchido exibe mensagem "Preencha mais dados
  para aumentar a pontuacao" no lugar da lista vazia
- [ ] Preview e otimista: ao marcar `declarou_voto` no form, o badge atualiza para o
  valor calculado por `computeRanking()` antes de salvar
- [ ] Apos salvar o contato, badge exibe o valor vindo do banco (invalidacao de query)
- [ ] Campo `ranking` nao e enviado no payload de create/update (ou e enviado mas o
  trigger sobrescreve — Fullstack documenta a escolha no PR)
- [ ] TypeScript compila sem erros; nenhum `any` novo introduzido

#### Hints tecnicos (nao-prescritivos)

- **Arquivo principal**: `src/components/contacts/ContactDialog.tsx`
  - Remover `RANKING_VALUES`, `currentRanking`, `form.watch('ranking')`
  - Adicionar `watch` para os campos relevantes para computeRanking (declarou_voto,
    e_multiplicador, aceita_whatsapp, em_canal_whatsapp, whatsapp, leader_id, email,
    data_nascimento, telefone, bairro, cidade, cep, estado, logradouro, instagram,
    twitter, tiktok, youtube)
  - Importar `computeRanking` de `src/lib/contactRanking.ts`
- **Componente novo (opcional)**: `src/components/contacts/RankingBadge.tsx` — extrai
  o badge + popover em componente separado se aumentar a leitura de ContactDialog.tsx.
  Nao e obrigatorio — Fullstack decide.
- **Popover**: usar `Popover, PopoverContent, PopoverTrigger` de shadcn (ja importado
  em outros componentes do projeto)
- **campaign values para preview**: `useCampaignFields()` ja e usado em `CampaignFieldsList`.
  Para o preview, o form ja tem `pendingCampaignValues` (state em ContactDialog) que
  contem os toggles de campanha — usar esse estado para a categoria E do preview.
- **totalCampaignFields**: buscar com `useCampaignFields()` (ja chamado na aba Campanha
  via CampaignFieldsList) — reutilizar o dado, nao fazer nova query.

#### Test cases

- **Happy path**: abrir contato com `declarou_voto=true, whatsapp='31999'` → badge
  mostra 4, popover lista "+20 Declarou voto, +8 WhatsApp" na secao contribuindo
- **Preview otimista**: no form de edicao (sem salvar), marcar `e_multiplicador` →
  badge sobe de 4 para 5 (35pts → 3, ou seja, era 4 antes com 43pts... ajustar
  exemplo conforme os pesos exatos — Fullstack calcula)
- **Contato vazio**: badge mostra 0, popover exibe mensagem de "preencha mais dados"
- **Ranking maximo**: todos os campos preenchidos e todos boolean true → badge 10,
  cor dourada
- **Popover com muitos campos**: lista nao deve ter mais de 12 linhas (truncar ou
  usar scroll se necessario — conforme DP4 do PO)

#### Definition of Done

- [ ] Criterios de aceite acima
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test manual: abrir contato existente, verificar badge + popover; marcar
  campo no form e confirmar preview atualiza antes de salvar; salvar e confirmar
  valor do banco e exibido
- [ ] QA aprovou (comparar badge com query direta no Supabase Studio)

#### Out of scope

- Configuracao de pesos pela UI — v2
- Campo `ranking` editavel manualmente — removido permanentemente
- Qualquer alteracao visual na aba Campanha alem da secao de Ranking
- Historico de evolucao do ranking — v2

---

### EM049-T04 — Adicionar opcao `ranking_desc` ao sort existente na listagem

**Tipo:** feature
**Estimativa:** XS (1pt)
**Camadas afetadas:** hook, component
**Depende de:** EM049-T01 (campo `ranking` precisa ser confiavel no banco para a ordenacao ter valor)
**WSJF score:** (5 + 5 + 1) / 1 = 11 — altissimo por ser muito barato e de alto valor

#### User story

Como coordenadora de mobilizacao priorizando os contatos mais engajados para uma acao
de campo, quero selecionar "Mais engajados primeiro" no select de ordenacao da listagem,
para ver os contatos com maior ranking no topo sem precisar exportar e ordenar em planilha.

#### Contexto

O select de ordenacao em `Contacts.tsx` tem 5 opcoes: mais recentes, mais antigos,
nome A-Z, nome Z-A, favoritos primeiro. Adicionar `ranking_desc` como sexta opcao e
uma mudanca minima (1 linha no select + 1 case no switch do hook). O filtro de range
`ranking_min/ranking_max` ja funciona — esta task so adiciona a ordenacao.

#### Criterios de aceite

- [ ] Select de ordenacao em `Contacts.tsx` tem nova opcao "Mais engajados primeiro"
  com valor `ranking_desc`
- [ ] `ContactFilters` interface ja tem `sort_by` (adicionar `'ranking_desc'` ao union type)
- [ ] `useContacts` trata `case 'ranking_desc': query = query.order('ranking', { ascending: false })`
- [ ] Selecionar "Mais engajados primeiro" retorna contatos com ranking 10 antes de ranking 9,
  etc. (verificavel na listagem)
- [ ] Sem ordenacao secundaria obrigatoria — Fullstack decide se adiciona `.order('nome', ...)`
  como desempate e documenta no PR
- [ ] TypeScript compila sem erros

#### Hints tecnicos (nao-prescritivos)

- **Hook**: `src/hooks/useContacts.ts` — adicionar `'ranking_desc'` ao union type de
  `sort_by` na interface `ContactFilters` (linha ~95) e novo case no switch de sorting
  (linha ~545)
- **UI**: `src/pages/Contacts.tsx` — adicionar `<SelectItem value="ranking_desc">Mais
  engajados primeiro</SelectItem>` no select existente (linha ~346)

#### Test cases

- **Happy path**: selecionar "Mais engajados primeiro" → contato com ranking 9 aparece
  antes de contato com ranking 3
- **Com filtro de range**: `ranking_min=7 + sort=ranking_desc` → retorna apenas ranking
  >= 7, ordenados de 10 a 7
- **Favorito favoritos_first**: nao interferencia — as duas opcoes sao mutuamente
  exclusivas (um select, um valor por vez)

#### Definition of Done

- [ ] Criterios de aceite acima
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test manual: selecionar "Mais engajados primeiro" e confirmar ordenacao
  decrescente de ranking na listagem
- [ ] QA aprovou

#### Out of scope

- Filtro "Top N" (ex: "Top 50 mais engajados") — v2
- Ordenacao por ranking dentro de um segmento geografico — v2

---

### EM049-T05 — Desabilitar mapeamento de `ranking` como input no import CSV

**Tipo:** feature
**Estimativa:** S (2pt)
**Camadas afetadas:** component
**Depende de:** EM049-T01 (a partir do trigger, ranking nao pode mais ser input manual)
**WSJF score:** (3 + 5 + 3) / 2 = 5.5

#### User story

Como assessora importando uma planilha de contatos via CSV, quero ser informada de que
a coluna `ranking` e calculada automaticamente e sera ignorada, para nao me surpreender
com o fato de que o valor da minha planilha nao foi gravado.

#### Contexto

`ContactImportDialog.tsx` atualmente aceita coluna `ranking` como campo mapeavel:
ela aparece na lista de colunas disponivel (linha ~68), tem mapeamento automatico no
alias map (linha ~211), e e processada na normalizacao (linhas ~518-521) e no payload
de insercao (linha ~771). Com o trigger SQL, o `ranking` e sempre calculado — importar
um valor manual seria sobrescrito pelo trigger de qualquer forma. A decisao do PO (DP6)
e: deixar o trigger sempre recalcular e atualizar o import para nao aceitar `ranking`
como input (coluna vira output-only).

O export XLSX ja exporta `contacts.ranking` — sem mudanca de codigo, apenas smoke test
de validacao (criterio de aceite).

#### Criterios de aceite

- [ ] Coluna `ranking` removida da lista de campos mapeaveis na etapa de mapeamento
  do `ContactImportDialog.tsx` (lista `IMPORTABLE_FIELDS` ou equivalente — linhas ~66-68)
- [ ] Alias map `{ ranking: 'ranking', ... }` removido (linha ~211) — colunas chamadas
  "ranking" no CSV nao sao auto-mapeadas para nenhum campo do banco
- [ ] Bloco de normalizacao de ranking removido do parser (linhas ~518-521)
- [ ] Linha de insercao de ranking removida do payload de insert (linha ~771)
- [ ] Se o CSV do usuario contem uma coluna chamada "ranking", o dialog exibe aviso
  "A coluna 'ranking' sera ignorada — o ranking e calculado automaticamente com base
  nos dados do contato" (toast warning ou mensagem inline no passo de mapeamento)
- [ ] Template CSV de exemplo (lista de cabecalhos na linha ~339 e ~926) remove
  "ranking" ou o mantém com nota "(ignorado — calculado automaticamente)"
- [ ] Export XLSX via `ExportMenu.tsx` continua exportando coluna "Ranking" com o valor
  calculado pelo trigger (validar via smoke test — sem mudanca de codigo esperada)
- [ ] Merge de duplicatas (`useDuplicates.ts`) continua usando `MAX(ranking)` ao
  consolidar contatos; apos o merge, o trigger recalcula — comportamento documentado
  no PR como correto e esperado

#### Hints tecnicos (nao-prescritivos)

- **Arquivo principal**: `src/components/contacts/ContactImportDialog.tsx`
  - Linhas ~66-68: remover `{ value: 'ranking', label: 'Ranking (0 a 10)' }` de
    `IMPORTABLE_FIELDS` (ou nome equivalente da constante)
  - Linha ~128: remover `{ row: 'ranking', db: 'ranking', type: 'number', label: 'Ranking' }`
    do array de DB_FIELDS ou equivalente
  - Linha ~211: remover `ranking: 'ranking'` do ALIAS_MAP
  - Linhas ~518-521: remover bloco `if (raw.ranking) { ... normalized.ranking = r; }`
  - Linha ~771: remover `if (n.ranking !== undefined) obj.ranking = n.ranking;`
  - Linhas ~339/~926: no template CSV de exemplo, remover ou anotar coluna "ranking"
- **Aviso inline**: ao detectar cabecalho "ranking" no CSV, exibir aviso com `toast.warning()`
  ou mensagem no passo de mapeamento — Fullstack decide o local mais visivel

#### Test cases

- **CSV sem coluna ranking**: import normal, sem aviso, ranking calculado pelo trigger
- **CSV com coluna ranking preenchida**: aviso exibido, valor ignorado, ranking calculado
  pelo trigger pos-insert
- **Export XLSX**: coluna "Ranking" presente com valor numerico calculado (nao vazio)
- **Merge de duplicatas**: merge de 2 contatos com ranking 3 e 7 → contato final tem
  ranking recalculado pelo trigger (pode diferir de MAX(7) dependendo dos dados)

#### Definition of Done

- [ ] Criterios de aceite acima
- [ ] Lint OK
- [ ] Typecheck OK
- [ ] Build OK
- [ ] Smoke test manual: importar CSV com coluna ranking preenchida, confirmar aviso e
  que o valor nao foi usado; exportar XLSX e confirmar coluna Ranking presente
- [ ] QA aprovou

#### Out of scope

- Remover a coluna `ranking` do XLSX exportado — ela continua (output valido)
- Qualquer mudanca em `useDuplicates.ts` — comportamento atual e correto
- Migrar CSVs historicos — dado legado perdido e aceitavel (PO decidiu em DP6)

---

### EM049-T06 — Testes unitarios de `computeRanking()` e smoke da migration

**Tipo:** feature (test)
**Estimativa:** S (2pt)
**Camadas afetadas:** test
**Depende de:** EM049-T01, EM049-T02
**WSJF score:** (3 + 3 + 5) / 2 = 5.5 — reduz risco de regressao

#### User story

Como desenvolvedor mantendo a logica de ranking, quero ter testes unitarios de
`computeRanking()` cobrindo os casos criticos, para garantir que mudancas futuras
de peso nao quebrem silenciosamente o calculo.

#### Contexto

O projeto nao tem infra de testes configurada (sem Vitest setup — diferente do NaMi V2).
Se o Fullstack confirmar que nao ha `vitest.config.ts` no projeto, os testes unitarios
devem ser criados com setup minimo (instalar vitest + @testing-library/react se
necessario, ou apenas vitest para funcoes puras). Se o custo de setup for > 1h, Fullstack
documenta no PR e entrega os casos como testes manuais descritos — nao bloqueia o merge.

Os criterios de smoke da migration sao validados manualmente via Supabase Studio ou CLI.

#### Criterios de aceite

- [ ] Se vitest configurado: `src/lib/contactRanking.test.ts` com ao menos 6 casos:
  - contato vazio → 0
  - so declarou_voto=true → 2 (20pts)
  - declarou_voto + e_multiplicador → 3 (35pts)
  - declarou_voto + e_multiplicador + whatsapp → 4 (43pts)
  - todos os campos maximos → 10 (100pts)
  - totalCampaignFields=0 com campo marcado → sem divisao por zero
- [ ] Se vitest nao configurado: PR documenta os 6 casos com inputs e outputs esperados
  e instrucoes de teste manual no console do browser
- [ ] Smoke da migration documentado no PR: query de verificacao pos-backfill com
  resultado esperado (ex: `SELECT COUNT(*), MIN(ranking), MAX(ranking) FROM contacts`)
- [ ] Smoke de regressao: filtro `ranking_min=7` + sort `ranking_desc` funciona apos
  a migration (verificado manualmente na UI)

#### Hints tecnicos (nao-prescritivos)

- **Verificar setup**: `cat package.json | grep vitest` — se nao existir, avaliar custo
  de adicionar. Funcoes puras como `computeRanking` nao precisam de jsdom.
- **Arquivo de teste**: `src/lib/contactRanking.test.ts` (convencao Vitest, colocado
  ao lado do arquivo testado)
- **Smoke SQL**: rodar via `npx supabase db query --linked "SELECT COUNT(*), AVG(ranking),
  MAX(ranking) FROM contacts WHERE ranking > 0;"`

#### Test cases (os proprios casos de teste sao a entrega)

- Ver criterios de aceite acima

#### Definition of Done

- [ ] Criterios de aceite acima
- [ ] Se testes criados: `npm test` passa sem falhas
- [ ] Smoke queries documentadas no comentario do PR
- [ ] QA aprovou (revisou os casos e considerou cobertura adequada)

#### Out of scope

- Testes de componente (ContactDialog, RankingBadge) — custo alto, retorno baixo na v1
- Testes E2E (Cypress/Playwright) — sem infra no projeto
- Teste de performance do trigger SQL em producao — EXPLAIN ANALYZE cobre v1

---

## Consideracoes finais para o Fullstack

### Ordem recomendada dentro de cada task

Para T01: escrever SQL da funcao primeiro → testar com SELECT manual → adicionar
triggers → rodar backfill em ambiente de desenvolvimento primeiro.

Para T03: implementar badge sem popover primeiro (1h), depois adicionar popover com
breakdown (2h), depois conectar preview otimista com computeRanking (2h). Se o prazo
apertar, badge sem preview ja entrega valor.

### Campo `ranking` no payload de create/update

Duas opcoes validas — Fullstack documenta a escolha no PR:
- **Opcao A**: remover `ranking` do payload enviado ao Supabase — o trigger define o
  valor; o campo no form RHF fica so como display (watch, nao setValue)
- **Opcao B**: enviar `ranking` no payload, mas o trigger BEFORE sobrescreve — o campo
  Zod continua existindo mas o valor enviado e ignorado pelo banco

Opcao A e mais limpa semanticamente. Opcao B requer menos refactor no RHF.

### Compatibilidade com FiltrosFavoritos

O `sort_by: 'ranking_desc'` adicionado em T04 e um novo valor no union type. O
`useFiltrosFavoritos` serializa `ContactFilters` como JSON — favoritos salvos antes
desta feature continuam funcionando (nao tem o campo). Favoritos salvos apos a feature
com `sort_by: 'ranking_desc'` serao deserializados corretamente. Sem breaking change.

### Verificacao de indices no banco

A funcao `calc_contact_ranking` acessa `contact_campaign_values` filtrando por
`contact_id`. Verificar se ha indice:
```sql
SELECT indexname FROM pg_indexes
WHERE tablename = 'contact_campaign_values' AND indexdef ILIKE '%contact_id%';
```
Se nao houver, adicionar `CREATE INDEX CONCURRENTLY` na mesma migration 037.
