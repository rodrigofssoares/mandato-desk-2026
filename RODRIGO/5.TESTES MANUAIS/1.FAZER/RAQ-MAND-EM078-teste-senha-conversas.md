# Roteiro de Teste Manual — RAQ-MAND-EM078
## Senha de acesso às conversas do WhatsApp

**Pré-requisitos obrigatórios (executar ANTES de iniciar):**
1. Aplicar migration `supabase/migrations/110_zapi_panel_grants.sql` no banco remoto.
2. Deploy das Edge Functions `zapi-validate-panel-password` e `zapi-set-panel-password`.
3. Ter pelo menos 2 contas Z-API cadastradas (Conta A e Conta B).
4. Ter usuário estagiário ativo no sistema (role diferente de `admin`).
5. Ter usuário admin disponível para login.
6. Abrir 2 janelas de navegador: uma logada como admin, outra como estagiário.

---

## Bloco 1 — Admin: configurar senhas

### MT01 — Admin define senha na Conta A
1. Logar como admin.
2. Ir em WhatsApp > Contas.
3. Verificar que o card da Conta A exibe badge "Sem senha" (cor âmbar).
4. Clicar no ícone de chave (KeyRound) da Conta A.
5. No dialog, verificar que o título diz "Definir senha do painel".
6. Verificar que há badge verde "Senha protegida por hash PBKDF2-SHA256 (100k iterações)...".
7. Digitar senha: `Teste@2026` no campo "Nova senha".
8. Digitar a mesma senha no campo "Confirmar senha".
9. Clicar em "Definir senha".
- **Esperado:** toast de sucesso. Badge do card da Conta A muda para "Com senha" (verde).

### MT02 — Admin tenta definir senha curta
1. Clicar novamente no ícone de chave da Conta A.
2. Digitar senha: `abc` (< 8 chars).
3. Clicar em "Alterar senha".
- **Esperado:** erro inline "Senha deve ter ao menos 8 caracteres". Nenhuma chamada feita à EF.

### MT03 — Admin tenta definir senhas que não coincidem
1. Digitar `Teste@2026` em "Nova senha" e `OutraSenha@1` em "Confirmar senha".
2. Clicar em "Alterar senha".
- **Esperado:** erro inline "As senhas não coincidem". Nenhuma chamada feita à EF.

### MT04 — Admin deixa Conta B sem senha
1. Verificar que a Conta B não tem senha definida (badge "Sem senha").
2. NÃO definir senha para a Conta B — isso é intencional para o MT10.

---

## Bloco 2 — Estagiário: cadeado nas Conversas

### MT05 — Estagiário vê cadeado ao abrir Conversas da Conta A
1. Na janela do estagiário, ir em WhatsApp > Conversas.
2. Selecionar a Conta A no seletor de conta.
- **Esperado:** tela de cadeado aparece. Lista de conversas NÃO é visível.
  - Ícone de cadeado centralizado.
  - Texto "Acesso protegido" + "Digite a senha para acessar as conversas de [nome da Conta A]".
  - Campo de senha com botão olho (mostrar/ocultar).
  - Botão "Acessar conversas" desabilitado enquanto campo vazio.

### MT06 — Estagiário digita senha errada
1. No cadeado da Conta A, digitar: `SenhaErrada123`.
2. Clicar em "Acessar conversas".
- **Esperado:** campo de senha limpa. Erro inline aparece com ícone ShieldOff: "Credenciais inválidas" (ou similar). Cadeado permanece. Conversas NÃO são exibidas.

### MT07 — Rate-limit após 5 tentativas erradas
1. Repetir MT06 mais 4 vezes (total 5 tentativas erradas).
- **Esperado na 5ª tentativa (ou imediatamente após):**
  - Status HTTP 429 retornado pela EF.
  - UI exibe bloco de lockout com countdown regressivo (ex: "Tente novamente em 15min 00s").
  - Campo de senha e botão ficam desabilitados durante o countdown.
  - Countdown atualiza a cada segundo.

### MT08 — Estagiário digita senha certa
1. Após o lockout expirar (ou testar com usuário estagiário diferente sem tentativas erradas).
2. Digitar a senha correta: `Teste@2026`.
3. Clicar em "Acessar conversas".
- **Esperado:**
  - Toast de sucesso: "Acesso liberado — [nome da Conta A]".
  - Cadeado desaparece. Layout de 3 colunas com lista de conversas aparece.

### MT09 — Reload re-tranca a conta
1. Com a Conta A desbloqueada no estagiário, pressionar F5 (reload).
- **Esperado:** cadeado reaparece. Conversas não são visíveis. Estado de unlock perdido.

---

## Bloco 3 — Isolamento entre contas

