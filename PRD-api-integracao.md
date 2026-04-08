# PRD — API de Integracao Externa (Token + Edge Function)

**Data**: 2026-04-08
**Projeto**: Mandato Desk 2026
**P.O.**: Claude (assistido por Rodrigo)

---

## Problema

A pagina de API do sistema exibe documentacao com exemplos curl que **nao funcionam**. O sistema mostra:

```
-H "apikey: SEU_TOKEN"
-H "Authorization: Bearer SEU_TOKEN"
```

Porem:
1. O usuario so ve **um unico token** ("Token de Acesso") na pagina — nao sabe onde colocar cada um
2. O token gerado e um token **customizado**, nao e um JWT do Supabase — entao usar como `Authorization: Bearer` no REST direto do Supabase **nao funciona**
3. Nao existia um **backend** (Edge Function) que validasse esse token e executasse as operacoes

**Resultado**: O usuario gera o token, copia o curl, tenta enviar e recebe erro 401. A API e **decorativa** — existe na interface mas nao funciona.

## Personas

### Administrador do Gabinete (Rodrigo)
- Precisa integrar o CRM com ferramentas externas (GPTMaker, n8n, Postman)
- Quer enviar contatos por API de sistemas terceiros (chatbots, formularios)
- Conhece conceitos de API mas nao e desenvolvedor — depende de documentacao clara

### Operador de Integracao (equipe tecnica/chatbot)
- Sistema externo que envia requisicoes HTTP automatizadas
- Precisa de endpoint estavel, autenticacao simples (1 token), respostas JSON claras

## User Stories

### US-01: Criar contato via API externa

**Como** administrador do gabinete,
**Quero** enviar uma requisicao HTTP para criar um contato no CRM,
**Para** integrar chatbots e formularios externos sem entrar no sistema manualmente.

**Criterios de Aceite:**
- [x] Existe um endpoint POST que aceita JSON com dados do contato
- [x] O endpoint valida o token antes de executar
- [x] O contato aparece na listagem do sistema apos a requisicao
- [x] Token invalido retorna 401 com mensagem clara
- [x] Campo obrigatorio ausente (name) retorna 400 com mensagem clara

**Regras de Negocio:**
- Apenas o campo `name` e obrigatorio
- O `created_by` e preenchido automaticamente com o user_id do dono do token
- Colunas protegidas (id, created_at, merged_into, etc.) nao podem ser setadas via API

**Prioridade:** Must Have

---

### US-02: Autenticacao simples com 1 token

**Como** administrador,
**Quero** usar apenas 1 token para autenticar na API,
**Para** nao ter que lidar com apikey + Bearer separados (confuso).

**Criterios de Aceite:**
- [x] A documentacao mostra apenas 1 header: `Authorization: Bearer <token>`
- [x] Nao existe mais referencia a `apikey` na documentacao
- [x] O token gerado na pagina e o mesmo usado no header
- [x] A secao "Como Usar" explica claramente o que copiar e onde colocar

**Regras de Negocio:**
- O token e validado contra a tabela `api_tokens` (nao e JWT Supabase)
- Cada usuario pode ter 1 token ativo por vez

**Prioridade:** Must Have

---

### US-03: Documentacao com exemplos copiaveis e funcionais

**Como** administrador,
**Quero** copiar o curl da documentacao e colar no terminal/Postman e funcionar de primeira,
**Para** nao perder tempo debugando headers e URLs erradas.

**Criterios de Aceite:**
- [x] Cada endpoint tem um curl completo com o token real do usuario (nao "SEU_TOKEN")
- [x] Endpoints de POST/PATCH incluem body de exemplo no curl
- [x] Existe botao de copiar que copia o curl completo com token
- [x] A URL base aponta para o Edge Function correto (nao para /rest/v1/)

**Regras de Negocio:**
- Se o usuario nao tem token gerado, mostrar "SEU_TOKEN" como placeholder
- Se tem token, substituir automaticamente nos exemplos

**Prioridade:** Must Have

---

### US-04: Listar contatos via API

**Como** operador de integracao,
**Quero** buscar a lista de contatos via GET,
**Para** sincronizar dados entre o CRM e sistemas externos.

**Criterios de Aceite:**
- [x] GET /contacts retorna lista paginada com total
- [x] Aceita ?limit, ?offset para paginacao
- [x] Aceita ?search para busca textual (nome, telefone, email)
- [x] Aceita ?order para ordenacao (ex: name.asc)
- [x] Retorna apenas contatos do usuario dono do token

**Prioridade:** Must Have

---

### US-05: Atualizar e excluir contatos via API

**Como** operador de integracao,
**Quero** atualizar e excluir contatos via PATCH e DELETE,
**Para** manter os dados sincronizados bidireccionalmente.

