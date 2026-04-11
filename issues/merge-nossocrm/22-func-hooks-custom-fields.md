# 22 — Hooks: Campos Personalizados

**Tipo:** Funcional (React hooks)
**Fase:** 1
**Depende de:** 12-func-schema-custom-fields
**Desbloqueia:** 33-func-tab-campos-personalizados, 41-func-contato-aba-personalizados, 43-func-contato-filtro-custom-fields

## Objetivo
Hooks para gerenciar definições de campos personalizados e seus valores por contato.

## Arquivos a criar
- `src/hooks/useCustomFields.ts`
- `src/hooks/useContactCustomValues.ts`
- `src/lib/customFields/slugify.ts`

## API esperada
```ts
// useCustomFields.ts
useCustomFields(entidade?: 'contact'): { data }  // lista definições
useCreateCustomField(): mutation({
  rotulo, tipo, opcoes?, filtravel?
})
useUpdateCustomField(): mutation({ id, patch })
useDeleteCustomField(): mutation(id)   // cascade remove valores

// useContactCustomValues.ts
useContactCustomValues(contactId): {
  data: Record<string, any>  // { [campo_id]: valor_apropriado_pelo_tipo }
}
useSaveContactCustomValues(): mutation({
  contactId, values: Record<string, any>
})  // upsert em lote
```

## Slugify
```ts
// src/lib/customFields/slugify.ts
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}
```
Usar no `useCreateCustomField` para gerar `chave` a partir do `rotulo`.

## Lógica de salvamento (upsert)
```ts
// Salva valor no campo correto baseado no tipo
function valorParaColunas(campo, valor) {
  switch(campo.tipo) {
    case 'texto':    return { valor_texto: valor };
    case 'numero':   return { valor_numero: valor };
    case 'data':     return { valor_data: valor };
    case 'booleano': return { valor_bool: valor };
    case 'selecao':  return { valor_selecao: valor };
  }
}
```

## Critérios de Aceite
- [ ] Slugify normaliza acentos + especiais corretamente
- [ ] `useCreateCustomField` valida que `chave` resultante é única
- [ ] `useSaveContactCustomValues` faz upsert em batch
- [ ] Queries invalidam corretamente
- [ ] Delete faz cascade (testar removendo campo com valores)
- [ ] `npm run build` passa

## Verificação
```ts
slugify('Cargo Liderança') // → 'cargo_lideranca'
slugify('Nº Dependentes')  // → 'n_dependentes'
```