### MT10 — Conta A desbloqueada NÃO libera Conta B
1. Desbloquear a Conta A (senha `Teste@2026`).
2. Trocar para a Conta B no seletor de conta.
- **Esperado:**
  - Se Conta B tem senha: cadeado aparece (nova validação necessária).
  - Se Conta B NÃO tem senha (MT04): a lista de conversas da Conta B é exibida diretamente (sem cadeado, pois não há senha definida para ela).
- **Confirmação de isolamento:** voltar para Conta A → ainda aparece desbloqueada (sem precisar redigitar).

---

## Bloco 4 — Admin: bypass do cadeado

### MT11 — Admin não vê cadeado
1. Na janela do admin (sem impersonation ativa), ir em WhatsApp > Conversas.
2. Selecionar a Conta A.
- **Esperado:** layout de 3 colunas exibido diretamente, SEM tela de cadeado.
3. Confirmar que conversas carregam normalmente.

### MT12 — Admin não vê botão de senha na aba Conversas
1. Ainda como admin, confirmar que não existe nenhum elemento de "senha" ou cadeado na aba Conversas.
- **Esperado:** apenas o seletor de conta e o botão Atualizar, sem nenhum elemento de unlock.

---

## Bloco 5 — Admin: gestão de senha

### MT13 — Admin altera senha
1. Admin vai em WhatsApp > Contas.
2. Clicar na chave da Conta A (que agora deve mostrar "Alterar senha" no dialog).
3. Digitar nova senha: `NovaSenha@2026` e confirmar.
4. Clicar em "Alterar senha".
- **Esperado:**
  - Toast de sucesso.
  - Badge continua "Com senha".
  - **Importante:** na janela do estagiário (se Conta A estava desbloqueada antes), ao tentar nova ação que requer grants ou ao mudar de conta e voltar, o cadeado deve reaparecer (grants foram invalidados pelo server).

### MT14 — Estagiário tenta senha antiga após troca
1. Na janela do estagiário, recarregar. Tentar desbloquear Conta A com senha `Teste@2026` (a antiga).
- **Esperado:** erro "Credenciais inválidas". Não libera.
2. Tentar com `NovaSenha@2026`.
- **Esperado:** acesso liberado.

### MT15 — Admin remove senha
1. Admin clica na chave da Conta A.
2. Clicar no botão vermelho "Remover senha".
3. Na confirmação de AlertDialog, clicar em "Remover senha".
- **Esperado:**
  - Toast "Senha removida — conta acessível sem senha".
  - Badge da Conta A volta para "Sem senha" (âmbar).
  - **Isolamento de grants:** na janela do estagiário, se estava com grant ativo, o grant deve ter sido invalidado server-side (EF deletou ao remover senha). Na prática, o estagiário verá o cadeado sumir pois... atenção: se a Conta A não tem mais senha, o que acontece quando estagiário tenta abrir?

### MT16 — Estagiário abre conta SEM senha definida
1. Estagiário recarrega e vai para Conta A (que agora não tem senha, após MT15).
- **Esperado:** cadeado aparece (a tela de unlock ainda mostra pois frontend não sabe se conta tem ou não senha — só sabe que está "trancada"). Ao tentar qualquer senha, a EF retorna 401 "Credenciais inválidas" (resposta genérica — não vaza estado). ATENÇÃO: este é um edge case importante.
  - **Alternativa esperada possível (a validar):** se a implementação front retorna `isUnlocked=true` quando não há senha definida, documentar esse comportamento.

---

## Bloco 6 — Estagiário: restrições de UI

### MT17 — Estagiário NÃO vê botão de chave na aba Contas
1. Estagiário vai em WhatsApp > Contas.
2. Verificar que os cards das contas NÃO exibem o botão de chave (KeyRound).
- **Esperado:** apenas botão "Respostas" (se habilitado). Sem ações de editar, excluir, senha.
3. Verificar que existe aviso em banner: "Apenas administradores podem gerenciar contas Z-API."

### MT18 — Estagiário NÃO vê indicador "Com senha" / "Sem senha"
1. No mesmo card do MT17, verificar que o badge de status de senha (verde/âmbar) NÃO aparece.
- **Esperado:** `hasPassword` é `undefined` para não-admin (prop não passada), portanto o badge não renderiza.

---

## Bloco 7 — RLS (crítico — requer client API direto)

### MT19 — SELECT direto em zapi_chats sem grant = 0 linhas
1. Obter o JWT do estagiário (via DevTools > Application > localStorage, ou via `supabase.auth.getSession()`).
2. Sem desbloquear nenhuma conta, fazer chamada REST direta:
```
GET https://<SUPABASE_URL>/rest/v1/zapi_chats?select=id,phone,account_id
Authorization: Bearer <token_estagiario>
apikey: <anon_key>
```
- **Esperado:** resposta com array vazio `[]` (0 linhas). NÃO deve retornar conversas.

