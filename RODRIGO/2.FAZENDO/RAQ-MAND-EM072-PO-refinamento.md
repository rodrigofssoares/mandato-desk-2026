# Melhorias operacionais no WhatsApp CRM — Módulo Conversas

**Cliente:** Raquel — Mandato Desk 2026
**Código QG:** RAQ-MAND-EM072
**Prioridade:** alta
**Escrito por:** Agente PO em 2026-05-16

---

## Contexto e problema

O módulo Conversas do Mandato Desk 2026 integra o WhatsApp via Z-API em uma interface de
3 colunas (lista de chats | conversa | painel do contato). Com o crescimento da base para
15+ conversas simultâneas, quatro problemas operacionais travam o dia a dia do gabinete:

1. **Sem busca na lista de conversas:** a assessora precisa rolar a lista manualmente para
   encontrar um eleitor específico — tempo médio estimado de 20-40 segundos por localização,
   multiplicado por dezenas de ações por dia.

2. **Botão "Ver no CRM" quebrado:** navega para `/contacts` sem nenhum parâmetro, exigindo
   que a assessora reaplique manualmente o filtro para encontrar o contato — 3 a 5 cliques
   extras por ação.

3. **Sem caminho rápido para cadastrar novos eleitores:** quando alguém escreve via WhatsApp
   sem estar no CRM, a assessora precisa sair do módulo Conversas, abrir Contatos, criar o
   contato manualmente copiando nome e número, e voltar. O painel lateral hoje exibe apenas
   uma mensagem de texto orientativa, sem botão de ação.

4. **Reações aparecem como "[Mensagem não suportada]":** emojis de reação enviados por
   eleitores na conversa do WhatsApp não são identificados pela Edge Function `zapi-webhook`
   (sem branch para `reaction` em `extractMedia`) e tombam em `media_type='unknown'`.
   A exibição incorreta gera ruído visual e confunde a assessora sobre o estado da conversa.

---

## Persona

**Assessora de gabinete** (papel operacional): monitora as conversas do WhatsApp CRM ao
longo do dia, responde eleitores, cria registros de novos contatos e consulta o perfil
do eleitor no CRM para contextualizar o atendimento. Gerencia 15-40 conversas ativas
diariamente. Não é desenvolvedora; usa o sistema em ritmo de atendimento com urgência.

---

## Job-to-be-done

Quando monitoro conversas do WhatsApp no CRM, quero navegar, vincular e registrar contatos
sem sair do módulo Conversas, para que eu possa atender eleitores com contexto completo
e sem fricção operacional entre os módulos.

---

## Hipótese de solução (alto nível)

- **US01 — Busca:** Adicionar campo de texto de busca no cabeçalho da coluna de lista de
  chats, filtrando em tempo real (debounce 300ms) por nome do contato e por número de
  telefone. Filtro puramente client-side sobre o array `chats` já carregado — sem chamada
  extra ao banco.

- **US02 — "Ver no CRM" corrigido:** Substituir `<Link to="/contacts">` por
  `<Link to={/contacts?contact=${chat.contact_id}>}` quando `contact_id` existe. O parâmetro
  `?contact=<uuid>` já é suportado pela página Contacts (`useContact(contactIdFromUrl)`)
  e abre o `ContactDialog` direto. Fallback: se `contact_id` for null, botão continua
  desabilitado ou oculto.

- **US03 — "Adicionar no CRM":** Substituir o texto orientativo do painel lateral (quando
  `chat.contact_id` é null) por um botão "Adicionar no CRM" que pré-preenche nome e número
  usando os dados do chat, invoca `useCreateContact`, e ao sucesso navega para
  `/contacts?contact=<novo_id>` abrindo o `ContactDialog` para edição imediata. Se já
  existir contato com o mesmo telefone, exibir alerta de duplicata antes de criar.

