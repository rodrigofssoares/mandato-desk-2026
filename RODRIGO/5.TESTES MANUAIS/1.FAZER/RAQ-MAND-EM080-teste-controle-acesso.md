# Roteiro de Teste Manual E2E — RAQ-MAND-EM080 Controle de acesso WhatsApp

> Executar APOS aplicar a migration 111 no banco de producao.
> Prerequisito: ao menos 1 conta Z-API cadastrada com senha definida.
> Prerequisito: ao menos 1 usuario com role estagiario/assessor/assistente ativo.
> Prerequisito: ao menos 1 usuario com role proprietario ativo.

---

## Cenario 1 — Abas restritas (Agente de Relacionamento)

**Atores:** Conta admin + conta estagiario (Agente de Relacionamento)

**Passos:**
1. Logar como admin.
2. Ir em Configuracoes > Usuarios > encontrar o usuario estagiario.
3. Confirmar que o menu dropdown nao mostra abas de WhatsApp para esse user (so e na UI do WA).
4. Deslogar. Logar como estagiario.
5. Acessar WhatsApp no menu lateral.
6. Verificar: so a aba "Conversas" esta visivel. Nenhuma outra aba.
7. Na barra de endereco, acrescentar manualmente `?tab=contas`.
8. Verificar: URL volta automaticamente para `?tab=conversas`. Aba Contas nao aparece.
9. Tentar `?tab=webhooks`, `?tab=logs`, `?tab=auditoria`, `?tab=dashboard`.
10. Verificar: em todos os casos redireciona para Conversas.

**Resultado esperado:** Estagiario ve somente aba Conversas. URL manipulation nao funciona.

---

## Cenario 2 — Seletor de contas: restrito sem vinculo

**Passos:**
1. Logar como admin. Ir em Usuarios.
2. Garantir que o usuario estagiario NAO tem nenhuma conta WhatsApp vinculada (se tiver, desvincular primeiro via Vincular contas WhatsApp no dropdown do usuario).
3. Deslogar. Logar como estagiario.
4. Acessar WhatsApp > Conversas.
5. Verificar: aparece empty-state "Nenhuma conta de WhatsApp liberada para voce. Peca ao administrador...".
6. Verificar: nao aparece seletor de conta.

**Resultado esperado:** Empty-state amigavel com instrucao clara.

---

## Cenario 3 — Vincular conta e validar isolamento

**Passos:**
1. Logar como admin. Ir em Usuarios.
2. No card do usuario estagiario, clicar nos tres pontos > "Vincular contas WhatsApp".
3. Marcar apenas 1 conta (ex: "Conta A"). Fechar dialog.
4. Se houver uma segunda conta ("Conta B"), garantir que ela NAO esta marcada.
5. Deslogar. Logar como estagiario.
6. Acessar WhatsApp > Conversas.
7. Verificar: seletor de conta mostra APENAS "Conta A". "Conta B" nao aparece.
8. Verificar: opcao "Todos os numeros" NAO aparece.
9. Selecionar "Conta A". Informar a senha da conta (se configurada).
10. Verificar: conversas de "Conta A" carregam normalmente.
11. Tentar acessar diretamente via API REST (PostgREST):
    - GET `<SUPABASE_URL>/rest/v1/zapi_accounts` com o JWT do estagiario.
    - Verificar: so retorna "Conta A", nao "Conta B".
    - GET `<SUPABASE_URL>/rest/v1/zapi_chats?account_id=eq.<id_conta_B>` com JWT do estagiario.
    - Verificar: retorna 0 linhas (RLS bloqueia).

**Resultado esperado:** Isolamento de conta correto na UI e via API direta.

---

## Cenario 4 — CRUD de vinculos (vincular e desvincular)

**Passos:**
1. Logar como admin. Ir em Usuarios.
2. No card do estagiario, clicar "Vincular contas WhatsApp".
3. Marcar "Conta A" (vincular). Verificar toast de sucesso.
4. Desmarcar "Conta A" (desvincular). Verificar toast de sucesso.
5. Verificar que apos desvincular, se logar como estagiario:
   - Vai para WhatsApp > Conversas.
   - Ve empty-state (sem contas vinculadas).
6. Voltar como admin, vincular "Conta A" novamente.
7. Verificar que estagiario volta a ver "Conta A".

**Resultado esperado:** Vincular e desvincular funcionam. Estado reflete imediatamente (ou apos recarregar a aba).

---

## Cenario 5 — Isolamento entre dois agentes

**Prerequisito:** 2 usuarios com role estagiario (Agente1 e Agente2) e 2 contas WhatsApp (ContaX e ContaY).

