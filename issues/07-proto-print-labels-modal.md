# Issue 07: Prototipo Visual — PrintLabelsModal

**Tipo**: Prototipo
**Pagina**: Contatos
**Prioridade**: 7

## Descricao
Criar modal para configuracao e geracao de etiquetas de endereco em PDF. O modal mostra quantos contatos tem endereco completo, quais foram ignorados e por que, checkbox para incluir campo de origem/instituicao.

## Cenarios

### Happy Path
- Usuario clica "Etiquetas" na pagina de contatos → modal abre
- Ve: "45 contatos com endereco completo | 5 ignorados"
- Marca checkbox "Incluir instituicao/origem"
- Clica "Gerar PDF"

### Edge Cases
- Nenhum contato com endereco completo → botao gerar desabilitado, mensagem explicativa
- Todos os contatos validos → secao de ignorados oculta

### Erros
- Lista de contatos ignorados com motivo: "Falta CEP", "Falta bairro", etc.

## Arquivos a Criar
- `src/components/contacts/PrintLabelsModal.tsx` — Modal completo

## Arquivos a Modificar
- `src/pages/Contacts.tsx` — Adicionar botao "Etiquetas" com Printer icon

## O Que Fazer em Cada Arquivo

### `src/components/contacts/PrintLabelsModal.tsx`
- Dialog com DialogContent largo (max-w-2xl)
- Resumo: Badge verde "N contatos com endereco completo" + Badge amarelo "N ignorados"
- Checkbox: "Incluir campo de instituicao/origem na etiqueta"
- Secao colapsavel "Contatos ignorados" com tabela: nome, motivo
- Dados mockados: 3 contatos validos, 2 ignorados
- Botao "Gerar PDF" com Printer icon
- Exibir total de contatos validos
- Estado: 'idle' | 'generating' | 'done'

### `src/pages/Contacts.tsx`
- Adicionar botao "Etiquetas" com Printer icon, proximo ao Exportar
- Condicionar a `can.exportData()`
- State open/onOpenChange para o modal

## Dependencias Externas
Nenhuma (jsPDF ja instalado, mas nao usado nesta issue)

## Checklist
- [ ] Modal abre/fecha corretamente
- [ ] Resumo de contatos validos/ignorados mockado
- [ ] Checkbox de instituicao funcional visualmente
- [ ] Tabela de ignorados com motivos mockados
- [ ] Botao gerar PDF presente (sem logica de PDF)
- [ ] Integrado na pagina Contacts