- **US04 — Reações:** Adicionar branch `reaction` em `extractMedia` na Edge Function
  `zapi-webhook`. Gravar `media_type='reaction'` e em `media_metadata` os campos
  `{ emoji, reaction_message_id, sender }`. Em `MessageBubble`, adicionar `case 'reaction'`
  que renderiza o emoji com label do remetente e horário. Ignorar o `body` que chega vazio
  nesse tipo — não exibir "[Mensagem não suportada]".

---

## User stories e critérios de aceite

---

### US01 — Campo de busca nas conversas

**Como** assessora de gabinete monitorando as conversas do WhatsApp,
**quero** um campo de busca na lista de chats que filtre por nome do contato ou número de
telefone enquanto digito,
**para** localizar qualquer eleitor em menos de 5 segundos, sem precisar rolar a lista.

#### Critérios de aceite

**Dado** que estou no módulo Conversas com uma conta Z-API selecionada e pelo menos
uma conversa carregada,

- [ ] **CA-01.1** — Quando clico no campo de busca e digito "Maria", então a lista exibe
  apenas os chats cujo `contact_name` contém "Maria" (case-insensitive), e os chats que
  não contêm a string desaparecem da lista em até 300ms após parar de digitar.

- [ ] **CA-01.2** — Quando digito um número de telefone parcial (ex.: "9988"), então a
  lista exibe apenas os chats cujo `phone` contém essa substring, independente de formatação
  (com ou sem DDD).

- [ ] **CA-01.3** — Quando limpo o campo de busca, então todos os chats voltam a aparecer
  na ordem original (sem reload de página ou nova chamada ao banco).

- [ ] **CA-01.4** — Quando nenhum chat corresponde ao termo buscado, então a lista exibe
  um estado vazio com mensagem "Nenhuma conversa encontrada para '[termo]'".

- [ ] **CA-01.5** — Quando há uma conversa selecionada e filtro os resultados via busca,
  então a conversa selecionada continua aberta na coluna central (o estado `selectedChatId`
  não é resetado pela busca).

- [ ] **CA-01.6** — Quando o campo de busca contém texto e eu troco de conta Z-API, então
  o campo de busca é limpo automaticamente (junto com o reset de `selectedChatId` já
  existente).

#### Edge cases

- Busca com espaços extras no início/fim: trimar antes de filtrar.
- `contact_name` null: comparar só contra `phone`.
- Lista com 0 chats (estado inicial): campo de busca visível mas vazio; mensagem de "Sem
  conversas" já existente permanece inalterada.
- Busca com caracteres especiais (parênteses, traço, +): não deve lançar exceção no
  `includes()` ou regex — usar string `includes` plain, não regex.

---

### US02 — "Ver no CRM" abre o contato direto

**Como** assessora visualizando uma conversa com um eleitor cadastrado no CRM,
**quero** que o botão "Ver no CRM" abra o card completo desse contato diretamente,
**para** não perder tempo reaplicando filtros manualmente em Contatos.

#### Critérios de aceite

**Dado** que estou no painel lateral de uma conversa onde `chat.contact_id` é não-nulo,

- [ ] **CA-02.1** — Quando clico em "Ver no CRM", então o navegador redireciona para
  `/contacts?contact=<chat.contact_id>` e o `ContactDialog` abre automaticamente com os
  dados daquele contato preenchidos, sem que a assessora precise buscar o nome na listagem.

- [ ] **CA-02.2** — Quando clico em "Ver no CRM" e o contato existe no banco, então o
  `ContactDialog` exibe o nome, telefone e demais campos do contato em menos de 3 segundos
  em conexão 3G simulada (campo a campo; não exige carregamento de toda a listagem).

- [ ] **CA-02.3** — Quando `chat.contact_id` é null (eleitor não cadastrado), então o
  botão "Ver no CRM" não é exibido (comportamento atual preservado — painel mostra o texto
  orientativo / futuro botão "Adicionar no CRM" da US03).

- [ ] **CA-02.4** — Dado que `chat.contact_id` está preenchido mas o contato foi deletado
  do CRM (inconsistência de dados), quando clico em "Ver no CRM", então o sistema navega
  para `/contacts?contact=<id>` e exibe estado vazio (ContactDialog não abre ou exibe
  "Contato não encontrado") sem erro visual não tratado (sem tela branca / crash).

