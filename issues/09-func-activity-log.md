# Issue 09: Funcional — Criar activityLog.ts

**Tipo**: Funcional
**Pagina**: N/A (infraestrutura)
**Prioridade**: 9

## Descricao
Criar utilitario para registrar atividades na tabela `activities` do Supabase. Fire-and-forget — nao deve bloquear o fluxo principal.

## Cenarios

### Happy Path
- `logActivity({ type: 'import', entity_type: 'contact', description: 'Importados 50 contatos' })` → insere registro na tabela activities

### Edge Cases
- Usuario nao autenticado → log no console.error, nao lanca erro
- Descricao muito longa → trunca em 500 caracteres

### Erros
- Falha no insert → console.error, nao lanca erro (fire-and-forget)

## Tabelas no Banco
- `activities`: id, type, entity_type, entity_name, entity_id, description, responsible_id, created_at

## Arquivos a Criar
- `src/lib/activityLog.ts` — Funcao logActivity

## O Que Fazer em Cada Arquivo

### `src/lib/activityLog.ts`
- Interface `LogActivityParams`:
  ```typescript
  interface LogActivityParams {
    type: 'create' | 'update' | 'delete' | 'status_change' | 'assignment' | 'import' | 'merge' | 'bulk_delete';
    entity_type: 'contact' | 'demand' | 'tag' | 'leader' | 'user' | 'permission' | 'role';
    entity_name?: string;
    entity_id?: string;
    description?: string;
  }
  ```
- `export async function logActivity(params: LogActivityParams): Promise<void>`
  - Buscar user: `const { data: { user } } = await supabase.auth.getUser()`
  - Se nao tiver user, console.error e return
  - Insert na tabela activities com responsible_id = user.id
  - Wrap em try/catch, console.error no catch
  - Nao re-lancar o erro

## Dependencias Externas
Nenhuma

## Checklist
- [ ] logActivity insere na tabela activities
- [ ] Nao lanca erro se falhar (fire-and-forget)
- [ ] Busca usuario autenticado corretamente
- [ ] `npm run build` passa sem erros
