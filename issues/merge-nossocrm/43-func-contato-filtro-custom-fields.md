# 43 — Filtros por Campos Personalizados na Lista de Contatos

**Tipo:** Funcional
**Fase:** 6
**Depende de:** 41-func-contato-aba-personalizados
**Desbloqueia:** —

## Objetivo
Permitir filtrar a lista de contatos (`/contacts`) por qualquer campo personalizado marcado como `filtravel = true`. Filtros aparecem dinamicamente no painel de filtros lateral.

## Arquivos a criar/modificar
- `src/hooks/useContacts.ts` (estender `ContactFilters` + query)
- `src/components/contacts/ContactFilters.tsx` (adicionar seção dinâmica)
- `src/components/contacts/CustomFieldFilterInput.tsx` (novo — input por tipo para filtro)

## Extensão do tipo
```ts
export interface ContactFilters {
  search?: string;
  tags?: string[];
  is_favorite?: boolean;
  // ... existentes
  custom_fields?: Record<string, {
    op: 'eq' | 'contains' | 'gt' | 'lt' | 'between';
    value: any;
  }>;
}
```

## Query Supabase
Para cada filtro custom_field, fazer JOIN/subquery em `campos_personalizados_valores`:

```ts
// Para cada (campo_id, op, value):
let query = supabase.from('contacts').select(`
  *,
  custom_values:campos_personalizados_valores!inner(
    campo_id,
    valor_texto, valor_numero, valor_data, valor_bool, valor_selecao
  )
`);

// Filtrar por campo_id e op
query = query.eq('custom_values.campo_id', campo_id);
switch(op) {
  case 'eq':       query = query.eq('custom_values.valor_...', value); break;
  case 'contains': query = query.ilike('custom_values.valor_texto', `%${value}%`); break;
  case 'gt':       query = query.gt('custom_values.valor_numero', value); break;
  // etc
}
```

Pode ser mais robusto com um RPC function se a query ficar complexa demais.

## UI do filtro
Na sidebar de filtros de `/contacts`, depois dos filtros fixos, adicionar seção:

```
── Campos Personalizados ──
Cargo Liderança: [input texto]
Data últ. visita: [DatePicker] [até DatePicker]
Nº dependentes: [≥] [input numero]
Território: [Select multi]
```

Cada input gera um filtro separado no `ContactFilters.custom_fields`.

## Critérios de Aceite
- [ ] `useCustomFields({ filtravel: true })` alimenta a seção dinâmica do painel
- [ ] Cada tipo de campo renderiza input de filtro apropriado:
  - Texto → contains (ilike)
  - Número → ≥ ≤ = between
  - Data → ≥ ≤ between
  - Booleano → Sim/Não/Qualquer
  - Seleção → multi-select
- [ ] Query do Supabase filtra corretamente usando os valores
- [ ] Combinação de múltiplos filtros custom + filtros fixos funciona
- [ ] Limpar filtros reseta também os custom
- [ ] Contagem de resultados atualiza
- [ ] Paginação respeita filtros
- [ ] Build passa

## Verificação
- Criar campo "Cargo Liderança" (texto, filtrável)
- Preencher "Presidente" em 3 contatos
- Ir em `/contacts` → filtrar Cargo Liderança contains "Presidente" → só aparecem os 3
- Combinar com filtro de tag → resultado correto
