# Relatório de QA — RAQ-MAND-EM094 · Duplicar Funil

**Data:** 2026-06-13
**Branch:** `task/raq-mand-em094`
**Projeto Supabase (app):** `nevgnvrwqaoztefnyqdj`

## Resumo

Feature de duplicação de funis (boards) entregue e validada em todas as camadas.

| Camada | Resultado |
|--------|-----------|
| TypeScript (`tsc --noEmit`) | ✅ PASS |
| ESLint (arquivos tocados) | ✅ PASS |
| Build de produção (`vite build`) | ✅ PASS |
| Code Review (8 dimensões) | ✅ APROVADO (zero must-fix) |
| Security (OWASP/STRIDE/RLS) | ✅ APROVADO (1 ALTO corrigido + hardening) |
| QA dados (RPC end-to-end) | ✅ PASS |
| QA visual (Playwright) | ✅ PASS |

## Critérios de aceite (todos atendidos)

1. ✅ **Botão "Duplicar funil"** em Configurações → Funis, em cada card (ícone de cópia entre Editar e Excluir).
2. ✅ **Permissão na matriz**: nova coluna "Duplicar" aparece especificamente na linha **Funil** da matriz de permissões (5 cargos). Default: admin, proprietário e assessor podem duplicar; assistente e estagiário não.
3. ✅ **Duplica estrutura completa**: estágios (nome/ordem/cor), templates de mensagem e checklist (itens + anexos). Verificado por contagem origem×cópia idênticas.
4. ✅ **Pergunta sobre contatos**: diálogo com switch "Copiar também os contatos" (default desligado).
   - Com contatos: 503 board_items copiados (board "Contatos Quentes").
   - Sem contatos: 0 board_items, mas templates (2) e checklist (3) copiados (board "Seguidores").
5. ✅ **Sufixo "(cópia)"** no nome do novo funil (`Seguidores (cópia)`), `is_default` nunca herdado.

## Testes de autorização (RPC `duplicate_board`)

| Cenário | Resultado |
|---------|-----------|
| Sem autenticação | ✅ Rejeitado — `Não autenticado` |
| Não-admin sem permissão (assistente) | ✅ Rejeitado — `Sem permissão para duplicar funis` |
| Usuário inativo (após hardening) | ✅ Bloqueado por `is_user_active` |
| Admin | ✅ Duplicação OK |

## Evidências (screenshots)

- `02-funis-lista.png` — lista de funis com botão Duplicar em cada card
- `03-dialog-duplicar.png` — diálogo de duplicação com switch de contatos
- `04-matriz-permissoes.png` — matriz completa
- `05-matriz-linha-funil.png` — linha Funil com a coluna Duplicar

## Notas operacionais

- **Migrations aplicadas em prod** (`nevgnvrwqaoztefnyqdj`): `121` (baseline) + `122` (hardening de segurança).
- **Conta de teste**: a senha de `admin@mandatodesk.com` foi alterada durante o QA e depois **rotacionada para um valor aleatório** (nos projetos app e QG). Se precisar usar essa conta, redefina via "Esqueci minha senha".
- **Observação de infra (não relacionada à feature)**: o dev server local herdou `VITE_SUPABASE_URL` do ambiente do watcher (apontando para o projeto QG `bjhwxafjhvnslfexnjvh`, que tem `user_profiles` em vez de `profiles`), causando `PGRST205` no login até reiniciar o Vite com o `.env` correto. Não afeta produção (que usa o build com o `.env` do projeto).
