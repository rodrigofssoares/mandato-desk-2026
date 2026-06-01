# Agente de IA Integrado ao CRM — Interface de Chat com Agente Configurável

**Cliente:** Raquel — Mandato Desk 2026
**Código QG:** RAQ-MAND-EM075
**Prioridade:** alta
**Escrito por:** Agente PO em 2026-05-21

---

## 1. Visão Geral

O gabinete precisa de um canal de atendimento interno onde assessores e estagiários possam
interagir com um agente de IA pré-configurado por Rodrigo (admin), sem sair do CRM e sem
acessar ferramentas externas como ChatGPT ou Claude.ai. O valor de negócio é duplo: reduzir
o tempo gasto buscando orientações operacionais (como redigir respostas a eleitores, entender
procedimentos do mandato, interpretar demandas) e manter o consumo de tokens centralizado na
conta da OpenAI/Anthropic/OpenRouter do cliente — não disperso em contas pessoais da equipe
onde o custo é incontrolável. O agente se comporta como um GPT customizado da OpenAI, mas
roda dentro do CRM, com histórico persistente por usuário, favoritos salvos e controle de
acesso via RBAC existente.

---

## 2. Personas e Jobs-to-Be-Done

### Persona A — Rodrigo (admin/proprietário, configura o agente)

**Quem é:** Dono do mandato ou gestor do CRM. Único com acesso às configurações de IA.

**Job-to-be-done:**
Quando preciso orientar minha equipe em padrões de atendimento ao eleitor, quero configurar
um agente com o comportamento exato que treinei (prompt de sistema, tom, limitações de escopo),
para que a equipe use IA de forma padronizada sem que eu precise responder as mesmas perguntas
operacionais repetidamente — e sem que minha chave de API seja usada de forma descontrolada.

**Workaround atual:** Rodrigo cria um GPT no ChatGPT Plus pessoal e compartilha o link. Problema:
a equipe precisa ter conta no ChatGPT, o custo vem de uma conta pessoal, não há controle de
quem usou nem historico auditável no CRM.

---

### Persona B — Assessora/Assistente (usuário final do agente)

**Quem é:** Assessora parlamentar ou assistente que opera o CRM diariamente — gerencia contatos,
demandas e conversas do WhatsApp.

**Job-to-be-done:**
Quando estou atendendo um eleitor com demanda complexa (jurídica, social, de encaminhamento
institucional), quero perguntar ao agente configurado pelo gestor como devo proceder, para
redigir uma resposta correta e dentro do padrão do mandato em menos de 2 minutos — sem
precisar ligar para o chefe nem sair do CRM para usar outra ferramenta.

**Workaround atual:** usa ChatGPT pessoal (sem contexto do mandato), telegram do grupo do
gabinete, ou espera o gestor responder.

---

### Persona C — Estagiário (acesso restrito ao agente)

**Quem é:** Estagiário com permissão apenas de visualização em módulos sensíveis.

**Job-to-be-done:**
Quando preciso redigir uma primeira versão de resposta ou entender um procedimento interno,
quero consultar o agente (se admin liberou acesso), para não cometer erros por desconhecimento
sem precisar interromper o assessor.

---

## 3. User Stories

### US-01 — Configuração do agente pelo admin (subaba em Configurações)

**Como Rodrigo (admin),** quero configurar o agente de IA numa subaba dedicada dentro de
Configurações (ao lado da aba "IA" existente), para definir provider, modelo, chaves de API
específicas do agente, prompt de sistema e anexos de contexto, sem afetar as configurações
da IA assistiva já existente (resumo de demandas, sugestão de resposta, etc.).

**Regra de negócio:** esta subaba é visível e editável apenas por admin e proprietario.
O agente usa sua própria tabela `ai_agents` (ver seção 9) com campos separados da `ai_settings`
existente. O prompt de sistema aceita até 32.000 caracteres (limite seguro para context window).

**Critérios de aceite:**
- [ ] Dado que sou admin, quando acesso Configurações > aba "Agente IA", vejo formulário com
  campos: nome do agente, provider (OpenAI/Anthropic/OpenRouter), modelo (lista dinâmica por
  provider), chave de API exclusiva do agente, prompt de sistema (textarea), status
  ativo/inativo, lista de "papéis com acesso" (multiselect dos 5 roles).
- [ ] Dado que escolho OpenRouter como provider, quando carrego a lista de modelos, vejo ao
  menos os modelos fixos populares (ex: meta-llama/llama-3.3-70b, google/gemini-2.5-flash,
  deepseek/deepseek-r1) mais campo de texto livre para digitar model ID manualmente.
