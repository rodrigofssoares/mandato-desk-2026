# RAQ-MAND-EM051 — Integração Z-API WhatsApp (MVP)

**Cliente:** Raquel (Mandato Desk 2026)
**Codigo QG:** RAQ-MAND-EM051
**Prioridade:** alta
**Escrito por:** Agente PO em 2026-05-09

---

## Contexto e problema

O gabinete de Raquel usa WhatsApp como canal primario de atendimento politico. Hoje cada atendente opera o proprio celular de forma descentralizada: nao ha historico centralizado, nao ha rastreabilidade de quem respondeu o que, e Rodrigo (admin do sistema) nao tem visibilidade das conversas. Quando uma demanda chega por WhatsApp ela precisa ser registrada manualmente no CRM — processo que depende de disciplina individual e gera perda de dados.

O problema de negocio e duplo: (1) ausencia de rastreabilidade de conversas por contato cadastrado no CRM e (2) impossibilidade de supervisao e auditoria do atendimento. A solucao adotada e integrar o Mandato Desk diretamente com a Z-API (gateway brasileiro de WhatsApp Business), criando uma interface tipo WhatsApp Web embutida no sistema, com vinculacao automatica de conversas aos contatos ja cadastrados.

O MVP (esta entrega) cobre 2 contas WhatsApp, texto puro, recepcao e envio em tempo real, rastreamento de status (enviada/entregue/lida/erro) e logs de webhook. Midia, botoes, templates e expansao para 15 contas ficam em entregas futuras — estrutura ja deve suportar, mas nao sera implementada agora.

---

## Jobs-to-be-done

**Atendente (operador do painel):**
Quando estou atendendo um eleitor pelo WhatsApp, quero ver e responder as mensagens diretamente no Mandato Desk, para que eu nao precise alternar entre celular e CRM e perca o vinculo entre a conversa e o contato cadastrado.

**Admin do mandato (Rodrigo):**
Quando preciso auditar o atendimento ou diagnosticar falha de entrega, quero ver todos os eventos de webhook e logs de erro por conta, para que eu possa agir antes que o problema afete a comunicacao com eleitores.

**Configurador (tambem Rodrigo, no MVP):**
Quando cadastro uma nova conta WhatsApp no sistema, quero inserir as credenciais Z-API e gerar a URL de webhook correspondente, para que a conta comece a receber eventos sem precisar de intervencao tecnica adicional.

---

## Personas

### P1 — Atendente do painel
Membro do gabinete designado para operar uma conta WhatsApp especifica. No MVP sao ate 2 pessoas. Acessa apenas o painel da sua conta. Nao ve outras contas. Precisa de senha extra alem do login Mandato Desk para abrir as conversas (protecao adicional de privacidade). Seu job: ler e responder mensagens de texto, ver status de entrega.

### P2 — Admin / Configurador (Rodrigo)
Unico perfil com role `admin` no sistema. Cadastra contas Z-API (Instance ID + Token + Client-Token + senha extra do painel). Visualiza todos os paineis, logs e webhooks. Reseta senhas extras de paineis. Nao e o operador cotidiano — e o gestor da infraestrutura.

### P3 — Supervisor (FORA DO MVP)
Perfil que ve todas as conversas de todos os paineis sem operar nenhum. Deixado explicitamente fora do MVP. Estrutura RBAC futura deve acomodar, mas sem implementar agora.

---

## Hipotese de solucao (alto nivel)

Nova secao `/integracoes/whatsapp` no Sidebar com 4 subabas: **Contas**, **Conversas**, **Webhooks**, **Logs**.

- **Contas:** listagem das contas Z-API cadastradas (nome, status de conexao, Instance ID ofuscado). Admin cria/edita/exclui contas. Cada conta tem senha extra de painel (bcrypt no banco, tabela `zapi_panel_passwords`). CRUD completo obrigatorio.
- **Conversas:** ao clicar numa conta, pede senha extra (modal). Apos validacao, abre interface estilo WhatsApp Web — lista de chats a esquerda, conversa selecionada a direita. Mensagens em tempo real via Supabase Realtime. Envio de texto pelo campo inferior. Status de cada mensagem visivel (icone de check: enviada / dois checks: entregue / dois checks azuis: lida / X vermelho: erro).
- **Webhooks:** por conta, exibe a URL de webhook gerada (Edge Function publica `zapi-webhook`) e o segredo de validacao. Botao de copiar. Admin pode rever o segredo.
- **Logs:** tabela paginada de eventos recebidos pela Edge Function, com payload resumido, timestamp, tipo de evento e status de processamento. Filtro por conta e por tipo. Retencao de 90 dias (deletar registros mais antigos automaticamente, via pg_cron ou criterio de purge futuro).