#### Edge cases

- `chat.contact_id` válido mas contato `merged_into` não-nulo (foi mesclado): `useContact`
  pode retornar null. Exibir "Contato não encontrado" — não abrir dialog vazio.
- Dois contatos com mesmo telefone (cadastro duplicado): o `contact_id` no chat aponta para
  um específico — link direciona para esse, sem ambiguidade.

---

### US03 — Botão "Adicionar no CRM" dentro da conversa

**Como** assessora conversando com um eleitor que ainda não está no CRM,
**quero** um botão "Adicionar no CRM" no painel lateral da conversa que crie o contato
com nome e número pré-preenchidos e abra o card para edição imediata,
**para** cadastrar o eleitor sem sair do módulo Conversas nem copiar dados manualmente.

#### Critérios de aceite

**Dado** que estou no painel lateral de uma conversa onde `chat.contact_id` é null,

- [ ] **CA-03.1** — Quando clico em "Adicionar no CRM", então o sistema invoca
  `useCreateContact` com `nome = chat.contact_name ?? formatPhone(chat.phone)` e
  `whatsapp = chat.phone` pré-preenchidos, exibe um estado de carregamento no botão durante
  a operação, e ao sucesso navega para `/contacts?contact=<novo_id>` abrindo o
  `ContactDialog` para edição imediata dos demais campos (tags, empresa, redes sociais,
  observações, campos personalizados).

- [ ] **CA-03.2** — Quando `useCreateContact` detecta que já existe contato com o mesmo
  número de WhatsApp (`findDuplicatePhoneContact` retorna match), então o sistema exibe
  um alerta com a mensagem "Já existe um contato com este número: [nome do existente]. Deseja
  abrir o contato existente?" — com botões "Abrir existente" (navega via `?contact=<id>`) e
  "Cancelar".

- [ ] **CA-03.3** — Quando o contato é criado com sucesso, então o painel lateral da
  conversa atualiza para exibir o botão "Ver no CRM" em lugar do botão "Adicionar no CRM"
  (o `chat.contact_id` é refletido após refresh do query de chats ou via trigger SQL
  existente que casa phone ↔ whatsapp).

- [ ] **CA-03.4** — Quando a criação falha por erro de rede, então o botão retorna ao
  estado inicial, um toast de erro é exibido com a mensagem de falha, e nenhum contato
  parcial é gravado.

- [ ] **CA-03.5 (CRUD — regra Rodrigo)** — O `ContactDialog` aberto após criação permite
  editar todos os campos do contato (nome, empresa, tags, redes sociais, observações,
  campos de campanha) e deletar o contato recém-criado, sem sair para outra tela.

#### Edge cases

- `chat.contact_name` null: pré-preencher `nome` com `formatPhone(chat.phone)` e exibir
  placeholder "Nome não disponível — edite após criar".
- `chat.phone` em formato com código de país (ex.: `5511999998888`): garantir que o valor
  gravado em `whatsapp` seja compatível com o formato esperado por `phoneComparisonKey`.
- Botão clicado duas vezes rapidamente: desabilitar após primeiro clique durante o
  carregamento para evitar duplicata.
- Trigger SQL (migration 047) que preenche `zapi_chats.contact_id` dispara em mudança de
  `zapi_chats`, não de `contacts` — após criar o contato, o `contact_id` no chat só é
  atualizado se o trigger for disparado ou se o frontend fizer refetch. Especificar
  comportamento esperado: refetch de `useZapiChats` após sucesso da criação.

---

### US04 — Reações do WhatsApp exibidas corretamente

**Como** assessora lendo as mensagens de uma conversa,
**quero** que emojis de reação enviados pelo eleitor sejam exibidos como reações vinculadas
à mensagem original (e não como "[Mensagem não suportada]"),
**para** entender o estado emocional/confirmação do eleitor sem ruído visual.

