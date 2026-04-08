# Issue 05: Prototipo Visual — DemandsExportMenu

**Tipo**: Prototipo
**Pagina**: Demandas
**Prioridade**: 5

## Descricao
Criar componente de exportacao de demandas seguindo o mesmo padrao visual do ExportMenu.

## Cenarios

### Happy Path
- Usuario abre pagina de Demandas → ve botao "Exportar" no header
- Clica → dropdown com CSV e XLSX

### Edge Cases
- Nenhuma demanda cadastrada → toast "Nenhuma demanda para exportar"

## Arquivos a Criar
- `src/components/demands/DemandsExportMenu.tsx` — Componente dropdown

## Arquivos a Modificar
- `src/pages/Demands.tsx` — Adicionar DemandsExportMenu no header

## O Que Fazer em Cada Arquivo

### `src/components/demands/DemandsExportMenu.tsx`
- Copiar estrutura visual do ExportMenu.tsx
- 2 opcoes: Exportar CSV, Exportar XLSX
- Estado isExporting com spinner
- Handlers placeholder

### `src/pages/Demands.tsx`
- Importar DemandsExportMenu
- Adicionar no header da pagina
- Condicionar a `can.exportData()`

## Dependencias Externas
Nenhuma

## Checklist
- [ ] Componente renderiza dropdown com 2 opcoes
- [ ] Spinner durante "exportacao"
- [ ] Integrado na pagina Demands
- [ ] Permissao respeitada
