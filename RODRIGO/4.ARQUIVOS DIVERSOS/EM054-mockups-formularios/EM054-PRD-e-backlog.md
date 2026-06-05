# RAQ-MAND-EM054 — Construtor de Formulários Web

> PRD + Arquitetura + Backlog atomizado. Versão aprovada: **B (Studio Pro)**.
> Branch: `rodrigo/feature/RAQ-MAND-EM054-criacao-de-formularios-web-formularios`

---

## 1. Visão / Job-to-be-done

A equipe do mandato precisa criar formulários públicos (estilo Google Forms) compartilháveis por
link/QR, cujas respostas viram **contatos no CRM** automaticamente — com etiquetas, posição no
funil, pontuação de ranking, marcação de situação e mapeamento campo→contato — suportando picos
de **3.000–4.000 envios**, com **isolamento total de segurança** (a página pública não acessa
nenhum dado do CRM) e **fechamento automático por data/hora**.

**Persona:** assessor/proprietário do mandato (cria/gerencia). Contato/eleitor (preenche, sem login).

---

## 2. Decisões de arquitetura (segurança no centro)

### 2.1. Isolamento da página pública (CRÍTICO)
- A página pública **não tem acesso direto a nenhuma tabela** (anon role sem grants).
- Todo acesso público passa por **2 Edge Functions com `service_role`** (`verify_jwt = false`):
  - `formularios-public-get` — retorna **apenas o shape seguro** do formulário (título, descrição,
    capa, tema, campos visíveis com rótulo/opções/validação). **NUNCA** retorna mapeamento,
    automações, `created_by`, respostas ou config interna. Checa janela de atividade em tempo real.
  - `formularios-public-submit` — recebe a resposta, valida, rate-limit + captcha, faz dedup/merge,
    cria contato, aplica automações e grava resposta. Tudo server-side com service_role.
- Tabelas (`formularios`, `formulario_campos`, `formulario_respostas`) têm RLS **só para
  `authenticated`** via `has_permission(auth.uid(),'formularios',acao)`. **Sem policy `anon`.**

### 2.2. Robustez para 3.000–4.000 envios
- Submit é leve e idempotente. Dedup por `whatsapp`/`cpf` com upsert concorrência-safe.
- Rate-limit por IP (hash) + captcha (hCaptcha/Cloudflare Turnstile token verificado server-side).
- Índices em `formulario_respostas(form_id, created_at)` e dedup key em contatos.
- Métricas de visita por contador incremental via RPC (sem race).

### 2.3. Fechamento automático
- Colunas `abre_em` / `encerra_em` (timestamptz, nullable).
- `formularios-public-get` checa janela em tempo real → fora da janela responde `encerrado`.
- **pg_cron** job a cada 5 min marca `status='encerrado'` em forms vencidos (consistência da lista).

### 2.4. RBAC (matriz de permissão) — molde EM085 `demandas_colunas`
- Nova seção `formularios` em `permissoes_perfil` (criar/editar/excluir/ver/deletar_em_massa).
- Wiring: `SECOES`, `SECAO_LABELS`, `usePermissions.tsx`, `usePermissoesAdmin.ts`, tela `Permissoes.tsx`.

---

## 3. Modelo de dados

### `formularios`
| coluna | tipo | nota |
|---|---|---|
| id | uuid pk | |
| titulo | text not null | |
| slug | text unique not null | URL pública `/f/:slug` |
| descricao | text | |
| capa_url | text | imagem de capa (bucket público) |
| status | text default 'rascunho' | rascunho \| agendado \| ativo \| encerrado |
| publicado | boolean default false | |
| abre_em | timestamptz | |
| encerra_em | timestamptz | |
| tema | jsonb | {cor, cantos, fundo, mostrar_logo} |
| agradecimento | jsonb | {titulo, mensagem} |
| dedup_campo | text default 'whatsapp' | whatsapp \| cpf \| nenhum |
| dedup_acao | text default 'mesclar' | mesclar \| criar \| ignorar |
| aplicar_etiquetas | uuid[] default '{}' | tag ids |
| mover_stage_id | uuid | board_stages.id (funil) |
| ranking_pontos | int default 0 | pontos base no envio |
| marcar_situacao | jsonb default '{}' | {declarou_voto:true,...} |
| origem | text | origem do contato |
| max_respostas | int | limite opcional |
| total_visitas | int default 0 | contador (RPC) |
| created_by | uuid | |
| created_at / updated_at | timestamptz | |

### `formulario_campos`
| coluna | tipo | nota |
|---|---|---|
| id | uuid pk | |
| form_id | uuid fk → formularios (on delete cascade) | |
| ordem | int | |
| tipo | text | texto_curto, paragrafo, telefone, email, cpf, escolha_unica, checkboxes, lista, data, imagem, secao |
| rotulo | text | |
| ajuda | text | |
| obrigatorio | boolean default false | |
| min_chars / max_chars | int | |
| validar_formato | boolean default true | |
| opcoes | jsonb default '[]' | [{label, valor, ranking_pontos?}] |
| mapear_destino_1 | text | campo do contato (nome, whatsapp, telefone, email, cpf, bairro, profissao, observacoes, ...) |
| mapear_destino_2 | text | segundo destino opcional |
| largura | text default '100' | 100 \| 50 |
| config | jsonb default '{}' | extra |

