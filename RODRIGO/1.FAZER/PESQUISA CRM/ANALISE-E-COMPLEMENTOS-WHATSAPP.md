# Análise da Pesquisa + Complementos Propostos — WhatsApp CRM

> **Projeto:** Mandato Desk 2026 (CRM político — cliente Raquel)
> **Base:** `PESQUISA-CRM-WHATSAPP.md` (2026-05-16)
> **Data desta análise:** 2026-05-17
> **Status:** proposta — **nada será desenvolvido ainda**. Este documento +
> as 3 versões HTML interativas servem para você decidir o que aplicar.

---

## 1. Como ler este pacote de entrega

Você recebeu **4 arquivos**:

| Arquivo | O que é |
|---|---|
| `ANALISE-E-COMPLEMENTOS-WHATSAPP.md` | Este relatório — análise crítica + catálogo de complementos |
| `proposta-v1-paridade.html` | **Versão 1 — Paridade WhatsApp** (escopo enxuto) |
| `proposta-v2-relacionamento.html` | **Versão 2 — CRM de Relacionamento** (recomendada) |
| `proposta-v3-engajamento.html` | **Versão 3 — Plataforma de Engajamento** (completa) |

As 3 versões HTML são **interativas**: abra no navegador, marque/desmarque os
recursos, filtre por tema e veja o esforço total recalcular. No fim, o botão
"Resumo da seleção" gera uma lista pronta para copiar e me devolver — é assim que
você escolhe o que aplicar.

---

## 2. Avaliação da pesquisa existente

### 2.1 O que a pesquisa acertou

A `PESQUISA-CRM-WHATSAPP.md` é **sólida e bem fundamentada**. Pontos fortes:

- **Conceito correto.** Define com precisão que "CRM com WhatsApp" ≠ "chat que
  manda mensagem" — a conversa precisa ser o ambiente operacional.
- **Benchmark legítimo.** Kommo, HubSpot, Pipedrive, respond.io etc. são, de fato,
  as referências certas.
- **Diagnóstico honesto do código.** O cruzamento recurso×estado (🟢🟡🔴) está
  ancorado em leitura real dos arquivos (`ConversasTabContent.tsx`, `useZapiChats`),
  não em achismo.
- **Roadmap acionável.** As 5 fatias (A→E) são bem ordenadas por viabilidade
  comercial.
- **Consciência técnica.** A seção 9 (Z-API não-oficial, risco de ban, RLS,
  Edge Functions, LGPD) mostra entendimento das restrições reais.

**Veredito:** a pesquisa não precisa ser refeita. Precisa ser **completada** —
ela cobre muito bem a "camada de operação CRM dentro da conversa", mas deixa
pontos cegos que descrevo abaixo.

### 2.2 Pontos cegos da pesquisa (onde ela fica devendo)

| # | Lacuna | Por que importa |
|---|---|---|
| L1 | **Interações nativas do WhatsApp.** A pesquisa cataloga "enviar/receber mensagem" mas ignora responder/citar uma mensagem, reagir com emoji, encaminhar, buscar dentro da conversa, favoritar mensagem. | São o "óbvio" que todo usuário de WhatsApp espera. A ausência é percebida na hora — antes mesmo dos recursos de CRM. O código já recebe reações (`MessageBubble` trata `media_type='reaction'`) mas **não deixa o operador enviar**. |
| L2 | **Domínio político pouco explorado.** A seção 5.4 reconhece que "pipeline" político ≠ vendas, mas o catálogo segue genérico. Não há broadcast segmentado, protocolo de demanda, aniversário do eleitor, convite a evento, captura de bairro/zona. | É **aqui** que o produto vira um CRM *político* e não "mais um WhatsApp CRM genérico". É o maior diferencial competitivo não capturado. |
| L3 | **LGPD e ban viram só "risco", nunca recurso.** A seção 11 lista os dois como armadilhas, mas a mitigação fica no nível de conselho ("seja comedido"). | Para um mandato, isso precisa virar **funcionalidade**: registro de opt-in por contato, ritmo controlado de disparo, bloqueio de broadcast a quem não consentiu. |
| L4 | **Confiabilidade operacional do Z-API.** A pesquisa sabe que o Z-API é não-oficial e cai, mas não propõe monitorar a conexão, alertar quando o QR cai, nem fila de reenvio. | Se o número desconecta e ninguém percebe, o gabinete fica "mudo" sem saber. É um recurso de viabilidade, não de conforto. |
| L5 | **Camada de IA genérica.** A seção 6.1 lista 4 itens de IA em uma linha cada. Falta transcrição de áudio — e eleitores mandam **muito** áudio. | Transcrição torna áudio pesquisável e atende acessibilidade; é talvez o item de IA com melhor custo/benefício. |
| L6 | **Metodologia do próprio documento.** O catálogo tem prioridade (MUST/SHOULD/COULD) e tamanho (P/M/G), mas **não tem critério de aceite por recurso, estimativa em horas, grafo de dependências nem KPIs**. | Sem isso, a pesquisa não vira backlog executável direto. (Tratado na seção 5 — é melhoria do processo, não do produto.) |

