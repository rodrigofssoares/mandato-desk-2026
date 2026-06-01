# Filtro de Grupos e Nome de Eleitores LID no WhatsApp (Conversas)

**Cliente:** Raquel — Mandato Desk 2026
**Código QG:** RAQ-MAND-EM072B
**Prioridade:** alta
**Escrito por:** Agente PO em 2026-05-16

---

## Contexto e problema

A assessora de gabinete abre a aba Conversas do WhatsApp para ler mensagens de
eleitores e responder. Hoje ela vê ~23 entradas na lista — mas apenas ~4 são eleitores
reais. As outras ~19 são lixo: grupos de WhatsApp (ex: "Reunião da Câmara", "Grupo
Familiar"), newsletters, canais broadcast, e identificadores LID
(ex: `151415313924248`) de contatos cujo nome aparece em branco porque o webhook
descarta o campo `chatName`/`senderName`.

O custo concreto: a assessora precisa rolar a lista para encontrar o eleitor certo,
abre a conversa errada, perde contexto, às vezes tenta responder para um número de
grupo que nem envia mensagem direta. Cada atendimento desperdiça entre 1 e 3 minutos
em navegação desnecessária.

A causa-raiz está confirmada por inspeção direta nos payloads `zapi_webhook_log`:
a Edge Function `zapi-webhook` recebe `isGroup: true` nos grupos mas ignora esse
campo, normaliza o `phone` via `digitsOnly()` e cria um `zapi_chats` para qualquer
valor com ≥ 10 dígitos. Chats LID entram corretamente como pessoas reais, mas o
campo `chatName`/`senderName` (que tem o nome "Thais Souza Prima") nunca é
persistido — logo a UI mostra o número-LID cru.

---

## Job-to-be-done

Quando abro a aba Conversas para atender um eleitor,
quero ver apenas conversas individuais reais com seus nomes legíveis,
para que eu possa localizar e responder o eleitor correto sem distrações ou confusão.

---

## Hipótese de solução (alto nível)

**Frente 1 — Barreira no webhook:** antes de criar qualquer chat, a Edge Function
consulta `isGroup`, `isNewsletter` e `broadcast` no payload; se qualquer um for
verdadeiro, descarta silenciosamente (retorna 200 sem criar registro).

**Frente 2 — Nome em chats LID:** a tabela `zapi_chats` recebe coluna
`whatsapp_name` (text, nullable). No upsert do webhook, se o `phone` contiver
`@lid`, persiste `chatName ?? senderName` nessa coluna. A UI lê `contact_name ??
whatsapp_name ?? formatPhone(phone)` — sem mudança na lógica de CRM vinculado.

**Frente 3 — Limpeza dos chats sujos existentes:** migration SQL que apaga de
`zapi_messages` e `zapi_chats` todos os registros cujo `phone` corresponde a
padrões de grupo (formato antigo `XXXXXXXX-XXXXXXXXXX` ou comprimento > 15 dígitos,
ou sufixo `group` antes da normalização). Operação executada uma única vez via
`supabase db push`.

---

## User stories

- **US01** — Como assessora de gabinete, quero que mensagens vindas de grupos,
  newsletters e broadcasts sejam descartadas automaticamente pelo sistema, para que
  elas nunca apareçam na lista de conversas.

- **US02** — Como assessora de gabinete, quero ver o nome real do eleitor (ex:
  "Thais Souza Prima") em chats LID mesmo sem cadastro no CRM, para que eu saiba
  com quem estou falando antes de abrir a conversa.

- **US03** — Como assessora de gabinete, quero que os ~16 chats de grupo já
  registrados no banco sejam removidos, para que minha lista de conversas comece
  limpa após a correção.

---

## Critérios de aceite

### US01 — Descartar grupos/newsletter/broadcast no webhook

```gherkin
Dado que a Z-API envia um ReceivedCallback com isGroup: true
Quando o webhook processa o payload
Então nenhum registro novo é criado em zapi_chats nem em zapi_messages
E o webhook retorna HTTP 200 com { ok: true, reason: "ignored_group" }
E um registro em zapi_webhook_log é inserido com processing_status='ignored'

Dado que o payload tem isNewsletter: true (com qualquer valor de isGroup)
Quando o webhook processa o payload
Então o mesmo comportamento de descarte acima se aplica

Dado que o payload tem broadcast: true (com qualquer valor de isGroup/isNewsletter)
Quando o webhook processa o payload
Então o mesmo comportamento de descarte acima se aplica

Dado que o payload tem isGroup: false, isNewsletter: false, broadcast: false
  E o phone é um número real (ex: "556184299707")
Quando o webhook processa o payload
Então o chat é criado/atualizado normalmente sem alteração de comportamento
```

### US02 — Exibir nome em chats LID

```gherkin
Dado que o banco possui coluna whatsapp_name em zapi_chats (migration aplicada)
E a Z-API envia um ReceivedCallback com phone contendo "@lid"
  E chatName = "Thais Souza Prima" (ou senderName se chatName ausente)
Quando o webhook processa o payload
Então zapi_chats.whatsapp_name = "Thais Souza Prima" para aquele chat

Dado que um chat LID existe com whatsapp_name = "Thais Souza Prima"
  E contact_id é NULL (eleitor sem cadastro no CRM)
Quando a assessora abre a aba Conversas
Então o item na lista exibe "Thais Souza Prima" como nome principal
E o subtítulo exibe o identificador LID formatado (ou ocultado se não for telefone)
E NÃO exibe a sequência numérica crua "151415313924248" como nome

Dado que um chat LID existe com whatsapp_name = "Thais Souza Prima"
  E contact_id aponta para um contato CRM com nome "Thais Souza (CRM)"
Quando a assessora abre a aba Conversas
Então o item exibe "Thais Souza (CRM)" (contact_name tem precedência sobre whatsapp_name)

Dado que um chat LID existe com whatsapp_name = NULL
  E contact_id é NULL
Quando a assessora abre a aba Conversas
Então o item exibe o identificador formatado de fallback (não trava, não exibe vazio)
```

### US03 — Limpeza dos chats sujos existentes

```gherkin
Dado que existem registros em zapi_chats com phone sem formato de telefone válido
  (ex: phone com mais de 15 dígitos, ou phone correspondente a padrão de grupo)
Quando a migration de limpeza é aplicada via supabase db push
Então esses registros são deletados de zapi_messages (CASCADE ou DELETE explícito)
  E deletados de zapi_chats
  E a contagem de registros em zapi_chats cai para apenas os chats de telefone normal
    mais os chats LID legítimos (@lid)

Dado que a migration de limpeza foi aplicada
Quando a assessora abre a aba Conversas
Então a lista exibe somente conversas com telefones reais ou chats LID nomeados
E não exibe nenhum item com nome de sequência numérica longa sem nome
```

---

## Edge cases conhecidos

- **Grupo que manda mensagem depois da correção:** payload chega com `isGroup: true`;
  o webhook descarta, não cria chat, retorna `ignored_group`. A lista não é afetada.

- **Chat LID sem `chatName` e sem `senderName`:** `whatsapp_name` fica NULL; a UI
  cai no fallback — exibe o LID formatado (ex: `LID·151415...`) ou texto "Contato
  desconhecido". Não exibe string vazia nem trava.

- **Mesma pessoa com dois chats (telefone + LID):** ex: "Thais Souza Prima" tem
  `555491681881` E `151415313924248@lid`. Após a limpeza e correção, ambos os chats
  existem como registros distintos. A assessora pode ver dois itens para a mesma
  pessoa. A deduplicação/merge desses dois chats está **fora do escopo desta task**.

- **Newsletter com `isGroup: false` mas `isNewsletter: true`:** testado
  explicitamente — o guard deve checar `isNewsletter` independentemente de `isGroup`.

- **Mensagem de status de grupo (ex: alguém adicionado a um grupo):** payload do
  Z-API costuma trazer `isGroup: true` — coberto pelo guard de US01. Se houver
  subtipos específicos sem `isGroup`, o campo `broadcast: true` deve capturar.

- **Limpeza remove chat com `contact_id` vinculado:** a migration deve verificar se
  o chat a deletar tem `contact_id` não-nulo (ou seja, alguém vinculou um contato
  CRM a um chat de grupo por engano). Registrar em log para revisão manual antes de
  deletar — ou tratar como caso de exceção para decisão humana.

- **Upsert de chat LID já existente:** se o mesmo chat LID recebe nova mensagem, o
  upsert deve atualizar `whatsapp_name` se o valor mudar (ex: a pessoa mudou o nome
  no WhatsApp). Não deve criar duplicata.

---

## Não-objetivos (out of scope)

- **Mesclar automaticamente chat-telefone + chat-LID da mesma pessoa:** identificar
  que `555491681881` e `151415313924248@lid` são a mesma "Thais" exige heurística
  complexa e decisão humana. Fora desta task.

- **Reescrever `normalizePhoneForZapi`:** a função continua como está para telefones
  normais. O guard de grupos é adicionado ANTES de chamá-la, não dentro dela.

- **Exibir nome de grupo em uma futura aba "Grupos":** possível feature futura; não
  pertence aqui.

- **Sincronizar `whatsapp_name` retroativamente para chats antigos via polling da
  Z-API:** fora do escopo; apenas novos eventos preencherão o campo.

- **Suporte a contas multi-instância com grupos intencionais:** o CRM é 1:1
  eleitor; não há caso de uso de grupos legítimos neste produto.

---

## Métricas de sucesso

- Após deploy, a contagem de itens em `zapi_chats` cai de ~23 para ≤ 7 (telefones
  reais + chats LID legítimos). Verificável via `SELECT count(*) FROM zapi_chats`.
- Após a primeira semana, nenhum novo chat com `phone` de comprimento > 15 dígitos
  aparece em `zapi_chats`. Verificável por query de monitoramento.
- Chats LID existentes (pelo menos o de "Thais Souza Prima") exibem nome legível na
  UI, não a sequência numérica. Verificável por observação direta na aba Conversas.

---

## Riscos identificados

- **Valor:** baixo risco — a dor é observável e a Rodrigo já confirmou que os grupos
  são ruído puro para o fluxo de atendimento.
- **Usabilidade:** chat LID com `whatsapp_name` NULL ainda pode confundir se o
  fallback for pouco claro. O texto do fallback deve ser explícito ("Contato sem
  nome").
- **Feasibility:** a coluna `whatsapp_name` exige migration de schema; o deploy da
  Edge Function é separado do deploy do banco — a ordem importa (migration primeiro,
  depois EF, depois UI). Risco de janela onde EF nova escreve numa coluna que ainda
  não existe: coordenar deploy.
- **Business:** a limpeza é destrutiva (DELETE). Se algum chat de grupo tiver
  mensagens históricas que a assessora julgue importantes, elas serão perdidas.
  Rodrigo deve confirmar que não há necessidade de retenção antes da migration rodar.

---

## Perguntas em aberto

1. **Limpeza com contact_id vinculado:** se existir um `zapi_chats` de grupo que
   alguém vinculou manualmente a um contato CRM, a migration deve deletar mesmo
   assim ou pular e avisar? Decisão de Rodrigo antes do Backlog quebrar.

2. **Formato do fallback para LID sem nome:** exibir "Contato sem nome", ocultar o
   LID numérico, ou exibir "LID · últimos 6 dígitos"? Decisão visual mínima
   necessária para US02 completar os critérios de aceite.

---

## Definição de Pronto

- [ ] Migration aplicada em produção via `supabase db push`
- [ ] Edge Function `zapi-webhook` deployada com guard de grupos/newsletter/broadcast
- [ ] `ChatListItem` e `ChatPanel` lendo `whatsapp_name` como camada intermediária
      entre `contact_name` e `formatPhone(phone)`
- [ ] Lista de conversas exibe somente chats válidos após limpeza
- [ ] Nenhum novo chat de grupo entra no banco após envio de mensagem de teste de grupo
- [ ] Chat LID de "Thais Souza Prima" exibe nome legível (smoke test manual)
- [ ] `zapi_webhook_log` registra `processing_status='ignored'` para payloads de grupo
