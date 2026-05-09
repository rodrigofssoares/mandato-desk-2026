# RAQ-MAND-EM051 — Integração avançada Z-API (WhatsApp)

**Branch:** `rodrigo/feature/RAQ-MAND-EM051-integracao-completa-com-z-api-integracao`
**Tipo:** feature
**Sistema:** integração
**Modo:** `/qg-manual` (cadeia completa fora do QG automático)

---

## 1. Briefing original do Rodrigo (verbatim)

> Necessidade de implementar uma integração avançada com Z-API para envio,
> recebimento e acompanhamento de mensagens do WhatsApp em tempo real, com
> suporte a múltiplas contas, webhooks, modelos de mensagens e interface
> semelhante ao WhatsApp Web.

### Requisitos enumerados

- Integrar o sistema com a Z-API.
- Permitir cadastro de contas individuais de WhatsApp.
- Permitir que cada painel tenha credenciais próprias:
  - Login individual.
  - Senha individual.
  - Token da conta Z-API.
  - Configuração própria de webhook.
- Iniciar a implementação com 2 contas/painéis.
- Permitir expansão futura para pelo menos 15 contas/painéis.
- Criar estrutura para adicionar novas sessões de WhatsApp posteriormente.
- Permitir envio e recebimento de mensagens em tempo real.
- Utilizar webhooks para mapear eventos de mensagens recebidas e enviadas.
- Permitir configuração dos webhooks gerados nas ferramentas externas.
- Criar interface de conversa semelhante ao WhatsApp Web.

### Funcionalidades

- Enviar mensagens de texto, vídeos, áudios, arquivos, anexos.
- Enviar figurinhas (se suportado).
- Enviar mensagens com botões (se suportado).
- Enviar materiais através de modelos de mensagens prontas.
- Visualizar mensagens recebidas/enviadas em tempo real.
- Exibir histórico de conversas por contato.
- Permitir resposta direta dentro da tela do sistema.
- Associar conversas aos contatos cadastrados no sistema.
- Registrar status: Enviada / Entregue / Lida / Erro.

### Ajustes pedidos

- Estudar e mapear todos os recursos da Z-API.
- Definir arquitetura multi-conta.
- Cadastro de contas Z-API + tokens + autenticação.
- Gerenciamento de webhooks por conta.
- Tela de conversas em tempo real.
- Modelos de mensagens prontas.
- Suporte a mídias e anexos.
- Controle de permissões por painel e usuário.
- Separação entre contas (RBAC + RLS).
- Logs de envio, recebimento e falhas.
- Segurança no armazenamento de tokens, logins, senhas.
- Documentação do mapeamento.

### Comentário em voz aberta (verbatim)

> não só a integração básica de disparo e recebimento de mensagens. Quero uma
> integração completa, podendo assistir o que está sendo recebido e enviado no
> WhatsApp em tempo real, utilizando os recursos de Webhook do próprio Zapier
> [→ correção: **Z-API**] e também simulando ali a tela do WhatsApp Web. Ou
> seja, eu podendo inserir o texto, enviar os anexos, enviar figurinhas, enviar
> arquivos e tudo mais. Todos os recursos. Então vai ser uma integração completa
> e muito avançada dessa parte, onde eu vou ter acessos também individualizados.
> Cada painel vai ter que ter um login, uma senha específica desse WhatsApp,
> pois eu vou precisar fazer isso para 15 pessoas. Então vamos começar com dois
> primeiros, para a gente poder fazer isso e depois ir adicionando novas
> seções. Eu vou adicionar uma nova conta do Zapier [→ Z-API]. Vou colocar os
> tokens, e vão ser gerados webhooks pra eu poder inserir nas ferramentas e a
> gente ter esse mapeamento completo. Quero que estude de forma bem avançada
> todo esse mapeamento. Quero ver no mínimo 3 versões visuais dessa integração
> e suas subabas.

---

## 2. Decisões já tomadas (clarificações com Rodrigo, 2026-05-09)