- [ ] Dado que salvo a configuração, a chave de API é persistida criptografada na tabela
  `ai_agents` (mesma abordagem de `ai_settings.api_key` — nunca exposta no frontend).
- [ ] Dado que sou proprietario (não admin), quando acesso a subaba, consigo visualizar a
  configuração mas NÃO consigo editar (botão Salvar desabilitado, campos read-only).
- [ ] Dado que sou assessor ou abaixo, quando acesso Configurações, a subaba "Agente IA" NÃO
  aparece no menu (proteção de rota via RBAC + secao `agente_ia` na `permissoes_perfil`).
- [ ] Dado que altero qualquer campo e salvo, o evento é registrado em `activities` como
  `update / ai_agent` (auditoria — nunca com a chave de API no campo `changes`).

---

### US-02 — Gerenciamento de anexos do agente (contexto estático, administrado pelo admin)

**Como Rodrigo (admin),** quero fazer upload de arquivos (PDF, DOCX, TXT) que viram parte
do contexto permanente do agente, para que a equipe possa consultar documentos internos do
mandato (regimentos, templates, fluxos de atendimento) sem que eu precise embutir esse
conteúdo manualmente no prompt.

**Regra de negócio:** estes anexos são "contexto do agente" — extraídos como texto e
concatenados no system prompt em tempo de inferência. NÃO são exibidos como arquivos
baixáveis para o usuário final. Limite: 5 arquivos, 2 MB cada, formatos PDF/DOCX/TXT.
O texto extraído é armazenado na tabela `ai_agent_attachments`.

**Critérios de aceite:**
- [ ] Dado que sou admin na subaba do agente, vejo seção "Documentos de contexto" com
  lista de anexos existentes (nome, tamanho, data de upload) e botão "Adicionar documento".
- [ ] Dado que faço upload de um PDF de 1,8 MB, quando o upload conclui, o arquivo é
  processado server-side (Edge Function), o texto é extraído e salvo em `ai_agent_attachments`
  — o arquivo binário original NÃO fica no storage permanente (apenas o texto extraído).
- [ ] Dado que já existem 5 documentos, o botão "Adicionar documento" aparece desabilitado
  com tooltip "Limite de 5 documentos atingido — remova um para adicionar outro".
- [ ] Dado que clico em excluir um documento, aparece confirmação "Remover este documento
  apagará o texto extraído permanentemente." e, ao confirmar, a linha é deletada da tabela
  (CRUD obrigatório — regra Rodrigo).
- [ ] Dado que faço upload de arquivo com extensão não suportada (.xlsx, .pptx), recebo
  toast de erro "Formato não suportado. Use PDF, DOCX ou TXT."

---

### US-03 — Aba "Agente" no menu principal (interface de chat)

**Como assessora,** quero acessar uma aba "Agente" no menu lateral do CRM, para interagir
com o agente configurado pelo gestor em interface de chat — sem sair do sistema e sem precisar
de conta em ferramenta externa.

**Regra de negócio:** a aba aparece no menu apenas se `ai_agents.is_active = true` E se o
role do usuário está na lista `ai_agents.allowed_roles`. A rota é `/agente`.

**Critérios de aceite:**
- [ ] Dado que o agente está ativo e meu role tem acesso, quando abro o menu lateral, vejo
  item "Agente" com ícone de bot (ex: `Bot` do lucide-react) no menu.
- [ ] Dado que acesso `/agente`, vejo interface de chat com: área de mensagens no centro,
  campo de input no rodapé com botão Enviar, nome do agente no topo e status "ativo".
- [ ] Dado que o agente está inativo (`is_active = false`), quando acesso `/agente`, vejo
  card de aviso "O agente está temporariamente desativado pelo administrador" — sem campo
  de input.
- [ ] Dado que meu role não tem acesso ao agente, a rota `/agente` retorna componente de
  acesso negado (mesmo padrão dos outros módulos protegidos).
- [ ] Dado que envio uma mensagem, vejo indicador de "digitando..." (3 pontos animados)
  enquanto a Edge Function processa, e a resposta aparece completa após retorno (sem
  streaming neste MVP — ver seção 8 Fora de Escopo).
- [ ] Dado que a chamada à API do provider falha (timeout, chave inválida, etc.), a mensagem
  de erro aparece como mensagem do sistema no chat: "Erro ao processar. Tente novamente." —
  sem quebrar a tela.

