# QA — RAQ-MAND-EM080 Controle de acesso no WhatsApp

> Modalidade: ESTATICA/ESTRUTURAL (migration ainda nao aplicada em prod).
> Branch: `rodrigo/feature/RAQ-MAND-EM080-controle-de-acesso-no-whatsapp-whatsapp`
> Build: OK (tsc + vite, sem erros TypeScript)

---

## Escopo

- Criterios de aceite cobertos: 10 de 10
- Test cases executados: 18 (16 passaram, 1 falhou com gap de UX, 1 gap de segurança media nota)
- Modalidade: Estatica (codigo + migration + Edge Function)

---

## Mapeamento criterio → implementacao

### CT01 — Aba unica para restrito (estagiario/assessor/assistente) PASSOU

**Criterio:** Agente de Relacionamento (estagiario) ao abrir WhatsApp ve apenas a aba Conversas.

**Implementacao:**
- `src/pages/Whatsapp.tsx:73-87` — `availableTabs` memoizado: restrito tem apenas `{'conversas'}`.
- `Whatsapp.tsx:183-215` — TabsList renderiza condicionalmente com `{isPrivileged && ...}` para Contas/Campanhas/Eventos e `{isAdmin && ...}` para Dashboard/Auditoria/Webhooks/Logs.
- `Whatsapp.tsx:228-274` — TabsContent tambem condicionais: restrito nao tem o DOM de nenhuma aba alem de Conversas.
- `Whatsapp.tsx:89-94` — URL com `?tab=contas` (ou qualquer aba restrita) cai em fallback `'conversas'`.
- `Whatsapp.tsx:112-116` — `useEffect` que redireciona URL proibida para `conversas` ao carregar permissoes.
- `Whatsapp.tsx:127-130` — `handleTabChange` bloqueia navegacao para aba fora de `availableTabs`.

**Analise:** Tripla defesa — TabsTrigger nao renderizado + TabsContent nao renderizado + URL forcada para conversas. Restrito nao consegue forcar por URL.

Status: PASSOU

---

### CT02 — Visibilidade de abas para privilegiado (admin/proprietario) PASSOU

**Criterio:** Admin e Proprietario veem todas as abas de gestao (Contas/Campanhas/Eventos). Dashboard/Auditoria/Webhooks/Logs seguem admin-only.

**Implementacao:**
- `Whatsapp.tsx:45` — `isPrivileged = activeRole === 'admin' || activeRole === 'proprietario'`.
- `Whatsapp.tsx:46` — `isAdmin = activeRole === 'admin'`.
- `availableTabs` (l.73-87): privilegiado tem contas + campanhas + eventos; admin adiciona dashboard/auditoria/webhooks/logs.
- TabsList e TabsContent espelham identicamente.

**Analise:** `proprietario` ve Contas/Campanhas/Eventos mas NAO ve Dashboard/Auditoria/Webhooks/Logs. Correto conforme spec.

Status: PASSOU

---

### CT03 — Seletor de contas: restrito ve so contas vinculadas PASSOU

**Criterio:** No seletor de contas das Conversas, um restrito ve apenas as contas vinculadas a ele.

**Implementacao (frontend):**
- `ConversasTabContent.tsx:190` — `useZapiAccounts()` sem filtro client-side.
- A lista `accounts` recebida ja contem apenas as contas que a RLS liberou.

**Implementacao (banco — migration 111):**
- `111_em080_whatsapp_access_control.sql:275-291` — Policy `zapi_accounts_select`:
  ```sql
  is_zapi_privileged(auth.uid())   -- privilegiado ve todas
  OR
  EXISTS (SELECT 1 FROM zapi_account_users au
          WHERE au.account_id = zapi_accounts.id
            AND au.user_id = auth.uid())  -- restrito ve so vinculadas
  ```

**Analise:** Nenhum filtro client-side conflita com a RLS. A visibilidade e enforced 100% pelo banco.

Status: PASSOU

---

### CT04 — Empty-state amigavel para restrito sem vinculo PASSOU

**Criterio:** Restrito sem nenhuma conta vinculada ve empty-state amigavel.

