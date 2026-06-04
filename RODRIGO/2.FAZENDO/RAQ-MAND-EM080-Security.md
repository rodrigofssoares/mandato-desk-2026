# Auditoria de Seguranca -- RAQ-MAND-EM080 Controle de Acesso WhatsApp

> Auditor: agente security (defensivo). Data: 2026-06-03

---

## Escopo

Arquivos auditados:
- supabase/migrations/111_em080_whatsapp_access_control.sql
- supabase/functions/zapi-validate-panel-password/index.ts
- src/hooks/useZapiAccountUsers.ts
- src/hooks/useZapiPanelSettings.ts
- src/hooks/useZapiPanelSession.ts
- src/components/users/LinkWhatsappAccountsDialog.tsx
- src/components/users/UserCard.tsx
- src/components/whatsapp/ContasTabContent.tsx
- src/components/whatsapp/ConversasTabContent.tsx
- src/pages/Whatsapp.tsx
- src/integrations/supabase/types.ts

Baseline lido: 110_zapi_panel_grants.sql (EM078) para analise de regressao.

---

## Layer 1 -- 13 VibeCoding (checklist obrigatorio)

| # | Vulnerabilidade | Status | Arquivo:linha |
|---|---|---|---|
| 1 | Race Condition | SEGURO | zapi_rl_bump RPC atomico (110). Sem nova race. |
| 2 | IDOR | PARCIAL | F-01: modo __all__ bypassa lock de senha para restrito |
| 3 | SQL Injection | SEGURO | Sem concatenacao; parametros posicionais |
| 4 | XSS | NA | Sem HTML rico |
| 5 | SSRF | NA | Sem URL/proxy |
| 6 | Upload Malicioso | NA | Sem upload |
| 7 | Mass Assignment | SEGURO | Campos explicitos; RLS bloqueia sensiveis |
| 8 | Input Flooding | SEGURO | Content-Length 4KB na EF (linha 129) |
| 9 | Enumeracao | SEGURO | 403 generico; sem vazar estado de senha |
| 10 | Logica de Negocio | PARCIAL | F-01: restrito contorna lock screen no modo __all__ |
| 11 | Secrets | SEGURO | Sem keys hardcoded; service_role so na EF |
| 12 | JWT | SEGURO | Token validado server-side |
| 13 | Bypass URL | SEGURO | availableTabs.has() + redirect; URL params sem influencia em authn |

---
## Respostas as perguntas especificas

### 1. is_zapi_privileged fecha o bug do has_role?

SIM, completamente.

A funcao is_zapi_privileged (migration 111, linhas 39-53) faz SELECT direto em profiles
WHERE role IN (admin, proprietario) AND status_aprovacao = ATIVO sem nenhuma chamada a has_role.

As 3 novas policies (zapi_accounts_select, zapi_chats_select, zapi_messages_select) usam
EXCLUSIVAMENTE public.is_zapi_privileged(auth.uid()).

As policies de INSERT/UPDATE/DELETE em zapi_account_users (linhas 119, 126-127, 134)
e o UPDATE em zapi_panel_settings (linhas 185-186) usam has_role(auth.uid(), admin).
Correto: has_role tem bug apenas para role diferente de admin.

NENHUMA policy nova usa has_role(uid, proprietario). Bug fechado neste diff.

### 2. IDOR/escalada via zapi_account_users -- restrito consegue se auto-vincular?

NAO via INSERT/UPDATE/DELETE.

Policy INSERT (linha 119): WITH CHECK has_role admin -- bloqueia. SEGURO.
Policy UPDATE (linhas 126-127): USING + WITH CHECK has_role admin. SEGURO.
Policy DELETE (linha 134): USING has_role admin. Restrito nao deleta nem proprio vinculo. SEGURO.
Policy SELECT: is_zapi_privileged OR user_id = auth.uid(). Sem enumeracao. SEGURO.
GRANT com RLS ativa: PostgREST aplica RLS antes de executar. SEGURO.

### 3. Bypass de visibilidade -- restrito le contas/chats/messages nao vinculadas?

NAO via RLS das tabelas principais. Ha lacuna de UX no modo __all__ (F-01, MEDIO).

zapi_accounts_select (linhas 229-240):
  is_zapi_privileged OR EXISTS(account_users WHERE account_id=accounts.id AND user_id=auth.uid())
  Logica correta sem brecha de precedencia. SEGURO no banco.

zapi_chats_select e zapi_messages_select -- toggle-aware:
  (NOT toggle AND is_privileged) OR EXISTS(grants WHERE ... AND expires_at > now())

