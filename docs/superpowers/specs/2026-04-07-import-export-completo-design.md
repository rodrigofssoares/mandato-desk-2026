# Spec: Importacao e Exportacao Completa — Mandato Desk 2026

**Data:** 2026-04-07
**Objetivo:** Trazer o sistema de importacao/exportacao ao nivel da spec do Base Politica Pro, adaptado ao Mandato Desk 2026.

---

## Bloco 1 — Infraestrutura

### 1.1 `src/lib/normalization.ts` (NOVO)

Funcoes de normalizacao reutilizaveis:

```typescript
// normalizePhone(phone: string): string
// - Remove nao-digitos
// - Adiciona prefixo "55" se ausente
// - Resultado: 12-13 digitos

// normalizeName(name: string): string
// - Remove emojis
// - Title Case (respeitando preposicoes pt-BR: de, da, do, dos, das, e)
// - Remove espacos extras

// normalizeEmail(email: string): string
// - Minusculas
// - Remove espacos
// - Remove emojis
```

**Nota:** `contactValidation.ts` ja tem `normalizePhone` e `formatName` basicos. Mover e expandir essas funcoes para `normalization.ts` e re-exportar de `contactValidation.ts` para manter compatibilidade.

### 1.2 `src/lib/activityLog.ts` (NOVO)

Utilitario para registrar atividades na tabela `activities`:

```typescript
interface LogActivityParams {
  type: 'create' | 'update' | 'delete' | 'status_change' | 'assignment' | 'import' | 'merge' | 'bulk_delete';
  entity_type: 'contact' | 'demand' | 'tag' | 'leader' | 'user' | 'permission' | 'role';
  entity_name?: string;
  entity_id?: string;
  description?: string;
}

export async function logActivity(params: LogActivityParams): Promise<void>
// - Busca o user autenticado via supabase.auth.getUser()
// - Insere na tabela activities com responsible_id = user.id
// - Nao lanca erro (fire-and-forget com console.error)
```

### 1.3 Expandir `src/lib/contactValidation.ts`

Adicionar schema Zod especifico para importacao:

```typescript
export const importContactSchema = z.object({
  nome_completo: z.string().min(1).max(255),
  whatsapp: z.string().min(1).max(20),
  whatsapp_habilitado: z.boolean().optional(),
  nome_whatsapp: z.string().max(255).optional(),
  email: z.string().email().max(255).optional().or(z.literal('')),
  telefone: z.string().max(20).optional(),
  genero: z.enum(['masculino', 'feminino', 'outro']).optional(),
  endereco: z.string().max(500).optional(),
  numero: z.string().max(20).optional(),
  complemento: z.string().max(255).optional(),
  bairro: z.string().max(255).optional(),
  cidade: z.string().max(255).optional(),
  uf: z.string().max(2).optional(),
  cep: z.string().max(10).optional(),
  origem: z.string().max(255).optional(),
  observacoes: z.string().max(2000).optional(),
  notas_assessor: z.string().max(2000).optional(),
  declarou_voto: z.boolean().optional(),
  etiquetas: z.string().optional(), // nomes separados por virgula
});
```

Adicionar funcao de parse de booleanos:

```typescript
export function parseBoolean(value: string | undefined): boolean | undefined
// Aceita: sim/nao, true/false, 1/0, yes/no
```

---

## Bloco 2 — Importacao

### 2.1 `src/components/contacts/ContactImportDialog.tsx` (NOVO)

Dialog modal acessivel a partir da pagina de Contatos (botao "Importar" ao lado de "Exportar").

**Fluxo:**
1. Usuario clica "Importar" → abre dialog
2. Pode baixar template XLSX (aba "Contatos" + aba "Instrucoes")
3. Faz upload de CSV ou XLSX
4. Sistema mostra preview (5 primeiras linhas validas + estatisticas)
5. Usuario confirma → processamento em 5 fases

**5 Fases de processamento (lotes de 100):**
1. **Preparando** — Carrega contatos e etiquetas existentes
2. **Criando** — Insere novos contatos (WhatsApp nao existe no banco)
3. **Atualizando** — Atualiza existentes (WhatsApp ja existe; campos vazios NAO sobrescrevem)
4. **Etiquetas** — Cria etiquetas novas se necessario, vincula contact_tags
5. **Concluido** — Registra atividade via `logActivity()`, exibe relatorio

