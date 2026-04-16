# Vínculo Board/Etapa na Integração via API — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que `POST /contacts` e `PATCH|PUT /contacts/by-phone/{tel}` vinculem automaticamente o contato a um board/etapa via parâmetros opcionais `board_id` e `stage_id`.

**Architecture:** Toda a lógica nova fica na Edge Function `supabase/functions/api-proxy/index.ts`. Uma função interna `linkContactToBoard` centraliza a lógica de vínculo (criar ou mover `board_item`). A UI `src/pages/Api.tsx` recebe documentação dos novos campos/endpoint.

**Tech Stack:** Deno (Edge Function), Supabase JS v2, React + TypeScript (UI doc)

---

## Mapa de Arquivos

| Arquivo | Ação | Responsabilidade |
|---------|------|-----------------|
| `supabase/functions/api-proxy/index.ts` | Modificar | Toda a lógica nova da API |
| `src/pages/Api.tsx` | Modificar | Documentação e playground dos novos campos/endpoint |

---

## Task 1: Função interna `linkContactToBoard`

**Files:**
- Modify: `supabase/functions/api-proxy/index.ts`

- [ ] **Step 1: Adicionar a função `linkContactToBoard` logo antes do bloco `// ---- Handlers ----` (linha 90)**

Inserir este bloco no arquivo, antes da linha `// ---- Handlers ----`:

```typescript
// Resultado do vínculo com board
interface BoardLinkResult {
  status: 'ok' | 'warning'
  action?: 'linked' | 'moved'
  board_item_id?: string
  message?: string
}

// Vincula ou move um contato para um board/etapa
async function linkContactToBoard(
  supabase: SupabaseClient,
  contactId: string,
  boardId: string,
  stageId: string | null,
  userId: string,
): Promise<BoardLinkResult> {
  // Validar que o board pertence ao user
  const { data: board, error: boardErr } = await supabase
    .from('boards')
    .select('id')
    .eq('id', boardId)
    .eq('created_by', userId)
    .maybeSingle()

  if (boardErr || !board) {
    return { status: 'warning', message: 'board_id not found or not accessible' }
  }

  // Resolver stage_id: se ausente, buscar estágio com menor ordem
  let resolvedStageId = stageId
  if (!resolvedStageId) {
    const { data: firstStage, error: stageErr } = await supabase
      .from('board_stages')
      .select('id')
      .eq('board_id', boardId)
      .order('ordem', { ascending: true })
      .limit(1)
      .maybeSingle()

    if (stageErr || !firstStage) {
      return { status: 'warning', message: 'Nenhuma etapa encontrada no board informado' }
    }
    resolvedStageId = firstStage.id
  }

  // Verificar se já existe board_item para (contact_id, board_id)
  const { data: existing } = await supabase
    .from('board_items')
    .select('id')
    .eq('contact_id', contactId)
    .eq('board_id', boardId)
    .maybeSingle()

  if (existing) {
    // Já está no board — mover de etapa
    const { error: moveErr } = await supabase
      .from('board_items')
      .update({ stage_id: resolvedStageId, moved_at: new Date().toISOString() })
      .eq('id', existing.id)

    if (moveErr) return { status: 'warning', message: moveErr.message }
    return { status: 'ok', action: 'moved', board_item_id: existing.id }
  }

  // Calcular próxima ordem dentro do estágio
  const { count } = await supabase
    .from('board_items')
    .select('id', { count: 'exact', head: true })
    .eq('stage_id', resolvedStageId)

  const nextOrdem = (count ?? 0) + 1

  // Criar novo board_item
  const { data: newItem, error: insertErr } = await supabase
    .from('board_items')
    .insert({
      board_id: boardId,
      contact_id: contactId,
      stage_id: resolvedStageId,
      ordem: nextOrdem,
    })
    .select('id')
    .single()

  if (insertErr || !newItem) {
    return { status: 'warning', message: insertErr?.message ?? 'Erro ao criar board_item' }
  }

  return { status: 'ok', action: 'linked', board_item_id: newItem.id }
}
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/api-proxy/index.ts
git commit -m "feat(api): adiciona funcao interna linkContactToBoard (RAQ-MAND-EM023)"
```