Vinculacao de conversa a contato: matching automatico por numero normalizado E.164 contra `contacts.whatsapp`. Se bater, exibe nome e link para o contato. Se nao bater, exibe numero bruto sem criar contato automaticamente (decisao deliberada — nao criar lixo no CRM).

---

## User stories

- **US01** — Como Rodrigo (admin), quero cadastrar uma conta Z-API com nome, Instance ID, Token, Client-Token e senha extra do painel, para que a conta comece a receber eventos de webhook sem configuracao manual adicional.

- **US02** — Como Rodrigo (admin), quero editar ou excluir uma conta Z-API cadastrada (incluindo resetar a senha extra do painel), para corrigir credenciais erradas ou desativar uma conta sem perder os logs historicos.

- **US03** — Como atendente, quero inserir a senha extra do painel para acessar as conversas da minha conta WhatsApp, para que nenhum outro usuario do Mandato Desk veja minhas conversas sem autorizacao.

- **US04** — Como atendente, quero ver a lista de conversas da minha conta WhatsApp em tempo real (atualiza sem recarregar), para saber imediatamente quando um novo contato ou mensagem chega.

- **US05** — Como atendente, quero selecionar uma conversa e ver o historico de mensagens trocadas com aquele numero, com status (enviada/entregue/lida/erro) visivel para cada mensagem, para acompanhar se o eleitor recebeu e leu minha resposta.

- **US06** — Como atendente, quero digitar e enviar uma mensagem de texto para o numero da conversa selecionada, para responder ao eleitor sem sair do Mandato Desk.

- **US07** — Como atendente, quero ver o nome do contato CRM vinculado a cada conversa (quando o numero bate com `contacts.whatsapp`), para identificar rapidamente quem e o eleitor.

- **US08** — Como Rodrigo (admin), quero copiar a URL de webhook e o segredo de validacao de cada conta Z-API, para configurar o endpoint no painel da Z-API sem precisar pedir ajuda tecnica.

- **US09** — Como Rodrigo (admin), quero ver o log de todos os eventos recebidos pelo webhook (tipo, timestamp, conta, status de processamento), filtrado por conta, para diagnosticar perdas de mensagem ou erros de entrega.

---

## Criterios de aceite (Gherkin)

### US01 — Cadastrar conta Z-API

```
Given: Rodrigo esta autenticado com role admin e acessa Integracoes > WhatsApp > Contas
When: preenche nome, Instance ID, Token, Client-Token e senha extra (min 6 chars) e clica em Salvar
Then: a conta aparece na lista com status "Configurado" e nao mostra Token nem Client-Token em texto claro (ambos sao ofuscados com "****")
And: a URL de webhook para essa conta e exibida automaticamente na aba Webhooks
And: a senha extra e armazenada como hash bcrypt (nao texto puro) — verificavel por query direta na tabela `zapi_panel_passwords`
```

### US02 — Editar e excluir conta

```
Given: existe ao menos 1 conta cadastrada
When: Rodrigo clica em "Editar" em uma conta, altera o nome e salva
Then: a lista atualiza com o novo nome em menos de 2 segundos sem recarregar a pagina

When: Rodrigo clica em "Excluir" e confirma no dialogo
Then: a conta some da lista
And: os logs associados a essa conta permanecem na tabela `zapi_webhook_log` com `account_id` preservado (soft reference — nao cascadeia delete)

When: Rodrigo clica em "Resetar senha extra" e digita nova senha (min 6 chars)
Then: a senha extra e atualizada (novo hash bcrypt) e o atendente precisa usar a nova senha no proximo acesso ao painel
```

### US03 — Senha extra do painel

```
Given: usuario autenticado acessa Integracoes > WhatsApp > Conversas
When: clica em uma conta para abrir as conversas
Then: um modal solicita a senha extra do painel antes de exibir qualquer conversa

When: digita senha incorreta
Then: mensagem de erro "Senha incorreta" aparece e o modal permanece
And: apos 5 tentativas erradas em 60 segundos, o modal exibe "Muitas tentativas. Aguarde 60 segundos." e bloqueia novos envios pelo tempo restante

When: digita senha correta
Then: o modal fecha e as conversas sao exibidas
And: a sessao de senha e valida por ate 30 minutos (inatividade encerra) — sem precisar redigitar nesse periodo
```

