# Setup Google Contacts — Mandato Desk 2026

**Codigo QG:** RAQ-MAND-EM047
**Data:** 2026-05-04

Este documento descreve os passos que Rodrigo precisa executar manualmente antes de ativar a integracao Google Contacts. O codigo esta implementado, mas sem essas configuracoes nenhuma Edge Function funcionara.

---

## Etapa 1 — Google Cloud Console

### 1.1 Criar ou selecionar projeto

1. Acesse: https://console.cloud.google.com/
2. Crie um projeto novo ou selecione um existente para o Mandato Desk
3. Anote o nome do projeto

### 1.2 Ativar a People API

1. No menu lateral, va em **APIs e Servicos > Biblioteca**
2. Pesquise por **"People API"**
3. Clique em **Ativar**

### 1.3 Criar credenciais OAuth 2.0

1. Va em **APIs e Servicos > Credenciais**
2. Clique em **+ Criar credenciais > ID do cliente OAuth 2.0**
3. Selecione tipo: **Aplicativo da Web**
4. Nome: `Mandato Desk 2026`
5. Em **URIs de redirecionamento autorizados**, adicione:
   ```
   https://<PROJECT_REF>.supabase.co/functions/v1/google-auth/callback
   ```
   Substitua `<PROJECT_REF>` pelo ref do projeto Supabase (encontrado em Settings > API no painel Supabase)
6. Clique em **Criar**
7. Copie o **ID do cliente** e o **Segredo do cliente**

### 1.4 Configurar tela de consentimento OAuth

1. Va em **APIs e Servicos > Tela de consentimento OAuth**
2. Selecione **Externo** (permite logins de qualquer conta Google)
3. Preencha o nome do aplicativo (ex: "Mandato Desk")
4. Adicione seu email como contato
5. Em **Escopos**, adicione: `https://www.googleapis.com/auth/contacts`
6. Em **Usuarios de teste**, adicione os emails das assessoras que vao usar o sistema
7. Mantenha o status como **Em teste** — para uso interno (<100 usuarios), nao e necessario publicar

---

## Etapa 2 — Configurar Secrets no Supabase

1. Acesse o painel do Supabase > seu projeto
2. Va em **Settings > Edge Functions** ou **Settings > Vault / Secrets**
3. Adicione as seguintes variaveis de ambiente para as Edge Functions:

| Nome da variavel | Valor |
|---|---|
| `GOOGLE_CLIENT_ID` | O ID do cliente OAuth copiado no passo 1.3 |
| `GOOGLE_CLIENT_SECRET` | O segredo do cliente copiado no passo 1.3 |
| `FRONTEND_URL` | URL de producao do frontend, ex: `https://mandato-desk.lovableproject.com` |

As variaveis `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_JWT_SECRET` sao injetadas automaticamente pelo Supabase em todas as Edge Functions.

---

## Etapa 3 — Deploy das Edge Functions

Execute no terminal, dentro da pasta do projeto (`Mandato Desk 2026/`):

```bash
# Garantir que o projeto esta linkado
npx supabase link --project-ref <PROJECT_REF>

# Deploy das duas funcoes
npx supabase functions deploy google-auth
npx supabase functions deploy google-contacts-sync
```

---

## Etapa 4 — Verificar funcionamento

1. Abra o sistema e navegue para `/google-integration`
2. Clique em **Conectar com Google**
3. Selecione a conta Google desejada e autorize o acesso
4. Voce deve retornar para a pagina com `?connected=true` e ver a mensagem de sucesso
5. Crie um contato de teste no CRM e aguarde ate 30 segundos
6. Verifique se o contato apareceu no Google Contacts

---

## Checklist final

- [ ] People API ativada no Google Cloud Console
- [ ] Credenciais OAuth 2.0 criadas (tipo "Aplicativo da Web")
- [ ] URI de redirecionamento correto adicionado
- [ ] Emails das assessoras adicionados como usuarios de teste
- [ ] `GOOGLE_CLIENT_ID` configurado nos secrets do Supabase
- [ ] `GOOGLE_CLIENT_SECRET` configurado nos secrets do Supabase
- [ ] `FRONTEND_URL` configurado nos secrets do Supabase
- [ ] `npx supabase functions deploy google-auth` executado com sucesso
- [ ] `npx supabase functions deploy google-contacts-sync` executado com sucesso
- [ ] Smoke test manual realizado (conectar + criar contato + verificar no Google)

---

## Observacoes importantes

- **Modo de teste vs. publicado**: o app em modo "Teste" funciona apenas para usuarios adicionados manualmente na lista de testers. Para producao com mais de 100 usuarios, seria necessario publicar o app e passar pela verificacao do Google. Para o Mandato Desk (uso interno de gabinete), o modo "Teste" e suficiente.

- **Quota da People API**: 10.000 requisicoes por dia por projeto. A reconciliacao inicial de 2.000 contatos usa ~2.000 requisicoes (20% da quota diaria). Operacoes rotineiras de create/update/delete ficam bem abaixo do limite.

- **O `GOOGLE_CLIENT_SECRET` nunca e exposto**: ele fica apenas nos secrets da Edge Function (servidor Supabase). O frontend nunca tem acesso a ele.
