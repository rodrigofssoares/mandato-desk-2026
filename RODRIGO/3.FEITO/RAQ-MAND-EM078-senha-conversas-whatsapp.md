# RAQ-MAND-EM078 — Senha de acesso às conversas do WhatsApp

**Branch:** `rodrigo/feature/RAQ-MAND-EM078-senha-de-acesso-as-conversas-do-whatsapp-whatsapp`
**Tipo:** feature · **Sistema:** whatsapp · **Prioridade:** alta

## Problema
A aba WhatsApp > Conversas NÃO exige senha. O RLS atual (`043_zapi_whatsapp.sql:319-346`)
libera SELECT de `zapi_chats`/`zapi_messages` pra qualquer autenticado — o "cadeado" foi
projetado só pro frontend (`useZapiPanelSession`, que nunca foi implementado). Resultado:
estagiário lê todas as conversas de todas as contas via API direta. Segurança de fachada.

## Modelo (decidido com o cliente)
- **Senha POR CONTA/instância** (schema atual `zapi_panel_passwords`, 1 senha por `account_id`).
- Admin (Rodrigo) **define/altera/reseta** a senha de cada conta na aba Contas. Estagiário NUNCA.
- Pra abrir as conversas de uma conta, o estagiário digita a senha DAQUELA conta.
- Validar conta X NÃO libera conta Y → isola estagiários entre si.
- **Admin faz bypass** do cadeado (gerencia tudo, não faz sentido pedir senha a ele).
- Liberação por **sessão do navegador**: reload → pede de novo (estado em memória).
- Segurança REAL: enforcement no banco (RLS), não só frontend.

## Arquitetura de enforcement
1. **Grant server-side**: EF valida a senha (hash) e cria linha em `zapi_panel_grants`
   (user_id, account_id, expires_at) via service_role. Esse grant é a fronteira de segurança.
2. **RLS** de `zapi_chats`/`zapi_messages` SELECT passa a exigir: `is admin` OU grant ativo
   pra aquele `account_id`. Quem não validou → 0 linhas, mesmo via API direta.
3. **Frontend**: estado de unlock em memória (reload re-tranca a UI); ao validar de novo,
   o grant é renovado. Nuance aceita: a conta JÁ validada continua acessível via API até o
   grant expirar (é a conta autorizada do próprio estagiário — ok). A conta NÃO validada
   nunca é acessível. Isolamento garantido.

---

## T1 — Banco (model-writer) · migration nova (próximo número livre, ex 084)
- Tabela `zapi_panel_grants(id uuid pk, user_id uuid fk auth.users, account_id uuid fk
  zapi_accounts cascade, granted_at timestamptz default now(), expires_at timestamptz not null)`.
  - Índice `(user_id, account_id, expires_at)`. UNIQUE `(user_id, account_id)` (upsert renova).
  - RLS: SELECT só do próprio (`user_id = auth.uid()`); INSERT/UPDATE/DELETE bloqueado pra
    usuário (só service_role via EF). Admin pode SELECT (debug) — opcional.
- Alterar RLS SELECT de `zapi_chats` e `zapi_messages`:
  `USING ( has_role(auth.uid(),'admin') OR EXISTS (SELECT 1 FROM zapi_panel_grants g
   WHERE g.user_id = auth.uid() AND g.account_id = <tabela>.account_id AND g.expires_at > now()) )`.
  (zapi_messages TEM account_id direto — sem join.)
- `zapi_panel_passwords.password_hash` continua admin-only (já é). Comentário de "texto puro MVP"
  some — agora é hash de verdade.
- Cleanup de grants expirados: reusar padrão do cron de purga (`044_zapi_purge_cron.sql`) OU
  deixar TTL curto e limpar on-validate. Decisão do model-writer.
- **REGRA DO PROJETO:** SQL vai pra `RODRIGO/1.FAZER/*.sql` pro Rodrigo rodar; depois move pra
  `3.FEITO/` + copia pra `supabase/migrations/`. NÃO aplicar via CLI sem o Rodrigo.

## T2 — Edge Functions (route-writer)
- `zapi-set-panel-password`: admin-only (checa has_role via JWT). Recebe {account_id, new_password}.
  Gera salt aleatório + hash PBKDF2-SHA256 (≥100k iterações) [ou bcrypt]. Upsert em
  `zapi_panel_passwords` (onConflict account_id). Formato armazenado: `pbkdf2$iter$salt$hash`.
- `zapi-validate-panel-password`: qualquer autenticado. Recebe {account_id, password}.
  - Busca o hash (service_role), faz compare constant-time.
  - **Rate-limit**: máx ~5 tentativas / 15min por (user_id, account_id); lockout temporário.
  - Sucesso → upsert grant com `expires_at = now() + GRANT_TTL` (ex 8h). Retorna {ok:true, expires_at}.
  - Falha → {ok:false} + incrementa contador. Nunca vaza se a conta tem ou não senha além do necessário.
- Reusar `_shared` (CORS, auth helpers). Sem libs bcrypt problemáticas no Deno — preferir Web Crypto.

## T3 — Frontend: cadeado nas Conversas (hook-writer + component-writer)
- Hook `useZapiPanelSession(accountId)`: estado de unlock EM MEMÓRIA (context/module-level, NÃO
  sessionStorage — reload deve re-trancar). Expõe `isUnlocked`, `unlock(password)` (chama
  `zapi-validate-panel-password`), `lock()`, `loading`, `error`. Admin → `isUnlocked = true` sempre.
- Componente de cadeado (lock screen) na aba Conversas: quando uma conta está selecionada e não
  desbloqueada → mostra input de senha (não mostra a lista/conteúdo). Sucesso → revela conversas.
  Erro/rate-limit → feedback claro (sonner + inline). Admin nunca vê o cadeado.
- Integrar em `src/pages/Whatsapp.tsx` (aba conversas) e no componente de conversas existente.

## T4 — Admin: gestão de senha por conta (hook-writer + component-writer)
- Atualizar `useResetZapiPanelPassword` (`src/hooks/useZapiAccounts.ts:301`) pra chamar a EF
  `zapi-set-panel-password` (hash server-side) em vez do upsert texto-puro atual.
- `ResetPanelPasswordDialog` + `ContasTabContent`: manter admin-only. Adicionar:
  - Indicador por conta de "senha definida / sem senha".
  - Ação "definir senha" (conta sem senha) além de "resetar/alterar".
  - CRUD completo da senha (definir + alterar + remover, se fizer sentido remover).
- Garantir UI escondida/desabilitada pra não-admin (já é, validar).

## Critérios de aceite (QA)
1. Estagiário abre Conversas de conta sem validar → tela de senha, sem conversas.
2. Senha errada → erro, não libera; após N tentativas → rate-limit.
3. Senha certa → libera as conversas DAQUELA conta; reload → pede de novo.
4. Validar conta X não libera conta Y.
5. **Via API direta sem grant → SELECT em zapi_chats/zapi_messages de conta não validada = 0 linhas.**
6. Admin não vê cadeado; gerencia senha por conta na aba Contas (definir/alterar/resetar).
7. Estagiário não cria/edita/reseta senha (RLS admin-only + UI).
8. Senha sempre com hash forte; migração ajusta. Zero texto puro.
9. Segurança de Webhooks/Logs intacta.

## Cadeia: PO(skip-DoR ok) → Backlog(feito) → Fullstack → Security(OBRIGATÓRIO: auth/RLS/dados)
→ Pentest(surface crítica: auth + RLS nova → dispara) → Code Review → QA.