### US04 — Lista de conversas em tempo real

```
Given: atendente passou pela validacao de senha extra e esta na tela de conversas
When: um novo numero envia mensagem pela primeira vez para a conta Z-API
Then: a conversa aparece no topo da lista em menos de 5 segundos (via Supabase Realtime)
And: o preview da ultima mensagem e o horario sao exibidos

When: a lista esta vazia (nenhuma conversa ainda)
Then: exibe mensagem "Nenhuma conversa ainda. Aguardando mensagens..."
```

### US05 — Historico e status de mensagens

```
Given: atendente selecionou uma conversa
When: a tela de conversa abre
Then: as mensagens sao exibidas em ordem cronologica ascendente, com baloes diferenciados (enviadas a direita, recebidas a esquerda)
And: cada mensagem enviada exibe icone de status: 1 check cinza (enviada), 2 checks cinzas (entregue), 2 checks azuis (lida), X vermelho (erro)

When: uma nova mensagem chega na conversa aberta
Then: ela aparece no fim da lista em menos de 5 segundos sem recarregar

When: o status de uma mensagem enviada muda (ex: delivered -> read)
Then: o icone atualiza automaticamente em menos de 5 segundos
```

### US06 — Envio de mensagem de texto

```
Given: atendente esta numa conversa aberta e a conta Z-API esta conectada
When: digita texto no campo inferior e pressiona Enter ou clica em Enviar
Then: a mensagem aparece imediatamente na conversa com status "enviada" (1 check)
And: em background a Edge Function `zapi-send-text` chama a API Z-API e atualiza o status para "entregue" quando o webhook confirmar

When: a conta Z-API esta desconectada (instancia offline)
Then: o campo de envio exibe aviso "Conta desconectada — mensagem nao pode ser enviada" e o botao Enviar fica desabilitado

When: o texto esta vazio (somente espacos)
Then: o botao Enviar fica desabilitado e nenhuma requisicao e feita
```

### US07 — Vinculacao conversa-contato

```
Given: uma conversa existe com numero "+5511999990000"
When: existe um contato em `contacts` com `whatsapp` = "+5511999990000" (ou variacao sem +55 que normalize igual)
Then: o nome do contato e exibido no topo da conversa com link clicavel para a pagina do contato no CRM

When: o numero nao bate com nenhum contato
Then: o numero bruto e exibido sem link e sem criar um contato automaticamente
```

### US08 — URL e segredo de webhook

```
Given: Rodrigo acessa Integracoes > WhatsApp > Webhooks
When: seleciona uma conta cadastrada
Then: a URL de webhook da conta e exibida no formato: `https://<projeto>.functions.supabase.co/zapi-webhook?account=<uuid>`
And: o segredo de validacao (hex 32 chars) e exibido ofuscado com botao "Mostrar" e botao "Copiar"

When: Rodrigo clica em "Copiar URL"
Then: a URL e copiada para o clipboard e um toast "URL copiada!" aparece por 3 segundos
```

### US09 — Log de webhooks

```
Given: Rodrigo acessa Integracoes > WhatsApp > Logs
When: a aba carrega
Then: exibe tabela com colunas: Conta, Tipo de evento, Timestamp, Status (processado/erro), Payload (truncado em 200 chars)
And: ha filtros por Conta (dropdown) e por Tipo de evento (dropdown)
And: paginacao de 50 registros por pagina