### MT20 — SELECT em zapi_messages sem grant = 0 linhas
1. Mesma abordagem do MT19, mas para zapi_messages:
```
GET https://<SUPABASE_URL>/rest/v1/zapi_messages?select=id,body,account_id
Authorization: Bearer <token_estagiario>
apikey: <anon_key>
```
- **Esperado:** array vazio `[]`.

### MT21 — SELECT após unlock = retorna dados da conta liberada
1. Estagiário desbloqueia a Conta A (senha correta).
2. Fazer chamada REST com filtro `account_id=eq.<uuid_conta_A>`:
```
GET https://<SUPABASE_URL>/rest/v1/zapi_chats?account_id=eq.<UUID_A>&select=id,phone
Authorization: Bearer <token_estagiario>
apikey: <anon_key>
```
- **Esperado:** retorna as conversas da Conta A (grant ativo no banco).

### MT22 — SELECT da Conta B sem unlock = 0 linhas (mesmo com Conta A desbloqueada)
1. Com Conta A desbloqueada (grant ativo), fazer chamada REST filtrando pela Conta B (sem grant):
```
GET https://<SUPABASE_URL>/rest/v1/zapi_chats?account_id=eq.<UUID_B>&select=id,phone
Authorization: Bearer <token_estagiario>
apikey: <anon_key>
```
- **Esperado:** array vazio `[]`. Isolamento confirmado.

---

## Bloco 8 — Regressão: Webhooks e Logs

### MT23 — Aba Webhooks acessível normalmente
1. Admin ir em WhatsApp > Webhooks.
- **Esperado:** conteúdo da aba carrega sem erros. Nenhum elemento de cadeado.

### MT24 — Aba Logs acessível normalmente
1. Admin ir em WhatsApp > Logs.
- **Esperado:** logs carregam normalmente.

### MT25 — Estagiário acessa Webhooks e Logs (se tiver permissão)
1. Se o estagiário tem acesso à página WhatsApp, verificar que as abas Webhooks e Logs funcionam normalmente (não afetadas pela feature de senha).

---

## Bloco 9 — Deep-link com conta trancada

### MT26 — Deep-link ?chat= para conta sem grant
1. Como estagiário, construir URL: `/whatsapp?chat=<numero>&tab=conversas`.
2. Navegar para essa URL diretamente.
- **Esperado:**
  - Tab "Conversas" é ativada automaticamente.
  - Seletor de conta mostra a conta padrão (primeira não-desconectada).
  - Se essa conta tem senha e não foi desbloqueada: cadeado aparece (deep-link não bypassa o cadeado).
  - O chat específico SÓ é selecionado após o estagiário desbloquear a conta.

---

## Bloco 10 — Expiração de grant em sessão ativa

### MT27 — Comportamento quando grant expira durante sessão
> Este teste requer manipulação do banco diretamente ou esperar 8h. Em ambiente de teste,
> alterar `GRANT_TTL_MS` temporariamente para 1 minuto, ou fazer UPDATE manual em
> `zapi_panel_grants` setando `expires_at = now() - interval '1 second'`.

1. Estagiário desbloqueia Conta A.
2. Forçar expiração do grant no banco (UPDATE manual ou aguardar TTL).
3. Na interface, estagiário tenta abrir outra conversa ou recarregar a lista.
- **Esperado:** como o estado de unlock é em memória (não relido do banco no frontend), a UI continuará mostrando as conversas. Porém, ao tentar carregar MENSAGENS de um chat específico, o SELECT em `zapi_messages` retornará 0 linhas (RLS bloqueia — grant expirado no banco). Documentar se a UI exibe estado de erro ou lista vazia silenciosamente.

---

## Resumo de resultados esperados por critério de aceite

| Critério | Testes que cobrem | Status esperado |
|---|---|---|
| 1. Estagiário sem validar → tela de senha | MT05 | Pendente E2E |
| 2. Senha errada → erro; N tentativas → rate-limit | MT06, MT07 | Pendente E2E |
| 3. Senha certa → libera; reload → pede de novo | MT08, MT09 | Pendente E2E |
| 4. Validar conta X não libera conta Y | MT10, MT22 | Pendente E2E |
| 5. API direta sem grant → 0 linhas | MT19, MT20, MT21, MT22 | Pendente E2E |
| 6. Admin sem cadeado; gerencia senha nas Contas | MT11, MT12, MT01–MT04 | Pendente E2E |
| 7. Estagiário não gerencia senha (UI + RLS) | MT17, MT18 | Pendente E2E |
| 8. Hash forte, zero texto puro | Validado estaticamente (PBKDF2-SHA256 100k) | APROVADO estaticamente |
| 9. Webhooks/Logs intactos | MT23, MT24, MT25 | Pendente E2E |

---

*Gerado por QA — RAQ-MAND-EM078 — 2026-06-03*