#### Critérios de aceite

**Dado** que o eleitor enviou uma reação emoji a uma mensagem da conversa e o webhook
Z-API recebeu o evento correspondente,

- [ ] **CA-04.1** — Quando a Edge Function `zapi-webhook` processa um evento com
  `type === 'reaction'` (ou equivalente no payload Z-API), então o registro gravado em
  `zapi_messages` tem `media_type = 'reaction'` e `media_metadata` contém pelo menos
  `{ emoji: string, reaction_message_id: string }`.

- [ ] **CA-04.2** — Quando a conversa é exibida no CRM e há uma mensagem com
  `media_type = 'reaction'`, então o `MessageBubble` renderiza o emoji como texto
  visível (ex.: "👍") acompanhado do horário da reação — e nunca exibe
  "[Mensagem não suportada]".

- [ ] **CA-04.3** — Quando o payload da reação inclui o campo `sender` (identificando
  quem reagiu), então o bubble exibe o remetente abaixo do emoji (ex.: "João reagiu 👍"),
  formatado como texto secundário de menor tamanho; se `sender` não estiver disponível,
  exibe apenas o emoji e horário.

- [ ] **CA-04.4** — Quando chega um evento de reação para uma mensagem cujo
  `reaction_message_id` não está no histórico carregado (mensagem antiga fora do scroll),
  então o sistema exibe a reação como mensagem independente na linha do tempo, sem crash
  e sem tentar referenciar a mensagem original.

- [ ] **CA-04.5** — Quando chega um evento de tipo desconhecido que não tem branch
  implementada na Edge Function, então o comportamento de fallback `media_type='unknown'`
  e exibição "[Mensagem não suportada]" continua funcionando para os demais tipos — apenas
  `reaction` é corrigido nesta story.

- [ ] **CA-04.6** — O tratamento de `reaction` é genérico o suficiente para aceitar
  qualquer string de emoji válido em Unicode — não há whitelist de emojis.

#### Edge cases

- Reação removida (eleitor remove o emoji): Z-API pode enviar evento de remoção com
  `emoji` vazio ou null. Neste caso, gravar `media_type='reaction'` com `emoji=''` e
  o `MessageBubble` não renderiza nada (ou exibe "Reação removida" em itálico).
- Múltiplas reações à mesma mensagem por pessoas diferentes: cada evento gera um registro
  separado em `zapi_messages` — exibidos como bubbles independentes na linha do tempo
  (v1 não agrupa reações; agrupamento é v2).
- Payload Z-API com estrutura diferente de `reaction` em versões futuras da API: a Edge
  Function deve logar o payload completo em `media_metadata` para facilitar diagnóstico
  retroativo sem migration de schema.
- Reação recebida em grupo (se grupos forem suportados no futuro): `sender` pode ser
  número diferente do `phone` do chat — gravar como-está sem validação adicional na v1.

---

## Fora de escopo (não-objetivos)

- Enviar reações a partir do CRM (só recebimento e exibição) — v2
- Agrupar múltiplas reações à mesma mensagem em um único indicador visual (ex.: estilo
  WhatsApp com contador "👍 3") — v2
- Busca server-side / paginação de chats (hoje todos os chats são carregados de uma vez;
  busca client-side é suficiente para 15-100 chats) — reavaliar quando lista ultrapassar
  200 itens
- Sincronização automática do `contact_id` no chat via trigger reverso (contacts → chats)
  — o trigger existente só cobre zapi_chats → contacts; reverso é escopo de migration
  separada
- Editar ou excluir contato pelo painel lateral da conversa (só criação e navegação)
- Qualquer mudança no módulo de Contas Z-API, aba Configurações ou outros módulos do CRM
- Pesquisa full-text em conteúdo de mensagens (buscar dentro do histórico de mensagens)
- Notificação push ou badge de novas mensagens

---

## Métricas de sucesso

- **US01 — Tempo de localização:** assessora localiza qualquer conversa em menos de
  5 segundos após digitar (vs. 20-40 segundos de scroll manual). Validar com observação
  direta na primeira semana de uso.
