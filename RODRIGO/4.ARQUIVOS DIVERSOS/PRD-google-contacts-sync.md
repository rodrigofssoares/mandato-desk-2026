# Sincronização Automática Google Contacts — Mandato Desk 2026

**Cliente:** Raquel Auxiliadora
**Código QG:** RAQ-MAND-EM047
**Prioridade:** alta
**Escrito por:** Agente PO em 2026-05-04

---

## Contexto e problema

A página `/google-integration` existe no sistema desde a concepção do projeto (PRD v1.0), mas é um placeholder vazio — exibe apenas um card com badge "Em desenvolvimento". O schema de banco está 100% modelado (tabelas `google_oauth_tokens`, `google_sync_settings`, `contact_sync`, `google_sync_logs` e campos `google_contact_id`/`google_resource_name`/`google_etag` em `contacts`). Nenhuma Edge Function de sync existe no diretório `supabase/functions/` e nenhum hook React foi criado.

O problema operacional: assessores do gabinete criam, editam e deletam contatos no CRM diariamente, mas a agenda Google das usuárias (presumivelmente usada em telefones celulares e Gmail) não reflete essas mudanças. Isso cria uma base dupla — CRM e Google Agenda — que divergem com o tempo, gerando trabalho manual de reconciliação e risco de ligações para números desatualizados. A base atual possui ao menos 2.000+ contatos (referência: arquivo `contatos_2026-04-24_completo_erros.xlsx`).

---

## Job-to-be-done

Quando uma assessora cadastra, edita ou remove um contato no CRM, ela quer que o Google Contacts reflita essa mudança automaticamente, para que possa ligar ou enviar mensagem direto pelo celular sem pesquisar no sistema.

---

## Decisões de produto (resolvidas pelo PO)

### D1 — Quem autoriza o OAuth?
**Decisão: cada usuário com role `admin` ou `proprietario` autoriza individualmente.**

Justificativa: o schema já tem `google_oauth_tokens.user_id UNIQUE` (um token por usuário). Autorização "global" do gabinete exigiria uma conta de serviço Google (Service Account com Domain-Wide Delegation), que requer configuração no Google Workspace Admin Console — fora do alcance do projeto. A tela de integração já prevê "conectar/desconectar conta" por usuário. Roles `assessor`, `assistente` e `estagiario` não têm acesso ao módulo `google` (ver permissões no PRD).

### D2 — "Automaticamente" = síncrono ou assíncrono?
**Decisão: assíncrono via Edge Function chamada após a mutation.**

Fluxo: mutation no CRM (create/update/delete) conclui e atualiza o banco local → frontend chama Edge Function `google-contacts-sync` em background (sem await que bloqueie a UX) → Edge Function atualiza Google People API → registra resultado em `contact_sync` e `google_sync_logs`. O usuário vê o resultado no CRM imediatamente; o sync acontece em segundos após. Motivo: chamada síncrona à People API dentro da mutation criaria latência visível (~500-2000ms extra) e poderia bloquear o save se o Google estivesse lento.

### D3 — Falha na chamada à People API?
**Decisão: retry automático 2×, depois `sync_status = 'error'` + toast informativo.**

A Edge Function tenta 2 vezes com backoff de 1s. Se falhar nas 3 tentativas (incluindo inicial), grava `contact_sync.sync_status = 'error'` + `last_error` com mensagem, registra em `google_sync_logs`, e o frontend exibe um toast "Sincronização pendente — tente novamente na página de Integração". O contato no CRM não é afetado — o erro é só no espelho Google. A tela `/google-integration` mostra contagem de erros e permite retry manual.

### D4 — O cruzamento inicial (reconciliação) roda quando?
**Decisão: sob demanda, 1×, acionado por botão "Sincronizar tudo" na tela de Integração.**

Não roda periodicamente (sem cron — Supabase scheduled functions têm custo adicional e complexidade). Roda: (a) na primeira vez que o usuário conecta o Google, automaticamente ao final do OAuth; (b) manualmente via botão na tela. O cruzamento compara `contacts` sem `google_resource_name` com contatos existentes no Google pelo nome+telefone e cria os ausentes. A tela exibe progresso (barra ou contador "X de Y processados").

