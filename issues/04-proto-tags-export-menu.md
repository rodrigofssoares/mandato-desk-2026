# Issue 04: Prototipo Visual — TagsExportMenu

**Tipo**: Prototipo
**Pagina**: Etiquetas
**Prioridade**: 4

## Descricao
Criar componente de exportacao de etiquetas seguindo o mesmo padrao visual do ExportMenu de contatos. Dropdown com opcoes CSV e XLSX.

## Cenarios

### Happy Path
- Usuario abre pagina de Etiquetas → ve botao "Exportar" no header
- Clica → dropdown com CSV e XLSX

### Edge Cases
- Nenhuma etiqueta cadastrada → toast "Nenhuma etiqueta para exportar"

## Arquivos a Criar
- `src/components/tags/TagsExportMenu.tsx` — Componente dropdown

## Arquivos a Modificar
- `src/pages/Tags.tsx` — Adicionar TagsExportMenu no header

## O Que Fazer em Cada Arquivo

### `src/components/tags/TagsExportMenu.tsx`
- Copiar estrutura visual do ExportMenu.tsx (DropdownMenu com Button trigger)
- 2 opcoes: Exportar CSV, Exportar XLSX
- Estado isExporting com spinner
- Handlers placeholder (toast.success mockado)

### `src/pages/Tags.tsx`
- Importar TagsExportMenu
- Adicionar no header da pagina, ao lado dos botoes existentes
- Condicionar a `can.exportData()` se disponivel

## Dependencias Externas
Nenhuma

## Checklist
- [ ] Componente renderiza dropdown com 2 opcoes
- [ ] Spinner durante "exportacao"
- [ ] Integrado na pagina Tags
- [ ] Permissao respeitada