When: um evento de webhook e recebido pela Edge Function com payload invalido ou assinatura incorreta
Then: o log registra o evento com Status = "erro" e detalhe do motivo
And: a mensagem nao e persistida em `zapi_messages`
```

---

## Regra CRUD obrigatorio (regra Rodrigo)

- Contas Z-API: criar + editar + excluir. Incluindo resetar senha extra.
- A aba Logs e somente leitura (sem CRUD — logs sao imutaveis por auditoria).
- Conversas e Webhooks nao tem CRUD proprio — dependem das contas.

---

## Edge cases conhecidos

- **Instancia Z-API offline:** webhook de status pode nao chegar. Mensagem fica presa em "enviada". Sistema nao pode travar — UI exibe status atual sem forcar reconexao.
- **Numero sem codigo de pais:** Z-API pode retornar numeros sem "+55". A normalizacao de matching com `contacts.whatsapp` deve usar a mesma funcao `normalize_phone()` ja existente no projeto (migration 001), comparando apenas digitos.
- **Webhook duplicado (retry Z-API):** a Edge Function deve ser idempotente — identificar evento por `messageId` da Z-API e ignorar inserts duplicados (ON CONFLICT DO NOTHING em `zapi_messages`).
- **Payload de webhook muito grande:** Z-API pode incluir base64 de midia mesmo sem solicitar. A Edge Function trunca ou ignora o campo `media` no MVP — nao persiste base64 no banco.
- **Concorrencia de sessao de senha:** dois atendentes usando a mesma conta ao mesmo tempo e um cenario valido (2 contas, potencialmente 2+ atendentes por conta no futuro). RLS por `panel_id` deve garantir que a sessao de senha de um nao interfira no outro.
- **Supabase Realtime quota:** plano Free tem limite de 200 conexoes simultaneas. Com 2 contas e poucos usuarios, sem risco imediato. Documentar para quando expandir para 15 contas.
- **Token Z-API comprometido:** Admin deve poder rotacionar o Token/Client-Token via edicao da conta. Tokens sao criptografados em repouso (Vault Supabase ou AES via Edge Function — Backlog define qual).
- **LGPD:** mensagens WhatsApp sao dados pessoais de terceiros (eleitores). Armazenamento deve ter retencao maxima definida. Proposta MVP: 90 dias. Rodrigo deve confirmar com Raquel se ha politica de privacidade que cubra esse armazenamento.
- **Rate limit Z-API:** envios em rajada podem ser bloqueados. Edge Function `zapi-send-text` deve tratar HTTP 429 e retornar erro claro para a UI.
- **Lista vazia de chats:** quando a conta nunca recebeu mensagem, `zapi_chats` estara vazia. UI exibe estado vazio com instrucao.

---

## Nao-objetivos (fora do escopo MVP EM051)

- Envio de midia (imagens, audio, video, arquivos, figurinhas).
- Botoes interativos e listas de opcoes (WhatsApp Business API).
- Templates de mensagens prontas.
- Expansao para mais de 2 contas (estrutura permite, mas nao sera configurada).
- Perfil "Supervisor" que ve todos os paineis sem senha extra.
- RBAC granular por permissao dentro do modulo WhatsApp (ex: atendente so ve proprias conversas por configuracao — no MVP e por senha extra, nao por policy de usuario).
- Criacao automatica de contato ao receber mensagem de numero desconhecido.
- Importacao de historico anterior de conversas.
- Notificacoes push/browser para novas mensagens.
- Relatorios e metricas de atendimento (ex: tempo medio de resposta).
- Integracao com qualquer plataforma alem da Z-API.

---

## Metricas de sucesso

- **M1 (configuracao):** Rodrigo cadastra a primeira conta Z-API e copia a URL de webhook em menos de 3 minutos, sem instrucao adicional.
- **M2 (recepcao):** mensagem enviada por celular externo aparece na UI do Mandato Desk em menos de 5 segundos.
- **M3 (envio):** atendente envia mensagem de texto e o status muda de "enviada" para "entregue" em menos de 10 segundos (depende da Z-API — mensagem com receptor online).
- **M4 (vinculacao):** 100% das conversas cujo numero bate com `contacts.whatsapp` exibem o nome do contato (sem falso negativo por formatacao diferente de numero).
- **M5 (auditoria):** 0 eventos de webhook sao perdidos silenciosamente — toda falha de processamento aparece no log com motivo.
- **M6 (seguranca):** nenhum Token Z-API ou senha extra e exposta em texto puro em qualquer resposta de API ou log do sistema.

Como medir: M1/M2/M3 por observacao direta na primeira sessao de uso (Rodrigo + Raquel). M4 por query `SELECT COUNT(*) FROM zapi_chats WHERE contact_id IS NULL AND phone IN (SELECT normalize_phone(whatsapp) FROM contacts WHERE whatsapp IS NOT NULL)` — deve retornar 0. M5 por inspecao da tabela `zapi_webhook_log` apos 24h de uso. M6 por code review do Security agent.

---

## Riscos identificados

| Dimensao | Risco | Mitigacao |
|---|---|---|
| **Valor** | Atendentes resistem a trocar o celular pelo Mandato Desk por habito | MVP com 2 pessoas escolhidas por Raquel (early adopters voluntarios); feedback antes de expandir para 15 |
| **Usabilidade** | Senha extra e vista como friccao desnecessaria | Sessao de 30 minutos sem re-autenticacao; explicar o motivo de privacidade durante onboarding |
| **Feasibility** | Z-API pode nao entregar webhook de status (delivered/read) para todos os numeros (depende de tipo de conta WhatsApp — Business vs Personal) | Documentar no onboarding que status "lida" so funciona com WhatsApp Business API; Personal pode ficar em "entregue" |
| **Feasibility** | Supabase Realtime pode ter latencia alta em conexoes simultaneas no plano atual | Testar com 2 conexoes abertas; se latencia > 5s, adicionar polling como fallback |
| **Business** | Custo Z-API e recorrente por instancia (plano mensal por numero de WhatsApp) | Rodrigo ja tem conhecimento disso — registrado como premissa, nao risco bloqueante |
| **Seguranca** | Token Z-API armazenado sem criptografia vira vetor de comprometimento | Security agent deve validar implementacao do Vault/AES antes do QA |
| **LGPD** | Mensagens de eleitores armazenadas sem base legal documentada | Rodrigo deve confirmar com Raquel existencia de aviso de privacidade antes do go-live |

---

## Premissas

1. Rodrigo ja tem ou vai contratar instancias Z-API antes da implementacao (2 instancias para MVP).
2. As contas WhatsApp ja estao ativas no celular e conectadas a Z-API.
3. O Supabase Vault esta habilitado no projeto (para criptografia de tokens) — se nao estiver, Backlog usa AES via Edge Function como fallback.
4. A Edge Function de webhook sera publica (sem JWT Supabase) pois a Z-API nao envia Authorization header — autenticacao e feita por segredo na query string ou header proprietario da Z-API.
5. Modalidade de matching de numero: `normalize_phone()` existente (migration 001) e suficiente para o MVP — remove tudo que nao e digito, compara sufixo de 8+ digitos.

---

## Decisoes de Rodrigo (2026-05-09) — pontos abertos resolvidos

| # | Tema | Decisao final |
|---|---|---|
| 1 | Retencao de mensagens | **90 dias** com purge automatico via pg_cron (mensagens + logs de webhook) |
| 2 | Reset senha extra | **So admin (Rodrigo)** via tela de Contas — sem fluxo de e-mail no MVP |
| 3 | Criacao de contato a partir da conversa | **NAO no MVP** — exibe numero bruto sem criar contato. Vincular conversa-contato so por matching de numero ja cadastrado |
| 4 | Timeout sessao senha extra | **30 minutos de inatividade** — sem opcao "lembrar nesta sessao do navegador" |
| 5 | Criptografia tokens Z-API | **Supabase Vault** (extensao `supabase_vault`); fallback AES-256-GCM via Edge Function se Vault indisponivel |
| 6 | Acesso ao modulo WhatsApp no RBAC | **Qualquer usuario autenticado** ve o menu, mas precisa da senha extra pra abrir conversas. RBAC granular (atendente X so conta A) FORA do MVP |

Estas decisoes substituem qualquer ambiguidade nos pontos abaixo (mantidos como historico).

---

## Pontos de bloqueio para Rodrigo decidir ANTES do Backlog (HISTORICO — ja resolvidos acima)

1. **Retencao de mensagens:** 90 dias de historico e suficiente para Raquel? Ou precisa ser indefinido (com impacto em custo de storage Supabase)?

2. **Senha extra do painel — quem pode resetar?** Apenas admin (Rodrigo)? Ou o proprio atendente pode resetar via e-mail? MVP assume que so Rodrigo reseta — confirmar.

3. **Comportamento quando contato NAO e encontrado:** hoje a proposta e exibir numero bruto sem criar contato. Ha cenarios em que Raquel quer criar o contato diretamente da conversa? Se sim, isso e escopo do MVP ou de entrega seguinte?

4. **Sessao de senha extra — timeout de 30 minutos:** e adequado? Atendentes que ficam ativos o dia todo preferem nao redigitar. Posso colocar "lembrar nesta sessao do navegador" como opcao — mas aumenta superficie de risco se o computador ficar desbloqueado.

5. **Criptografia de tokens Z-API:** Vault Supabase (requer extensao habilitada no projeto) ou AES-256 via Edge Function (sem dependencia externa)? Backlog precisa saber qual escolher antes de criar a migration de `zapi_accounts`.

6. **Perfil de acesso ao modulo WhatsApp no RBAC existente:** hoje o sistema tem roles `admin / proprietario / assessor / assistente / estagiario`. O modulo WhatsApp vai seguir essa matriz (admin ve tudo, demais precisam de senha extra) ou vai ter configuracao separada por conta (atendente X so acessa conta A, atendente Y so conta B)? MVP assume: qualquer usuario autenticado pode tentar acessar qualquer conta, mas precisa da senha extra. Confirmar se e isso.
