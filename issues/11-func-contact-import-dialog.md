# Issue 11: Funcional — ContactImportDialog (logica completa)

**Tipo**: Funcional
**Pagina**: Contatos
**Prioridade**: 11
**Depende de**: Issue 01 (prototipo), Issue 08 (normalization), Issue 09 (activityLog), Issue 10 (schema)

## Descricao
Conectar o prototipo do ContactImportDialog com logica real: parse de CSV/XLSX, validacao Zod, upsert por WhatsApp normalizado, processamento em lotes de 100, registro de atividade.

## Cenarios

### Happy Path
- Upload de XLSX com 200 contatos → preview com 5 linhas + stats
- Clica importar → progresso percorre 5 fases
- 150 criados, 40 atualizados, 10 com erros → relatorio final correto
- Atividade registrada no banco

### Edge Cases
- WhatsApp duplicado na planilha → atualiza em vez de criar segundo
- Campo vazio na planilha → NAO sobrescreve dado existente no banco
- Coluna "etiquetas" com "Tag1, Tag2" → cria tags se nao existem, vincula
- XLSX com aba "Instrucoes" → ignora essa aba
- Header duplicado → remove automaticamente
- Linhas vazias → ignora
- CSV com delimitador `;` ou `,` → detecta automaticamente

### Erros
- Nome vazio → erro na linha, continua proxima
- WhatsApp invalido (nao resulta em 12-13 digitos) → erro na linha
- Email mal formatado → erro na linha
- Erro de insert/update no banco → erro na linha, continua
- Copiar erros → clipboard com formato "Linha X: mensagem"

## Tabelas no Banco
- `contacts`: todos os campos mapeados
- `tags`: id, nome, categoria, cor
- `contact_tags`: contact_id, tag_id
- `activities`: type='import', entity_type='contact'

## Arquivos a Modificar
- `src/components/contacts/ContactImportDialog.tsx` — Substituir dados mockados por logica real

## O Que Fazer em Cada Arquivo

### `src/components/contacts/ContactImportDialog.tsx`

**Parse de arquivo:**
- Import xlsx dinamico: `const XLSX = await import('xlsx')`
- CSV: detectar delimitador (`;` ou `,`), split por linhas, split por delimitador
- XLSX: `XLSX.read(data, { type: 'array' })`, ignorar aba "Instrucoes"
- Mapear headers para campos do schema (case-insensitive, trim)
- Detectar header automaticamente (primeira linha com "nome" ou "whatsapp")

**Template XLSX:**
- Funcao `downloadTemplate()`: criar workbook com 2 abas
- Aba "Contatos": headers corretos como primeira linha
- Aba "Instrucoes": texto explicativo dos campos
- Download via `XLSX.writeFile()`

**Validacao:**
- Aplicar normalizacao: `normalizePhone()`, `normalizeName()`, `normalizeEmail()`
- Validar com `importContactSchema.safeParse()`
- `parseBoolean()` para campos booleanos
- Coletar erros por linha

**Processamento em 5 fases (lotes de 100):**
1. Preparando: buscar todos contatos existentes (whatsapp), todas tags existentes
2. Criando: para cada contato sem match de whatsapp → `supabase.from('contacts').insert()` em lotes de 100
3. Atualizando: para cada contato com match → `supabase.from('contacts').update()` (somente campos nao vazios)
4. Etiquetas: para cada contato com campo etiquetas → criar tag se nao existe → upsert contact_tags
5. Concluido: `logActivity()`, atualizar estado para 'done'

**Relatorio:**
- Contagens: criados, atualizados, ignorados, erros
- Lista de erros com numero da linha
- Botao "Copiar erros" → `navigator.clipboard.writeText()`

## Dependencias Externas
Nenhuma (xlsx, zod ja instalados)

## Checklist
- [ ] Parse CSV com delimitador `;` e `,`
- [ ] Parse XLSX ignorando aba "Instrucoes"
- [ ] Template XLSX baixa corretamente
- [ ] Normalizacao aplicada antes de validar
- [ ] Validacao Zod rejeita linhas invalidas sem parar processo
- [ ] Upsert por WhatsApp: cria se novo, atualiza se existe
- [ ] Campos vazios nao sobrescrevem dados existentes
- [ ] Etiquetas criadas automaticamente se nao existem
- [ ] Processamento em lotes de 100
- [ ] Barra de progresso atualiza por fase
- [ ] Relatorio final com contagens corretas
- [ ] Copiar erros funciona
- [ ] Atividade registrada via logActivity
- [ ] Testar com 5, 50, 200 contatos