**Implementacao:**
- `ConversasTabContent.tsx:574-593` — quando `accounts.length === 0` e `!isPrivileged`:
  ```tsx
  <EmptyState
    icon={Lock}
    title="Nenhuma conta de WhatsApp liberada para você"
    description="Peça ao administrador para vincular uma conta ao seu usuário na área de Equipe."
  />
  ```

**Analise:** Mensagem clara, icon de cadeado, instrucao de acao. Correto.

Status: PASSOU

---

### CT05 — Opcao "Todos os numeros" so para privilegiado PASSOU

**Criterio:** Opcao "Todos os numeros" no seletor restrita a privilegiados.

**Implementacao:**
- `ConversasTabContent.tsx:634` — `{accounts.length >= 1 && isPrivileged && (<SelectItem value="__all__">...)}`.
- `effectiveLockAccountId` e `null` quando `__all__`, portanto nenhum lock screen aparece (modo admin).

**Analise:** Correto. Restrito nao ve a opcao e nao pode forcar o valor via DOM manipulation (a RLS bloquearia mesmo assim via `zapi_accounts_select`).

Status: PASSOU

---

### CT06 — Webhook/Logs admin-only (antes vazavam para nao-admin) PASSOU

**Criterio:** Webhooks/Logs deixam de ficar visiveis para nao-admin.

**Implementacao (frontend):**
- `Whatsapp.tsx:207-215` — ambas as abas condicionadas em `{isAdmin && ...}`.

**Implementacao (banco):**
- `111_em080_whatsapp_access_control.sql:358-363` — Policy `zapi_webhook_log_select`:
  ```sql
  USING ( has_role(auth.uid(), 'admin') );
  ```
  Substitui o anterior `USING (auth.uid() IS NOT NULL)` que vazia para qualquer autenticado.

**Analise:** Dupla protecao UI + RLS. Gap original (P-01 Pentest) fechado.

Status: PASSOU

---

### CT07 — Gerenciamento de vinculos na area de Equipe PASSOU COM RESSALVA

**Criterio:** Admin gerencia vinculos conta-usuario na area de Equipe (Usuarios). CRUD completo (vincular + desvincular).

**Implementacao:**
- `src/components/users/UserCard.tsx:167-169` — item "Vincular contas WhatsApp" no dropdown.
- `src/components/users/LinkWhatsappAccountsDialog.tsx` — dialog com checkboxes por conta.
- `src/hooks/useZapiAccountUsers.ts:71-112` — `useToggleAccountUserBinding`: `linked=true` faz upsert, `linked=false` faz delete.
- Migration 111 policies: `zapi_account_users_insert` e `zapi_account_users_delete` com `has_role(auth.uid(), 'admin')`.
- CRUD completo: vincular (INSERT) e desvincular (DELETE) presentes. UPDATE nao necessario (upsert idempotente).
- Invalidacao de cache: `queryClient.invalidateQueries({ queryKey: zapiAccountUserKeys.all })` em ambas as operacoes.

**GAP DE UX (MEDIO):** O item "Vincular contas WhatsApp" aparece no dropdown para QUALQUER usuario com `canManage=true`, que inclui `proprietario` gerenciando assessores. O proprietario (ROLE_LEVELS=80) passa na condicao `canManage` mas a RLS rejeita a operacao no banco. O usuario ve o dialog, interage com checkboxes, e recebe um toast de erro sanitizado sem entender por que falhou.

**Sugestao de correcao:**
```tsx
// Em UserCard.tsx, adicionar guard explicitamente admin-only:
{canManage && currentUser?.role === 'admin' && (
  <>
    <DropdownMenuSeparator />
    <DropdownMenuItem onClick={() => setLinkWhatsappOpen(true)}>
      <MessageCircle className="h-4 w-4 mr-2" />
      Vincular contas WhatsApp
    </DropdownMenuItem>
  </>
)}
```

Status: PASSOU COM RESSALVA (funciona para admin; proprietario ve acao que falha silenciosamente)

---

### CT08 — Bypass de senha para privilegiado (toggle off) PASSOU

**Criterio:** Por padrao, Admin/Proprietario entram nas conversas sem digitar senha.

**Implementacao (frontend):**
- `useZapiPanelSession.ts:72-73` — `const bypass = isPrivileged && !requirePasswordForPrivileged`.
- `useZapiPanelSession.ts:163-172` — early-return com `isUnlocked: true` quando bypass.