- **US02 — Cliques eliminados:** ação "Ver no CRM" cai de 4-6 cliques (navegar + buscar
  + abrir) para 1 clique. Validar contando interações em sessão observada.
- **US03 — Cadastros via conversa:** pelo menos 3 novos contatos criados via botão
  "Adicionar no CRM" na primeira semana (vs. zero cadastros iniciados a partir do módulo
  Conversas hoje).
- **US04 — Ruído visual eliminado:** zero ocorrências de "[Mensagem não suportada]" para
  eventos do tipo `reaction` a partir da data de deploy. Validar com query:
  `SELECT COUNT(*) FROM zapi_messages WHERE media_type = 'unknown' AND created_at > <data_deploy>`.

---

## Riscos identificados

- **Valor (US01):** Baixo. Busca client-side é feature universal; demanda clara e imediata.
- **Valor (US02/03):** Baixo. Elimina fricção concreta documentada pela cliente.
- **Valor (US04):** Médio. Reações são esteticamente menores; se Z-API não enviar eventos
  de reação de forma consistente, a correção terá impacto limitado até o webhook receber
  tráfego real de reações.
- **Usabilidade (US03):** Médio. O alerta de duplicata (CA-03.2) pode ser confuso se a
  assessora não souber que o eleitor já está cadastrado. Mensagem deve citar o nome do
  contato existente para ser acionável.
- **Feasibility (US03 — trigger reverso):** O `contact_id` no chat só se atualiza se o
  trigger existente disparar. Após criar o contato, o frontend precisa fazer refetch de
  `useZapiChats` explicitamente para refletir a vinculação — confirmar com Fullstack se
  `useCreateContact` invalida o query key correto.
- **Feasibility (US04 — payload Z-API):** A estrutura do evento `reaction` precisa ser
  validada contra a documentação Z-API antes da implementação. Se o campo `type` usar
  nomenclatura diferente (ex.: `messageType: 'reactionMessage'`), o branch na Edge Function
  deve seguir a convenção real do payload, não a assumida.
- **Business:** Sem conflito com outros módulos ou objetivos macro.

---

## Prioridade relativa entre as 4 stories

| Ordem | Story | Justificativa |
|-------|-------|---------------|
| 1 | **US01 — Busca** | Maior frequência de uso; impacto imediato em toda sessão de trabalho; implementação puramente client-side, risco zero de regressão no banco. |
| 2 | **US02 — "Ver no CRM" corrigido** | Bug funcional claro; 1 linha de mudança no `Link to`; sem dependência externa; resolve fricção a cada consulta de perfil. |
| 3 | **US03 — "Adicionar no CRM"** | Fluxo novo de criação; maior surface de edge cases (duplicata, trigger reverso, CRUD); dependente de US02 para a navegação pós-criação funcionar corretamente. |
| 4 | **US04 — Reações** | Correção de exibição; menor impacto operacional imediato; depende de validação do payload real Z-API antes de implementar. |

---

## Definition of Ready — atendida?

- [x] Persona específica identificada (assessora de gabinete — papel funcional, não demográfico)
- [x] Job-to-be-done articulado para o conjunto das 4 stories
- [x] Critérios de aceite testáveis por story (sem "rápido"/"intuitivo" — todos observáveis
  ou mensuráveis com comportamento Given/When/Then)
- [x] Pelo menos uma métrica quantitativa por story
- [x] Não-objetivos listados com escopo v1 vs v2 explícito
- [x] Hipótese de solução em alto nível (sem código — referências a arquivos são contexto,
  não implementação)
- [x] Prioridade relativa definida com justificativa
- [x] CRUD completo mencionado (CA-03.5 — regra Rodrigo)
- [x] Riscos de feasibility identificados para as stories mais complexas (US03, US04)
- [x] Edge cases de cada story mapeados

**DoR: ATENDIDA. Backlog pode quebrar em tasks atomizadas.**
