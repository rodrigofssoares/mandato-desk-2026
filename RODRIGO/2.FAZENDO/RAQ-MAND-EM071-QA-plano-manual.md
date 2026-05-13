# QA — RAQ-MAND-EM071 (v2.8.3)

**Bug:** Etiquetas não salvam em alguns contatos (ex: Érika Rímoli Mota da Silva).

**Causa raiz identificada:**
1. **Dup phone check** rodava em todo update (`useUpdateContact`), bloqueando contatos cujo telefone bate com uma duplicata legacy no banco — mesmo quando o usuário só tocava em etiquetas.
2. **Delete silencioso** em `contact_tags` (sem destructurar `{ error }`) podia esconder falhas e deixar estado inconsistente.

**Fix aplicado em `src/hooks/useContacts.ts`:**
- Dup phone check só dispara se `phoneComparisonKey(telefone)` ou `phoneComparisonKey(whatsapp)` mudou (compara antes via `select('telefone, whatsapp').eq('id', id)`).
- Sync de tags em **delta** (compute `toRemove` + `toAdd`, executa só o necessário, cada step com `if (error) throw`).
- `console.error` adicionado nos dois `onError` (create + update) pra DevTools.

**Versão:** package.json 2.8.1 → 2.8.3, src/version.ts 2.8.2 → 2.8.3 (sincronizados).

---

## Validações automatizadas executadas

| Check | Resultado |
|---|---|
| `npm run build` (tsc -b + vite build) | ✅ PASS — 4156 módulos, 0 erros |
| TypeCheck arquivos do diff | ✅ PASS |
| ESLint arquivos do diff | ✅ PASS (warnings pré-existentes não introduzidas) |
| Security audit (OWASP/STRIDE) | ✅ APROVADO COM RESSALVAS (1 MEDIUM não-bloqueante: race em delta — já existia no código antigo) |
| Code Review (8 dimensões) | ✅ APROVADO (0 must-fix) |

---

## Plano de teste manual (executar contra base real)

### CT-1 — Caso original: contato "Érika Rímoli Mota da Silva"
**Pré-condição:** existe outro contato no banco com telefone duplicado em formato diferente (ex: `+55 11 99...` vs `11 99...`).

**Passos:**
1. Abrir o app em produção (após deploy v2.8.3) ou em dev local (`npm run dev`).
2. Buscar o contato "Érika Rímoli Mota da Silva" na listagem de contatos.
3. Abrir a edição do contato.
4. Marcar/desmarcar uma ou mais etiquetas. **Não tocar nos campos telefone/whatsapp.**
5. Salvar.

**Esperado:**
- Toast verde "Contato atualizado com sucesso".
- Reabrir o contato e confirmar que as etiquetas refletem a alteração.
- Reload completo da página → etiquetas persistem.

**Sinal de regressão antiga:** toast vermelho "Outro contato já usa esse telefone..." OU silêncio sem mudança visível.

---

### CT-2 — Contato saudável (regressão)
**Pré-condição:** contato sem nenhum conflito de telefone no banco.

**Passos:**
1. Editar qualquer contato "normal" (sem duplicatas).
2. Adicionar uma etiqueta nova.
3. Salvar.
4. Editar de novo e remover essa etiqueta.
5. Salvar.

**Esperado:**
- Os dois saves bem-sucedidos.
- Etiqueta adicionada na primeira edição e removida na segunda.
- Nenhuma mudança no comportamento percebido vs versão anterior.

---

### CT-3 — Mudança de telefone com conflito real
**Passos:**
1. Editar um contato A.
2. Alterar o telefone do contato A para um telefone que já existe no contato B.
3. Salvar.

**Esperado:**
- Toast vermelho: `Outro contato já usa esse telefone: "B" (...).`
- Contato A **não é alterado** (nem telefone, nem etiquetas).
- Comportamento idêntico ao anterior (regressão zero).

---

### CT-4 — Criação de contato com telefone duplicado (regressão)
**Passos:**
1. Criar novo contato com telefone que já existe em outro contato.

**Esperado:**
- Toast vermelho: `Já existe um contato com esse telefone: "X" (...).`
- Contato **não é criado**.

---

### CT-5 — Toggle massivo de etiquetas
**Passos:**
1. Editar um contato com 0 etiquetas.
2. Marcar 5 etiquetas distintas → salvar.
3. Editar de novo: desmarcar 3, marcar outras 2 → salvar.
4. Reload.

**Esperado:**
- Estado final = 4 etiquetas (2 que ficaram + 2 novas).
- Cada save mostra toast verde.
- Atividade no log de auditoria.

---

### CT-6 — Erro propaga até toast (defensive)
**Como simular:** abrir DevTools → Network → block request a `/rest/v1/contact_tags` → editar etiquetas → salvar.

**Esperado:**
- Toast vermelho com mensagem de erro.
- `console.error('[useContacts] mutation error:', ...)` no console.
- Nenhuma alteração persistida.

---

## Critérios de aceite do briefing

| Critério | Status |
|---|---|
| Investigar causa do bug para certos contatos | ✅ Identificada (dup phone check incondicional) |
| Reproduzir com Érika Rímoli Mota da Silva | ⏳ Requer execução do CT-1 contra base real |
| Identificar se é cadastro/dados/etiqueta/validação/backend | ✅ Validação client-side: dup phone check incondicional |
| Corrigir para esse contato e todos os afetados | ✅ Fix global na mutation (não específico de contato) |
| Garantir update de etiquetas em todos os contatos | ✅ Refatoração delta-sync com erro explícito |
| Sistema exibe retorno adequado em erro | ✅ Toast + console.error em ambos os onError |

---

## Verificação humana sugerida

1. Rodar o app local: `npm run dev` (porta 8080).
2. Logar com conta de teste com acesso à base que contém Érika.
3. Executar CT-1 → CT-6 na ordem.
4. Confirmar v2.8.3 no rodapé/sidebar (`AppSidebar` usa `APP_VERSION` de `src/version.ts`).
5. Após validação OK, mergear PR + tagar v2.8.3.
