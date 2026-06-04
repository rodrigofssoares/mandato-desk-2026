# Roteiro E2E — RAQ-MAND-EM082 Limpeza de Histórico WhatsApp

**Pré-requisito:** migration 112 aplicada + EFs zapi-cleanup-history e zapi-restore-history deployadas.

**Conta de teste sugerida:** usar uma conta Z-API de sandbox com pelo menos 10 chats e 50 mensagens.

---

## Preparação

1. Logar como admin no Mandato Desk 2026.
2. Ir em WhatsApp > aba Conversas.
3. Confirmar que a conta de teste está selecionada e tem conversas visíveis.
4. Anotar total de conversas visíveis (ex: 12 chats).

---

## TC01 — Botão "Limpar histórico" visível para admin, oculto para outros roles

- Logar como admin → verificar botão "Limpar histórico" visível na barra de ações.
- Logar como assessor → verificar botão ausente.
- Logar como proprietário (sem pode_deletar=true no banco) → verificar botão ausente.
- **Esperado:** botão só aparece para quem tem `canDelete('whatsapp')=true`.

---

## TC02 — Dialog: reset ao fechar

1. Abrir o dialog, selecionar modo "Por período", clicar nos atalhos "30 dias".
2. Fechar sem confirmar (clicar Cancelar ou X).
3. Reabrir o dialog.
4. **Esperado:** passo 1, modo nenhum selecionado, sem estado anterior.

---

## TC03 — Modo "Por período" com atalho 7 dias

1. Abrir dialog, selecionar "Por período", clicar "7 dias".
2. Avançar. Passo 2 deve mostrar filtro selecionado.
3. Passo 3: digitar "confirmar" (minúscula) → botão desabilitado.
4. Digitar "CONFIRMAR" → botão habilitado.
5. Clicar "Limpar histórico".
6. **Esperado:** toast de sucesso com contagem, passo 4 exibe batch_id + expires_at.
7. **Verificar no banco:** `SELECT * FROM zapi_cleanup_batches ORDER BY created_at DESC LIMIT 1;` → status='pending', mode='period'.
8. **Verificar na UI:** mensagens dos últimos 7 dias desapareceram da lista.
9. **Verificar:** chats sem nenhuma mensagem no período continuam visíveis.

---

## TC04 — Modo "Tudo" → envia mode='all' para a EF

1. Abrir dialog, selecionar "Tudo (conta inteira)".
2. Passo 2 exibe aviso de operação destrutiva (sem filtros adicionais).
3. Confirmar com "CONFIRMAR".
4. **Esperado:** todos os chats e mensagens da conta desaparecem da lista.
5. **Verificar:** `SELECT count(*) FROM zapi_chats WHERE account_id='<uuid>' AND deleted_at IS NULL;` → 0.
6. **Verificar:** batch tem mode='all' (não 'period').

---

## TC05 — Modo "Conversas específicas"

1. Abrir dialog, selecionar "Conversas específicas".
2. Selecionar 2 chats específicos via checkbox.
3. Confirmar.
4. **Esperado:** só os 2 chats selecionados somem da lista. Demais permanecem.
5. **Verificar:** mensagens, notas e etiquetas desses 2 chats também soft-deletadas.

---

## TC06 — Modo "Granular" apenas mensagens

1. Abrir dialog, selecionar "Avançado (granular)".
2. Marcar apenas "Mensagens".
3. Confirmar.
4. **Esperado:** mensagens soft-deletadas; notas, etiquetas e favoritos intactos.
5. **Verificar no banco:**
   ```sql
   SELECT count(*) FROM zapi_messages WHERE account_id='<uuid>' AND deleted_at IS NOT NULL;
   -- deve ser > 0
   SELECT count(*) FROM zapi_chat_notes WHERE deleted_at IS NOT NULL;
   -- deve ser 0 (não tinham account_id — bug em aberto: TC_BUG_01)
   ```

---

## TC_BUG_01 — BUG ALTO: modo 'all' e 'granular' NÃO apagam notas/etiquetas/favoritos

**Contexto:** `zapi_chat_notes`, `zapi_chat_tags`, `zapi_chat_message_flags` NÃO têm coluna `account_id`.
O `cleanup-predicate.ts` executa `.eq('account_id', accountId)` nessas tabelas nos modos 'all' e 'granular' (sem escopo de chat_ids).
O PostgREST/Supabase retorna erro 42703 (column does not exist) ou count=0 — as notas/etiquetas/favoritos NÃO são soft-deletadas.

**Repro:**
1. Criar notas internas em um chat.
2. Executar limpeza modo 'all'.
3. **Verificar:** `SELECT count(*) FROM zapi_chat_notes WHERE deleted_at IS NOT NULL;` → 0 (esperado > 0).

**Impacto:** modos 'all' e 'granular' (notes/tags/flags sem chat_ids) quebram silenciosamente — a EF provavelmente lança exceção em `all/notes` e retorna 500. Modos 'chats' e cascata de 'period' usam `softDeleteChatChildren` (via `chat_id`) e funcionam corretamente.

**Severidade:** Alta (limpeza parcial enganosa em modos 'all' e 'granular').

---