### D5 — Mapeamento de campos CRM → Google People API
**Decisão — mapeamento fixo, sem configuração visual (fora de escopo do MVP):**

| Campo CRM | Campo People API |
|---|---|
| `name` | `names[0].displayName` + `names[0].givenName` |
| `phone` | `phoneNumbers` tipo `home` |
| `whatsapp` | `phoneNumbers` tipo `mobile` |
| `email` | `emailAddresses[0].value` |
| `address` + `address_number` + `complement` + `neighborhood` + `city` + `state` + `zip_code` | `addresses[0]` (streetAddress / city / region / postalCode / country = "Brazil") |
| `birth_date` | `birthdays[0].date` |
| `observations` + `assessor_notes` | `biographies[0].value` (concatenados com separador `\n---\n`) |
| `instagram` | `urls` tipo `instagramProfile` |

Campos sem equivalente People API (ranking, declarou_voto, leader_id, redes sociais exceto Instagram) são ignorados no sync — ficam apenas no CRM.

### D6 — Sincronização de etiquetas (tags)?
**Decisão: FORA do escopo desta task.**

A coluna `google_sync_settings.sync_tags` existe mas o Google People API não tem conceito de etiquetas arbitrárias equivalente às tags do CRM. Mapear para `memberships` da People API requer grupos do Google Contacts, que tem fluxo OAuth adicional e complexidade desproporcional ao valor. `sync_tags` permanece `false` por padrão. Feature candidata para task futura isolada.

### D7 — `keep_on_google_delete` quando usuário deleta no CRM?
**Decisão: respeitar a configuração. Default = `true` (manter no Google).**

Se `keep_on_google_delete = true`: quando contato é deletado no CRM, a Edge Function NÃO chama `people.deleteContact`. Remove o registro de `contact_sync` mas o contato permanece no Google. Se `keep_on_google_delete = false`: chama `people.deleteContact` e registra em logs. A configuração é ajustável na tela de Integração.

---

## User stories

**US01 — Conexão OAuth**
Como administradora ou proprietária do gabinete, quero conectar minha conta Google à minha conta do CRM, para que o sistema possa escrever contatos na minha agenda Google automaticamente.

**US02 — Sync automático na criação**
Como assessora que cadastra um contato novo, quero que esse contato apareça automaticamente no meu Google Contacts em até 30 segundos após o save, para não precisar cadastrar duas vezes.

**US03 — Sync automático na edição**
Como assessora que atualiza nome, telefone ou endereço de um contato, quero que o Google Contacts reflita a alteração automaticamente, para que o celular sempre tenha o dado mais atual.

**US04 — Sync automático na exclusão**
Como assessora que remove um contato do CRM, quero controlar se o contato é também removido do Google Contacts (via configuração `keep_on_google_delete`), para não perder dados no celular sem querer.

**US05 — Reconciliação inicial (sync em massa)**
Como administradora conectando o Google pela primeira vez, quero que o sistema compare e envie todos os contatos do CRM para o Google Contacts em uma única operação, para que a agenda já inicie completa e atualizada.

**US06 — Painel de status e logs**
Como administradora, quero ver na página de Integração quantos contatos estão sincronizados, com erro ou pendentes, e o log das últimas operações, para saber se o sync está funcionando e investigar falhas.

**US07 — Retry manual de erros**
Como administradora, quero clicar em "Tentar novamente" para reprocessar contatos com `sync_status = 'error'`, para corrigir falhas de rede sem precisar editar o contato.

**US08 — Desconexão da conta Google**
Como administradora, quero desconectar minha conta Google do CRM, para que o sistema pare de escrever dados na minha agenda.

---

## Critérios de aceite por story

