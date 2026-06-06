# RAQ-MAND-EM054 — Construtor de Formulários Web · Go-live + Testes Manuais

> Branch: `rodrigo/feature/RAQ-MAND-EM054-criacao-de-formularios-web-formularios`
> Versão aprovada: **B (Studio Pro)**. Cadeia `/qg-manual` completa (Security + Pentest + Code Review aplicados).

---

## 1. PASSOS DE GO-LIVE (ordem obrigatória)

### 1.1. Aplicar as migrations (banco)
```bash
npx supabase db query --linked --file "RODRIGO/1.FAZER/114_em054_formularios.sql"
npx supabase db query --linked --file "RODRIGO/1.FAZER/115_em054_formularios_rbac.sql"
npx supabase db query --linked --file "RODRIGO/1.FAZER/116_em054_formularios_rpc_publico.sql"
```
Depois, mover os 3 arquivos de `RODRIGO/1.FAZER/` para `RODRIGO/3.FEITO/`.

### 1.2. Regenerar os tipos (remove o `sbForms` / casts EM054)
```bash
npx supabase gen types typescript --linked > src/integrations/supabase/types.ts
```
> Opcional agora: os hooks usam `sbForms` (cast) até isso. Funciona sem regenerar, mas o ideal é regenerar e depois trocar `sbForms` por `supabase` tipado em `src/hooks/useFormularios.ts` (marcado com `// EM054`).

### 1.3. Deploy da Edge Function pública
```bash
npx supabase functions deploy formularios-public-submit
```

### 1.4. Configurar secrets da Edge Function (Dashboard > Edge Functions > Secrets)
| Secret | Obrigatório | Observação |
|---|---|---|
| `SUPABASE_URL` | já existe | — |
| `SUPABASE_SERVICE_ROLE_KEY` | já existe | — |
| `FORM_RATE_SALT` | **recomendado** | salt do hash de IP (LGPD). Sem ele usa fallback inseguro `em054` e loga warning. |
| `TURNSTILE_SECRET` | **recomendado p/ link público em massa** | Cloudflare Turnstile. Sem ele o captcha fica **desativado**. |

### 1.5. (Opcional, captcha no front) configurar no `.env`
- `VITE_TURNSTILE_SITE_KEY` — site key do Turnstile. Sem ela o widget não aparece e o envio funciona sem captcha.

### 1.6. Deploy do frontend
```bash
npm run deploy   # build + wrangler (Cloudflare Pages)
```

---

## 2. ROTEIRO DE TESTE MANUAL (E2E)

### A. RBAC / acesso
- [ ] Login **admin** → aba "Formulários" aparece na sidebar.
- [ ] Login **assessor** → vê a aba, consegue criar/editar, **não** vê "Excluir" (sem `pode_deletar`).
- [ ] Login **assistente** → vê a aba só leitura (sem criar/editar/excluir).
- [ ] Login **estagiário (Agente de Relacionamento)** → **não** vê a aba.
- [ ] Em Configurações > Permissões, a seção **Formulários** aparece na matriz com criar/editar/excluir.

### B. CRUD de formulário
- [ ] Criar formulário (botão "Novo formulário" → título) → navega pro editor.
- [ ] Editar título inline → indicador "salvo" aparece (autosave).
- [ ] Duplicar formulário na lista → cria cópia "-copia" em rascunho.
- [ ] Excluir formulário (AlertDialog confirma) → some da lista.
- [ ] Seleção múltipla → exclusão em massa (admin/proprietário).
- [ ] Filtros: Ativos / Agendados / Encerrados / Rascunhos / Todos mostram contagem certa.

### C. Builder (Studio 3 painéis)
- [ ] Adicionar campo de cada tipo pela paleta (texto, parágrafo, telefone, email, CPF, escolha única, caixas, lista, data, imagem, seção).
- [ ] Selecionar campo → editar no inspetor (rótulo, ajuda, obrigatório, min/max chars, validar formato, largura).
- [ ] Editar opções de um campo de escolha (adicionar/renomear/remover opção).
- [ ] Reordenar campos (subir/descer).
- [ ] Excluir campo.
- [ ] Upload de imagem de capa (só JPEG/PNG/WebP/GIF até 5MB) → preview atualiza.
- [ ] Trocar cor do tema → preview ao vivo muda (sem flood de requests).

