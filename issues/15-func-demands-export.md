# Issue 15: Funcional — DemandsExportMenu (logica)

**Tipo**: Funcional
**Pagina**: Demandas
**Prioridade**: 15
**Depende de**: Issue 05 (prototipo)

## Descricao
Conectar o DemandsExportMenu com logica real de exportacao de demandas.

## Cenarios

### Happy Path
- Exportar CSV → arquivo `demandas_2026-04-07.csv` com 11 colunas
- Exportar XLSX → arquivo `demandas_2026-04-07.xlsx` com larguras

### Edge Cases
- Demanda sem contato vinculado → colunas contato_nome e contato_id vazias
- Demanda sem etiquetas → coluna etiquetas vazia
- Zero demandas → toast "Nenhuma demanda para exportar"

### Erros
- Erro no fetch → toast.error

## Tabelas no Banco
- `demands`: id, title, description, status, priority, contact_id, neighborhood, created_at, updated_at
- `contacts`: nome (join para contato_nome)
- `demand_tags` + `tags`: para coluna etiquetas

## Arquivos a Modificar
- `src/components/demands/DemandsExportMenu.tsx` — Logica real

## O Que Fazer em Cada Arquivo

### `src/components/demands/DemandsExportMenu.tsx`

**Fetch:**
```typescript
supabase.from('demands')
  .select('*, contact:contacts(nome), demand_tags(tag_id, tags(nome))')
  .order('created_at', { ascending: false })
```

**Mapeamentos:**
```typescript
const STATUS_LABELS: Record<string, string> = {
  open: 'Aberta',
  in_progress: 'Em Andamento',
  resolved: 'Resolvida',
};
const PRIORITY_LABELS: Record<string, string> = {
  low: 'Baixa',
  medium: 'Media',
  high: 'Alta',
};
```

**Transform para rows:**
```typescript
function demandsToRows(demands) {
  return demands.map(d => ({
    id: d.id,
    titulo: d.title ?? '',
    descricao: d.description ?? '',
    status: STATUS_LABELS[d.status] ?? d.status,
    prioridade: PRIORITY_LABELS[d.priority] ?? d.priority,
    bairro: d.neighborhood ?? '',
    contato_nome: d.contact?.nome ?? '',
    contato_id: d.contact_id ?? '',
    criado_em: d.created_at ? new Date(d.created_at).toLocaleDateString('pt-BR') : '',
    atualizado_em: d.updated_at ? new Date(d.updated_at).toLocaleDateString('pt-BR') : '',
    etiquetas: Array.isArray(d.demand_tags)
      ? d.demand_tags.map(dt => dt.tags?.nome).filter(Boolean).join(', ')
      : '',
  }));
}
```

**Larguras XLSX:**
```typescript
ws['!cols'] = [
  { wch: 36 }, { wch: 30 }, { wch: 40 }, { wch: 15 }, { wch: 12 },
  { wch: 20 }, { wch: 25 }, { wch: 36 }, { wch: 12 }, { wch: 12 }, { wch: 25 },
];
```

## Dependencias Externas
Nenhuma

## Checklist
- [ ] CSV com 11 colunas e delimitador ;
- [ ] XLSX com larguras
- [ ] Status e prioridade mapeados para portugues
- [ ] Etiquetas como lista separada por virgula
- [ ] Contato vinculado incluido
- [ ] Datas em pt-BR