---

### US-04 — Envio de arquivo pelo usuário no chat (input runtime)

**Como assessora,** quero anexar um arquivo (imagem ou PDF) na conversa com o agente, para
que ele possa analisar o documento e me ajudar a interpretá-lo ou redigir uma resposta.

**Regra de negócio:** estes anexos são de uso único/runtime — enviados junto com a mensagem
corrente, NÃO persistem no banco como documentos reutilizáveis. Limite por mensagem: 1
arquivo, máximo 10 MB, formatos PDF/PNG/JPG/JPEG. Só disponível se o provider/modelo
suportar vision/file input (OpenAI gpt-4.1, Anthropic claude-sonnet/opus, OpenRouter com
modelos multimodais).

**Critérios de aceite:**
- [ ] Dado que estou no chat, vejo ícone de clipe ao lado do campo de input. Ao clicar,
  abre seletor de arquivo filtrado para PDF/imagens.
- [ ] Dado que seleciono um arquivo de 8 MB permitido, vejo preview inline do arquivo
  selecionado (thumbnail para imagem, ícone+nome para PDF) com botão "X" para remover.
- [ ] Dado que envio a mensagem com o arquivo, o arquivo é enviado junto à mensagem e
  exibido como bolha de "arquivo enviado" na conversa antes da resposta do agente.
- [ ] Dado que seleciono arquivo acima de 10 MB, recebo validação imediata no frontend:
  "Arquivo excede o limite de 10 MB." — sem chamada ao servidor.
- [ ] Dado que o modelo configurado não suporta arquivos (ex: modelo de texto puro), o
  ícone de clipe aparece desabilitado com tooltip "Modelo atual não suporta anexos."

---

### US-05 — Histórico de conversas (sessões persistidas, 30 dias)

**Como assessora,** quero que minhas conversas com o agente sejam salvas automaticamente e
acessíveis por até 30 dias, para poder retomar o contexto de uma conversa anterior sem
precisar repetir as informações.

**Regra de negócio:** cada "sessão" é uma conversa separada com título (primeiras 60 chars
da primeira mensagem) e timestamp. Histórico é individual por usuário (RLS `user_id =
auth.uid()`). Após 30 dias da criação da sessão, a sessão e suas mensagens são deletadas
por um cron job ou cleanup trigger. Limite: 200 sessões por usuário (além disso, as mais
antigas são removidas automaticamente ao criar nova).

**Critérios de aceite:**
- [ ] Dado que envio minha primeira mensagem, uma nova sessão é criada automaticamente em
  `ai_chat_sessions` com `title` = primeiras 60 chars da mensagem do usuário.
- [ ] Dado que reabro a aba "Agente" após fechar o browser, vejo a última sessão ativa
  aberta por padrão (não inicia sessão nova vazia).
- [ ] Dado que clico em "Nova conversa" (botão no topo), uma sessão nova é criada e a
  anterior fica acessível no histórico lateral.
- [ ] Dado que abro o painel de histórico (ícone de relógio ou lista lateral colapsável),
  vejo lista das últimas 30 sessões com título e data, ordenadas da mais recente à mais
  antiga.
- [ ] Dado que clico em uma sessão do histórico, as mensagens dessa sessão são carregadas
  e posso continuar a conversa a partir do contexto anterior.