**Implementacao (banco):**
- `111_em080_whatsapp_access_control.sql:309-310` — Policy `zapi_chats_select`:
  ```sql
  ( NOT public.zapi_require_password_for_privileged() AND public.is_zapi_privileged(auth.uid()) )
  ```

**Analise:** Padrao `require_password_for_privileged=false` garante bypass. A linha singleton e inserida na migration com `ON CONFLICT DO NOTHING` garantindo o default.

Status: PASSOU

---

### CT09 — Toggle global de senha para privilegiado (admin-only) PASSOU

**Criterio:** Existe toggle "Exigir senha de painel para Administradores e Proprietarios" admin-only. Ligado → admin/proprietario tambem digitam senha.

**Implementacao (frontend):**
- `ContasTabContent.tsx:198-226` — Card com Switch condicional em `{isAdmin && ...}`.
- `useZapiPanelSettings.ts:75-102` — `useUpdateZapiPanelSettings` faz UPDATE em `zapi_panel_settings`.

**Implementacao (banco):**
- Policy `zapi_panel_settings_update` com `has_role(auth.uid(), 'admin')`.
- Qualquer autenticado pode ler (para o frontend saber o estado do toggle).
- RLS em `zapi_chats` usa `zapi_require_password_for_privileged()` para aplicar ou nao o gate.

**Analise:** Toggle visivel e operavel apenas por admin. Efeito propagado via RLS no banco. Correto.

Status: PASSOU

---

### CT10 — Restritos sempre digitam senha (sem bypass) PASSOU

**Criterio:** Restritos sempre obrigatoriamente digitam senha (EM078).

**Implementacao:**
- `useZapiPanelSession.ts:73` — `bypass = isPrivileged && !requirePasswordForPrivileged`. Para restrito, `isPrivileged=false` → `bypass=false` independente do toggle.
- `ConversasTabContent.tsx:675-683` — Lock screen aparece quando `effectiveLockAccountId && !panelSession.isUnlocked`.

**Analise:** Restrito nunca tem bypass. O toggle so afeta privilegiados.

Status: PASSOU

---

### CT11 — Isolamento de contas: RLS em zapi_chats/zapi_messages PASSOU

**Criterio:** Conta nao vinculada nao aparece via API direta (RLS).

**Implementacao:**
- `zapi_accounts_select`: restrito so ve contas vinculadas.
- `zapi_chats_select` e `zapi_messages_select`: restritos precisam de grant; grants so sao emitidos pela EF `zapi-validate-panel-password` apos verificar vínculo em `zapi_account_users`.
- `zapi_panel_grants`: INSERT/UPDATE/DELETE bloqueados para `authenticated` (policy `write_blocked` com `USING(false)` + `GRANT SELECT` apenas para authenticated).
- EF `zapi-validate-panel-password:192-221` — verifica vinculo ANTES de validar senha. Sem vinculo → 403, nao entra no fluxo de rate-limit.

**Analise:** Defesa em profundidade correta:
1. UI nao mostra contas nao vinculadas (RLS em zapi_accounts).
2. Mesmo que restrito tentasse forcar account_id via API, a EF rejeita grant sem vinculo.
3. Sem grant, RLS em zapi_chats/zapi_messages bloqueia SELECT.
4. Grant nao pode ser criado diretamente pelo usuario (policy write_blocked).

Status: PASSOU

---

### CT12 — notas de chat alinhadas ao modelo EM080 (N-01) PASSOU

**Criterio:** Vetor lateral de `zapi_chat_notes` fechado (antes vazava notas de contas nao vinculadas).

**Implementacao:**
- `111_em080_whatsapp_access_control.sql:385-402` — Policy `zapi_chat_notes_select`:
  - Privilegiado: acesso direto via `is_zapi_privileged()`.
  - Restrito: so ve notas de chats cujas contas estao vinculadas (JOIN via `zapi_chats` + `zapi_account_users`).

Status: PASSOU

---

### CT13 — Trigger force_created_by em zapi_account_users (P-03) PASSOU

**Criterio:** Auditoria de quem criou o vinculo nao pode ser falsificada.