### US01 — Conexão OAuth
- [ ] Botão "Conectar com Google" visível na página `/google-integration` para roles `admin` e `proprietario`
- [ ] Ao clicar, abre popup OAuth do Google solicitando escopo `https://www.googleapis.com/auth/contacts`
- [ ] Após autorização bem-sucedida, `access_token`, `refresh_token` e `expires_at` são salvos em `google_oauth_tokens` para o `user_id` autenticado
- [ ] O `client_secret` do OAuth é lido de Supabase Vault (variável `GOOGLE_CLIENT_SECRET`), nunca exposto no frontend
- [ ] Página mostra o email da conta Google conectada (`google_email`) após autorização
- [ ] Se o usuário já tem token ativo, botão muda para "Reconectar" (não duplica registro — upsert por `user_id`)
- [ ] Ao concluir OAuth, o sistema dispara automaticamente a reconciliação inicial (US05) em background

### US02 — Sync automático na criação
- [ ] Ao salvar um novo contato no CRM (via `contacts` INSERT), a Edge Function `google-contacts-sync` é invocada em background com `operation = 'create'`
- [ ] A Edge Function cria o contato no Google People API usando o mapeamento de campos de D5
- [ ] `contacts.google_resource_name` e `contacts.google_contact_id` são preenchidos com o `resourceName` retornado pela API
- [ ] `contact_sync` recebe registro com `sync_status = 'synced'` e `last_synced_at = now()`
- [ ] Operação registrada em `google_sync_logs` com `status = 'success'`
- [ ] Se People API falhar após 3 tentativas: `contact_sync.sync_status = 'error'`, log com `error_message`, toast "Contato salvo. Sincronização com Google pendente." — contato no CRM não é afetado
- [ ] Sync só ocorre se `google_sync_settings.sync_enabled = true` e existe token ativo para o usuário

### US03 — Sync automático na edição
- [ ] Ao atualizar um contato existente (via `contacts` UPDATE), se `google_resource_name` não for nulo, a Edge Function é invocada com `operation = 'update'`
- [ ] Edge Function usa `people.updateContact` com o `etag` mais recente (buscado da People API antes de atualizar para evitar conflito 412)
- [ ] `contacts.google_etag` e `google_last_synced_at` são atualizados após sucesso
- [ ] `contact_sync.sync_status` volta para `'synced'` após atualização bem-sucedida
- [ ] Se o contato ainda não existe no Google (sem `google_resource_name`), a Edge Function cria ao invés de atualizar (fallback para `create`)

### US04 — Sync automático na exclusão
- [ ] Ao deletar um contato do CRM, a Edge Function verifica `google_sync_settings.keep_on_google_delete` do usuário que deletou
- [ ] Se `keep_on_google_delete = false` e contato tem `google_resource_name`: chama `people.deleteContact` e registra em logs
- [ ] Se `keep_on_google_delete = true`: não chama People API, apenas remove registro de `contact_sync`
- [ ] Operação registrada em `google_sync_logs` em ambos os casos
- [ ] Deletar no CRM nunca falha por causa do Google: se a chamada People API retornar erro, a deleção no CRM prossegue e o erro é logado

### US05 — Reconciliação inicial
- [ ] Botão "Sincronizar todos os contatos" visível na página de Integração (somente quando conta Google conectada)
- [ ] Ao clicar, exibe progresso "X de Y contatos enviados para o Google" atualizado a cada lote de 50
- [ ] Contatos sem `google_resource_name` são criados no Google
- [ ] Contatos com `google_resource_name` mas `sync_status != 'synced'` são atualizados
- [ ] Contatos com `sync_status = 'synced'` são ignorados (não reprocessados)
- [ ] Ao concluir, atualiza `google_sync_settings.last_full_sync = now()`
- [ ] Rate limit da People API (10 req/s) é respeitado: lotes de no máximo 10 por segundo com `setTimeout` entre lotes
- [ ] Se o processo for interrompido (rede cai), o estado parcial é preservado — ao rodar novamente, retoma de onde parou (contatos já com `sync_status = 'synced'` são pulados)