---

## 3. Catálogo de complementos propostos

39 recursos que **não estão** nos 62 da pesquisa original, organizados em 6 temas.
Legenda: prioridade **MUST/SHOULD/COULD**; esforço **P** (<1 dia) · **M** (1-3 dias) · **G** (>3 dias).

### Tema 1 — Interações nativas do WhatsApp (lacuna L1)

| Cód | Recurso | Prior. | Esf. | Referência de mercado / nota |
|---|---|---|---|---|
| C1 | **Responder/citar mensagem específica** (reply-to) | MUST | M | Padrão universal. Hoje o operador não consegue citar uma mensagem ao responder — confunde em conversa longa. |
| C2 | **Reagir a mensagem com emoji** (enviar reação) | SHOULD | P | O código já **exibe** reações recebidas; falta deixar o operador **enviar**. Fecha o ciclo barato. |
| C3 | **Encaminhar mensagem** entre conversas | SHOULD | M | Repassar um áudio/mídia de demanda para outra conversa ou atendente. |
| C4 | **Buscar texto dentro da conversa** | MUST | M | A pesquisa tem busca global (#51) mas não busca *intra-conversa*. |
| C5 | **Favoritar/marcar mensagem** | COULD | P | Marcar mensagens-chave (endereço, compromisso) + aba "importantes" por conversa. |
| C6 | **Recibos de leitura + "digitando…"** | SHOULD | M | Mostrar ✓✓ azul (eleitor leu) e indicador de digitação — reduz a incerteza do atendente. |
| C7 | **Mensagem de localização** (receber/enviar) | COULD | M | Eleitor manda o local de um problema (buraco, obra). Cruza com o mapa Leaflet que o projeto já tem. |
| C8 | **Refletir edição/exclusão** de mensagem | COULD | P | Acompanhar o recurso novo do WhatsApp, conforme o Z-API expõe. |

### Tema 2 — Produtividade de atendimento (complementa a Fatia D)

| Cód | Recurso | Prior. | Esf. | Referência de mercado / nota |
|---|---|---|---|---|
| C9 | **Agendar envio de mensagem** (send later) | SHOULD | M | Escrever agora, enviar no horário (bom dia, parabéns). Padrão Kommo/respond.io. |
| C10 | **Snooze de conversa** ("lembrar depois") | SHOULD | P | A conversa some da lista ativa e volta no horário marcado. A pesquisa cita snooze no benchmark mas não cataloga. |
| C11 | **Variáveis nas respostas rápidas** (`{{nome}}`, `{{bairro}}`) | SHOULD | P | Personalização automática — complementa o #40 da pesquisa. |
| C12 | **Categorias/pastas de respostas rápidas** | COULD | P | Organiza os snippets por tema quando viram dezenas. |
| C13 | **Ações em massa na lista de conversas** | SHOULD | M | Multi-seleção → atribuir/etiquetar/arquivar em lote. |
| C14 | **Visões salvas de conversas** (smart folders) | SHOULD | M | Filtros nomeados ("minhas abertas", "demandas do bairro X"). Reaproveita o padrão `FiltrosFavoritos` que o projeto já tem em contatos. |
| C15 | **Rascunho persistente por conversa** | COULD | P | Texto não enviado fica salvo ao trocar de conversa. |
| C16 | **Nota de handoff na transferência** | SHOULD | P | Ao transferir, exigir uma nota de contexto. Complementa o #9 da pesquisa. |

### Tema 3 — CRM político (lacuna L2 — maior diferencial)

| Cód | Recurso | Prior. | Esf. | Referência de mercado / nota |
|---|---|---|---|---|
| C17 | **Listas / broadcast segmentado** por tag/bairro/região | SHOULD | G | Comunicado a um segmento com **ritmo controlado anti-ban**. A pesquisa só descreve o *risco* de banimento — não oferece a feature segura. |
| C18 | **Protocolo de demanda com retorno ao eleitor** | SHOULD | M | Conversa vinculada a uma demanda com nº de protocolo; mudança de status dispara mensagem ("ofício encaminhado", "demanda concluída"). |
| C19 | **Lembrete de aniversário/datas do eleitor** | SHOULD | M | O projeto já tem `BirthdaySection` no dashboard — trazer para a conversa: alerta + mensagem de parabéns em 1 clique. |
| C20 | **Convite a evento/agenda do mandato** | COULD | M | Enviar convite de evento pela conversa e registrar a confirmação. |
| C21 | **Bairro/região/zona eleitoral no painel** | SHOULD | M | Capturar e exibir a localização do eleitor; integra com o `LeadsMap` existente. |
| C22 | **Régua de relacionamento** (cadência por etapa) | COULD | G | Follow-up automático de quem não respondeu — padrão Kommo/RD Station. |
| C23 | **Campanhas temáticas / pesquisa de opinião** | COULD | G | Disparar enquete a um segmento e consolidar respostas. O `PollDialog` já existe. |
| C24 | **Consentimento / opt-in LGPD por contato** | SHOULD | M | Registrar consentimento; bloquear broadcast a quem não deu opt-in. Transforma a lacuna L3 em recurso. |

### Tema 4 — Confiabilidade e operação em equipe (lacunas L3/L4)

| Cód | Recurso | Prior. | Esf. | Referência de mercado / nota |
|---|---|---|---|---|
| C25 | **Monitor de saúde da conexão Z-API** | MUST | M | Status da instância, alerta quando o QR cai/desconecta, botão reconectar. Z-API é não-oficial e cai sozinho — sem isso o gabinete fica "mudo" sem saber. |
| C26 | **Multi-número / multi-instância** | COULD | G | Vários números no mesmo CRM (gabinete + campanha). `ContasTabContent` já gerencia contas — estender para conversas. |
| C27 | **Horário de atendimento configurável** | SHOULD | P | Define expediente + aviso automático fora do horário. Complementa o #41. |
| C28 | **SLA + alerta de conversa parada** | SHOULD | M | Destaca conversa sem resposta há X tempo. Complementa indicadores (#54). |
| C29 | **CSAT — pesquisa de satisfação pós-atendimento** | COULD | M | Pesquisa enviada ao finalizar a conversa. Padrão Zendesk. |
| C30 | **Modo supervisor** | COULD | G | Ver todas as conversas, intervir, métricas por atendente. A memória da EM051 listou como "MVP fora" — vale revisitar. |
| C31 | **Exportar/imprimir conversa** | COULD | P | Gerar PDF de uma conversa para registro formal de demanda. |
| C32 | **Fila de envio offline / reenvio automático** | COULD | M | Se o envio falha (queda do Z-API), enfileira e reenvia. |

### Tema 5 — Inteligência (lacuna L5 — detalha a Fatia E)

| Cód | Recurso | Prior. | Esf. | Referência de mercado / nota |
|---|---|---|---|---|
| C33 | **Resumo automático da conversa** | COULD | M | Detalha o #57 — útil na transferência/retomada. |
| C34 | **Sugestão de resposta com IA** (rascunho) | COULD | M | Detalha o #56. `useAISettings` já existe no projeto. |
| C35 | **Classificação automática de assunto/intenção** | COULD | M | Auto-categoriza a demanda do eleitor. Detalha o #58. |
| C36 | **Análise de sentimento** | COULD | P | Prioriza a fila por urgência/insatisfação. |
| C37 | **Next-best-action** por contato | COULD | M | Sugestão da próxima ação — padrão Freshsales/Kommo (#59). |
| C38 | **Transcrição automática de áudios** | COULD | M | **Não está na pesquisa.** Eleitores mandam muito áudio — transcrever torna pesquisável e acessível. Melhor custo/benefício da camada de IA. |

### Tema 6 — Qualidade de dados

| Cód | Recurso | Prior. | Esf. | Referência de mercado / nota |
|---|---|---|---|---|
| C39 | **Detecção de duplicado ao criar contato** | SHOULD | P | Ao criar contato pela conversa (#6 da pesquisa), checar duplicados. O projeto já tem `useDuplicates` + `ContactMergeModal` — reaproveitar. |

### Tema 7 — Configuração e governança *(requisito adicionado pelo cliente)*

| Cód | Recurso | Prior. | Esf. | Referência de mercado / nota |
|---|---|---|---|---|
| C40 | **Painel de recursos por conta do WhatsApp** (feature toggles) | MUST | M | Feature flags por canal — padrão de plataformas multi-conta (respond.io, Kommo). Cada conta Z-API (`ContasTabContent` / `AccountFormDialog`) ganha uma aba **"Recursos"** onde se liga/desliga os recursos opcionais — **principalmente os de IA**. Ex.: o número de campanha tem broadcast + IA ativos; o número do gabinete, não. |

---

## 4. As 3 versões — qual escolher

Cada versão HTML é um **escopo fechado** que você pode ainda refinar marcando/
desmarcando recursos. A relação entre elas é cumulativa (V2 contém V1; V3 contém V2).

| Versão | Recursos | Esforço* | Para quem é | Posicionamento de mercado |
|---|---|---|---|---|
| **V1 — Paridade WhatsApp** | 14 complementos | ~28 pts | Quer fechar rápido o "óbvio" e os gaps de confiabilidade | Sai de "caixa de entrada incompleta" para "WhatsApp decente" |
| **V2 — CRM de Relacionamento** ⭐ | 26 complementos | ~64 pts | Quer um CRM **político** de verdade, com diferencial | Entra no patamar Kommo/respond.io **+ identidade política** |
| **V3 — Plataforma de Engajamento** ✅ **escolhida** | 40 complementos | ~111 pts | Quer produto premium, vendável a outros mandatos | Supera o benchmark com IA, automação e multi-número |

> *Esforço em pontos relativos (P=1, M=3, G=6). **Não é estimativa em horas** —
> serve só para comparar o peso entre versões.

**Decisão do cliente (2026-05-17):** escopo **V3 — Plataforma de Engajamento**,
com um requisito adicional: os recursos opcionais — **principalmente os de IA** —
precisam poder ser **ligados/desligados por conta do WhatsApp**. Esse requisito
virou o recurso **C40** e está detalhado na seção 4.1.

> **Importante:** estes complementos **somam-se** ao roadmap original da pesquisa
> (Fatias A→E). A ordem recomendada continua sendo **primeiro a Fatia A** (tornar
> a conversa um CRM) — sem o painel lateral editável, vários destes complementos
> não têm onde "morar". O ideal é intercalar: Fatia A → V1 → Fatia B/C → V2.

### 4.1 Recurso C40 — Configuração de recursos por conta do WhatsApp

Como a V3 traz IA, automação e broadcast, faz sentido que cada **conta Z-API**
decida o que usar. O recurso C40 entrega isso.

**Onde mora:** o projeto já tem o módulo de contas (`ContasTabContent.tsx`,
`AccountCard.tsx`, `AccountFormDialog.tsx`). C40 adiciona uma aba/seção
**"Recursos"** na configuração de cada conta.

**Como funciona:**
- Cada conta tem um conjunto de *flags* (liga/desliga) persistido no banco
  (coluna `recursos_config` JSONB em `zapi_accounts`, ou tabela
  `zapi_account_features`).
- Os recursos **opcionais** aparecem como interruptores agrupados por tema. Os
  recursos **base** (responder, buscar, monitor de conexão) **não** são
  desligáveis — não há motivo para isso e remove pegadinha de "sumiu o botão".
- O bloco de **IA** fica em destaque, com aviso de que esses recursos consomem
  a integração de IA do projeto (`useAISettings`) — e podem ter custo por uso.
- O front lê as flags da conta ativa e **esconde/mostra** os recursos na tela de
  conversa. Recurso desligado = código não roda (nada de chamada de IA "à toa").

**Quais recursos são configuráveis por conta** (marcados com `⚙` na V3):

| Categoria | Recursos configuráveis |
|---|---|
| **IA** (destaque do pedido) | C33 Resumo · C34 Sugestão de resposta · C35 Classificação · C36 Sentimento · C37 Next-best-action · C38 Transcrição de áudio |
| Automação & alcance | C9 Agendar envio · C17 Broadcast · C22 Régua de relacionamento · C23 Campanhas · C32 Fila de reenvio |
| Engajamento & gestão | C19 Aniversário · C20 Convite a evento · C24 Opt-in LGPD · C27 Horário · C28 SLA · C29 CSAT · C30 Supervisor |
| Interação | C6 Recibos de leitura (preferência de privacidade) |

> **Cenário típico:** a conta **"Gabinete Raquel"** liga IA de resumo e
> transcrição (ajuda o atendimento), mas mantém broadcast e régua **desligados**
> (evita risco de ban no número institucional). Já a conta **"Campanha"** liga
> tudo. Sem C40, a equipe teria de escolher um perfil único para todos os números.

**Esquema de dados sugerido** (a confirmar pelo agente Backlog na hora de
desenvolver): `zapi_accounts.recursos_config JSONB DEFAULT '{}'` — chave =
código do recurso (`c34`, `c38`…), valor = boolean. *Default seguro:* recursos de
IA e broadcast **começam desligados**; o operador liga conscientemente.

---

## 5. Complemento de processo (lacuna L6)

Independentemente da versão escolhida, recomendo enriquecer o backlog com 4 itens
que a pesquisa não traz e que o agente de Backlog vai precisar:

1. **Critério de aceite por recurso** — hoje há só uma "Observação". Cada recurso
   precisa de um "Given/When/Then" testável.
2. **Estimativa em horas** — converter P/M/G em faixas reais ao montar o sprint.
3. **Grafo de dependências** — ex.: C17 (broadcast) depende de C24 (opt-in);
   C18 (protocolo) depende da Fatia A; C28 (SLA) depende do status (#8).
4. **KPIs por fatia** — ex.: cliques por atendimento, tempo médio de resposta,
   % de demandas com protocolo. Sem métrica não dá para saber se o recurso pegou.

Isso é trabalho do agente PO/Backlog **quando você decidir desenvolver** — não
agora.

---

## 6. Próximos passos

Escopo decidido: **V3 + C40** (configuração por conta). O arquivo
`proposta-v3-engajamento.html` foi atualizado — agora tem **40 recursos**, o C40
em destaque e o selo `⚙ por conta` nos recursos configuráveis (filtro próprio na
barra de filtros).

1. Abrir `proposta-v3-engajamento.html` e revisar a seleção (vem com os 40
   marcados). Desmarcar o que não quiser de saída.
2. Conferir, no filtro **"⚙ Configurável por conta"**, se a lista de recursos que
   ficarão liga/desliga está coerente com o esperado.
3. Usar **"Resumo da seleção"** para gerar a lista final e devolver.
4. Aí disparamos o fluxo QG / `/qg-manual` para a construção — começando pela
   **Fatia A** da pesquisa original (painel lateral editável), depois **C40**
   (a infraestrutura de toggles, que vários recursos vão consumir), e então os
   demais recursos.

> **Ordem técnica recomendada:** C40 deve ser um dos **primeiros** a entrar — é
> a "tomada" onde os recursos de IA/automação se conectam. Construir IA antes do
> painel de toggles obrigaria a refatorar depois.

---

> **Fontes:** mesmas plataformas da pesquisa original (Kommo, HubSpot, Pipedrive,
> Bitrix24, RD Station, Zendesk, respond.io, Rasayel, Freshsales) + leitura do
> código atual (`MessageBubble.tsx`, `ConversasTabContent.tsx`, `ContasTabContent.tsx`,
> `useZapiChats`, `useZapiMessages`, `useDuplicates`, `BirthdaySection`, `LeadsMap`).
