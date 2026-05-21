# Dismiss de Alertas no Dashboard (Snooze Persistido)

**Cliente:** Raquel Auxiliadora — Mandato Desk 2026
**Codigo QG:** RAQ-MAND-EM067
**Prioridade:** media
**Escrito por:** Agente PO em 2026-05-09

---

## Contexto e problema

O dashboard exibe um modal de alertas (`AlertsModal`) com tres categorias calculadas
em runtime pelo hook `useDashboardMetrics`: contatos parados 5+ dias no funil ativo
(`contato_parado`), tarefas vencidas (`tarefa_vencida`) e aniversariantes sem tarefa
do dia (`aniversariante_sem_tarefa`). Cada alerta tem um id sintetico derivado do
registro-fonte (ex: `parado-<uuid>`, `vencida-<uuid>`, `ani-<uuid>`).

O problema: a modal recalcula alertas a cada abertura, sem memoria de estado. Um
assessor que ja viu o alerta de contato parado e decidiu conscientemente "vou tratar
isso na proxima semana" ve o mesmo alerta repetido toda vez que abre o dashboard.
Nao ha como sinalizar "estou ciente deste alerta". O resultado pratico e que a modal
vira ruido — o usuario aprende a fechar sem ler — perdendo o valor de sinal que alertas
deveriam ter. Rodrigo relatou que o badge de alertas nao e mais consultado porque "la
sempre tem coisa" (workaround atual: ignorar o badge).

---

## Decisao de produto: semantica de "exclusao" — Opcao A (Snooze Persistido)

O briefing original usa o termo "apagar alerta", que e ambiguo porque alertas sao
calculados (nao armazenados). Ha tres semanticas possiveis:

**Opcao A — Snooze persistido (RECOMENDADA):** Criar tabela
`dashboard_alert_dismissals(user_id, alert_key, dismissed_at)` e filtrar os alertas
dismissados do resultado do hook. O alerta desaparece da modal enquanto o registro
de dismiss existir. Alerta pode retornar se o registro for deletado (undo) ou se o
usuario quiser resetar todos os dismissals.

**Opcao B — Resolver a fonte:** "Apagar" = acao real sobre o dado (concluir tarefa,
mover contato de stage, criar tarefa de parabens). Semantica correta para tarefa
vencida; inconsistente e destrutiva para contato parado (mover o contato de stage so
para sumir do alerta e uma acao incorreta).

**Opcao C — Hide local (frontend only):** Esconde no estado React da sessao. Volta
no proximo reload. Nao atende o requisito de persistencia.

**Justificativa da escolha A:** E a unica semantica consistente para os tres tipos de
alerta sem exigir acoes diferentes por tipo. Nao toca os dados de origem. E reversivel
(usuario pode "restaurar alertas" se quiser). O id sintetico ja serve como `alert_key`
natural (ex: `parado-abc123`, `vencida-def456`). Requer migration simples com RLS.

**Quanto ao "apagar em massa":** implementado como "dismissar todos os alertas visiveis"
de uma vez, com confirmacao obrigatoria antes de executar (conforme requisito original).

---

## Job-to-be-done

Quando abro o dashboard e vejo alertas que ja avaliei e decidi tratar depois,
quero poder dispensar cada alerta individualmente — ou todos de uma vez — para que
a modal mostre apenas os sinais que ainda nao tratei, sem ruido dos que ja estou
ciente.

---

## Hipotese de solucao (alto nivel)

Adicionar botao "Dispensar" (icone X) em cada item do `AlertsModal`. Ao clicar,
grava um registro em `dashboard_alert_dismissals` com `user_id` (auth.uid()) e
`alert_key` (id sintetico do alerta). O hook `useDashboardMetrics` filtra os
alertas cujo id sintetico aparece nessa tabela, antes de retornar a lista.

