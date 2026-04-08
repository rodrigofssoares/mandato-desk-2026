# Issue 16: Funcional — ActivitiesExportMenu (logica)

**Tipo**: Funcional
**Pagina**: Dashboard (ActivityFeed)
**Prioridade**: 16
**Depende de**: Issue 06 (prototipo)

## Descricao
Conectar o ActivitiesExportMenu com logica real de exportacao de atividades.

## Cenarios

### Happy Path
- Exportar CSV → arquivo `atividades_2026-04-07.csv` com 9 colunas
- Exportar XLSX → arquivo `atividades_2026-04-07.xlsx` com larguras

### Edge Cases
- Atividade sem usuario (responsible_id null) → coluna usuario_nome = "Sistema"
- Atividade sem entity_name → coluna vazia
- Zero atividades → toast "Nenhuma atividade para exportar"

### Erros
- Erro no fetch → toast.error

## Tabelas no Banco
- `activities`: id, type, entity_type, entity_name, entity_id, description, responsible_id, created_at
- `profiles`: nome (join para usuario_nome)

## Arquivos a Modificar
- `src/components/activities/ActivitiesExportMenu.tsx` — Logica real

## O Que Fazer em Cada Arquivo

### `src/components/activities/ActivitiesExportMenu.tsx`

**Fetch (paginado em lotes de 1000):**
```typescript
// Loop com .range(offset, offset + 999) ate retornar < 1000
supabase.from('activities')
  .select('*, profiles:responsible_id(nome)')
  .order('created_at', { ascending: false })
  .range(offset, offset + 999)
```

**Mapeamentos:**
```typescript
const TYPE_LABELS: Record<string, string> = {
  create: 'Criacao',
  update: 'Atualizacao',
  delete: 'Exclusao',
  status_change: 'Mudanca de Status',
  assignment: 'Atribuicao',
  import: 'Importacao',
  merge: 'Mesclagem',
  bulk_delete: 'Exclusao em Massa',
};
const ENTITY_LABELS: Record<string, string> = {
  contact: 'Contato',
  demand: 'Demanda',
  tag: 'Etiqueta',
  leader: 'Lideranca',
  user: 'Usuario',
  permission: 'Permissao',
  role: 'Perfil',
};
```

**Transform para rows:**
```typescript
function activitiesToRows(activities) {
  return activities.map(a => ({
    id: a.id,
    tipo: TYPE_LABELS[a.type] ?? a.type,
    descricao: a.description ?? '',
    tipo_entidade: ENTITY_LABELS[a.entity_type] ?? a.entity_type,
    entidade_nome: a.entity_name ?? '',
    entidade_id: a.entity_id ?? '',
    usuario_nome: a.profiles?.nome ?? 'Sistema',
    usuario_id: a.responsible_id ?? '',
    data: a.created_at ? new Date(a.created_at).toLocaleString('pt-BR') : '',
  }));
}
```

**Larguras XLSX:**
```typescript
ws['!cols'] = [
  { wch: 36 }, { wch: 18 }, { wch: 40 }, { wch: 15 },
  { wch: 30 }, { wch: 36 }, { wch: 25 }, { wch: 36 }, { wch: 20 },
];
```

## Dependencias Externas
Nenhuma

## Checklist
- [ ] CSV com 9 colunas e delimitador ;
- [ ] XLSX com larguras
- [ ] Tipos de atividade mapeados para portugues
- [ ] Tipos de entidade mapeados para portugues
- [ ] Paginacao em lotes de 1000
- [ ] Usuario "Sistema" quando sem responsible
- [ ] Data em pt-BR com hora