**Regras de duplicidade:**
- Chave: WhatsApp normalizado
- Se WhatsApp existe → UPDATE (somente campos preenchidos na planilha)
- Se WhatsApp nao existe → INSERT

**20 campos aceitos:** conforme schema `importContactSchema`

**Mapeamento de colunas:** O header do CSV/XLSX deve ter os nomes em portugues (`nome_completo`, `whatsapp`, etc). Ignorar aba "Instrucoes" do XLSX automaticamente.

**Normalizacao aplicada antes da validacao:**
- Telefone/WhatsApp: `normalizePhone()`
- Nome: `normalizeName()`
- Email: `normalizeEmail()`

**Tratamento de erros:**
- Erros rastreados por linha (numero da linha + mensagem)
- Erros nao interrompem o processo
- Relatorio final: criados, atualizados, ignorados, erros
- Botao para copiar erros para clipboard

**Permissao:** `can.importContacts()` (ja existe)

### 2.2 Melhorias em `src/pages/BulkImport.tsx`

Manter os 4 modos existentes (add, delete, edit, tag) e adicionar:

1. **Dialog de confirmacao** — AlertDialog antes de executar ("Tem certeza que deseja [acao] N contatos?")
3. **Normalizar telefone** — Aplicar `normalizePhone()` no whatsapp antes de insert/lookup
4. **Normalizar nome** — Aplicar `normalizeName()` no nome
5. **Relatorio de nao encontrados** — Na aba delete/edit/tag, listar contatos nao encontrados separadamente
6. **Copiar erros** — Botao "Copiar erros" que copia linhas com erro para clipboard
7. **Re-importar erros** — Botao para preencher o textarea com as linhas que falharam

---

## Bloco 3 — Exportacoes

### 3.1 Melhorias em `src/components/contacts/ExportMenu.tsx`

1. **Opcao "Exportar todos" vs "Exportar filtrados"** — Dropdown com 4 itens: CSV filtrado, CSV completo, XLSX filtrado, XLSX completo
2. **Paginacao de 1.000** — Buscar em lotes de 1.000 (limite PostgREST) e concatenar
3. **Larguras de coluna XLSX** — Definir `ws['!cols']` com larguras customizadas por coluna
4. **Colunas extras** — Adicionar: `id`, `whatsapp_habilitado` (campo `em_canal_whatsapp`), `nome_whatsapp` (nao existe no banco, remover da spec)
5. **Nome do arquivo** — Sufixo `_filtrado` ou `_completo` (ex: `contatos_2026-04-07_filtrado.csv`)
6. **Manter `;`** como delimitador CSV

**Nota sobre `nome_whatsapp`:** O campo nao existe na tabela `contacts` atual. Nao adicionar ao banco — apenas exportar se existir.

### 3.2 `src/components/tags/TagsExportMenu.tsx` (NOVO)

Componente reutilizavel seguindo o padrao do ExportMenu:

**Colunas:** id, nome, categoria (com mapeamento), cor, criado_em
**Mapeamento de categorias:** professionals→Perfil, relationships→Interesse, demands→Campanhas, geral→Geral
**Formatos:** CSV (;) e XLSX (com larguras)
**Permissao:** `can.exportData()`

**Integracao:** Adicionar na pagina `Tags.tsx`

### 3.3 `src/components/demands/DemandsExportMenu.tsx` (NOVO)

**Colunas:** id, titulo, descricao, status (mapeado), prioridade (mapeado), bairro, contato_nome, contato_id, criado_em, atualizado_em, etiquetas
**Mapeamento status:** open→Aberta, in_progress→Em Andamento, resolved→Resolvida
**Mapeamento prioridade:** low→Baixa, medium→Media, high→Alta
**Formatos:** CSV (;) e XLSX (com larguras)
**Permissao:** `can.exportData()`

**Integracao:** Adicionar na pagina `Demands.tsx`

### 3.4 `src/components/activities/ActivitiesExportMenu.tsx` (NOVO)

**Colunas:** id, tipo (mapeado), descricao, tipo_entidade (mapeado), entidade_nome, entidade_id, usuario_nome, usuario_id, data