### D. Mapeamento & Automações
- [ ] Mapear "Nome completo" → `nome` + `whatsapp` (2 destinos).
- [ ] Definir etiquetas automáticas (multiselect das tags existentes).
- [ ] Definir coluna do funil (mover_stage_id).
- [ ] Definir pontos de ranking.
- [ ] Marcar situação (declarou_voto / favorito / multiplicador). **Nota:** opt-in/aceita WhatsApp NÃO estão disponíveis aqui (proteção LGPD — correto).
- [ ] Configurar dedup (campo whatsapp/cpf/nenhum + ação mesclar/criar/ignorar).

### E. Publicação + datas
- [ ] Aba Pública: link `/f/<slug>` + QR + copiar.
- [ ] Definir abre_em (futuro) → publicar → status fica **Agendado**.
- [ ] Definir encerra_em → publicar → status **Ativo**.
- [ ] Esperar o cron (5 min) OU verificar: após `encerra_em`, status vira **Encerrado** automaticamente.

### F. Página pública (anônima — testar deslogado / aba anônima)
- [ ] Abrir `/f/<slug>` de um form ativo → renderiza com tema/cores.
- [ ] Validação: enviar vazio → erros inline nos obrigatórios.
- [ ] Limite de caracteres respeitado.
- [ ] Enviar válido → **tela de agradecimento**.
- [ ] Conferir no CRM: contato criado com nome/whatsapp, etiquetas aplicadas, no funil certo, ranking somado, situação marcada.
- [ ] Reenviar com **mesmo whatsapp** → dedup: modo "mesclar" só preenche campos vazios (não sobrescreve dados existentes); "ignorar" não duplica; "criar" duplica.
- [ ] Abrir `/f/<slug>` de form **encerrado** → tela "Formulário encerrado".
- [ ] Abrir `/f/<slug>` de form **agendado** (não iniciado) → tela "ainda não disponível".
- [ ] Slug inexistente → tela 404 amigável.
- [ ] **Isolamento (crítico):** na aba anônima, confirmar no DevTools/Network que nenhuma chamada retorna dados do CRM (contatos/etiquetas internas/mapeamento). Só o shape público do form.

### G. Métricas
- [ ] Aba Métricas: preenchimentos, visitas, conversão, "encerra em" + gráfico de 7 dias batem com a realidade.
- [ ] Cada acesso à página pública incrementa "visitas".

### H. Robustez (volume)
- [ ] Simular vários envios seguidos do mesmo IP → após 5 em 10 min, retorna "muitas tentativas" (rate-limit).
- [ ] (Carga) lote de centenas/milhares de envios não trava nem duplica contatos indevidamente.

---

## 3. ITENS DE HARDENING / FOLLOW-UP (não bloqueiam, mas recomendados antes de divulgar o link em massa)

- **Captcha em produção:** configurar `TURNSTILE_SECRET` + `VITE_TURNSTILE_SITE_KEY`. Sem captcha, o link público fica sujeito a flood de contatos falsos.
- **`FORM_RATE_SALT`:** configurar (senão usa fallback inseguro `em054`).
- **Rate-limit por IP:** depende de `cf-connecting-ip`/`x-forwarded-for`. O proxy Cloudflare na frente do app injeta `cf-connecting-ip` confiável. Validar em produção que o IP chega correto na EF.
- **Image tracker (BAIXO):** `capa_url`/imagem aceitam URL externa — um editor poderia apontar pra servidor de tracking. Hoje o upload usa o bucket próprio; decidir se quer travar URLs externas.
- **Métrica "preenchimentos":** hoje conta todas as respostas (incl. status='erro', raras). Se quiser só `processado`, ajustar a contagem em `useFormularios`.

---

## 4. RESULTADO DA CADEIA QG (resumo)
- **Security:** 1 CRÍTICO (optin LGPD) — **corrigido**; 5 médios (corrigidos/documentados); 2 baixos (documentados).
- **Pentest:** 0 críticos; 2 altos (dedup hijack + SVG XSS) — **corrigidos**; médios (rate-limit/captcha) viram config de deploy.
- **Code Review:** 5 must-fix — **todos corrigidos**; nits aplicados. Build + typecheck + lint limpos.
