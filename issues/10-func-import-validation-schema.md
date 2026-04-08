# Issue 10: Funcional — Schema Zod de importacao + parseBoolean

**Tipo**: Funcional
**Pagina**: N/A (infraestrutura)
**Prioridade**: 10

## Descricao
Adicionar schema Zod especifico para validar linhas de importacao de contatos e funcao parseBoolean para converter strings em booleanos.

## Cenarios

### Happy Path
- Linha com nome e whatsapp validos → schema valida OK
- `parseBoolean('sim')` → `true`
- `parseBoolean('nao')` → `false`
- `parseBoolean('1')` → `true`
- `parseBoolean('true')` → `true`

### Edge Cases
- `parseBoolean(undefined)` → `undefined`
- `parseBoolean('')` → `undefined`
- `parseBoolean('qualquer')` → `undefined`
- Campo email vazio → aceito (optional)
- Campo nome vazio → rejeita (required)

## Arquivos a Modificar
- `src/lib/contactValidation.ts` — Adicionar importContactSchema e parseBoolean

## O Que Fazer em Cada Arquivo

### `src/lib/contactValidation.ts`
- Adicionar `importContactSchema` com z.object:
  - nome_completo: z.string().min(1).max(255)
  - whatsapp: z.string().min(1).max(20)
  - whatsapp_habilitado: z.boolean().optional()
  - nome_whatsapp: z.string().max(255).optional()
  - email: z.string().email().max(255).optional().or(z.literal(''))
  - telefone: z.string().max(20).optional()
  - genero: z.enum(['masculino', 'feminino', 'outro']).optional()
  - endereco: z.string().max(500).optional()
  - numero: z.string().max(20).optional()
  - complemento: z.string().max(255).optional()
  - bairro: z.string().max(255).optional()
  - cidade: z.string().max(255).optional()
  - uf: z.string().max(2).optional()
  - cep: z.string().max(10).optional()
  - origem: z.string().max(255).optional()
  - observacoes: z.string().max(2000).optional()
  - notas_assessor: z.string().max(2000).optional()
  - declarou_voto: z.boolean().optional()
  - etiquetas: z.string().optional()

- Adicionar `export type ImportContactData = z.infer<typeof importContactSchema>`

- Adicionar `export function parseBoolean(value: string | undefined): boolean | undefined`
  - Se undefined ou vazio → undefined
  - Lowercase do value
  - ['sim', 'true', '1', 'yes', 's'] → true
  - ['nao', 'não', 'false', '0', 'no', 'n'] → false
  - Qualquer outro → undefined

## Dependencias Externas
Nenhuma (zod ja instalado)

## Checklist
- [ ] importContactSchema valida corretamente campos obrigatorios
- [ ] importContactSchema aceita campos opcionais vazios
- [ ] parseBoolean converte todos os formatos esperados
- [ ] Types exportados corretamente
- [ ] `npm run build` passa sem erros
