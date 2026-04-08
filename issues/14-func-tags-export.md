# Issue 14: Funcional — TagsExportMenu (logica)

**Tipo**: Funcional
**Pagina**: Etiquetas
**Prioridade**: 14
**Depende de**: Issue 04 (prototipo)

## Descricao
Conectar o TagsExportMenu com logica real de exportacao de etiquetas em CSV e XLSX.

## Cenarios

### Happy Path
- Exportar CSV → arquivo `etiquetas_2026-04-07.csv` com 5 colunas
- Exportar XLSX → arquivo `etiquetas_2026-04-07.xlsx` com larguras

### Edge Cases
- Zero etiquetas → toast "Nenhuma etiqueta para exportar"
- Categoria sem mapeamento → usar valor original

### Erros
- Erro no fetch → toast.error

## Tabelas no Banco
- `tags`: id, nome, categoria, cor, created_at

## Arquivos a Modificar
- `src/components/tags/TagsExportMenu.tsx` — Substituir handlers placeholder por logica real

## O Que Fazer em Cada Arquivo

### `src/components/tags/TagsExportMenu.tsx`

**Fetch:**
- `supabase.from('tags').select('*').order('nome', { ascending: true })`

**Mapeamento de categorias:**
```typescript
const CATEGORY_LABELS: Record<string, string> = {
  professionals: 'Perfil',
  relationships: 'Interesse',
  demands: 'Campanhas',
  geral: 'Geral',
};
```

**Transform para rows:**
```typescript
function tagsToRows(tags) {
  return tags.map(t => ({
    id: t.id,
    nome: t.nome,
    categoria: CATEGORY_LABELS[t.categoria] ?? t.categoria,
    cor: t.cor,
    criado_em: t.created_at ? new Date(t.created_at).toLocaleDateString('pt-BR') : '',
  }));
}
```

**Larguras XLSX:**
```typescript
ws['!cols'] = [
  { wch: 36 }, // id
  { wch: 25 }, // nome
  { wch: 15 }, // categoria
  { wch: 10 }, // cor
  { wch: 12 }, // criado_em
];
```

**CSV:** delimitador `;`, BOM UTF-8, mesma funcao downloadFile do ExportMenu

**XLSX:** dynamic import, json_to_sheet, larguras, writeFile

## Dependencias Externas
Nenhuma

## Checklist
- [ ] CSV exporta com 5 colunas e delimitador ;
- [ ] XLSX exporta com larguras
- [ ] Categorias mapeadas para portugues
- [ ] Data formatada em pt-BR
- [ ] Toast de sucesso/erro