### US06 — Painel de status e logs
- [ ] Página `/google-integration` exibe 3 contadores: "Sincronizados" (sync_status = 'synced'), "Com erro" (sync_status = 'error'), "Pendentes" (sync_status = 'pending')
- [ ] Exibe `last_full_sync` formatado em pt-BR ("Última sincronização completa: DD/MM/YYYY HH:mm")
- [ ] Tabela de logs mostra as últimas 50 entradas de `google_sync_logs` com: data/hora, nome do contato, operação (criar/atualizar/deletar), status (sucesso/erro), mensagem de erro quando houver
- [ ] Tabela paginável ou com scroll infinito (não carrega todos os logs de uma vez)
- [ ] Página é acessível somente por roles com permissão `google.view` (admin e proprietario conforme PRD)

### US07 — Retry manual de erros
- [ ] Na página de Integração, seção "Contatos com erro" lista os contatos com `sync_status = 'error'` com nome e `last_error`
- [ ] Botão "Tentar novamente" por contato invoca a Edge Function para aquele contato específico
- [ ] Botão "Reprocessar todos os erros" invoca sync em lote para todos os contatos com erro
- [ ] Após retry bem-sucedido: `sync_status` muda para `'synced'` e contato some da lista de erros

### US08 — Desconexão
- [ ] Botão "Desconectar" na página de Integração (quando conta conectada)
- [ ] Ao confirmar (dialog de confirmação com texto "Isso não remove contatos do Google Contacts"), deleta registro de `google_oauth_tokens` do usuário
- [ ] `google_sync_settings.sync_enabled` é setado para `false`
- [ ] Página retorna ao estado inicial (botão "Conectar com Google")
- [ ] Contatos existentes no Google NÃO são afetados pela desconexão

---

## Edge cases conhecidos

- **Token expirado (access_token):** Edge Function detecta `expires_at < now()` e usa `refresh_token` para renovar antes de chamar People API. Se refresh falhar (token revogado pelo usuário no Google), grava `google_oauth_tokens.is_active = false` e exibe banner na página de Integração "Sua conexão com o Google expirou. Reconecte."
- **Erro 412 Precondition Failed (etag desatualizado):** Edge Function busca etag atual e retenta o update 1×. Se falhar novamente, registra como `sync_status = 'conflict'` (enum já existe).
- **Rate limit People API (429):** Edge Function aguarda `Retry-After` do header ou backoff de 60s e retenta. Se exceder tempo limite do Deno (máx 150s), registra erro e deixa como pendente.
- **Contato sem campos mínimos:** se `name` for nulo ou vazio, não envia para o Google (People API exige `displayName`). Registra em `google_sync_logs` com `status = 'error'` e `error_message = 'name obrigatório'`.
- **Base de 2000+ contatos na reconciliação inicial:** processado em lotes de 50 com delay entre lotes. Edge Function pode ultrapassar timeout do Deno se executada como chamada única. Solução: reconciliação quebrada em lotes chamados sequencialmente pelo frontend (loop com await).
- **Usuário sem token Google tenta criar contato:** sync é silenciosamente pulado (não há token → não faz nada, não registra erro). Sync só ocorre quando `is_active = true` em `google_oauth_tokens`.
- **Duplicate resource:** se Google retornar `resourceName` já existente em `contact_sync` de outro contato do CRM (raro mas possível após deleção e recriação), log com `status = 'error'` + `error_message` descritivo.

---

## Não-objetivos (out of scope desta task)

- **Sincronização bidirecional Google → CRM:** o briefing e o PRD são explícitos — fluxo principal é CRM → Google. A coluna `bidirectional_sync` existe na tabela mas permanece `false`. Feature separada, se demandada.
- **Sincronização de etiquetas/tags para grupos do Google Contacts:** decisão D6.
- **Sincronização de lideranças (`leaders`) para o Google:** apenas `contacts` é sincronizado.
- **Sync para múltiplas contas Google do mesmo usuário:** um usuário = um token = uma conta Google.
- **Configuração visual do mapeamento de campos:** mapeamento é fixo (D5). Tela de mapeamento customizável é escopo futuro.
- **Sync periódico automático (cron):** ausente nesta task. Sync dispara por mutation + botão manual.
- **Importar contatos do Google → CRM:** a reconciliação inicial só empurra do CRM para o Google, não faz import reverso.
- **Interface para roles assessor/assistente/estagiario:** permissão `google` é apenas para admin e proprietario conforme PRD.

