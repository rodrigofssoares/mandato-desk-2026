# Issue 01: Prototipo Visual — ContactImportDialog

**Tipo**: Prototipo
**Pagina**: Contatos
**Prioridade**: 1

## Descricao
Criar o componente visual do dialog de importacao de contatos. Deve ser um modal (Dialog do shadcn) com:
- Botao de download de template
- Area de upload de arquivo (drag & drop ou click)
- Preview dos dados em tabela (5 primeiras linhas)
- Estatisticas (total, validas, invalidas, vazias)
- Barra de progresso com indicador de fase (Preparando, Criando, Atualizando, Etiquetas, Concluido)
- Relatorio final com contagens (criados, atualizados, ignorados, erros)
- Botao "Copiar erros" no relatorio
- Todos os dados mockados/hardcoded

## Cenarios

### Happy Path
- Usuario abre dialog → ve area de upload e botao de template
- Faz upload de arquivo → ve preview com 5 linhas e estatisticas
- Clica importar → barra de progresso percorre as 5 fases
- Ao concluir → relatorio com contagens

### Edge Cases
- Nenhum arquivo selecionado → botao importar desabilitado
- Arquivo sem dados validos → mensagem "Nenhum dado valido encontrado"

### Erros
- Estado de erro visual com lista de erros por linha (mockado)

## Arquivos a Criar
- `src/components/contacts/ContactImportDialog.tsx` — Dialog completo com UI

## Arquivos a Modificar
- `src/pages/Contacts.tsx` — Adicionar botao "Importar" que abre o dialog

## O Que Fazer em Cada Arquivo

### `src/components/contacts/ContactImportDialog.tsx`
- Usar Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription do shadcn
- Area de upload com Input type="file" accept=".csv,.xlsx,.xls"
- Botao "Baixar Template" com Download icon
- Tabela de preview com Table/TableHeader/TableBody do shadcn (dados mockados)
- Badge com estatisticas: "50 linhas | 48 validas | 1 vazia | 1 invalida"
- Progress bar (componente Progress do shadcn) com label da fase atual
- Card de relatorio final: criados (green), atualizados (blue), ignorados (yellow), erros (red)
- Lista de erros com numero da linha e mensagem
- Botao "Copiar erros" com Copy icon
- Estado: 'idle' | 'preview' | 'importing' | 'done'

### `src/pages/Contacts.tsx`
- Importar ContactImportDialog
- Adicionar botao "Importar" com Upload icon, ao lado do botao Exportar
- Condicionar visibilidade a `can.importContacts()`
- Passar state open/onOpenChange para o dialog

## Dependencias Externas
Nenhuma

## Checklist
- [ ] Dialog abre/fecha corretamente
- [ ] Area de upload visual funcional (sem logica de parse)
- [ ] Preview com dados mockados exibido em tabela
- [ ] Estatisticas mockadas exibidas
- [ ] Barra de progresso com fases mockadas
- [ ] Relatorio final mockado com contagens
- [ ] Botao copiar erros presente (sem logica)
- [ ] Botao importar desabilitado quando nao ha dados
- [ ] Responsivo em telas menores
