# 42 — Detalhe do Contato: Aba "Tarefas"

**Tipo:** Funcional
**Fase:** 4
**Depende de:** 21-func-hooks-tarefas, 31-func-page-tarefas
**Desbloqueia:** —

## Objetivo
Adicionar uma aba "Tarefas" no detalhe do contato listando todas as tarefas vinculadas a ele, com botão para criar nova já pré-vinculada.

## Arquivos a criar/modificar
- `src/pages/ContactDetail.tsx` (ou componente de abas)
- `src/components/contacts/ContactTarefasPanel.tsx` (novo)

## ContactTarefasPanel
```tsx
function ContactTarefasPanel({ contactId }) {
  const { data: tarefas } = useTarefas({ contact_id: contactId });
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div>
      <div className="flex justify-between mb-4">
        <h3>Tarefas ({tarefas?.length ?? 0})</h3>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          + Nova tarefa
        </Button>
      </div>

      {/* Abas Pendentes / Concluídas */}
      <Tabs defaultValue="pendentes">
        <TabsList>
          <TabsTrigger value="pendentes">Pendentes</TabsTrigger>
          <TabsTrigger value="concluidas">Concluídas</TabsTrigger>
        </TabsList>
        <TabsContent value="pendentes">
          {tarefas.filter(t => !t.concluida).map(t => <TarefaRow ... />)}
        </TabsContent>
        <TabsContent value="concluidas">
          {tarefas.filter(t => t.concluida).map(t => <TarefaRow ... />)}
        </TabsContent>
      </Tabs>

      {showCreate && (
        <TarefaFormDialog
          defaultValues={{ contact_id: contactId }}
          onClose={() => setShowCreate(false)}
        />
      )}
    </div>
  );
}
```

## Integração na estrutura de abas do contato
Adicionar aba "Tarefas" (após "Personalizados"):
```tsx
<TabsTrigger value="tarefas">
  Tarefas
  {contagemPendentes > 0 && <Badge>{contagemPendentes}</Badge>}
</TabsTrigger>
```

Badge com contagem de pendentes fica visível no header da aba.

## Reuso
- `TarefaRow` do módulo Tarefas — mesmo componente
- `TarefaFormDialog` do módulo Tarefas — mesmo componente, apenas passando `defaultValues.contact_id`

## Critérios de Aceite
- [ ] Aba "Tarefas" aparece no detalhe do contato
- [ ] Lista tarefas reais do Supabase filtradas por `contact_id`
- [ ] Sub-abas Pendentes/Concluídas funcionam
- [ ] Badge mostra contagem de pendentes no trigger da aba
- [ ] Botão "+ Nova tarefa" pré-preenche `contact_id`
- [ ] Após criar, lista atualiza (invalidação correta)
- [ ] Toggle concluir da linha funciona
- [ ] Editar/deletar linha funciona
- [ ] Responsivo

## Verificação
- Abrir contato → aba Tarefas → criar 2 tarefas
- Marcar uma como concluída → aparece na sub-aba "Concluídas"
- Editar a outra → salva corretamente
- Navegar para `/tarefas` → as mesmas tarefas aparecem