Na modal, adicionar botao "Dispensar todos" no rodape — visivel apenas quando ha
alertas — com dialog de confirmacao ("Dispensar todos os X alertas? Eles serao
removidos desta lista. Voce pode restaura-los nas configuracoes."). Ao confirmar,
insere um registro de dismiss para cada alerta visivel.

Nas Configuracoes do dashboard (ou no proprio modal, via link "Restaurar alertas"),
exibir botao "Restaurar todos os alertas dispensados" que deleta todos os registros
em `dashboard_alert_dismissals` do usuario. CRUD completo: dismiss individual (criar),
restaurar individual (deletar linha) e restaurar tudo (deletar todas as linhas).

---

## User stories

**US01** — Como assessora de gabinete revisando o dashboard, quero dispensar um
alerta individualmente, para que ele saia da modal sem que eu precise agir sobre
o registro-fonte neste momento.

**US02** — Como assessora com varios alertas acumulados que ja avaliei, quero
dispensar todos os alertas de uma vez (com confirmacao), para limpar a modal
rapidamente e comecar o dia com foco nos alertas novos.

**US03** — Como assessora que dispensou um alerta por engano, quero restaurar um
alerta dispensado individualmente, para que ele volte a aparecer na modal.

**US04** — Como assessora que quer resetar a visao de alertas, quero restaurar
todos os alertas dispensados de uma vez, para que a modal volte a mostrar o
estado completo calculado.

---

## Criterios de aceite

### US01 — Dismiss individual

- [ ] Cada item na `AlertsModal` exibe um botao X (icone) no canto direito, ao lado
  do icone de link externo existente
- [ ] Clicar no X de um alerta insere um registro em `dashboard_alert_dismissals`
  com `user_id = auth.uid()` e `alert_key = id do alerta` (ex: `vencida-abc123`)
- [ ] O alerta dispensado desaparece da modal sem fechar o dialog — os demais
  alertas permanecem visiveis
- [ ] O contador do badge no header do dashboard diminui em 1 apos o dismiss
  (sem reload de pagina)
- [ ] Apos reload completo da pagina, o alerta dispensado NAO reaparece na modal
- [ ] Se o alerta-fonte mudar de id (ex: tarefa vencida e concluida e outra tarefa
  nova vence), o novo alerta aparece normalmente (dismiss por `alert_key` exato)

### US02 — Dismiss em massa

- [ ] O rodape do `AlertsModal` exibe botao "Dispensar todos" apenas quando
  `alerts.length > 0`
- [ ] Clicar em "Dispensar todos" abre um dialog de confirmacao com texto:
  "Dispensar todos os [N] alertas? Eles serao removidos desta lista. Voce pode
  restaura-los a qualquer momento."
- [ ] Confirmar insere um registro de dismiss para cada alerta visivel no momento
  (insert em lote, nao loop sequencial de N requests)
- [ ] Apos confirmar, a modal exibe estado vazio ("Nenhum alerta no momento")
- [ ] O badge do header some ou exibe 0
- [ ] Cancelar o dialog nao altera nenhum dado

### US03 — Restaurar individual

- [ ] Na tela de Configuracoes (ou via link "Gerenciar alertas dispensados" no
  rodape do modal), existe listagem dos alertas dispensados com botao "Restaurar"
  por item
- [ ] Clicar em "Restaurar" deleta o registro correspondente em
  `dashboard_alert_dismissals`
- [ ] O alerta volta a aparecer no proximo calculo do hook (apos invalidate da query
  ou reload)

### US04 — Restaurar todos

- [ ] Na mesma tela/secao de Configuracoes, existe botao "Restaurar todos os alertas
  dispensados"
- [ ] Clicar exibe confirmacao ("Restaurar todos os [N] alertas dispensados?")
- [ ] Confirmar deleta todos os registros de `dashboard_alert_dismissals` do usuario
- [ ] Apos confirmar, a contagem de alertas dispensados na tela volta a 0

### Criterio transversal — CRUD completo (regra Rodrigo)

- [ ] Dismiss individual (criar) + restaurar individual (deletar) + restaurar todos
  (deletar lote) implementados — as tres operacoes de escrita presentes

### Criterio transversal — RLS e isolamento

- [ ] Usuario A dispensando um alerta nao afeta a visualizacao do Usuario B
  (RLS na tabela `dashboard_alert_dismissals` garante isolamento por `user_id`)
- [ ] Alerta com `alert_key = 'parado-abc123'` dispensado por usuario A continua
  visivel para usuario B

---

## Edge cases conhecidos

- **Alerta-fonte resolvido enquanto estava dispensado:** tarefa `vencida-abc123`
  e concluida; o hook para de gera-la naturalmente — o registro em `dismissals`
  fica orphao mas inofensivo (join por `alert_key` simplesmente nao retorna nada).
  Limpeza periodica de orphaos e out of scope da v1.
- **Novo alerta com mesmo alert_key:** improvavel (id sintetico inclui UUID do
  registro-fonte), mas se acontecer (ex: tarefa deletada e recriada com mesmo UUID)
  o alerta novo ficara suprimido pelo dismiss antigo. Comportamento aceitavel na v1.
- **Dismiss em massa com 0 alertas:** botao "Dispensar todos" nao aparece quando
  `alerts.length === 0` — impossivel de acionar.
- **Insert em lote de muitos dismissals:** limite pratico e 50 alertas por tipo
  (cap no hook), logo maximo 150 dismissals simultaneos — dentro do limite de
  payload do Supabase.
- **Listagem de alertas dispensados vazia (tela Configuracoes):** exibir estado
  vazio "Nenhum alerta dispensado" — sem espaco em branco.
- **Alerta de aniversariante:** o id e `ani-<contact_id>`, que e fixo por contato.
  Se o usuario dispensar o alerta de aniversario de Joao hoje, ele nao vera o
  alerta de Joao no ano seguinte (mesmo alert_key). Comportamento aceitavel na v1
  — aniversario e recorrente e o dismiss deve ser manual se quiser ver novamente.
  Documentar no PR.
- **Rede cai durante dismiss em massa:** insert em lote falha parcialmente; mostrar
  toast de erro e nao fechar o dialog de confirmacao. Itens ja inseridos ficam
  dispensados; usuario pode tentar novamente.

---

## Nao-objetivos (out of scope)

- Snooze com prazo (ex: "dispensar por 7 dias") — complexidade adicional sem demanda
  clara; fica como extensao futura
- Undo imediato com toast "Desfazer" apos dismiss individual — desejavel, mas aumenta
  complexidade de estado; a restauracao via Configuracoes cobre o caso de uso
- Push notification ou email quando novo alerta surge — fora do escopo desta task
- Configurar quais tipos de alerta aparecem (ex: desativar aniversariantes) — feature
  separada de preferencias de notificacao
- Alterar a logica de calculo dos alertas (threshold de dias, limites) — out of scope
- Qualquer mudanca na tela de Tarefas, Board ou Contatos — esta task e apenas o modal
  e a camada de persistencia de dismiss
- Limpeza automatica de registros orphaos em `dashboard_alert_dismissals` — cron job
  e out of scope da v1

---

## Metricas de sucesso

- **Primaria (quantitativa):** Badge de alertas deixa de ser ignorado — medido por
  observacao direta: Rodrigo/assessora abre a modal pelo menos 1x por sessao de
  trabalho na primeira semana apos entrega (vs comportamento atual de ignorar o badge)
- **Secundaria (quantitativa):** Alertas dispensados por sessao de trabalho >= 1
  na primeira semana — indica que a funcao esta sendo usada, nao apenas implementada
- **Terciaria (qualitativa):** Rodrigo relata que a modal mostra "so o que importa"
  na primeira revisao apos entrega — sinal de que o ruido foi reduzido
- **Como medir:** observacao direta na primeira semana + query
  `SELECT COUNT(*) FROM dashboard_alert_dismissals WHERE created_at >= NOW() - INTERVAL '7 days'`
  para confirmar uso real

---

## Riscos identificados

- **Valor:** Risco medio. O problema de ruido e real (Rodrigo relatou ignorar o badge),
  mas o valor depende de o usuario adotar o habito de dispensar alertas en vez de
  simplesmente fechar o modal. Mitigacao: o dismiss individual e de baixo atrito
  (botao inline, sem confirmacao para o caso individual).
- **Usabilidade:** Risco baixo. Dismiss individual e padrao conhecido (X no item).
  Dismiss em massa tem confirmacao que reduz risco de acao acidental. O maior risco
  e o usuario nao descobrir a tela de restauracao — mitigado pelo link "Gerenciar
  alertas dispensados" visivel no proprio modal.
- **Feasibility:** Risco baixo. Migration simples (tabela com 3 colunas + RLS por
  user_id). O hook existente precisa de um join/filter adicional antes de retornar
  os alertas — custo de query marginalmente maior, aceitavel dado o volume (max 150
  alertas por usuario).
- **Feasibility — alert_key de aniversariante recorrente:** Risco baixo-medio. O id
  `ani-<contact_id>` e permanente por contato, entao um dismiss dura para sempre.
  Documentar comportamento no PR; considerar expirar dismissals de tipo
  `aniversariante_sem_tarefa` por data (ex: `dismissed_until = fim_do_dia`) como
  extensao v2.
- **Business:** Risco baixo. Mudanca aditiva; nenhum dado existente e alterado.
  RLS garante que dismiss de um usuario nao vaza para outro.

---

## Decisoes de produto resolvidas

| Decisao | Escolha | Justificativa |
|---|---|---|
| Semantica de "exclusao" | Opcao A (snooze persistido via tabela) | Unica semantica consistente para os 3 tipos de alerta; reversivel; nao toca dados de origem |
| Confirmacao no dismiss individual | NAO — sem confirmacao, dismiss imediato | Baixo custo de reversao (restaurar via Configuracoes); confirmacao aumentaria atrito desnecessariamente |
| Confirmacao no dismiss em massa | SIM — dialog obrigatorio | Risco de acao acidental alto; custo de reversao maior (restaurar N itens); requisito original do briefing |
| Tela de restauracao | Link no rodape do modal + secao em Configuracoes | Visibilidade sem poluir o fluxo principal; usuario encontra quando precisar |
| Expiracao automatica de dismissals | Nao na v1 | Complexidade desnecessaria; restauracao manual cobre o caso de uso |
| Isolamento por usuario | RLS com user_id = auth.uid() | Padrao do sistema; cada assessora tem sua visao independente |

---

## Definition of Ready — atendida?

- [x] Persona especifica identificada (assessora de gabinete / Rodrigo revisando dashboard)
- [x] Job-to-be-done articulado
- [x] Semantica de "exclusao" definida com justificativa (Opcao A)
- [x] Criterios de aceite testáveis (sem "rapido"/"intuitivo")
- [x] Pelo menos uma metrica quantitativa (frequencia de uso do badge + query de dismissals)
- [x] Nao-objetivos listados (reduz scope creep)
- [x] Hipotese de solucao em alto nivel (sem codigo — tabela e join sao arquitetura, nao implementacao)
- [x] CRUD completo: dismiss (criar) + restaurar individual (deletar) + restaurar todos (deletar lote)
- [x] Riscos de feasibility identificados (alert_key recorrente de aniversariante)
- [x] Edge cases documentados (orphaos, rede cai, mesmo alert_key)

**DoR: ATENDIDA. Backlog pode quebrar em tasks atomizadas.**
