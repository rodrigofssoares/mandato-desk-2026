# Code Review -- T6 RAQ-MAND-EM080 Controle de Acesso WhatsApp

## Escopo

- Diff: 11 arquivos (+~900 -~50 linhas estimadas)
- Build: OK (npm run build sem erros)
- Lint: OK (npm run lint sem warnings relevantes)
- Typecheck: OK (npx tsc --noEmit sem erros)

---

## Aprovacao geral

A implementacao e solida. O design respeita as camadas existentes: hooks isolam acesso ao Supabase, componentes consomem apenas o necessario, a migration tem bloco de verificacao que falha ruidosamente se qualquer objeto nao foi criado. A escolha de usar chave composta (accountId + role) no sessionMap resolve o F-02 de forma elegante sem adicionar complexidade. O gating de abas em Whatsapp.tsx e imperativo mas legivel. A separacao entre bypass de privilegiado e fluxo normal de senha esta clara e documentada.

---

## Must-fix (bloqueiam merge)

### issue 1 -- useZapiPanelSession.ts:126

**Bug de pluralizacao na mensagem de rate-limit.**

O condicional usa `retryAfter > 60` para decidir entre "minuto" e "minutos", mas a variavel `retryAfter` esta em segundos. Quando `retryAfter === 60` (1 minuto exato), `Math.ceil(60/60) === 1` e `retryAfter > 60` e falso, resultando em "Aguarde 1 minutos." -- gramaticalmente errado.

Codigo atual:
```ts
`Muitas tentativas incorretas. Aguarde ${Math.ceil(retryAfter / 60)} minuto${retryAfter > 60 ? 's' : ''}.`
```

Correcao:
```ts
const minutes = Math.ceil(retryAfter / 60);
`Muitas tentativas incorretas. Aguarde ${minutes} minuto${minutes > 1 ? 's' : ''}.`
```

---

## Should-fix

### suggestion 2 -- useZapiAccountUsers.ts (key factory sem slot byUser)

O `zapiAccountUserKeys` tem `all` e `list()` mas nao tem slot `byUser(userId)`. A query atual filtra client-side no componente (`b.user_id === userId`), mas se o hook evoluir para filtrar server-side, nao havera chave de invalidacao granular disponivel.

Sugestao -- adicionar o slot agora para nao criar debito de API de cache depois:
```ts
const zapiAccountUserKeys = {
  all: ['zapi-account-users'] as const,
  list: () => [...zapiAccountUserKeys.all, 'list'] as const,
  byUser: (userId: string) => [...zapiAccountUserKeys.all, 'user', userId] as const,
};
```

### suggestion 3 -- useZapiAccountUsers.ts:77-88 (roundtrip desnecessario no getUser)

O mutation faz `supabase.auth.getUser()` para obter `creatorId` e passa como `created_by` no upsert, mas a migration 111 ja tem trigger `force_created_by` que sobrescreve esse campo server-side. O roundtrip adiciona latencia sem utilidade.

Sugestao -- remover a chamada e omitir `created_by` do payload:
```ts
// Remover estas linhas:
const { data: sessionData } = await supabase.auth.getUser();
const creatorId = sessionData.user?.id ?? null;
// E no upsert, omitir: created_by: creatorId
```

### suggestion 4 -- useZapiPanelSettings.ts:51-53 (fail-open sem comentario explicativo)

O bloco catch retorna `{ requirePasswordForPrivileged: false }` silenciosamente em caso de `permission denied`. O comportamento e correto (RLS nas tabelas de mensagens e a defesa real -- Security B-02), mas sem comentario parece um swallow de erro negligente. Qualquer revisor futuro vai questionar.

Sugestao -- adicionar comentario inline:
```ts
} catch {
  // Fail-open intencional: se o usuario nao tem permissao de ler zapi_panel_settings,
  // assume requirePasswordForPrivileged=false (nao bloqueia privilegiados sem senha).
  // A defesa real e o RLS em zapi_chats/zapi_messages (Security B-02).
  return { requirePasswordForPrivileged: false };
}
```

---

## Nitpicks

### nitpick 5 -- Whatsapp.tsx:113 (eslint-disable com deps incompletos)

O `useEffect` que redireciona para aba valida tem `eslint-disable-next-line react-hooks/exhaustive-deps` com deps `[isPermLoading, rawTab, isPrivileged, isAdmin]`. Mas `availableTabs` tambem depende de `accounts`, `hasBroadcastEnabled` e `hasEventosEnabled`. O disable mascara deps faltantes.

Consideracao: memoizar `availableTabs` com `useMemo` (deps explicitas) e incluir no array do useEffect. Isso elimina o disable e torna o gating rastreavel pelo React DevTools.

### nitpick 6 -- ConversasTabContent.tsx:226-228 (isPrivileged de activeRole pode confundir)

`isPrivileged` e derivado de `activeRole` (contexto de impersonation), nao de `profile.role`. O comentario existente explica que e intencional para UI (F-01 documentado). Considerar renomear para `isPrivilegedRole` ou adicionar comentario de 1 linha reforçando que e baseado em activeRole (nao a role real do usuario).

### nitpick 7 -- LinkWhatsappAccountsDialog.tsx:93 (isPending desabilita todos os checkboxes)

`toggleBinding.isPending` desabilita TODOS os checkboxes durante qualquer mutacao, nao apenas o item sendo alterado. Para listas pequenas o impacto e desprezivel. Vale registrar para quando a lista de contas escalar.

---

## Questions

### question 8 -- migration 111 (predicado USING redundante em policy)

Em alguma policy de SELECT do diff ha um `USING (auth.uid() IS NOT NULL)`. Esse predicado e redundante quando a policy ja e `TO authenticated` -- so usuarios autenticados chegam ao USING. Nao e bug (e conservador, nao permissivo), mas e ruido de template. Foi intencional ou e sobra de copy-paste?

---

## Praise

### praise 9 -- migration 111 (bloco de verificacao DO/BEGIN/END)

O bloco ao final da migration verifica a existencia de cada objeto criado (tabelas, funcoes, policies, indices) e faz RAISE EXCEPTION com mensagem descritiva se qualquer um faltar. Faz a migration falhar ruidosamente em vez de aplicar silenciosamente com objetos faltando. Pratica excelente que raramente se ve em projetos de equipe pequena.

### praise 10 -- useZapiPanelSession.ts:31-44 (sessionMap com chave composta)

A decisao de usar `accountId + '::' + activeRole` como chave do Map resolve o F-02 (grants de impersonation vazando entre roles) de forma elegante e sem estado adicional. O JSDoc explica o "por que" da chave composta, nao apenas o "o que". Exatamente o tipo de comentario que agrega valor.

---

## Veredicto

- [x] APROVAR COM AJUSTES

**1 must-fix** (bug de pluralizacao em useZapiPanelSession.ts:126 -- 2 linhas de correcao) deve ser resolvido antes do merge. Os 3 should-fix sao recomendados mas nao bloqueiam. Os nitpicks sao opcionais.

Apos correcao do must-fix: pode mergear.