- [ ] Dado que uma sessão completou 30 dias, ela NÃO aparece mais no histórico e NÃO pode
  ser recuperada (cleanup automático — comunicado ao usuário no topo: "Histórico disponível
  por 30 dias").
- [ ] Dado que clico em "Excluir conversa" em uma sessão do histórico, aparece confirmação
  e, ao confirmar, a sessão e suas mensagens são deletadas (CRUD obrigatório — regra Rodrigo).

---

### US-06 — Favoritar respostas do agente

**Como assessora,** quero favoritar respostas específicas do agente, para construir um banco
pessoal de respostas que posso consultar rapidamente em situações recorrentes — mesmo após a
sessão expirar.

**Regra de negócio:** favoritos são individuais por usuário (`user_id = auth.uid()`). Limite:
500 favoritos por usuário (Rodrigo sugeriu 1000 — reduzindo para 500 pois não há evidência
que ultrapasse isso; ver Decisões em Aberto). Favoritos NÃO expiram (ficam além dos 30 dias
do histórico). Cada favorito referencia a mensagem original e tem campo de nota opcional
(até 200 chars).

**Critérios de aceite:**
- [ ] Dado que recebo uma resposta do agente, vejo botão de estrela (outline) ao lado de
  cada mensagem do agente. Ao clicar, a estrela fica preenchida e a resposta é salva em
  `ai_chat_favorites`.
- [ ] Dado que clico novamente na estrela preenchida, aparece confirmação "Remover dos
  favoritos?" e, ao confirmar, o favorito é removido (estrela volta a outline).
- [ ] Dado que acesso a subaba "Favoritos" dentro da aba Agente, vejo lista de respostas
  favoritadas com: trecho da resposta (primeiros 150 chars), data em que foi favoritada,
  nota opcional e botão de copiar.
- [ ] Dado que clico em "Copiar", o texto completo da resposta é copiado para o clipboard
  com feedback toast "Copiado!".
- [ ] Dado que clico no ícone de editar nota em um favorito, aparece campo inline para
  editar a nota (até 200 chars). Ao salvar, a nota é persistida (CRUD obrigatório —
  regra Rodrigo).
- [ ] Dado que atinjo 500 favoritos, ao tentar favoritar mais uma resposta, recebo toast
  de aviso: "Limite de 500 favoritos atingido. Remova alguns para adicionar novos."
- [ ] Dado que busco no campo de busca da aba Favoritos, os resultados filtram por conteúdo
  da resposta E por nota — exibindo apenas os que contêm o termo buscado.
- [ ] Dado que clico em excluir um favorito, aparece confirmação e, ao confirmar, o
  favorito é removido da lista.

---

## 4. Priorização MoSCoW + RICE

| US | Descrição resumida | MoSCoW | Reach | Impact | Confidence | Effort | RICE Score |
|----|---|---|---|---|---|---|---|
| US-01 | Config do agente (admin) | Must | 2 (só admin) | 5 (habilita tudo) | 5 | 3 | **16.7** |
| US-03 | Interface de chat na aba Agente | Must | 5 (toda equipe) | 5 | 5 | 3 | **41.7** |
| US-05 | Histórico de sessões 30 dias | Must | 5 | 4 | 5 | 3 | **33.3** |
| US-06 | Favoritar respostas | Should | 5 | 3 | 4 | 2 | **30.0** |
| US-02 | Anexos do agente (contexto admin) | Should | 2 (admin) | 4 | 4 | 3 | **10.7** |
| US-04 | Anexo de arquivo pelo usuário no chat | Could | 5 | 3 | 3 | 4 | **11.3** |

> RICE = (Reach × Impact × Confidence) ÷ Effort. Valores 1-5.

---

## 5. MVP Escopado — Slice 1 (entregável end-to-end mínimo)

O walking skeleton é: **admin configura o agente → usuário envia mensagem → recebe resposta → sessão é salva**.

**Entram no Slice 1 (MVP):**
- US-01 completa (sem a parte de OpenRouter modelo livre — apenas lista fixa de modelos populares)
- US-03 completa (chat funcional, sem streaming, sem anexo de arquivo)
- US-05 completa (histórico + sessões + limpeza 30 dias)
- US-06 completa (favoritos com CRUD)

**Ficam para Slice 2:**
- US-02 (anexos do agente como contexto admin) — útil mas não bloqueia o uso básico
- US-04 (anexo de arquivo pelo usuário no chat) — depende de modelos multimodais, mais complexo

**Definição de "done" do MVP:** assessora consegue abrir `/agente`, enviar uma pergunta,
receber resposta do agente configurado por Rodrigo, retornar no dia seguinte e encontrar
a conversa no histórico, favoritar uma resposta e buscá-la depois.

---

## 6. Fora de Escopo (out-of-scope explícito)

- **Streaming token-a-token** (Server-Sent Events): MVP retorna resposta completa. Streaming
  é evolutivo — pode ser Slice 3 se o tempo de resposta for inaceitável nos testes.
- **Voice mode / transcrição de áudio no agente**: o módulo WhatsApp já tem `transcricao_audio`
  via `AIFeatures`; o agente não duplica isso.
- **Análise de imagem sem upload explícito**: o agente não lê prints de tela ou imagens do
  CRM automaticamente — só analisa o que o usuário enviar via US-04 (Slice 2).
- **Agentic tool calls / function calling**: o agente não executa ações no CRM (criar contato,
  mover demanda). Apenas gera texto. Tool calls ficam fora deste MVP.
- **Multi-agente**: um único agente por organização neste MVP. Suporte a múltiplos agentes
  configurados é roadmap futuro.
- **Compartilhamento de sessões entre usuários**: histórico e favoritos são 100% individuais.
- **Exportação de histórico**: não faz parte deste MVP.
- **Notificações push de resposta**: o usuário precisa estar na aba para receber a resposta.
- **Integração do agente com dados do CRM (contatos, demandas)**: o agente NÃO busca dados
  do banco automaticamente. Contexto vem apenas do prompt + anexos do admin + mensagens
  da sessão corrente. Integração RAG com o CRM é roadmap futuro.
- **Refatorar `ai_settings` existente**: a tabela e os hooks atuais (useAISettings,
  useAIAnalyzeChat, etc.) não são tocados nesta task.

---

## 7. Decisões em Aberto para Rodrigo

1. **Tabela `ai_agents` separada ou reuso de `ai_settings`?**
   Sugestão do PO: criar tabela `ai_agents` separada. Justificativa: `ai_settings` é singleton
   global para features assistivas (resumo de demanda, sugestão de resposta) e tem modelo de
   dados diferente (features JSONB, flag global). O agente de chat tem prompt de sistema,
   allowed_roles, múltiplos documentos de contexto e potencialmente evolui para multi-agente.
   Manter separado evita breaking change nas features existentes.
   **Rodrigo decide:** tabela nova `ai_agents` (recomendado) ou adicionar campos em `ai_settings`?

2. **Limite de favoritos: 500 ou 1000?**
   Rodrigo mencionou 1000. PO sugere 500 — cada favorito pode ter texto longo (até ~4000
   chars de resposta). 500 × 4000 chars = ~2 MB por usuário em texto. Com 10 usuários
   simultâneos, ~20 MB em dados de favoritos — aceitável. 1000 dobra para ~40 MB, ainda OK.
   **Rodrigo decide:** qual o limite?

3. **Quem pode configurar o agente — só admin ou também proprietario?**
   O `AISettingsTab` existente restringe a admin. A US-01 propõe que proprietario visualize
   mas não edite. Rodrigo pode querer que o proprietario (a vereadora) também possa editar
   o prompt sem depender do admin técnico.
   **Rodrigo decide:** proprietario pode editar o agente (sim/não)?

4. **OpenRouter: lista fixa de modelos ou campo texto livre?**
   OpenRouter tem centenas de modelos. Opção A: lista curada de 8-10 modelos populares
   (Llama, Gemini, DeepSeek, Mistral, etc.) + campo "outro modelo ID". Opção B: campo texto
   livre com validação pattern `provider/model-name`. Opção B dá mais poder mas exige que
   Rodrigo saiba o ID exato.
   **Rodrigo decide:** lista curada com "outro" (A) ou campo livre (B)?

5. **Attachments do agente (US-02): texto extraído de PDF fica onde?**
   Opção A: coluna `extracted_text TEXT` na tabela `ai_agent_attachments` (simples, sem
   storage adicional). Opção B: arquivo original vai para Supabase Storage, texto extraído
   fica na tabela. Opção A é recomendada para MVP (não precisamos do binário original).
   **Rodrigo decide:** Opção A (só texto extraído) ou Opção B (arquivo + texto)?

6. **LGPD — dados sensíveis no chat:**
   Se a assessora colar nome e CPF de um eleitor no chat, o texto vai para a API do provider
   (OpenAI/Anthropic/OpenRouter). Opção A: warning fixo na interface "Não insira dados
   pessoais identificáveis (nome, CPF, telefone) no chat — use apelidos ou IDs internos."
   Opção B: implementar pseudoanonimização automática antes de enviar ao provider (detectar
   padrões de CPF/telefone e substituir por tokens). Opção B é complexa e pode gerar falsos
   positivos.
   **Rodrigo decide:** Opção A (warning educativo) ou Opção B (pseudoanonimização)?

---

## 8. Métricas de Sucesso

- **Adoção em 14 dias:** ao menos 3 dos 5 usuários ativos do CRM usam a aba Agente pelo
  menos 1 vez (medido por contagem de sessões criadas na `ai_chat_sessions`).
- **Frequência de uso:** ao menos 1 sessão nova por usuário ativo por semana após o
  primeiro mês — indica que virou hábito, não novidade.
- **Favoritos criados:** ao menos 20 favoritos criados no primeiro mês — indica que as
  respostas têm valor prático recorrente.
- **Custo controlado:** custo de tokens do agente não ultrapassa R$ 50/mês no primeiro
  mês (monitorar via dashboard do provider; não implementar controle automático no MVP).
- **Qualitativo (30 dias):** Rodrigo relata que parou de receber perguntas operacionais
  repetidas via WhatsApp pessoal.

---

## 9. Riscos Identificados

### Valor
- **Risco:** equipe pode continuar usando ChatGPT pessoal por inércia, especialmente se
  a UX do agente interno for mais lenta (sem streaming). **Mitigação:** MVP funcional e
  rápido é mais importante que features — priorizar latência aceitável (<5s) antes de
  recursos adicionais.

### Usabilidade
- **Risco:** usuário não encontra a aba "Agente" se o admin não configurar o agente como
  ativo. **Mitigação:** admin recebe alerta em Settings caso o agente esteja inativo há
  mais de 7 dias após a feature ser habilitada.

### Feasibility
- **Risco:** extração de texto de PDF no servidor (Deno Edge Function) pode ser complexa —
  Deno não tem suporte nativo a `pdfjs`. **Mitigação:** US-02 fica no Slice 2. Se necessário,
  usar biblioteca compatível com Deno ou pré-processar via chamada a API externa (ex:
  OpenAI File Upload).
- **Risco:** OpenRouter requer cabeçalho `HTTP-Referer` e `X-Title` obrigatórios. A Edge
  Function precisa incluí-los ou recebe 401. **Mitigação:** mapear na Edge Function antes
  de implementar.

### LGPD / Dados Sensíveis
- **Risco alto:** mensagens enviadas ao agente podem conter dados pessoais de eleitores
  (nome, CPF, endereço). Esses dados trafegam para servidores da OpenAI/Anthropic/OpenRouter
  fora do Brasil, potencialmente violando a LGPD (Art. 33 — transferência internacional
  de dados pessoais). **Mitigação imediata:** warning obrigatório na interface (Decisão 6,
  Opção A). **Mitigação futura:** contrato DPA com o provider e política de retenção de
  dados configurada no dashboard do provider.

### Custo Escalando Sem Controle
- **Risco:** usuários podem fazer perguntas longas com contexto extenso, consumindo tokens
  acima do esperado. **Mitigação MVP:** limitar o histórico enviado ao provider a últimas
  10 mensagens da sessão corrente (não enviar histórico completo de 200 sessões). Sem limite
  de mensagens por sessão no MVP — monitorar e implementar throttle se necessário.

### Business
- **Risco:** o cliente (Raquel) pode questionar custo adicional de tokens. **Mitigação:**
  documentar no onboarding que o custo de tokens é responsabilidade do cliente ao configurar
  a própria chave de API — Rodrigo não subsidia o uso.

---

## 10. Arquitetura de Dados Sugerida (alto nível — não é decisão do PO, é sugestão para o Backlog)

```
ai_agents (singleton por organização, MVP)
  id, name, provider, model, api_key (encrypted), system_prompt,
  is_active, allowed_roles TEXT[], created_by, updated_by, created_at, updated_at

ai_agent_attachments (contexto estático do admin)
  id, agent_id FK, filename, extracted_text, file_size, created_by, created_at

ai_chat_sessions (histórico por usuário)
  id, user_id FK, title, created_at, last_message_at, expires_at (created_at + 30d)

ai_chat_messages (mensagens de cada sessão)
  id, session_id FK, role (user|assistant|system), content, has_attachment,
  created_at

ai_chat_favorites (favoritos individuais)
  id, user_id FK, message_id FK, note (max 200 chars), created_at, updated_at
```

RLS: todas as tabelas de usuário (`ai_chat_sessions`, `ai_chat_messages`,
`ai_chat_favorites`) com policy `user_id = auth.uid()`. Tabela `ai_agents` e
`ai_agent_attachments` com policy admin/proprietario para escrita, autenticado para leitura
(apenas `is_active`, `name`, `allowed_roles` — nunca `api_key` ou `system_prompt`).

Nova seção no RBAC: `agente_ia` adicionada ao enum `SECOES` em `src/types/permissions.ts`.
Defaults sugeridos: admin/proprietario = pode_ver; assessor/assistente/estagiario =
pode_ver (se admin colocar na `allowed_roles`) ou false.

Edge Function nova: `ai-agent-chat` — recebe `{ session_id, message, attachment? }`,
monta contexto (system_prompt + anexos + histórico da sessão), chama provider, persiste
resposta, retorna ao frontend.