**Implementacao:**
- `111_em080_whatsapp_access_control.sql:160-183` — Trigger `trg_zapi_account_users_force_created_by` executa `NEW.created_by := auth.uid()` antes do INSERT.
- `useZapiAccountUsers.ts:78-88` — cliente omite `created_by` no upsert (campo forcado server-side).

Status: PASSOU

---

### CT14 — is_zapi_privileged nao usa has_role bugado PASSOU

**Criterio:** Helper correto para verificar admin/proprietario sem o bug de has_role.

**Implementacao:**
- `111_em080_whatsapp_access_control.sql:49-63` — Lookup direto em `profiles` com `role IN ('admin','proprietario') AND status_aprovacao='ATIVO'`. Nenhuma chamada a `has_role()`.
- SECURITY DEFINER + STABLE.

Status: PASSOU

---

### CT15 — Idempotencia da migration PASSOU

**Criterio:** Migration pode ser re-aplicada sem erros.

**Analise:**
- `CREATE TABLE IF NOT EXISTS` para ambas as tabelas novas.
- `CREATE OR REPLACE FUNCTION` para todos os helpers e triggers.
- `DROP POLICY IF EXISTS` + `CREATE POLICY` para todas as policies.
- `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER` para o trigger.
- `INSERT ... ON CONFLICT (id) DO NOTHING` para o singleton.
- Bloco DO ao final verifica presenca de todos os objetos criados.

**Unico gap no bloco DO:** a funcao `zapi_account_users_force_created_by` e verificada, mas o trigger `trg_zapi_account_users_force_created_by` em `pg_trigger` NAO e verificado. Severidade baixa — `CREATE TRIGGER` falha ruidosamente se a tabela nao existir (mas nao se a funcao ja existia e o trigger estava em estado inconsistente).

Status: PASSOU (com nota de cobertura incompleta no DO)

---

### CT16 — SessionMap com chave composta por role (P-02/F-02) PASSOU

**Criterio:** Trocar de role via impersonation invalida grant em memoria.

**Implementacao:**
- `useZapiPanelSession.ts:77` — `sessionKey = \`${accountId}::${activeRole}\``.
- Impersonation so permitida para admin (`ImpersonationContext.tsx:18-24`).

Status: PASSOU

---

### CT17 — Toggle ligado NAO sincroniza isUnlocked em tempo real para privilegiado (GAP MEDIO) FALHOU

**Cenario:** Admin esta na pagina de Conversas com uma conta ja desbloqueada (bypass ativo). Outro admin liga o toggle `require_password_for_privileged` na aba Contas. O primeiro admin, sem recarregar, continua com `isUnlocked=true` no estado React.

**Analise:**
- `useZapiPanelSession.ts:79-83` — `useState` e inicializado uma vez. Quando `bypass` muda de `true` para `false` (toggle ligado remotamente), o estado `unlocked` ja foi inicializado como `true` e nao e re-sincronizado.
- O early-return em `l.163` so retorna `isUnlocked: true` quando `bypass=true`. Quando bypass se torna falso, o hook retorna `isUnlocked: unlocked` (o state "contaminado" com valor antigo).
- O lock screen nao aparece ate reload.
- **Impacto de segurança: BAIXO** — o RLS no banco (`zapi_require_password_for_privileged()` + `is_zapi_privileged()`) age na query SQL do `useZapiChats`. Quando o toggle e ligado, a policy vai retornar false para novas queries do privilegiado sem grant (staleTime=60s no `useZapiPanelSettings`, portanto o RLS so entra em acao apos ate 60s). A lista de chats fica vazia ou retorna erro silencioso.
- **Impacto de UX: MEDIO** — usuario privilegiado ve a interface desbloqueada mas lista de chats vazia, sem explicacao.

**Sugestao de correcao (baixa prioridade, pos-deploy):**
```ts
// Em useZapiPanelSession.ts, adicionar useEffect:
useEffect(() => {
  if (bypass) {
    setUnlocked(true);
  } else if (!isSessionValid(sessionKey ?? '')) {
    setUnlocked(false);
  }
}, [bypass, sessionKey]);
```

Status: FALHOU (gap de UX; sem fuga de dados — RLS protege)
Severidade: Media (UX ruim; sem risco de segurança real)