**Passos:**
1. Como admin: vincular ContaX ao Agente1. Vincular ContaY ao Agente2.
2. Logar como Agente1.
3. WhatsApp > Conversas. Verificar: seletor tem apenas ContaX.
4. Digitar senha de ContaX (se configurada). Conversas de ContaX carregam.
5. Tentar GET direto em zapi_chats com account_id=ContaY via API REST. Verificar: 0 linhas.
6. Deslogar. Logar como Agente2.
7. WhatsApp > Conversas. Verificar: seletor tem apenas ContaY.
8. Digitar senha de ContaY. Conversas de ContaY carregam.

**Resultado esperado:** Agente1 nao ve ContaY; Agente2 nao ve ContaX. Isolamento total.

---

## Cenario 6 — Bypass de senha para admin (toggle desligado)

**Passos:**
1. Logar como admin.
2. Ir em WhatsApp > Contas.
3. Verificar que o toggle "Exigir senha de painel para Administradores e Proprietarios" esta DESLIGADO.
4. Ir para aba Conversas.
5. Selecionar qualquer conta Z-API.
6. Verificar: NAO aparece tela de senha. Conversas carregam diretamente.
7. Logar como proprietario (se disponivel).
8. Repetir passos 4-6. Resultado esperado identico.

**Resultado esperado:** Admin e proprietario entram sem senha quando toggle desligado.

---

## Cenario 7 — Toggle de senha para privilegiados (ligar)

**Passos:**
1. Logar como admin.
2. WhatsApp > Contas.
3. Ligar o toggle "Exigir senha de painel para Administradores e Proprietarios".
4. Verificar toast de sucesso.
5. Ir para aba Conversas.
6. Selecionar uma conta com senha definida.
7. Verificar: tela de senha aparece (cadeado).
8. Inserir a senha correta.
9. Verificar: conversas carregam.
10. Logar como proprietario (se disponivel). Repetir passos 5-9. Mesmo comportamento esperado.

**Resultado esperado:** Com toggle ligado, admin e proprietario tambem veem tela de senha.

---

## Cenario 8 — Toggle visivel somente para admin (nao para proprietario)

**Passos:**
1. Logar como proprietario.
2. WhatsApp > Contas.
3. Verificar: o card com toggle "Exigir senha..." NAO aparece na tela.
4. Verificar: o aviso "Apenas administradores podem gerenciar contas" aparece.
5. Tentar chamar diretamente a API REST para atualizar zapi_panel_settings.
6. Verificar: retorna erro de permissao (RLS bloqueia UPDATE para nao-admin).

**Resultado esperado:** Toggle nao exibido para proprietario. Operacao bloqueada no banco.

---

## Cenario 9 — Vincular contas WhatsApp: visivel somente para admin (regressao F01)

**Prerequisito:** Usuarios com roles admin, proprietario e assessor disponiveis.

**Passos:**
1. Logar como proprietario.
2. Ir em Usuarios.
3. Ver card de um assessor (cargo abaixo do proprietario).
4. Abrir dropdown do card.
5. Verificar: o item "Vincular contas WhatsApp" aparece ou nao?
   - **Comportamento atual (bug F01):** Aparece. Ao tentar usar, falha com toast de erro.
   - **Comportamento esperado (apos correcao):** Nao aparece para proprietario.
6. Logar como admin.
7. Ver card de um assessor. Dropdown.
8. Verificar: item "Vincular contas WhatsApp" APARECE e funciona corretamente.

**Resultado esperado (apos correcao de F01):** Somente admin ve o item de vinculo.
**Resultado atual:** Proprietario ve o item mas a acao falha no banco.

---

## Cenario 10 — Webhooks/Logs: nao acessiveis para assessor

**Passos:**
1. Logar como assessor.
2. Acessar WhatsApp.
3. Verificar: abas Webhooks e Logs NAO aparecem.
4. Tentar `?tab=webhooks` na URL.
5. Verificar: redireciona para Conversas.
6. Tentar GET direto em zapi_webhook_log via API REST com JWT do assessor.
7. Verificar: retorna 0 linhas (RLS admin-only).

**Resultado esperado:** Webhooks e Logs invisiveis e inacessiveis para assessor.

---

## Observacoes pós-execucao

Marcar cada cenario com PASSOU / FALHOU / PARCIAL e anotar evidencias (screenshots) em:
`RODRIGO/5.TESTES MANUAIS/3.FEITO/RAQ-MAND-EM080-teste-controle-acesso/screenshots/`
