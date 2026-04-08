# Issue 17: Funcional — Etiquetas de Endereco PDF (logica)

**Tipo**: Funcional
**Pagina**: Contatos
**Prioridade**: 17
**Depende de**: Issue 07 (prototipo)

## Descricao
Implementar a geracao real de PDF com etiquetas de endereco usando jsPDF. Conectar o PrintLabelsModal com dados reais do banco.

## Cenarios

### Happy Path
- 45 contatos com endereco completo → PDF com 45 paginas
- Checkbox "incluir instituicao" marcado → campo origem aparece na etiqueta
- PDF abre dialogo de impressao do navegador

### Edge Cases
- Contato sem CEP → listado como ignorado com motivo "Falta CEP"
- Contato sem bairro → ignorado com "Falta bairro"
- Muitos contatos validos (ex: 2000) → gerar PDF com todos, sem limite
- CEP sem hifen → formatar como "12345-678"
- Contato sem origem + checkbox marcado → linha de instituicao omitida

### Erros
- Erro na geracao do PDF → toast.error
- Zero contatos validos → botao gerar desabilitado

## Tabelas no Banco
- `contacts`: nome, logradouro, numero, complemento, bairro, cidade, estado, cep, origem

## Arquivos a Criar
- `src/lib/addressLabels.ts` — Funcao de geracao de PDF

## Arquivos a Modificar
- `src/components/contacts/PrintLabelsModal.tsx` — Conectar com dados reais e addressLabels

## O Que Fazer em Cada Arquivo

### `src/lib/addressLabels.ts`

**Interface:**
```typescript
interface LabelContact {
  nome: string;
  logradouro: string;
  numero: string;
  complemento?: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  origem?: string;
}

interface GenerateLabelsOptions {
  contacts: LabelContact[];
  includeOrigin: boolean;
}
```

**Funcao principal:**
```typescript
export function generateAddressLabels({ contacts, includeOrigin }: GenerateLabelsOptions): void
```

**Logica:**
- `import jsPDF from 'jspdf'`
- Pagina A4: new jsPDF({ format: 'a4' })
- Para cada contato:
  - Se nao e o primeiro, `doc.addPage()`
  - Caixa centralizada: x = (210 - 120) / 2 = 45mm, y = (297 - 50) / 2 = 123.5mm
  - Desenhar retangulo com borda fina: `doc.rect(45, 120, 120, 55)`
  - Linha 1: nome (16pt, bold, centralizado)
  - Linha 2: origem (14pt, normal) — se includeOrigin e origem preenchida
  - Linha 3: logradouro + ", " + numero (13pt)
  - Linha 4: bairro + " - " + formatCEP(cep) (13pt)
  - Linha 5: cidade + " - " + estado (13pt)
  - Todas as linhas centralizadas horizontalmente na caixa

**Funcao auxiliar:**
```typescript
function formatCEP(cep: string): string {
  const digits = cep.replace(/\D/g, '');
  if (digits.length === 8) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return cep;
}
```

**Validacao:**
```typescript
export function validateAddress(contact: Partial<LabelContact>): string | null
// Retorna mensagem de erro ou null se valido
// Verifica: nome, logradouro, numero, bairro, cidade, estado, cep
```

**Finalizar:**
- `doc.autoPrint()` — abre dialogo de impressao
- `doc.output('dataurlnewwindow')` ou `window.open(doc.output('bloburl'))`

### `src/components/contacts/PrintLabelsModal.tsx`

**Fetch de contatos:**
- Buscar contatos com filtros ativos (ou todos) incluindo campos de endereco
- `supabase.from('contacts').select('nome, logradouro, numero, complemento, bairro, cidade, estado, cep, origem')`
- Aplicar `validateAddress()` em cada um
- Separar em validos e invalidos

**UI conectada:**
- Substituir dados mockados por contagens reais
- Lista de ignorados com motivo real de `validateAddress()`
- Botao "Gerar PDF" chama `generateAddressLabels()`
- Gerar para todos os contatos validos (sem limite)

## Dependencias Externas
Nenhuma (jspdf v4.0.0 ja instalado)

## Checklist
- [ ] PDF gerado com 1 etiqueta por pagina A4
- [ ] Caixa centralizada com 120x50mm
- [ ] 5 linhas com fontes corretas (16pt bold, 14pt, 13pt)
- [ ] Checkbox incluir origem funciona
- [ ] CEP formatado como 12345-678
- [ ] Contatos sem endereco completo listados como ignorados
- [ ] Funciona com qualquer quantidade de contatos
- [ ] Dialogo de impressao abre automaticamente
- [ ] Dados reais do banco
