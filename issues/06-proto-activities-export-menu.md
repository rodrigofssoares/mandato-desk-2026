# Issue 06: Prototipo Visual — ActivitiesExportMenu

**Tipo**: Prototipo
**Pagina**: Dashboard (ActivityFeed)
**Prioridade**: 6

## Descricao
Criar componente de exportacao de atividades e integrar no ActivityFeed do dashboard.

## Cenarios

### Happy Path
- Usuario ve o ActivityFeed no dashboard → botao "Exportar" no canto superior
- Clica → dropdown com CSV e XLSX

### Edge Cases
- Nenhuma atividade → toast "Nenhuma atividade para exportar"

## Arquivos a Criar
- `src/components/activities/ActivitiesExportMenu.tsx` — Componente dropdown

## Arquivos a Modificar
- `src/components/dashboard/ActivityFeed.tsx` — Adicionar botao de exportacao no header

## O Que Fazer em Cada Arquivo

### `src/components/activities/ActivitiesExportMenu.tsx`
- Copiar estrutura visual do ExportMenu.tsx
- 2 opcoes: Exportar CSV, Exportar XLSX
- Estado isExporting com spinner
- Handlers placeholder

### `src/components/dashboard/ActivityFeed.tsx`
- Importar ActivitiesExportMenu
- Adicionar no header do card, ao lado do titulo
- Condicionar a `can.exportData()`

## Dependencias Externas
Nenhuma

## Checklist
- [ ] Componente renderiza dropdown com 2 opcoes
- [ ] Integrado no ActivityFeed
- [ ] Permissao respeitada