---

## MVP mínimo (para Backlog atomizar primeiro)

Entregar nesta ordem de prioridade:

1. **Edge Function `google-contacts-sync`** com operações `create`, `update`, `delete` + refresh de token
2. **Edge Function `google-auth`** com fluxo OAuth completo (authorization URL + callback + token save no Vault)
3. **Página `/google-integration`** substituindo o placeholder: conectar/desconectar, contadores de status, botão sync manual, lista de erros
4. **Disparo automático pós-mutation** nos hooks/mutations existentes de contacts (create, update, delete)
5. **Reconciliação em lote** (botão "Sincronizar tudo") com progresso

Os itens 1-3 já entregam o ciclo completo end-to-end. Os itens 4-5 entregam a automação contínua.

---

## Métricas de sucesso

- Taxa de sucesso de sync >= 99% nas primeiras 100 mutations de contato após ativação (medido em `google_sync_logs.status`)
- Tempo entre save do contato no CRM e aparição no Google Contacts <= 30 segundos (p95, medido manualmente na validação)
- Zero casos de falha silenciosa: toda falha deve aparecer em `google_sync_logs` e na contagem "Com erro" da tela
- Reconciliação inicial de 2000 contatos conclui sem timeout manual (< 10 minutos com lotes de 50)
- Raquel ou assessora confirma que contatos criados no CRM aparecem no celular sem ação manual — validado em ambiente real na semana de entrega

---

## Riscos identificados

- **Valor:** usuárias podem não perceber o sync imediato e continuar com workaround manual por hábito. Mitigação: banner de confirmação após primeiro sync bem-sucedido ("Contato enviado ao Google Contacts").
- **Usabilidade:** fluxo OAuth em popup pode ser bloqueado por navegador (popup blocker). Mitigação: Edge Function `google-auth` deve retornar URL de redirect que o frontend abre com `window.open` — se bloqueado, mostrar link clicável.
- **Feasibility:** `google-contacts-sync` pode exceder timeout de 150s do Deno para reconciliação em massa. Mitigação: loop de lotes no frontend, não uma chamada única.
- **Feasibility:** `client_secret` OAuth precisa estar em Supabase Vault (variável `GOOGLE_CLIENT_SECRET`) e `GOOGLE_CLIENT_ID` em secrets da Edge Function. Sem esses valores configurados no painel Supabase, nada funciona. Rodrigo precisa criar o projeto no Google Cloud Console e configurar os secrets antes do deploy da Edge Function.
- **Business:** se a conta Google usada for a conta pessoal da assessora (não corporativa), o OAuth pode requerer verificação do app pelo Google se a tela de consentimento não for publicada. Para uso interno de gabinete (<100 usuários), o modo "Teste" do Google OAuth é suficiente — não precisa publicar o app.
- **Rate limit:** People API tem cota de 10.000 requests/dia por projeto Google Cloud. Para 2000 contatos na reconciliação inicial: ~2000 creates = 20% da cota diária. Operações rotineiras de create/update não chegam perto do limite.

---

## Perguntas em aberto

1. **Google Cloud Console:** as credenciais OAuth (`client_id` e `client_secret`) já existem em algum projeto Google Cloud configurado para este sistema? Se não, Rodrigo precisa criar antes da implementação começar. Blocker para a Edge Function `google-auth`.

2. **URL de redirect do OAuth:** qual é a URL de produção do Supabase (`supabase.co/functions/v1/google-auth`) e qual a URL do frontend em produção para configurar nos "Authorized redirect URIs" do Google Cloud Console?

3. **Escopo do OAuth:** além de `https://www.googleapis.com/auth/contacts`, precisa de `contacts.readonly`? (só readonly não permite criar/editar — precisa do scope completo `contacts`). Confirmação: usar `contacts` (leitura + escrita).