---

## Task 2: `POST /contacts` com vínculo opcional de board

**Files:**
- Modify: `supabase/functions/api-proxy/index.ts` — função `handlePost`

- [ ] **Step 1: Substituir a função `handlePost` completa**

Localizar a função `handlePost` (linha 178) e substituí-la por:

```typescript
async function handlePost(
  supabase: SupabaseClient,
  resource: string,
  body: Record<string, unknown>,
  userId: string,
) {
  // Extrair parâmetros de board antes de filtrar (não são colunas do contato)
  const boardId = typeof body.board_id === 'string' ? body.board_id : null
  const stageId = typeof body.stage_id === 'string' ? body.stage_id : null
  delete body.board_id
  delete body.stage_id

  const filtered = filterBody(body, resource)
  const requiredError = validateRequired(filtered, resource)
  if (requiredError) return json(400, { error: requiredError })

  filtered.created_by = userId

  const { data, error } = await supabase
    .from(resource)
    .insert(filtered)
    .select()
    .single()

  if (error) {
    if (error.message.includes('duplicate') || error.message.includes('unique')) {
      return json(409, { error: 'Registro duplicado: ' + error.message })
    }
    return json(500, { error: error.message })
  }

  // Vincular ao board se informado (apenas para contacts)
  if (resource === 'contacts' && boardId) {
    const boardLink = await linkContactToBoard(supabase, data.id, boardId, stageId, userId)
    return json(201, { ...data, board_link: boardLink })
  }

  return json(201, data)
}
```

- [ ] **Step 2: Verificar manualmente**

Testar com curl (substituir `TOKEN` e `BOARD_ID` pelos valores reais):

```bash
curl -X POST 'https://nevgnvrwqaoztefnyqdj.supabase.co/functions/v1/api-proxy/contacts' \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Teste Board","phone":"(11) 91111-1111","board_id":"BOARD_ID"}'
```

Esperado: `201` com `board_link.status: "ok"` e `board_link.action: "linked"`

- [ ] **Step 3: Testar sem board_id**

```bash
curl -X POST 'https://nevgnvrwqaoztefnyqdj.supabase.co/functions/v1/api-proxy/contacts' \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Sem Board","phone":"(11) 92222-2222"}'
```

Esperado: `201` com o contato sem campo `board_link` (comportamento atual preservado)

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/api-proxy/index.ts
git commit -m "feat(api): POST /contacts aceita board_id e stage_id opcionais (RAQ-MAND-EM023)"
```

---

## Task 3: Nova rota `PATCH|PUT /contacts/by-phone/{tel}`

**Files:**
- Modify: `supabase/functions/api-proxy/index.ts` — bloco `Deno.serve` e nova função `handlePatchByPhone`

- [ ] **Step 1: Adicionar função `normalizePhone` e `handlePatchByPhone` antes do bloco `Deno.serve`**

```typescript
// Normaliza telefone: remove (, ), -, espaços e prefixo +55
function normalizePhone(phone: string): string {
  return phone.replace(/[\s\(\)\-\+]/g, '').replace(/^55/, '')
}

