# 41 — Detalhe do Contato: Aba "Personalizados"

**Tipo:** Funcional
**Fase:** 3
**Depende de:** 22-func-hooks-custom-fields, 33-func-tab-campos-personalizados
**Desbloqueia:** 43-func-contato-filtro-custom-fields

## Objetivo
Adicionar uma aba nova "Personalizados" no detalhe do contato, logo após a aba "Pessoais". Renderiza form dinâmico baseado nos campos criados em Settings. Salva valores em `campos_personalizados_valores`.

## Arquivos a criar/modificar
- `src/pages/ContactDetail.tsx` (ou componente de abas do contato)
- `src/components/contacts/CustomFieldsPanel.tsx` (novo)
- `src/components/contacts/CustomFieldInput.tsx` (novo — renderiza input por tipo)

## CustomFieldInput
```tsx
function CustomFieldInput({ campo, value, onChange }) {
  switch(campo.tipo) {
    case 'texto':    return <Input ... />;
    case 'numero':   return <Input type="number" ... />;
    case 'data':     return <DatePicker ... />;
    case 'booleano': return <Switch ... />;
    case 'selecao':  return <Select>{campo.opcoes.map(...)}</Select>;
  }
}
```

## CustomFieldsPanel
```tsx
function CustomFieldsPanel({ contactId }) {
  const { data: campos } = useCustomFields('contact');
  const { data: valores } = useContactCustomValues(contactId);
  const { mutate: save } = useSaveContactCustomValues();

  const form = useForm({
    defaultValues: valores,
  });

  // Render: lista de campos ordenada por campo.ordem
  // Submit: save({ contactId, values: form.getValues() })
  return (
    <form onSubmit={form.handleSubmit(v => save({ contactId, values: v }))}>
      {campos.map(c => (
        <Field key={c.id} label={c.rotulo}>
          <CustomFieldInput campo={c} {...form.register(c.id)} />
        </Field>
      ))}
      <Button type="submit">Salvar alterações</Button>
    </form>
  );
}
```

## Integração na estrutura de abas
Localizar o componente que define as abas do detalhe do contato (provavelmente `ContactDetail.tsx` ou `ContactDetailDialog.tsx`) e adicionar:

```tsx
<Tabs defaultValue="pessoais">
  <TabsList>
    <TabsTrigger value="pessoais">Pessoais</TabsTrigger>
    <TabsTrigger value="personalizados">Personalizados</TabsTrigger>  {/* NOVO */}
    <TabsTrigger value="endereco">Endereço</TabsTrigger>
    <TabsTrigger value="tags">Tags</TabsTrigger>
    ...
  </TabsList>
  <TabsContent value="personalizados">
    <CustomFieldsPanel contactId={contact.id} />
  </TabsContent>
</Tabs>
```

Se não houver campos personalizados criados ainda, a aba mostra uma empty state:
```
Nenhum campo personalizado configurado.
[Configurar em Settings → Geral]
```

## Critérios de Aceite
- [ ] Aba "Personalizados" aparece entre Pessoais e as demais
- [ ] Form dinâmico renderiza input correto por tipo
- [ ] Valores existentes carregam no form
- [ ] Salvar persiste via upsert em lote
- [ ] Toast de sucesso/erro
- [ ] Empty state quando não há campos configurados
- [ ] Campos fixos do contato (nome, email, etc.) **permanecem intocados** em outras abas
- [ ] Responsivo no mobile

## Verificação
- Criar 3 campos em Settings (texto, data, seleção)
- Abrir contato → aba Personalizados → preencher → salvar → recarregar → valores persistidos
- Criar novo campo depois → reabrir contato → novo campo aparece vazio