**Mapeamento de tipos de atividade:**
create→Criacao, update→Atualizacao, delete→Exclusao, status_change→Mudanca de Status, assignment→Atribuicao, import→Importacao, merge→Mesclagem, bulk_delete→Exclusao em Massa

**Mapeamento de tipos de entidade:**
contact→Contato, demand→Demanda, tag→Etiqueta, leader→Lideranca, user→Usuario, permission→Permissao, role→Perfil

**Formatos:** CSV (;) e XLSX (com larguras)
**Permissao:** `can.exportData()`

**Integracao:** Adicionar no componente `ActivityFeed.tsx` (dashboard) ou criar pagina dedicada — usar ActivityFeed pois nao existe pagina de atividades.

### 3.5 `src/lib/addressLabels.ts` + `src/components/contacts/PrintLabelsModal.tsx` (NOVOS)

**addressLabels.ts:**
- Usa jsPDF v4.0.0
- Pagina A4, 1 etiqueta por pagina
- Caixa centralizada 120mm x 50mm
- 5 linhas: nome (16pt bold), instituicao/origem (14pt, opcional), endereco+numero (13pt), bairro+CEP (13pt), cidade+UF (13pt)
- Validacao: todos os campos de endereco obrigatorios (nome, endereco, numero, bairro, cidade, estado, cep)
- Sem limite de quantidade de contatos

**PrintLabelsModal.tsx:**
- Modal com checkbox para incluir campo instituicao/origem
- Lista contatos com endereco incompleto (ignorados) com motivo
- Botao "Gerar PDF" que chama `generateAddressLabels()`
- Abre dialogo de impressao automaticamente

**Integracao:** Adicionar na pagina de Contatos como opcao no menu ou botao separado. Usar `can.exportData()` para permissao.

---

## Arquivos Tocados — Resumo

### Novos (8 arquivos):
1. `src/lib/normalization.ts`
2. `src/lib/activityLog.ts`
3. `src/components/contacts/ContactImportDialog.tsx`
4. `src/components/tags/TagsExportMenu.tsx`
5. `src/components/demands/DemandsExportMenu.tsx`
6. `src/components/activities/ActivitiesExportMenu.tsx`
7. `src/lib/addressLabels.ts`
8. `src/components/contacts/PrintLabelsModal.tsx`

### Modificados (5 arquivos):
1. `src/lib/contactValidation.ts` — schema de importacao + parseBoolean
2. `src/pages/BulkImport.tsx` — melhorias (confirmacao, limite, clipboard, normalizacao)
3. `src/components/contacts/ExportMenu.tsx` — paginacao, larguras, filtrado/todos
4. `src/pages/Tags.tsx` — adicionar TagsExportMenu
5. `src/pages/Demands.tsx` — adicionar DemandsExportMenu
6. `src/pages/Contacts.tsx` — adicionar botao Importar + PrintLabels
7. `src/components/dashboard/ActivityFeed.tsx` — adicionar ActivitiesExportMenu

### Dependencias:
Nenhuma nova — `xlsx`, `jspdf`, `jspdf-autotable`, `zod` ja estao instalados.

---

## Verificacao

### Testes manuais por bloco:

**Bloco 1:**
- `npm run build` deve passar sem erros
- Verificar que `normalizePhone('11999887766')` retorna `'5511999887766'`
- Verificar que `normalizeName('joao da silva')` retorna `'Joao da Silva'`

**Bloco 2:**
- Fazer upload de CSV com 5 contatos → preview correto
- Importar com WhatsApp duplicado → deve atualizar, nao duplicar
- Importar com campo vazio → nao deve sobrescrever dado existente
- Bulk import com >1000 linhas → deve mostrar erro
- Bulk import com confirmacao → dialog aparece antes de executar

**Bloco 3:**
- Exportar contatos CSV filtrado → nome do arquivo com `_filtrado`
- Exportar contatos XLSX → colunas com larguras corretas
- Exportar etiquetas → categorias mapeadas corretamente
- Exportar demandas → status e prioridade em portugues
- Exportar atividades → tipos mapeados corretamente
- Gerar PDF de etiquetas → 1 por pagina, campos corretos
- Contato sem endereco completo → aparece na lista de ignorados