| # | Tópico | Decisão |
|---|---|---|
| 1 | **Plataforma** | **Z-API (z-api.io)** — gateway brasileiro de WhatsApp. NÃO é Zapier. |
| 2 | **Auth painel** | **Credenciais Z-API (Instance ID + Token + Client-Token) + senha extra de proteção do painel WhatsApp** (camada adicional além do login Mandato Desk). Cada painel exige senha extra antes de abrir conversas. |
| 3 | **MVP escopo EM051** | **2 contas + texto + recebimento + status (enviada/entregue/lida/erro) + tela WhatsApp Web** (subabas Contas/Conversas/Webhooks/Logs). Mídia, áudio, arquivo, figurinha, botões e modelos ficam pra entregas seguintes. |
| 4 | **Escopo futuro** | Expansão até **15 contas**, mídia, modelos, botões, figurinhas, RBAC granular. |
| 5 | **Visual** | **3 mockups HTML produzidos ANTES** da implementação. Rodrigo escolhe 1, e a implementação foca só no escolhido. |

---

## 3. Pontos de atenção pra PO refinar

1. **Personas:** Quem opera o painel WhatsApp? Atendente? Gabinete (Raquel)?
   Existe perfil "supervisor" que vê todos os painéis?
2. **Senha extra:** quem cadastra/reseta? É bcrypt no banco? Rate limit?
3. **Z-API multi-instância:** cada conta = 1 Instance Z-API separada, com seu
   próprio plano cobrado. Custo recorrente Z-API ≠ baixo.
4. **Webhook URL:** Edge Function pública por conta ou rota única filtrando por
   `instanceId` no payload?
5. **Real-time:** Supabase Realtime nas tabelas `zapi_messages` + `zapi_chats`?
6. **Vinculação a contatos:** matching por número (E.164) com a tabela
   `contatos` existente? Cria contato automaticamente se não existir?
7. **Storage de mídia recebida:** Supabase Storage bucket privado por painel?
   (mesmo que mídia de envio fique fora do MVP, mídia recebida cai já)
8. **Logs:** tabela `zapi_webhook_log` com payload bruto? Retenção?
9. **Conformidade LGPD:** mensagens WhatsApp são dados pessoais. Cliente Raquel
   sabe? Consentimento dos contatos?

---

## 4. Limites do que vai ser feito nesta task (EM051 / MVP)

✅ **DENTRO**
- Migration: `zapi_accounts`, `zapi_chats`, `zapi_messages`, `zapi_webhook_log`,
  `zapi_panel_passwords` (hash bcrypt), `zapi_panel_users` (RBAC) — todas com RLS.
- Edge Function `zapi-webhook` — recebe eventos Z-API (mensagem recebida, status
  delivered/read/error), valida assinatura/origem, persiste, dispara realtime.
- Edge Function `zapi-send-text` — envia mensagem texto via Z-API REST.
- Hooks: `useZapiAccounts`, `useZapiChats`, `useZapiMessages` (com Realtime).
- Página `/integracoes/whatsapp` com 4 subabas (Contas, Conversas, Webhooks, Logs).
- Senha extra de proteção do painel (modal antes de abrir conversas).
- Tela WhatsApp Web no layout escolhido pelo Rodrigo (de 1 dos 3 mockups).
- Vinculação básica conversa↔contato por número.
- Status de mensagem (enviada/entregue/lida/erro) atualizado via webhook.
- Logs de envio/recebimento/falha.
- Segurança: tokens Z-API criptografados (Vault Supabase ou AES via Edge),
  senha extra com bcrypt, RLS por `panel_id`, signature verification do webhook.

❌ **FORA (entregas futuras)**
- Mídia (envio): vídeo, áudio, arquivo, anexo, figurinha.
- Botões interativos.
- Modelos de mensagens prontas (templates).
- Expansão pra além de 2 contas (mas estrutura permite — só cadastrar mais).
- RBAC granular por permissão (terá só "operador do painel X").

---

## 5. Próximos passos (cadeia QG manual)

1. ✅ Briefing consolidado salvo neste arquivo.
2. ⏭ **PO** refina → `RAQ-MAND-EM051-PO-refinamento.md`.
3. ⏭ **frontend-design** gera 3 mockups → `RAQ-MAND-EM051-mockups/v1.html`,
   `v2.html`, `v3.html`.
4. ⏭ Rodrigo escolhe 1 mockup.
5. ⏭ **Backlog** quebra → `RAQ-MAND-EM051-Backlog-tasks.md`.
6. ⏭ Loop por task: Fullstack → Security (crítico — auth+tokens+webhook) → CR → QA.
7. ⏭ Commit + push.
