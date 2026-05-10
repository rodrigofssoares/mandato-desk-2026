# RAQ-MAND-EM051 — Known issues identificados pelo Pentest

> Issues do pentest que **não foram corrigidos** nesta sessão de fundação. Todos
> têm severidade Média ou Baixa. Cobrir em próxima sessão de hardening
> (criar task `RAQ-MAND-EM051-hardening` no QG quando partir pra Fase 2 da EM051).

---

## Attack #4 — `get_current_user_role()` e demais SECURITY DEFINER sem `SET search_path`

**Severidade:** Média (CWE-1321)
**Surface:** Funções `get_current_user_role`, `has_permission`, `handle_new_user`, `generate_api_token` em migrations antigas (provavelmente 001, 002).

**Risco:** Mesma classe de F3 que já foi corrigido em 045 (has_role e is_user_active). Atacante com permissão de criar funções/tabelas em `public` poderia hijacking via search_path.

**Fix sugerido:** `CREATE OR REPLACE FUNCTION` cada uma com `SET search_path = public, pg_catalog` e qualificar `public.profiles`, `public.tabela`, etc. Effort S.

---

## Attack #5 — Policies das migrations 043/045/046 sem `TO authenticated`

**Severidade:** Média (defesa em profundidade)
**Surface:** ~14 policies novas das migrations Z-API.

**Risco:** Sem `TO authenticated`, policies aplicam ao role `anon` também. Hoje fecha porque `auth.uid() IS NOT NULL` falha pra anon, mas se adicionar RPC SECURITY DEFINER que use `current_user`, defesa cai. Inconsistente com o resto do projeto (mig 001 sempre usa `TO authenticated`).

**Fix sugerido:** Recriar todas as policies adicionando `TO authenticated`. Effort S.

---

## Attack #6 — pg_cron purge é DELETE single-shot

**Severidade:** Média (CWE-400 — esgotamento de recursos)
**Surface:** Mig 044 jobs `zapi-purge-messages` e `zapi-purge-webhook-logs`.

**Risco:** Em volume alto (estimativa: 6.5M linhas/90d com 50 msg/min), `DELETE FROM zapi_messages WHERE created_at < ...` em bloco único trava webhook inbound durante o purge (AccessExclusiveLock + dead tuples massivos). Hoje sem volume, OK. Em produção com tráfego real, vai doer.

**Fix sugerido:** Substituir por loop em batches (10k linhas com `pg_sleep(0.1)` entre batches). Effort M.

---

## Attack #7 — `body` permite null bytes, RTL override, zero-width chars

**Severidade:** Média (CWE-93 / CWE-79 amplificado)
**Surface:** `zapi_messages.body` (CHECK só valida length).

**Risco:** Mensagem com `‮` (RTL override) ou `\x00` (null byte) persiste e renderiza. Se UI usar `dangerouslySetInnerHTML` em algum lugar (verificar quando T13/T15 forem implementados), vira XSS stored. Em export CSV, vira CSV injection.

**Fix sugerido:** CHECK `position(E'\x00' IN body) = 0`. Documentar que UI deve usar React safe-render (sem `dangerouslySetInnerHTML`). Effort trivial.

---

## Attack #8 — `ON DELETE CASCADE` permite admin apagar evidência inteira em 1 SQL

**Severidade:** Baixa-Média (CWE-693 — anti-forensics)
**Surface:** FKs em zapi_panel_passwords/chats/messages para zapi_accounts.

**Risco:** Admin (legítimo ou comprometido) faz `DELETE FROM zapi_accounts WHERE id = X` → tudo associado some. Em mandato político, é destruição de evidência num único statement.

**Fix sugerido (opcional, depende de política LGPD do mandato):**
- Adicionar `deleted_at TIMESTAMPTZ` em zapi_accounts
- Substituir DELETE por soft-delete via UPDATE
- Cron periódico apaga registros com `deleted_at > 90 dias`

Effort M. Discutir com Rodrigo se isso é prioridade.

---

## Attack #9 — Comments revelam topologia de defesa

**Severidade:** Baixa (info disclosure)
**Surface:** Comments autodoc nas migrations.

**Risco:** Atacante com `pg_dump` ou SELECT em `pg_description` (qualquer auth) lê: "AES-256-GCM aplicada na EF antes do INSERT", "bcrypt cost ≥10". Reduz tempo de recon.

**Fix sugerido:** Nenhum. Trade-off vs autodocumentação. Eu manteria.

---

## Attack #10 — Sem rate limit em SELECT por authenticated

**Severidade:** Baixa (CWE-770)
**Surface:** Policies SELECT amplas + PostgREST.

**Risco:** Atendente faz `select('*').range(0, 999999)` em zapi_messages → exfiltra histórico inteiro. Mitigado parcialmente pelo PostgREST default LIMIT 1000, mas burlável via `range()` ou `.csv()`.

**Fix sugerido:** Configurar `PGRST_DB_MAX_ROWS` no Supabase (config externa). Effort trivial.

---

## Tested-clean (atacado e resistiu)

| # | Ataque | Resultado |
|---|---|---|
| 11 | IDOR cross-account em zapi_messages | Bloqueado por design (single-tenant aceito como F4) |
| 12 | Escrita direta em zapi_chats/messages/webhook_log via Supabase JS | Bloqueado (`USING (false) WITH CHECK (false)`) |
| 13 | CHECK length() bypass via UTF-8 multibyte | Bloqueado (length retorna code points) |
| 14 | JSONB injection via payload | Bloqueado (estrutura segura) |

---

## Plano de hardening (próxima sessão)

Sugestão de migration `047_zapi_hardening_complementar.sql` cobrindo Attack #4-#7. Attack #8 vira decisão arquitetural (perguntar Rodrigo). #9 e #10 ficam como aceite documentado.

Estimativa: 1 task de ~3pt (M) na fase de hardening.