Analise de precedencia (condA AND condB) OR condC:
  condA=NOT toggle, condB=is_privileged, condC=grant ativo
  Toggle OFF + privilegiado: condA=true AND condB=true -> acesso direto. CORRETO.
  Toggle ON  + privilegiado: condA=false -> so condC. Precisa grant. CORRETO.
  Toggle OFF/ON + restrito:  condB=false -> so condC. Precisa grant. CORRETO.
Todas as 4 combinacoes corretas. Sem brecha logica.

### 4. EF validate -- vinculo determina privilegio via service_role?

SIM, corretamente.

Linha 174: busca profiles.role + status_aprovacao via admin (service_role) usando callerId
extraido do JWT validado por requireAuth. Nao confia em claims do cliente.

Restrito sem vinculo recebe 403 na linha 217 ANTES do rate-limit (linha 224). SEGURO.
O 403 usa mensagem generica sem revelar estado da senha. SEGURO.
403 de vinculo NAO incrementa failed_attempts (zapi_rl_bump so chamado apos senha
incorreta, linha 293). Sem DoS de lockout em terceiros via tentativas sem vinculo. SEGURO.
Privilegiado com toggle ON: ignora bloco if (!isPrivileged), obtem grant ao final. SEGURO.

### 5. Toggle zapi_panel_settings -- nao-admin consegue alterar?

NAO. Singleton protegido.

Policy UPDATE (linhas 185-186): has_role admin USING + WITH CHECK. SEGURO.
INSERT: sem policy + RLS = default deny. SEGURO.
DELETE: sem policy = deny. SEGURO.
GRANT: SELECT, UPDATE apenas. Sem INSERT/DELETE. SEGURO.
Singleton enforced: PRIMARY KEY boolean + CHECK (id = true). SEGURO.
Toggle ON nao eleva restrito (restrito ja precisa de grant sempre). SEGURO.

### 6. Regressoes vs. EM078

Nenhuma regressao encontrada.

- Grants (110): zapi_panel_grants nao alterada. Policies write-blocked intactas. SEGURO.
- Rate-limit TOCTOU (M-01): zapi_rl_bump RPC atomico nao alterado. SEGURO.
- Constant-time (verifyPassword): inalterada. SEGURO.
- Content-Length guard (F6): linha 129 da EF, 4 KB, inalterada. SEGURO.
- Timing de conta sem senha: delay 200ms (linha 281) inalterado. SEGURO.
- Profile re-fetch: 2 queries em profiles (requireAuth + linha 174). Segunda necessaria
  para logica de vinculo. Redundancia de leitura sem impacto de seguranca. SEGURO.
---

## Layer 2 -- OWASP Top 10 + STRIDE

A01 Broken Access Control:
  RLS habilitada em zapi_account_users e zapi_panel_settings. Policies corretas.
  Abas Webhooks/Logs admin-only em Whatsapp.tsx e availableTabs.
  handleTabChange bloqueia navegacao de restrito. TUDO SEGURO.

A04 Insecure Design:
  Modo __all__ desativa lock de senha no frontend enquanto RLS exige grant.
  Inconsistencia UX vs. defense in depth. Ver F-01 (MEDIO).

A07 Identification and Auth Failures:
  requireAuth valida status_aprovacao ATIVO. EF re-busca profile server-side. SEGURO.

A09 Security Logging and Monitoring:
  EF loga callerId + accountId sem senha/hash. SEGURO.
  Sem log persistente de remocao de vinculo. BAIXO -- ver B-01.

STRIDE:
| Categoria | Surface | Mitigacao | Lacuna |
|---|---|---|---|
| Spoofing | Restrito finge ser privilegiado | Lookup server-side em profiles via service_role | Nenhuma |
| Tampering | Adultera require_password_for_privileged | RLS UPDATE so admin | Nenhuma |
| Tampering | Adultera zapi_account_users para auto-vincular | RLS INSERT/UPDATE/DELETE so admin | Nenhuma |
| Repudiation | Quem removeu vinculo? | created_by no INSERT | Sem log de remocao -- B-01 |
| Info Disclosure | Estado de senha via timing | Delay 200ms + mensagem generica | Nenhuma |
| DoS | Lockout via tentativas sem vinculo | 403 antes do rate-limit | Nenhuma |
| Elevation | Restrito vira privilegiado via toggle | Toggle UPDATE so admin | Nenhuma |

---

## Sumario de findings

- CRITICAS: 0
- ALTAS: 0
- MEDIAS: 2 (F-01, F-02)
- BAIXAS: 2 (B-01, B-02)

---

## Findings Medias

### F-01 [VibeCoding #2 / OWASP A01 / CWE-639] Modo __all__ bypassa lock de senha para restrito

Arquivo:linha: src/components/whatsapp/ConversasTabContent.tsx:229-232