async function handlePatchByPhone(
  supabase: SupabaseClient,
  rawPhone: string,
  body: Record<string, unknown>,
  userId: string,
): Promise<Response> {
  const normalized = normalizePhone(rawPhone)
  if (!normalized) return json(400, { error: 'Telefone invalido na URL' })

  // Extrair parâmetros de board antes de filtrar
  const boardId = typeof body.board_id === 'string' ? body.board_id : null
  const stageId = typeof body.stage_id === 'string' ? body.stage_id : null
  delete body.board_id
  delete body.stage_id

  // Buscar contato pelo telefone normalizado
  const { data: contacts, error: searchErr } = await supabase
    .from('contacts')
    .select('id, phone')
    .eq('created_by', userId)
    .ilike('phone', `%${normalized}%`)
    .limit(1)

  if (searchErr) return json(500, { error: searchErr.message })
  if (!contacts || contacts.length === 0) {
    return json(404, { error: `Contato nao encontrado para o telefone: ${rawPhone}` })
  }

  const contact = contacts[0]

  // Atualizar campos do contato (se houver)
  const filtered = filterBody(body, 'contacts')
  let updatedContact = contact

  if (Object.keys(filtered).length > 0) {
    const { data: updated, error: updateErr } = await supabase
      .from('contacts')
      .update(filtered)
      .eq('id', contact.id)
      .eq('created_by', userId)
      .select()
      .single()

    if (updateErr) return json(500, { error: updateErr.message })
    updatedContact = updated
  } else {
    // Buscar dados completos do contato para retornar
    const { data: full } = await supabase
      .from('contacts')
      .select('*')
      .eq('id', contact.id)
      .single()
    if (full) updatedContact = full
  }

  // Vincular ao board se informado
  if (boardId) {
    const boardLink = await linkContactToBoard(supabase, contact.id, boardId, stageId, userId)
    return json(200, { ...updatedContact, board_link: boardLink })
  }

  return json(200, updatedContact)
}
```

- [ ] **Step 2: Registrar a rota no bloco `Deno.serve`**

Localizar o bloco de roteamento no `Deno.serve` (linhas 293–327). Adicionar detecção da rota `by-phone` **antes** da validação do `resource`:

```typescript
    // Parsear rota: /api-proxy/{resource}/{id?}
    const url = new URL(req.url)
    const pathParts = url.pathname.split('/').filter(Boolean)
    const funcIndex = pathParts.indexOf('api-proxy')
    const resource = pathParts[funcIndex + 1]
    const resourceId = pathParts[funcIndex + 2]

    // Rota especial: PATCH|PUT /contacts/by-phone/{tel}
    if (
      resource === 'contacts' &&
      resourceId === 'by-phone' &&
      (req.method === 'PATCH' || req.method === 'PUT')
    ) {
      const rawPhone = pathParts[funcIndex + 3]
      if (!rawPhone) return json(400, { error: 'Telefone obrigatorio na URL. Ex: /contacts/by-phone/11999999999' })
      const body = await req.json().catch(() => ({}))
      return await handlePatchByPhone(supabase, decodeURIComponent(rawPhone), body as Record<string, unknown>, tokenData.user_id)
    }

    if (!resource || !['contacts', 'demands', 'tags'].includes(resource)) {
```

- [ ] **Step 3: Verificar manualmente**

```bash
# Atualizar campos + mover no board (substituir TEL, TOKEN, BOARD_ID, STAGE_ID)
curl -X PATCH 'https://nevgnvrwqaoztefnyqdj.supabase.co/functions/v1/api-proxy/contacts/by-phone/11911111111' \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"notes":"ja convertido","board_id":"BOARD_ID","stage_id":"STAGE_ID"}'
```

Esperado: `200` com contato atualizado + `board_link.status: "ok"` + `board_link.action: "moved"` (se já estava no board) ou `"linked"` (se era novo)

```bash
# Telefone inexistente
curl -X PATCH 'https://nevgnvrwqaoztefnyqdj.supabase.co/functions/v1/api-proxy/contacts/by-phone/00000000000' \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Esperado: `404` com mensagem clara

```bash
# PUT como alias
curl -X PUT 'https://nevgnvrwqaoztefnyqdj.supabase.co/functions/v1/api-proxy/contacts/by-phone/11911111111' \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"notes":"via PUT"}'
```

