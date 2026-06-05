# Testes Manuais — RAQ-MAND-EM085 (Melhorias na aba de Demandas)

Branch: `rodrigo/feature/RAQ-MAND-EM085-melhorias-na-aba-de-demandas` · v2.15.0

## ⚠️ Pré-requisito (frentes 4 e 5)
Antes de testar colunas/permissões, **aplicar a migration** e regenerar os tipos:
```bash
npx supabase db query --linked --file "RODRIGO/1.FAZER/113_em085_demand_columns.sql"
npx supabase gen types typescript --linked > src/integrations/supabase/types.ts
```
As frentes **1, 2 e 3** funcionam **sem** a migration.

---

## F1 — Responsável automático
1. Aba Demandas → "Nova Demanda". Preencher só o título → Criar.
2. ✅ Abrir a demanda criada: campo **Responsável** = seu usuário (logado).
3. Editar e trocar o responsável manualmente → deve respeitar a troca.

## F2 — Seletor de contato buscável + card (Variante A)
1. "Nova Demanda" → campo **Contato** → clicar em "Buscar contato…".
2. Buscar por **nome** parcial → resultados aparecem (barra fixa no topo).
3. Buscar por **CPF** (com ou sem pontos) → encontra.
4. Buscar por **telefone** (dígitos) → encontra.
5. Selecionar → aparece o **card compacto**: avatar, nome, telefone, etiquetas.
6. Botão **WhatsApp** (verde) → abre a conversa interna do contato.
7. Botão **Ver no CRM** → abre a ficha do contato.
8. Botão **X** → remove o contato selecionado e volta pra busca.

## F3 — Nova demanda dentro do WhatsApp/Conversas
1. Abrir WhatsApp → Conversas → selecionar uma conversa com **contato no CRM**.
2. No painel direito (seção "Demanda vinculada") → botão **"Nova demanda"**.
3. Criar: o contato já vem **travado** (sem busca, mostrando o card).
4. ✅ Responsável = usuário logado; contato = o da conversa.
5. ✅ Após criar, a demanda fica **vinculada ao chat** (aparece como "Demanda vinculada").
6. Conferir na aba Demandas que a demanda existe com o contato certo.

## F4 — Colunas configuráveis (requer migration)
1. Aba Demandas → botão **"Gerenciar colunas"** (visível p/ admin/proprietário).
2. As 3 colunas iniciais aparecem (Aberta / Em Andamento / Resolvida) com as demandas migradas.
3. **Adicionar** coluna nova (ex: "Aguardando retorno") → aparece no kanban.
4. **Renomear** (lápis) e **mudar cor** (bolinha) → reflete no kanban.
5. **Reordenar** (arrastar pela alça) → ordem persiste.
6. **Excluir** coluna vazia → ok. Excluir coluna com demandas → **bloqueado** com aviso.
7. No kanban, **arrastar** uma demanda entre colunas → posição (stage) atualiza.
8. "Nova Demanda" → campo **Coluna** (no lugar de Status) lista as colunas; default = primeira.

## F5 — Permissões de colunas (requer migration)
1. Configurações → Permissões → procurar a seção **"Colunas de Demandas"**.
2. Marcar/desmarcar criar/editar/excluir por cargo.
3. Logar (ou impersonar) com um cargo **sem** permissão de gerenciar colunas:
   - ✅ Não vê o botão "Gerenciar colunas".
   - ✅ Continua vendo o kanban e podendo arrastar demandas (isso é `demandas`,`editar`).
4. Cargo com permissão parcial (só editar, sem excluir) → vê renomear/cor mas não a lixeira.

## Regressão — Funil de contatos (RLS compartilhada)
1. Abrir o **Funil** (board de contatos) normalmente.
2. ✅ Criar/editar/reordenar/excluir colunas do Funil continua funcionando igual.
3. ✅ Mover contatos entre etapas do Funil continua funcionando.
   (A migration 113 reescreveu as policies de boards/board_stages preservando o comportamento não-demanda.)

---

## Follow-ups conhecidos (não bloqueiam)
- **MÉDIO-01 (Security, pré-existente):** EF `zapi-chat-update` não valida existência do `demand_id`. Caminhos do EM085 sempre passam id real; hardening opcional via redeploy da EF.
- **MÉDIO-02:** `useDeleteDemandColumn` faz count+delete não-atômico; o FK `ON DELETE SET NULL` garante que nenhuma demanda se perde numa corrida (check é só UX).
- Pós-migration: remover os casts `as never` / `sbUntyped` (marcados com EM085) após regenerar `types.ts`.
