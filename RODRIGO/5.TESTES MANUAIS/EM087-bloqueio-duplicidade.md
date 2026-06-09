# EM087 — Bloqueio de envio por duplicidade (roteiro de teste manual)

Branch: `rodrigo/feature/RAQ-MAND-EM087-ajustar-formulario-formularios`

## Pré-requisitos (passo controlado do Rodrigo)

1. Aplicar a migration em prod:
   ```
   npx supabase db query --linked --file "supabase/migrations/121_em087_dedup_bloqueio.sql"
   ```
2. Re-deploy da Edge Function (mapeia o novo erro `ja_respondeu`):
   ```
   npx supabase functions deploy formularios-public-submit
   ```
3. Merge do PR + `npm run deploy` (Cloudflare) — OU testar no localhost com a branch.

> ⚠️ A migration faz `CREATE OR REPLACE` da RPC `formulario_processar_resposta` (função de
> submissão pública ao vivo). É aditiva e idempotente, com rollback documentado no topo do arquivo.

## Onde configurar

Editor de formulário → aba **Mapeamento** → painel **Robustez & prazo** →
bloco **"Impedir respostas duplicadas"** + toggle **"Capturar respostas no CRM"**.

---

## Casos de teste

### 1. Votação anônima — bloquear quem já votou (caso principal)
- Critério: **Nome + Telefone** · Onde verificar: **Nas respostas deste formulário** ·
  Ação: **Bloquear envio** · Mensagem: "Seu voto já foi registrado." ·
  Captura no CRM: **desligada**.
- [ ] Responder o formulário com Nome="João Silva" + Tel="67 99999-0001" → **sucesso**.
- [ ] Responder DE NOVO com os mesmos dados → **tela cheia de bloqueio** com a mensagem editada.
- [ ] Responder com Nome="João Silva" + Tel diferente → **sucesso** (par diferente).
- [ ] Conferir em Resultados: o 2º envio NÃO foi gravado; nenhum contato criado no CRM.

### 2. Critério Campo específico (ID/matrícula)
- Critério: **Campo específico** → escolher o campo "Matrícula" · Escopo: respostas · Ação: bloquear.
- [ ] Enviar com Matrícula="12345" → sucesso. Reenviar com "12345" → bloqueio.
- [ ] Enviar com "  12345  " (espaços) ou "12345" maiúsc/minúsc → também bloqueia (normalizado).

### 3. Captação no CRM — bloquear quem já é contato
- Critério: **CPF** · Onde verificar: **Nos contatos do CRM** · Ação: bloquear · Captura: ligada.
- [ ] Enviar com um CPF que JÁ existe no CRM → **bloqueio**.
- [ ] Enviar com CPF novo → sucesso + contato criado.

### 4. Os dois escopos juntos
- Critério: WhatsApp · Escopo: **respostas E crm** · Ação: bloquear · Captura: ligada.
- [ ] Bloqueia se o número já está no CRM **ou** já respondeu o formulário.

### 5. Ações antigas continuam funcionando (regressão)
- [ ] Critério WhatsApp + Ação **Mesclar** → atualiza contato existente (não bloqueia).
- [ ] Ação **Criar novo** → sempre cria. Ação **Ignorar** → só registra resposta.

### 6. UI — coerência
- [ ] Trocar critério para "Campo específico" → o toggle "Nos contatos do CRM" fica **desabilitado**.
- [ ] Desligar "Capturar no CRM" → o toggle "Nos contatos do CRM" fica **desabilitado**.
- [ ] Ação ≠ Bloquear com escopo "respostas" → aparece aviso amarelo recomendando "Bloquear envio".
- [ ] Campo de mensagem só aparece quando a ação é "Bloquear envio".

### 7. Mensagem padrão
- [ ] Deixar a mensagem em branco → na tela de bloqueio aparece o texto padrão
  ("Identificamos que você já participou...").

### 8. Concorrência (opcional)
- [ ] Dois envios idênticos quase simultâneos → só 1 grava; o outro recebe bloqueio
  (garantido pelo índice único parcial, não só pela checagem prévia).

---

## ⚠️ Decisão de produto pendente (LGPD — escopo CRM)

O escopo **"Nos contatos do CRM"** com ação Bloquear faz o formulário público responder
"já existe" para um CPF/telefone que está na sua base — ou seja, um terceiro poderia
testar CPFs e descobrir quem está cadastrado. Para **votação/pesquisa pública**, prefira o
escopo **"Nas respostas deste formulário"** (não vaza nada da base). O sistema já sugere
"respostas" por padrão ao ativar a verificação. Use o escopo CRM só em formulários de
captação onde esse trade-off é aceitável.
