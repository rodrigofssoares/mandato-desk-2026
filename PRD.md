# PRD — Correcao da Deteccao de Duplicatas

**Data**: 2026-04-08
**Projeto**: Mandato Desk 2026
**P.O.**: Claude (assistido por Rodrigo)

---

## Problema

O sistema de deteccao de duplicatas nao funciona corretamente. Tres bugs criticos:

1. **Selecao em cascata** — Ao clicar no checkbox de um contato, todos os contatos abaixo sao selecionados, mesmo que nao pertencam ao mesmo grupo de duplicatas
2. **Visualizacao incompleta** — Ao clicar "Ver detalhes", mostra apenas um contato isolado, sem contexto de quais sao os duplicados dele
3. **Agrupamento quebrado** — Os contatos nao estao sendo agrupados corretamente pelos valores iguais (whatsapp/email/nome)

**Causa raiz identificada**: O hook `useDuplicateGroups` tenta usar uma funcao RPC do banco (`get_duplicate_contacts()`) que esta com nomes de colunas em ingles (`phone`, `name`) enquanto a tabela real usa nomes em portugues (`whatsapp`, `nome`). Quando a RPC retorna dados, eles vem sem os campos completos (`nome`, `whatsapp`, etc ficam vazios) e com agrupamento incorreto, porque o RPC retorna pares (contact_id + duplicate_of) mas o codigo so adiciona um dos dois ao grupo.

## Personas

- **Assessor politico** — Gerencia a base de contatos do mandato, precisa limpar duplicatas importadas em massa

## User Stories

### US-01: Agrupamento correto de duplicatas

**Como** assessor,
**Quero** que o sistema agrupe corretamente contatos com whatsapp, email ou nome iguais,
**Para** identificar quais estao repetidos na base.

**Criterios de Aceite:**
- [ ] Contatos com mesmo whatsapp normalizado aparecem no mesmo grupo
- [ ] Contatos com mesmo email (case-insensitive) aparecem no mesmo grupo
- [ ] Contatos com mesmo nome (case-insensitive) aparecem no mesmo grupo
- [ ] Cada grupo mostra TODOS os contatos duplicados, nao apenas um
- [ ] Grupos sao mutuamente exclusivos (um contato nao aparece em dois grupos)
- [ ] O match_value exibido no grupo e o valor real (nao normalizado)

**Regras de Negocio:**
- Normalizacao de whatsapp: remover caracteres nao-numericos, remover prefixo "55" do Brasil
- Prioridade de agrupamento: whatsapp > email > nome (se ja agrupou por whatsapp, nao agrupa por email)
- Contatos com `merged_into` preenchido sao excluidos da busca

### US-02: Selecao individual de contatos

**Como** assessor,
**Quero** selecionar contatos individualmente dentro de cada grupo,
**Para** escolher quais quero excluir, comparar ou mesclar.

**Criterios de Aceite:**
- [ ] Clicar no checkbox seleciona APENAS aquele contato, nao os outros
- [ ] Posso selecionar ate 2 contatos por grupo para comparar/mesclar
- [ ] A selecao de um grupo nao afeta outros grupos
- [ ] Botoes "Comparar" e "Mesclar" habilitam quando 2 estao selecionados

### US-03: Exclusao individual de duplicata

**Como** assessor,
**Quero** excluir um contato especifico de um grupo de duplicatas,
**Para** remover manualmente o registro que considero incorreto.

**Criterios de Aceite:**
- [ ] Cada contato tem botao de lixeira
- [ ] Confirmacao antes de excluir
- [ ] Lista atualiza apos exclusao
- [ ] Se o grupo ficar com 1 contato, o grupo some

### US-04: Comparacao lado a lado

**Como** assessor,
**Quero** comparar 2 contatos lado a lado,
**Para** entender as diferencas antes de decidir qual manter.

**Criterios de Aceite:**
- [ ] Modal mostra todos os campos dos 2 contatos em colunas
- [ ] Campos com valores diferentes sao destacados
- [ ] Tags de cada contato sao exibidas com indicador de origem
- [ ] Botao "Ir para Mesclar" leva ao modal de merge

### US-05: Mesclagem com escolha do usuario

**Como** assessor,
**Quero** mesclar 2 contatos escolhendo campo a campo qual valor manter,
**Para** consolidar as informacoes no melhor registro possivel.

**Criterios de Aceite:**
- [ ] Usuario escolhe qual contato MANTER e qual EXCLUIR (nao e automatico)
- [ ] Para cada campo, usuario seleciona valor de A ou B
- [ ] Tags sao consolidadas com checkbox
- [ ] Demandas sao transferidas automaticamente
- [ ] Registro de merge e salvo em contact_merges

## Priorizacao

| US | Titulo | Prioridade |
|----|--------|-----------|
| US-01 | Agrupamento correto | Must Have |
| US-02 | Selecao individual | Must Have |
| US-03 | Exclusao individual | Must Have |
| US-04 | Comparacao lado a lado | Should Have |
| US-05 | Mesclagem com escolha | Should Have |

## MVP (Escopo Minimo)

1. US-01 — Corrigir agrupamento (remover RPC, usar apenas client-side)
2. US-02 — Corrigir selecao (isolar por grupo)
3. US-03 — Exclusao individual funcional

## Riscos e Decisoes

| Risco/Decisao | Impacto | Responsavel | Status |
|--------------|---------|-------------|--------|
| RPC `get_duplicate_contacts()` usa colunas erradas | Alto | Dev | Decidido: remover RPC, usar client-side |
| Performance client-side com muitos contatos | Medio | Dev | Mitigado: query leve so com campos necessarios |

## Metricas de Sucesso

- Duplicatas sao agrupadas corretamente ao abrir o dialog
- Selecao funciona isolada por grupo (clicar em um nao afeta outros)
- Exclusao individual remove o contato e atualiza a lista
- Comparacao e mesclagem funcionam end-to-end