Esperado: `200` com contato atualizado

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/api-proxy/index.ts
git commit -m "feat(api): PATCH|PUT /contacts/by-phone/:tel com vinculo de board (RAQ-MAND-EM023)"
```

---

## Task 4: Atualizar documentação UI em `src/pages/Api.tsx`

**Files:**
- Modify: `src/pages/Api.tsx`

- [ ] **Step 1: Atualizar `exampleBodies.contacts.POST` com os novos campos (linha 56)**

Substituir o exemplo de POST:

```typescript
    POST: JSON.stringify({
      name: 'Joao Silva',
      phone: '(11) 99999-9999',
      email: 'joao@email.com',
      city: 'Sao Paulo',
      state: 'SP',
      neighborhood: 'Centro',
      board_id: '(opcional) uuid-do-board',
      stage_id: '(opcional) uuid-da-etapa',
    }, null, 2),
```

- [ ] **Step 2: Adicionar exemplos de body para o novo endpoint em `exampleBodies`**

Após o bloco `contacts`, antes de `demands`:

```typescript
const byPhoneBodies = {
  PATCH: JSON.stringify({
    notes: 'ja convertido',
    source: 'instagram',
    board_id: 'uuid-do-board',
    stage_id: 'uuid-da-etapa',
  }, null, 2),
}
```

- [ ] **Step 3: Adicionar grupo de endpoints "Contatos por Telefone" em `endpointGroups` (após o grupo de Contatos, linha 133)**

```typescript
  {
    title: 'Contatos por Telefone',
    endpoints: [
      {
        method: 'PATCH',
        path: '/contacts/by-phone/{telefone}',
        description: 'Atualizar contato pelo telefone e/ou mover para board/etapa. Telefone normalizado automaticamente.',
        body: byPhoneBodies.PATCH,
      },
      {
        method: 'PUT',
        path: '/contacts/by-phone/{telefone}',
        description: 'Alias de PATCH para sistemas que só enviam PUT.',
        body: byPhoneBodies.PATCH,
      },
    ],
  },
```

- [ ] **Step 4: Adicionar campos `board_id` e `stage_id` no array `contactFields` (após a linha 196)**

```typescript
  { campo: 'board_id', tipo: 'uuid', obrigatorio: false, descricao: 'ID do board para vincular automaticamente o contato (apenas POST)' },
  { campo: 'stage_id', tipo: 'uuid', obrigatorio: false, descricao: 'ID da etapa do board. Se ausente, usa a primeira etapa do board' },
```

- [ ] **Step 5: Verificar visualmente**

Iniciar o servidor de desenvolvimento e abrir a aba de Configurações → API:

```bash
npm run dev
```

Confirmar que:
- O exemplo de POST /contacts mostra `board_id` e `stage_id`
- Existe o grupo "Contatos por Telefone" com PATCH e PUT documentados
- A tabela de campos lista `board_id` e `stage_id`

- [ ] **Step 6: Commit**

```bash
git add src/pages/Api.tsx
git commit -m "docs(api): documenta campos board_id, stage_id e endpoint by-phone (RAQ-MAND-EM023)"
```

---

## Task 5: Deploy da Edge Function

- [ ] **Step 1: Fazer deploy da Edge Function atualizada**

```bash
npx supabase functions deploy api-proxy --project-ref nevgnvrwqaoztefnyqdj
```

Esperado: `Deployed Function api-proxy`

- [ ] **Step 2: Teste de fumaça pós-deploy**

```bash
# Criar contato com board (substituir TOKEN e BOARD_ID por valores reais)
curl -s -X POST 'https://nevgnvrwqaoztefnyqdj.supabase.co/functions/v1/api-proxy/contacts' \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Teste Final","phone":"(11) 93333-3333","board_id":"BOARD_ID"}' | jq .
```

- [ ] **Step 3: Commit final e push**

```bash
git push origin rodrigo/feature/RAQ-MAND-EM023-inclusao-de-vinculo-com-board-e-etapa-na-integracao-via-api-configuracoes
```