**Criterios de Aceite:**
- [x] PATCH /contacts/{id} atualiza campos enviados
- [x] DELETE /contacts/{id} exclui o contato
- [x] Nao permite alterar/excluir contatos de outros usuarios
- [x] Retorna 404 se o contato nao existe ou nao pertence ao usuario

**Prioridade:** Must Have

---

### US-06: CRUD de demandas e etiquetas via API

**Como** operador de integracao,
**Quero** criar/listar/atualizar/excluir demandas e etiquetas via API,
**Para** ter integracao completa com todas as entidades do CRM.

**Criterios de Aceite:**
- [x] Mesma estrutura de rotas: /demands e /tags
- [x] Mesma autenticacao por token
- [x] Campos obrigatorios: demands(title), tags(name, category)
- [x] Mesmos codigos de resposta (201, 400, 401, 404)

**Prioridade:** Should Have

---

### US-07: Tabela de campos aceitos na documentacao

**Como** administrador,
**Quero** ver uma tabela com todos os campos que posso enviar para cada recurso,
**Para** saber exatamente o que a API aceita sem ter que adivinhar.

**Criterios de Aceite:**
- [x] Tabela com: nome do campo, tipo, obrigatorio/opcional, descricao
- [x] Pelo menos para contatos (recurso principal)
- [x] Codigos de resposta HTTP documentados

**Prioridade:** Should Have

---

### US-08: Rastreamento de uso do token (last_used_at)

**Como** administrador,
**Quero** ver quando meu token foi usado pela ultima vez,
**Para** saber se a integracao esta funcionando e detectar uso indevido.

**Criterios de Aceite:**
- [x] Campo `last_used_at` atualizado a cada requisicao
- [x] Exibido na pagina de API abaixo do token
- [x] Formato: data e hora em pt-BR

**Prioridade:** Could Have

---

### US-09: Filtros avancados na listagem (PostgREST-style)

**Como** operador de integracao,
**Quero** filtrar contatos por coluna especifica (ex: ?city=eq.Sao Paulo),
**Para** buscar apenas os registros que preciso sem trazer a lista toda.

**Criterios de Aceite:**
- [x] Aceita filtros no formato ?coluna=operador.valor
- [x] Operadores: eq, neq, gt, gte, lt, lte, ilike, is
- [x] Apenas colunas permitidas (whitelist)

**Prioridade:** Could Have

---

## Priorizacao

| Story | Titulo | Prioridade | Status |
|-------|--------|-----------|--------|
| US-01 | Criar contato via API | **Must Have** | Implementado |
| US-02 | Autenticacao simples com 1 token | **Must Have** | Implementado |
| US-03 | Documentacao copiavel e funcional | **Must Have** | Implementado |
| US-04 | Listar contatos via API | **Must Have** | Implementado |
| US-05 | Atualizar e excluir contatos | **Must Have** | Implementado |
| US-06 | CRUD de demandas e etiquetas | Should Have | Implementado |
| US-07 | Tabela de campos aceitos | Should Have | Implementado |
| US-08 | Rastreamento last_used_at | Could Have | Implementado |
| US-09 | Filtros avancados | Could Have | Implementado |

## MVP (Escopo Minimo)

1. **US-02** — Autenticacao simples (Edge Function + validacao de token)
2. **US-01** — POST /contacts funcional
3. **US-04** — GET /contacts funcional
4. **US-05** — PATCH e DELETE /contacts funcional
5. **US-03** — Documentacao com curls corretos e copiaveis

## Implementacao Realizada

| Arquivo | Descricao | Status |
|---------|-----------|--------|
| `supabase/functions/api-proxy/index.ts` | Edge Function com CRUD completo | Deployed |
| `supabase/migrations/006_api_tokens_last_used_at.sql` | Coluna last_used_at | Aplicado |
| `src/pages/Api.tsx` | Documentacao atualizada | Commitado |

**URL da API:** `https://nevgnvrwqaoztefnyqdj.supabase.co/functions/v1/api-proxy`

**Pendente:** Deploy do frontend para que o usuario veja a documentacao atualizada.

## Riscos e Decisoes

| Risco/Decisao | Impacto | Responsavel | Status |
|--------------|---------|-------------|--------|
| Frontend precisa de deploy para usuario ver mudancas | Alto | Rodrigo | Pendente |
| Edge Function sem rate limiting — abuso possivel | Medio | Dev | Aceito (v1) |
| Service role bypassa RLS — filtragem por created_by e manual | Alto | Dev | Mitigado |
| Token nao expira automaticamente | Baixo | P.O. | Aceito |

## Metricas de Sucesso

- Usuario consegue criar contato via curl copiado da pagina em < 1 minuto
- Zero confusao sobre qual token usar e onde colocar (1 token, 1 header)
- Requisicoes com token invalido retornam 401 (nao 500)
- `last_used_at` atualiza corretamente a cada uso