### `formulario_respostas`
| coluna | tipo | nota |
|---|---|---|
| id | uuid pk | |
| form_id | uuid fk → formularios (on delete cascade) | |
| contact_id | uuid fk → contacts (set null) | contato criado/mesclado |
| dados | jsonb | respostas cruas {campo_id: valor} |
| ip_hash | text | rate-limit/audit (hash, sem IP cru) |
| user_agent | text | |
| status | text default 'processado' | processado \| erro |
| erro | text | |
| created_at | timestamptz | |

### Storage
- Bucket **`formularios`** (público p/ leitura de capas e imagens do form). Upload só por authenticated.

### Funções/cron
- `formulario_incrementar_visita(slug)` — SECURITY DEFINER, incrementa `total_visitas`.
- `formularios_fechar_vencidos()` + pg_cron 5min — `status='encerrado'` onde `encerra_em < now()`.
- RLS via `has_permission` (já existe).

---

## 4. Backlog atomizado (ondas)

### ONDA 1 — Fundação: schema + RBAC  `[model-writer]`
- **T1.1** Migration `114_em054_formularios.sql`: 3 tabelas + índices + FKs + RLS (authenticated/has_permission) + bucket `formularios` + policies storage + RPC visita + função fechar_vencidos + pg_cron.
- **T1.2** Migration `115_em054_formularios_rbac.sql`: INSERT `permissoes_perfil` seção `formularios` (5 roles).
- **T1.3** RBAC frontend: `SECOES`+`SECAO_LABELS` (permissions.ts), `usePermissions.tsx` (5 métodos), `usePermissoesAdmin.ts` (defaults).

### ONDA 2 — Backend público  `[route-writer / integration-writer]`
- **T2.1** EF `formularios-public-get` (anon, shape seguro + janela + incrementa visita).
- **T2.2** EF `formularios-public-submit` (anon, validação + rate-limit + captcha + dedup/merge contato + automações + grava resposta).
- **T2.3** `_shared` helpers: validação de campo, dedup, aplicar automações (tags/stage/ranking/situacao).

### ONDA 3 — CRM: gestão + builder  `[hook-writer + component-writer]`
- **T3.1** Rota `/formularios` + item sidebar (gated `can.viewFormularios`) + `SECAO_TO_PERMISSION`.
- **T3.2** Hooks: `useFormularios` (list+CRUD), `useFormulario(id)` (+ campos), `useFormularioMetrics`.
- **T3.3** `FormulariosPage` — lista (cards ativos/agendados/encerrados, métricas, janela, filtros) + CRUD (criar/duplicar/excluir) gated por RBAC.
- **T3.4** `FormBuilderStudio` (3 painéis: paleta + preview ao vivo + inspetor) com CRUD de campos.
- **T3.5** `MappingPanel` (campos→contato + automações) e `PublishPanel` (link/QR, datas, segurança).
- **T3.6** `MetricsPanel` (KPIs + gráfico).

### ONDA 4 — Página pública  `[route-writer + component-writer]`
- **T4.1** Rota pública `/f/:slug` (sem ProtectedRoute) → `PublicFormPage`.
- **T4.2** Render temático dos campos + validação client + submit via EF + captcha.
- **T4.3** Telas de agradecimento e "formulário encerrado".

### ONDA 5 — Qualidade  `[security + pentest + code-review + qa]`
- Security (OWASP/STRIDE, RLS, isolamento anon), Pentest (IDOR cross-form, bypass janela, flood, XSS no render de rótulos/opções), Code Review (8 ângulos), QA (critérios + edges + visual).

---

## 5. Critérios de aceite (resumo)
- [ ] Admin/proprietário cria, edita, exclui formulário (RBAC respeitado em UI **e** RLS).
- [ ] Assessor cria/edita conforme matriz; assistente/estagiário conforme configurado.
- [ ] Builder permite imagem, headline, texto e todos os tipos de campo.
- [ ] Mapeamento campo→contato (até 2 destinos) + etiquetas + funil + ranking + situação funcionam no envio.
- [ ] Link público + QR; página pública **não** expõe nenhum dado do CRM (verificado por pentest).
- [ ] Aceita alto volume (3–4 mil) sem travar; dedup correto.
- [ ] Data de abertura/encerramento com **fechamento automático** (cron + checagem em tempo real).
- [ ] Limite de caracteres por campo; validação de formato.
- [ ] Tela de agradecimento e tela de "encerrado".
- [ ] Métricas por formulário (preenchidos, visitas, conversão).
- [ ] Personalização de cores/estilo.
- [ ] CRUD completo (criar/editar/excluir) em formulários e campos.
