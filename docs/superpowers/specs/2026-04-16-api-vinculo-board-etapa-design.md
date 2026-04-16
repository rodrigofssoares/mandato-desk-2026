# Spec: Vínculo com Board e Etapa na Integração via API

**Data:** 2026-04-16  
**Issue:** RAQ-MAND-EM023  
**Branch:** rodrigo/feature/RAQ-MAND-EM023-inclusao-de-vinculo-com-board-e-etapa-na-integracao-via-api-configuracoes

---

## Contexto

A integração via API (aba Configurações) permite criar e atualizar contatos via REST, mas não contempla o vínculo automático com boards/etapas do Kanban. Isso obriga movimentação manual posterior, inviabilizando fluxos de captação externa (Instagram, formulários) onde o lead já entra em uma etapa específica do funil.

---

## Decisões de Design

| Decisão | Escolha |
|---------|---------|
| Identificação de board/etapa | Por UUID |
| Falha no vínculo com board | Cria contato + retorna aviso no response |
| `stage_id` ausente com `board_id` presente | Usa a etapa de menor `ordem` do board |
| Lookup por telefone | Normalizado (ignora parênteses, espaços, traços) |
| Atualização por telefone | Move no board E atualiza campos do contato |

---

## Contratos de API

### 1. `POST /contacts` — Criar contato com vínculo opcional

Campos novos opcionais no payload (extraídos antes do insert no contato):

```json
{
  "name": "Rodrigo Soares",
  "phone": "(11) 99999-9999",
  "source": "instagram",
  "board_id": "uuid-do-board",
  "stage_id": "uuid-da-etapa"
}
```

**Resposta de sucesso com vínculo (201):**
```json
{
  "id": "uuid",
  "name": "Rodrigo Soares",
  "phone": "(11) 99999-9999",
  "board_link": {
    "status": "ok",
    "action": "linked",
    "board_item_id": "uuid"
  }
}
```

**Resposta com aviso — board não encontrado (201):**
```json
{
  "id": "uuid",
  "name": "Rodrigo Soares",
  "board_link": {
    "status": "warning",
    "message": "board_id not found or not accessible"
  }
}
```

**Resposta sem board (201, comportamento atual):**
```json
{
  "id": "uuid",
  "name": "Rodrigo Soares"
}
```

---

### 2. `PATCH /contacts/by-phone/{telefone}` — Atualizar por telefone

Alias: `PUT /contacts/by-phone/{telefone}` (comportamento idêntico)

Telefone normalizado: `(11) 9 9999-9999`, `11999999999`, `11 99999 9999` → todos equivalentes.

**Payload:**
```json
{
  "notes": "já convertido",
  "source": "instagram",
  "board_id": "uuid-do-board",
  "stage_id": "uuid-da-etapa"
}
```

**Comportamento do board_link:**
- Contato **não está** no board → cria `board_item` na etapa indicada
- Contato **já está** no board → atualiza `stage_id` no `board_item` existente (`action: "moved"`)
- `stage_id` ausente com `board_id` presente → usa etapa com menor `ordem`

**Respostas:**

| Situação | Status | body |
|----------|--------|------|
| Sucesso | 200 | contato + `board_link.status: "ok"` |
| Telefone não encontrado | 404 | `{ "error": "Contact not found for phone: ..." }` |
| Board inválido | 200 | contato atualizado + `board_link.status: "warning"` |

---

## Arquivos a Modificar

### Edge Function
**`supabase/functions/api-proxy/index.ts`**

1. **Função interna compartilhada** `linkContactToBoard(contactId, boardId, stageId | null, client)`:
   - Valida que `board_id` pertence ao `user_id` do token
   - Resolve `stage_id`: se ausente, busca estágio com menor `ordem` do board
   - Verifica se já existe `board_item` para o par `(contact_id, board_id)`
   - Se não existe → `INSERT board_items`
   - Se existe → `UPDATE board_items SET stage_id = ..., moved_at = NOW()`
   - Retorna `{ status, action, board_item_id }` ou `{ status: "warning", message }`

2. **`POST /contacts`** — extrai `board_id`/`stage_id` do payload antes do insert; chama `linkContactToBoard` se `board_id` presente

3. **Nova rota `PATCH|PUT /contacts/by-phone/{tel}`** — detectada antes do padrão `/{id}`:
   - Normaliza telefone: remove `(`, `)`, `-`, ` `, `+55`
   - Busca contato por `phone ILIKE '%{tel_normalizado}%'` (ou regex de normalização)
   - Extrai `board_id`/`stage_id` do payload
   - Atualiza campos do contato
   - Chama `linkContactToBoard` se `board_id` presente

### UI de Documentação
**`src/pages/Api.tsx`**

1. Adicionar `board_id` e `stage_id` ao exemplo de payload do `POST /contacts` no playground
2. Adicionar seção `PATCH /contacts/by-phone/{telefone}` com exemplo e notas sobre normalização
3. Indicar que `PUT` é alias de `PATCH` para o novo endpoint

---

## Estrutura do Banco (sem alterações)

As tabelas já suportam o vínculo:

```
boards          → id, nome, tipo_entidade, user_id (via RLS)
board_stages    → id, board_id, nome, ordem
board_items     → id, board_id, contact_id, stage_id, ordem, moved_at
contacts        → id, phone, name, ...
```

Nenhuma migration necessária.

---

## Validação / Teste

1. `POST /contacts` com `board_id` e `stage_id` válidos → contato criado + `board_link.status: "ok"`
2. `POST /contacts` com `board_id` válido sem `stage_id` → usa primeira etapa do board
3. `POST /contacts` com `board_id` inexistente → contato criado + `board_link.status: "warning"`
4. `POST /contacts` sem `board_id` → comportamento atual inalterado
5. `PATCH /contacts/by-phone/11999999999` com campos + `board_id`/`stage_id` → contato atualizado + movido
6. `PATCH /contacts/by-phone/11999999999` com lead já no board → `action: "moved"` (não duplica)
7. `PUT /contacts/by-phone/...` → mesmo resultado que PATCH
8. Telefone com formatação diferente `(11) 9 9999-9999` → mesmo contato encontrado
9. Telefone não cadastrado → 404 claro
10. `stage_id` de board diferente do `board_id` → warning ou erro de FK
