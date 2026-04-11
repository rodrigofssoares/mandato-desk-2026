# 33 — Aba Geral: Campos Personalizados funcional

**Tipo:** Funcional
**Fase:** 2
**Depende de:** 22-func-hooks-custom-fields, 32-func-page-settings-hub, 05-proto-campos-personalizados-wireframes
**Desbloqueia:** 41-func-contato-aba-personalizados

## Objetivo
Implementar a seção "Campos Personalizados" dentro da aba "Geral" de Settings, plugando os hooks de `useCustomFields`.

## Arquivos a criar/modificar
- `src/components/settings/GeneralTab.tsx` (adicionar seção)
- `src/components/settings/CustomFieldsManager.tsx`
- `src/components/settings/CustomFieldFormDialog.tsx`

## Funcionalidades
1. **Listar** campos existentes em tabela com colunas: Rótulo | Tipo | Filtrável | Ações
2. **"+ Adicionar campo"** → abre dialog com:
   - Rótulo (text, obrigatório)
   - Tipo (select: Texto/Número/Data/Sim-Não/Seleção)
   - Se tipo = Seleção: array editável de opções
   - Filtrável (switch, default true)
   - Preview da `chave` slugificada (readonly)
3. **Editar** → mesmo dialog em modo edit (chave readonly)
4. **Excluir** → confirmação "Isso apagará todos os valores já preenchidos em contatos. Continuar?"

## Validações
- Rótulo obrigatório e único por entidade
- Se tipo = Seleção, pelo menos 2 opções
- Slug gerado não pode colidir com campos fixos de `contacts` (blacklist: `nome, email, telefone, cpf, ...`)

## Seções adicionais na aba Geral
Além de Campos Personalizados, a aba Geral também mostra:
- Página inicial default (select: Dashboard/Contatos/Board/...)
- Fuso horário
- Tags / Etiquetas → botão "Gerenciar →" que navega para `/settings?tab=geral#tags` ou abre sub-página

## Critérios de Aceite
- [ ] Listagem mostra campos reais do Supabase
- [ ] Criar campo funciona (slug correto)
- [ ] Editar campo funciona
- [ ] Deletar com confirmação funciona
- [ ] Validações bloqueiam criação inválida
- [ ] Tipo "Seleção" renderiza editor de opções no dialog
- [ ] Seção Página Inicial + Fuso salvos em `user_settings` ou `profiles`
- [ ] Toasts em PT
- [ ] Build passa

## Verificação
Criar 4 campos (um de cada tipo) → verificar no Supabase → editar um → excluir outro.
