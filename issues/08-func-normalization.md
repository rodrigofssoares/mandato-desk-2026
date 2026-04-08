# Issue 08: Funcional — Criar normalization.ts

**Tipo**: Funcional
**Pagina**: N/A (infraestrutura)
**Prioridade**: 8 (primeira funcional — base para todas as outras)

## Descricao
Criar utilitario de normalizacao com 3 funcoes reutilizaveis. Mover/expandir funcoes existentes de contactValidation.ts para normalization.ts e re-exportar para manter compatibilidade.

## Cenarios

### Happy Path
- `normalizePhone('11999887766')` → `'5511999887766'`
- `normalizePhone('5511999887766')` → `'5511999887766'`
- `normalizePhone('(11) 99988-7766')` → `'5511999887766'`
- `normalizeName('joao da silva')` → `'Joao da Silva'`
- `normalizeName('MARIA DAS GRACAS')` → `'Maria das Gracas'`
- `normalizeEmail(' Joao@Email.COM ')` → `'joao@email.com'`

### Edge Cases
- Telefone vazio → retorna string vazia
- Nome com emojis → emojis removidos
- Email com emojis → emojis removidos
- Nome so com preposicoes → nao capitaliza preposicoes (de, da, do, dos, das, e)
- Telefone ja com 55 → nao duplica prefixo

### Erros
- Funcoes nao lancam erro — retornam string limpa ou vazia

## Arquivos a Criar
- `src/lib/normalization.ts` — 3 funcoes de normalizacao

## Arquivos a Modificar
- `src/lib/contactValidation.ts` — Importar de normalization.ts e re-exportar para manter compatibilidade

## O Que Fazer em Cada Arquivo

### `src/lib/normalization.ts`
- `normalizePhone(phone: string): string`
  - `phone.replace(/\D/g, '')` para remover nao-digitos
  - Se nao comeca com "55" e tem 10-11 digitos, adicionar "55"
  - Retornar resultado

- `normalizeName(name: string): string`
  - Remover emojis com regex: `name.replace(/[\u{1F600}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')`
  - Split por espacos, capitalizar cada palavra
  - Preposicoes pt-BR em minusculas: ['de', 'da', 'do', 'dos', 'das', 'e']
  - Primeira palavra sempre capitalizada
  - Remover espacos extras com `.replace(/\s+/g, ' ').trim()`

- `normalizeEmail(email: string): string`
  - Remover emojis (mesma regex)
  - `.toLowerCase().trim()`
  - Remover espacos internos

### `src/lib/contactValidation.ts`
- Adicionar `import { normalizePhone, normalizeName } from './normalization'`
- Remover implementacao local de `normalizePhone` e `formatName`
- Re-exportar: `export { normalizePhone, normalizeName as formatName } from './normalization'`
- Manter a assinatura publica identica para nao quebrar imports existentes

## Dependencias Externas
Nenhuma

## Checklist
- [ ] normalizePhone funciona com todos os formatos
- [ ] normalizeName respeita preposicoes pt-BR
- [ ] normalizeEmail limpa corretamente
- [ ] contactValidation.ts re-exporta sem quebrar imports existentes
- [ ] `npm run build` passa sem erros