---

### CT18 — Regressao: privilegiado continua acessando contas, dashboards, broadcast, eventos PASSOU

**Criterio:** Nada quebra para privilegiado.

**Analise:**
- Build TypeScript passou sem erros.
- `useZapiAccounts` sem filtro client-side — RLS de `zapi_accounts` concede acesso total a `is_zapi_privileged`.
- `useAllZapiChats` sem filtro — RLS de `zapi_chats` concede a privilegiado via bypass (toggle off).
- Campanhas/Eventos condicionados em `isPrivileged && has...Enabled` — nao alterado.
- Dashboard/Auditoria condicionados em `isAdmin` — nao alterado.

Status: PASSOU

---

## Heuristicas exploratórias aplicadas

| Heurística | Status | Nota |
|---|---|---|
| Boundaries (URL ?tab= com valores invalidos) | PASSOU | Fallback para 'conversas' |
| Boundaries (accountId nulo, __all__) | PASSOU | effectiveLockAccountId=null, sem lock screen |
| URL manipulation (?tab=contas como restrito) | PASSOU | Redirect para conversas em useEffect |
| Concurrency (toggle mudado por outro admin) | GAP MEDIO | Ver CT17 — UX sem feedback, RLS protege |
| State transitions (impersonation admin→estagiario) | PASSOU | sessionKey muda, P-02 fix ativo |
| Empty/null (restrito sem contas vinculadas) | PASSOU | EmptyState especifico |
| Bypass de grant via POST direto em zapi_panel_grants | PASSOU | write_blocked policy + nenhum GRANT INSERT para authenticated |
| Proprietario tentando vincular conta (acao nao autorizada) | GAP UX | Ver CT07 — item visivel, operacao falha no banco |
| Regressao de abas pre-existentes | PASSOU | Todas condicionadas corretamente |
| Build TypeScript | PASSOU | 0 erros, warnings pre-existentes apenas |

---

## Regressao verificada

- [x] Conversas (aba) — nao afetada
- [x] Contas (aba) — ainda visivel para admin/proprietario; toggle e rendering corretos
- [x] Campanhas (aba) — ainda condicionada por isPrivileged + hasBroadcastEnabled
- [x] Eventos (aba) — ainda condicionada por isPrivileged + hasEventosEnabled
- [x] Dashboard/Auditoria — ainda admin-only
- [x] Webhooks/Logs — admin-only confirmado (antes vazava, agora protegido)
- [x] zapi_chat_notes — policy SELECT reescrita, sem regressao em INSERT/UPDATE/DELETE
- [x] Impersonation (troca de role) — sessionMap invalida grants antigos corretamente

---

## Sumario de findings

| ID | Tipo | Severidade | Descricao |
|---|---|---|---|
| F01 | Gap de UX | Media | UserCard: item "Vincular contas WhatsApp" visivel para proprietario mas RLS rejeita a operacao. Feedback de erro opaco. |
| F02 | Gap de UX | Media | useZapiPanelSession: toggle ligado remotamente nao sincroniza isUnlocked state — UI fica sem lock screen ate reload (RLS ainda protege no banco). |
| F03 | Gap de validacao | Baixa | Bloco DO da migration 111 verifica funcao force_created_by mas nao verifica o trigger trg_zapi_account_users_force_created_by no pg_trigger. |

---

## Veredicto

**APROVADO COM RESERVAS**

A implementacao cobre todos os 10 criterios de aceite. A segurança esta correta: RLS enforced no banco, defesa em profundidade no fluxo grant, helper is_zapi_privileged sem o bug de has_role, P-01/P-03/N-01 fechados. O build passa sem erros TypeScript.

Os dois gaps de UX (F01 e F02) nao criam brechas de segurança (RLS protege em todos os cenarios), mas geram experiencia ruim:
- F01: proprietario ve acao que falha sem explicacao clara.
- F02: privilegiado ve lista vazia sem entender o motivo quando toggle e ligado em tempo real.

**Recomendacao:** F01 deve ser corrigido antes de go-live (1 linha — adicionar `currentUser?.role === 'admin'` na condicao). F02 pode ser pos-deploy (cenario de borda raro, RLS protege).
