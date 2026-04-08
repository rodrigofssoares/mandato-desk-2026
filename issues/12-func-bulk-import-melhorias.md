# Issue 12: Funcional — Melhorias BulkImport (logica)

**Tipo**: Funcional
**Pagina**: Importacao em Massa
**Prioridade**: 12
**Depende de**: Issue 02 (prototipo), Issue 08 (normalization)

## Descricao
Conectar os novos elementos visuais do BulkImport com logica real: confirmacao, normalizacao, clipboard de erros, re-importar erros. Sem limite de quantidade — aceitar todos os contatos.

## Cenarios

### Happy Path
- Cola 500 linhas → contador "500 registros"
- Clica executar → dialog confirmacao → confirma → processa
- 490 sucesso, 10 falha → secao erros com botoes

### Edge Cases
- Zero erros → secao de erros oculta
- Re-importar erros → textarea preenchida com linhas que falharam
- Modo delete: contato nao encontrado → aparece em "Nao encontrados"
- Modo edit: sem whatsapp → erro "WhatsApp necessario"

### Erros
- Copiar erros → formato "nome,whatsapp,email — Erro: mensagem"

## Tabelas no Banco
- `contacts`: insert/update/delete
- `tags`: find or create
- `contact_tags`: upsert

## Arquivos a Modificar
- `src/pages/BulkImport.tsx` — Conectar logica aos novos elementos

## O Que Fazer em Cada Arquivo

### `src/pages/BulkImport.tsx`

**Dialog de confirmacao:**
- Importar AlertDialog do shadcn
- State `showConfirm` que abre antes do handleExecute
- Texto: "Tem certeza que deseja {modeLabels[mode].tab.toLowerCase()} {parsed.length} contatos?"
- Confirmar chama handleExecute real

**Normalizacao:**
- No parse e antes do processamento:
  - `normalizePhone()` no campo whatsapp
  - `normalizeName()` no campo nome
- Importar de `@/lib/normalization`

**Relatorio de nao encontrados:**
- No modo delete/edit/tag, quando o contato nao e encontrado no banco
- Guardar em state separado: `notFound: ParsedContact[]`
- Exibir tabela separada apos resultados

**Copiar erros:**
- Filtrar parsed onde status === 'error'
- Formatar: "nome,whatsapp,email — Erro: mensagem"
- `navigator.clipboard.writeText(text)` → toast.success("Erros copiados")

**Re-importar erros:**
- Filtrar parsed onde status === 'error'
- Formatar de volta para texto: "nome,whatsapp,email"
- Setar no rawText e chamar parseText()

## Dependencias Externas
Nenhuma

## Checklist
- [ ] Dialog de confirmacao funciona em todos os modos
- [ ] Normalizacao aplicada no telefone e nome
- [ ] Nao encontrados listados separadamente
- [ ] Copiar erros copia para clipboard
- [ ] Re-importar erros preenche textarea com erros
- [ ] Testar cada modo (add, delete, edit, tag)
