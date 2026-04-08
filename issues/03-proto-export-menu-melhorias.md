# Issue 03: Prototipo Visual — Melhorias ExportMenu

**Tipo**: Prototipo
**Pagina**: Contatos
**Prioridade**: 3

## Descricao
Expandir o dropdown de exportacao de contatos para ter 4 opcoes em vez de 2:
- CSV Filtrado
- CSV Completo
- XLSX Filtrado
- XLSX Completo

Separar visualmente com DropdownMenuSeparator e labels de grupo.

## Cenarios

### Happy Path
- Usuario clica Exportar → ve 4 opcoes organizadas em 2 grupos
- Seleciona qualquer opcao → loading spinner

### Edge Cases
- Sem filtros ativos → opcoes "filtrado" e "completo" fazem a mesma coisa (ok visualmente)

## Arquivos a Modificar
- `src/components/contacts/ExportMenu.tsx` — Expandir dropdown

## O Que Fazer em Cada Arquivo

### `src/components/contacts/ExportMenu.tsx`
- Adicionar DropdownMenuLabel "Filtrados" e "Completo" como separadores
- 4 DropdownMenuItems: CSV Filtrado, XLSX Filtrado, CSV Completo, XLSX Completo
- Cada item com icone (FileText para CSV, FileSpreadsheet para XLSX)
- Handlers podem apontar para funcoes placeholder por enquanto

## Dependencias Externas
Nenhuma

## Checklist
- [ ] Dropdown mostra 4 opcoes em 2 grupos
- [ ] Labels de grupo visiveis
- [ ] Icones corretos para cada formato
- [ ] Loading spinner durante exportacao
