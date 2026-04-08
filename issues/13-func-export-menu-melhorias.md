# Issue 13: Funcional — Melhorias ExportMenu (logica)

**Tipo**: Funcional
**Pagina**: Contatos
**Prioridade**: 13
**Depende de**: Issue 03 (prototipo)

## Descricao
Conectar as 4 opcoes do ExportMenu com logica real: paginacao em lotes de 1000, larguras de coluna XLSX, colunas extras, nomes de arquivo com sufixo.

## Cenarios

### Happy Path
- Exportar CSV filtrado → arquivo `contatos_2026-04-07_filtrado.csv`
- Exportar XLSX completo → arquivo `contatos_2026-04-07_completo.xlsx` com larguras
- Base com 3000 contatos → busca em 3 lotes de 1000

### Edge Cases
- Zero contatos → toast "Nenhum contato para exportar"
- Filtros ativos + "Exportar todos" → ignora filtros

### Erros
- Erro no fetch → toast.error + console.error

## Tabelas no Banco
- `contacts`: select com joins para tags
- `contact_tags` + `tags`: para coluna etiquetas

## Arquivos a Modificar
- `src/components/contacts/ExportMenu.tsx` — Logica completa

## O Que Fazer em Cada Arquivo

### `src/components/contacts/ExportMenu.tsx`

**Paginacao em lotes de 1000:**
- Criar funcao `fetchAllContactsPaginated(filters?, ignoreFilters?)`:
  - Loop: buscar com `.range(offset, offset + 999)`
  - Concatenar resultados ate retornar menos de 1000
  - Parametro `ignoreFilters` para opcao "completo"

**4 funcoes de export:**
- `exportCSV(filtered: boolean)` — com ou sem filtros
- `exportXLSX(filtered: boolean)` — com ou sem filtros
- Sufixo no nome: `_filtrado` ou `_completo`

**Larguras XLSX:**
- Definir `ws['!cols']` com array de larguras:
  ```typescript
  const colWidths = [
    { wch: 36 }, // id
    { wch: 25 }, // nome
    { wch: 15 }, // whatsapp
    { wch: 18 }, // whatsapp_habilitado
    { wch: 25 }, // email
    { wch: 15 }, // telefone
    // ... etc conforme spec
  ];
  ws['!cols'] = colWidths;
  ```

**Colunas extras no contactsToRows:**
- Adicionar campo `id` (UUID do contato)
- Adicionar campo `WhatsApp Habilitado` mapeado de `em_canal_whatsapp` (Sim/Nao)
- Reordenar para: id, nome, whatsapp, whatsapp_habilitado, email, telefone, ...

**Delimitador CSV:**
- Manter `;` (ponto-e-virgula)

## Dependencias Externas
Nenhuma

## Checklist
- [ ] Paginacao busca em lotes de 1000
- [ ] "Exportar todos" ignora filtros
- [ ] "Exportar filtrados" aplica filtros
- [ ] XLSX tem larguras de coluna
- [ ] Colunas id e whatsapp_habilitado presentes
- [ ] Nome do arquivo com sufixo correto
- [ ] CSV com delimitador ;
- [ ] Testar com base grande (>1000 contatos)