## TC07 — Painel de lixeira: aba visível apenas para admin

1. Logar como admin → verificar aba "Lixeira" na nav do WhatsApp.
2. Logar como proprietário → verificar aba ausente.
3. **Esperado:** aba só aparece para `canBulkDelete('whatsapp')=true` (admin).

---

## TC08 — Painel de lixeira: lista de batches e restauração

1. Executar TC03 (gera 1 batch pendente).
2. Ir em aba Lixeira.
3. **Verificar:** batch aparece com status "Pendente", countdown e botão "Restaurar".
4. Clicar "Restaurar" → AlertDialog de confirmação aparece com contagem de itens.
5. Confirmar restauração.
6. **Esperado:** toast "Histórico restaurado com sucesso", badge muda para "Restaurado".
7. **Verificar:** chats voltam a aparecer na aba Conversas.
8. **Verificar no banco:** `SELECT status FROM zapi_cleanup_batches WHERE id='<uuid>';` → 'restored'.

---

## TC09 — Lixeira: empty state

1. Garantir que não há batches pendentes.
2. Abrir aba Lixeira.
3. **Esperado:** mensagem "Nenhum histórico na lixeira."

---

## TC10 — Countdown urgente (< 24h)

**Simular via SQL:**
```sql
UPDATE zapi_cleanup_batches SET expires_at = now() + INTERVAL '2 hours' WHERE id = '<uuid>';
```
1. Abrir aba Lixeira.
2. **Esperado:** countdown "Expira em 2h 0min" em amarelo/laranja com ícone de alerta.

---

## TC11 — Batch expirado: sem botão de restaurar

**Simular via SQL:**
```sql
UPDATE zapi_cleanup_batches SET status = 'expired', expires_at = now() - INTERVAL '1 hour' WHERE id = '<uuid>';
```
1. Abrir aba Lixeira.
2. **Esperado:** badge "Expirado", sem botão "Restaurar".

---

## TC12 — Intervalo de datas invertido (validação)

1. Abrir dialog, selecionar "Por período".
2. Digitar data início = 2026-06-01, data fim = 2026-05-01.
3. **Esperado:** campos com borda vermelha, mensagem de erro, botão "Próximo" desabilitado.

---

## TC13 — Sem conversas selecionadas no modo "chats"

1. Abrir dialog, selecionar "Conversas específicas".
2. Não marcar nenhum chat.
3. **Esperado:** botão "Próximo" desabilitado.

---

## TC14 — Sem itens selecionados no modo granular

1. Abrir dialog, selecionar "Avançado (granular)".
2. Não marcar nenhum item.
3. **Esperado:** botão "Próximo" desabilitado.

---

## TC15 — Gating: botão ausente em modo __all__ (todas as contas)

1. Na aba Conversas, selecionar a visão "Todas as contas" (modo __all__).
2. **Esperado:** botão "Limpar histórico" ausente (só aparece com conta específica selecionada).

---

## TC16 — Botão "Ver lixeira" no passo 4 (admin-only)

1. Admin executa limpeza até o passo 4.
2. **Esperado:** botão "Ver lixeira" visível; ao clicar, navega para aba Lixeira e fecha o dialog.
3. Repetir com usuário sem `canBulkDelete('whatsapp')`.
4. **Esperado:** botão "Ver lixeira" ausente.

---

## TC17 — Rate limit: 3 limpezas em 5 minutos

1. Executar 3 limpezas mode='period' consecutivas (cada uma com intervalo diferente).
2. Executar 4ª limpeza.
3. **Esperado:** toast de erro "Muitas operações de limpeza em curto período."

**Nota:** requer que migration 112 esteja aplicada e a EF retorne 429.

---

## TC18 — Batch único pending por conta

1. Com 1 batch em status 'pending', tentar executar nova limpeza na mesma conta.
2. **Esperado:** toast de erro "Já existe uma limpeza pendente para esta conta."

---

## Smoke SQL pós-aplicação da migration 112

```sql
-- 1. Colunas de soft-delete criadas
SELECT column_name, table_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name IN ('deleted_at', 'deleted_by', 'deleted_batch_id')
  AND table_name IN ('zapi_messages','zapi_chats','zapi_chat_notes','zapi_chat_tags','zapi_chat_message_flags','zapi_webhook_log')
ORDER BY table_name, column_name;
-- Esperado: 17 linhas (6 tabelas × deleted_at; 5 tabelas × deleted_by; 6 × deleted_batch_id)

-- 2. Tabela zapi_cleanup_batches criada
SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='zapi_cleanup_batches';
-- Esperado: 1

-- 3. Crons configurados
SELECT jobname, schedule FROM cron.job WHERE jobname LIKE 'zapi%';
-- Esperado: zapi-purge-messages, zapi-purge-webhook-logs, zapi-purge-trash, zapi-expire-cleanup-batches

-- 4. Helper can_access_zapi_account criado
SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname='can_access_zapi_account';
-- Esperado: 1 linha

-- 5. RBAC admin pode deletar
SELECT role, pode_deletar, pode_deletar_em_massa FROM permissoes_perfil WHERE secao='whatsapp';
-- Esperado: admin=TRUE/TRUE; outros=FALSE/FALSE
```