Descricao:
effectiveLockAccountId e null quando selectedAccountId === __all__ (linha 229-232).
Quando restrito seleciona Todos os numeros (disponivel se accounts.length >= 1, linha 629),
o lock screen NAO e renderizado (condicao effectiveLockAccountId && !panelSession.isUnlocked
e falsa porque effectiveLockAccountId e null) e useAllZapiChats dispara.

Para restrito com ao menos 1 conta vinculada: a opcao Todos os numeros aparece no seletor.
Ao selecionar, o restrito ve a interface de conversas sem digitar senha. A RLS de zapi_chats
retorna somente linhas com grant ativo -- sem grant a lista fica vazia. O dado nao vaza,
mas o lock screen (primeira camada de defense in depth) e contornado.

Para privilegiado com toggle ON: similar -- modo __all__ nao exibe lock screen.
RLS devolve vazio para contas sem grant. Inconsistencia de UX.

Impacto:
Dado protegido pela RLS. Defense in depth comprometida: se RLS for relaxada por bug futuro,
o lock screen nao estara presente como segunda camada.

Como corrigir (opcao recomendada):
Em ConversasTabContent.tsx linha 629, adicionar condicional de role:

  Antes:  {accounts.length >= 1 && (
  Depois: {accounts.length >= 1 && isPrivileged && (

A feature T87/C26 depende de configuracao de conta (aba Contas) que restrito nao acessa.
Remover a opcao e semanticamente correto.

Alternativa para privilegiado com toggle ON: verificar se todas as contas tem grant ativo;
sem grant universal, exibir aviso pedindo conta individual em vez de lista vazia.

---

### F-02 [OWASP A07 / CWE-613] Impersonation nao reseta grant em memoria

Arquivo:linha: src/hooks/useZapiPanelSession.ts:32-39

Descricao:
sessionMap e module-level (singleton de modulo JS). Quando admin usa impersonation
para trocar de role (admin -> estagiario), o sessionMap continua com os grants em
memoria adquiridos como admin. Se o admin ja desbloqueou uma conta, ao entrar em modo
estagiario isSessionValid retorna true e isUnlocked fica true. Lock screen nao aparece.

Impacto:
A RLS protege o dado -- sem grant no banco, a query retorna vazio. O dado nao vaza.
Mas o admin em modo impersonation ve o layout desbloqueado com lista vazia, quebrando
a fidelidade da simulacao de acesso de estagiario.

Como corrigir:
Namear a chave do sessionMap com accountId + activeRole:
  const sessionKey = accountId + ':' + activeRole;
  sessionMap.get(sessionKey) em vez de sessionMap.get(accountId)

Ou exportar clearSessionMap() e chamar no ImpersonationContext ao trocar de role.

---

## Findings Baixas

### B-01 [OWASP A09 / CWE-778] Sem log persistente de remocao de vinculos

Arquivo:linha: supabase/migrations/111_em080_whatsapp_access_control.sql:72-99

created_by e registrado no INSERT. Remocao (DELETE) nao e auditada.
Se admin remover vinculo de forma maliciosa, nao ha rastro.

Como corrigir: trigger AFTER DELETE ON zapi_account_users que insere em activities
com type=whatsapp_access_revoked, entity_id = OLD.user_id, responsible_id = auth.uid().

---

### B-02 [OWASP A05 / Hardening] useZapiPanelSettings fail-open em erro de RLS

Arquivo:linha: src/hooks/useZapiPanelSettings.ts:51-53

Em erro de permission denied / row-level security, o hook retorna
requirePasswordForPrivileged: false (fail-open para privilegiado). O dado esta protegido
pela RLS de zapi_chats/messages. Exposicao de comportamento UX, nao de dado direto.

Como corrigir: para erros desconhecidos, retornar true (fail-closed). Para erro de RLS
especifico, o false atual e aceitavel pois restritos tem SELECT garantido.

---

## Veredicto

[x] APROVADO COM RESERVAS
    F-01 recomendado corrigir ANTES do merge: impacta defense in depth de restrito.
    F-02 pode ser issue separada (dado protegido pela RLS).
[ ] BLOQUEADO -- sem findings criticas ou altas.

---

## Proximos passos

| Quem | O que |
|---|---|
| Fullstack | F-01: remover opcao Todos os numeros para restrito em ConversasTabContent.tsx linha 629 |
| Fullstack | F-02: limpar sessionMap ao trocar de role (issue separada) |
| Fullstack | B-01: trigger AFTER DELETE ON zapi_account_users -> activities (sprint seguinte) |
| Fullstack | B-02: avaliar fail-closed em useZapiPanelSettings (baixa prioridade) |

---

Auditoria concluida. OWASP Top 10 + STRIDE + 13 VibeCoding aplicados a todos os arquivos do diff.
Sem findings criticas ou altas. A camada de RLS esta correta e robusta.
As 2 findings medias sao de UX/consistencia de frontend com a RLS como defesa real.