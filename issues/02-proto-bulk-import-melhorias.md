# Issue 02: Prototipo Visual — Melhorias BulkImport

**Tipo**: Prototipo
**Pagina**: Importacao em Massa
**Prioridade**: 2

## Descricao
Adicionar elementos visuais que faltam na pagina BulkImport existente:
- Dialog de confirmacao antes de executar
- Contador de registros (badge mostrando total)
- Secao de "Nao encontrados" no relatorio
- Botao "Copiar erros" e "Re-importar erros"
- Todos sem logica real — apenas UI

## Cenarios

### Happy Path
- Usuario cola texto → ve contador "15 registros"
- Clica executar → dialog de confirmacao aparece
- Confirma → processamento normal
- Ao concluir → ve secao de erros com botoes copiar/re-importar

### Edge Cases
- Muitos registros (ex: 5000) → contador exibe total normalmente, sem limite
- Zero erros → secao de erros oculta

### Erros
- Lista de nao encontrados mockada com 3 itens

## Arquivos a Modificar
- `src/pages/BulkImport.tsx` — Adicionar UI dos novos elementos

## O Que Fazer em Cada Arquivo

### `src/pages/BulkImport.tsx`
- Adicionar badge/contador acima do botao de acao: "N registros"
- Adicionar AlertDialog (shadcn) antes do handleExecute: "Tem certeza que deseja [acao] N contatos?"
- Apos resultados, adicionar secao "Nao encontrados" com tabela separada (dados mockados)
- Botao "Copiar erros" com ClipboardCopy icon (sem logica)
- Botao "Re-importar erros" com RefreshCw icon (sem logica)

## Dependencias Externas
Nenhuma

## Checklist
- [ ] Contador de registros visivel
- [ ] AlertDialog de confirmacao aparece ao clicar executar
- [ ] Secao "Nao encontrados" mockada visivel apos resultados
- [ ] Botao "Copiar erros" presente
- [ ] Botao "Re-importar erros" presente
