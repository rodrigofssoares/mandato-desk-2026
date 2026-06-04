# RAQ-MAND-EM080 — Controle de acesso no WhatsApp

> Refinamento PO (DoR atendida). Decisões de arquitetura confirmadas com Rodrigo em 2026-06-03.
> Branch: `rodrigo/feature/RAQ-MAND-EM080-controle-de-acesso-no-whatsapp-whatsapp` (base `master`).

## Contexto / Problema
Hoje, no módulo WhatsApp:
- A aba **Conversas** mostra **todas** as contas Z-API pra qualquer usuário com acesso à seção `whatsapp` (`useZapiAccounts` faz `SELECT` sem filtro por usuário; RLS de `zapi_accounts` = `auth.uid() IS NOT NULL`).
- As abas de gestão (Contas, Webhooks, Logs) aparecem pra **qualquer** usuário com acesso (só Dashboard/Auditoria são admin-only). Um Agente de Relacionamento vê tudo isso.
- A senha de painel (EM078) só dá **bypass pro `admin`** — `proprietario` é tratado como restrito e precisa digitar senha.
- Não existe vínculo conta↔usuário: não dá pra dizer "Maria só enxerga a conta do Agente 1".

## Decisões confirmadas (Rodrigo)
1. **Cargos privilegiados** = `admin` + `proprietario`. **Restritos** = `assessor` + `assistente` + `estagiario` (Agente de Relacionamento).
2. **Senha de painel para privilegiado**: por **padrão NÃO exige** (acesso direto). Toggle global permite passar a exigir senha também deles.

## Modelo de acesso (alvo)
| Aspecto | Privilegiado (admin/proprietário) | Restrito (assessor/assistente/agente) |
|---|---|---|
| Abas WhatsApp | Conversas + Contas + Campanhas + Eventos (+ Dashboard/Auditoria/Webhooks/Logs = **admin-only**) | **Somente Conversas** |
| Contas visíveis nas conversas | Todas | **Somente as vinculadas a ele** |
| Senha de painel | Não exige por padrão (toggle global pra exigir) | **Sempre obrigatória** |
| Gerenciar vínculos/senhas | Sim (admin) | Não |

## Regras-chave (enforcement REAL no banco, não só UI — lição EM078)
- **Helper SQL novo** `is_zapi_privileged(_uid)` SECURITY DEFINER STABLE → `EXISTS(profiles WHERE id=_uid AND role IN ('admin','proprietario') AND status_aprovacao='ATIVO')`. **NÃO usar `has_role(uid,'proprietario')`** — bug conhecido (`001_complete_schema.sql:63-82` retorna true pra qualquer ativo quando role≠admin).
- **Vínculo** `zapi_account_users(account_id, user_id)` N:N. Restrito só enxerga contas vinculadas; privilegiado vê todas.
- **Senha controla LEITURA das conversas; vínculo controla VISIBILIDADE da conta.** Combinados: Maria só vê a conta do Agente 1 no seletor E precisa da senha dela pra ler os chats. Mesmo sabendo a senha de outra conta, ela não a enxerga (e a EF de validação recusa grant sem vínculo — defesa em profundidade).
- **Toggle global** `require_password_for_privileged` (default `false`). Quando `true`, até admin/proprietário precisam de grant (senha).

## Critérios de aceite
- [ ] Agente de Relacionamento (estagiário) ao abrir WhatsApp vê **apenas a aba Conversas** — sem Contas, Dashboard, Auditoria, Webhooks, Logs, Campanhas, Eventos.
- [ ] Assessor e Assistente idem (só Conversas).
- [ ] No seletor de contas das Conversas, um restrito vê **apenas as contas vinculadas** a ele. Conta não vinculada não aparece — nem na lista nem via API direta (RLS).
- [ ] Admin e Proprietário veem **todas** as contas e as abas de gestão (Contas/Campanhas/Eventos). Dashboard/Auditoria/Webhooks/Logs seguem admin-only.
- [ ] Admin gerencia vínculos conta↔usuário **na área de Equipe (Usuários)** — não na matriz de Permissões. CRUD completo (vincular + desvincular).
- [ ] Por padrão, Admin/Proprietário entram nas conversas **sem digitar senha**. Restritos **sempre** digitam senha (EM078).
- [ ] Existe um **toggle global** "Exigir senha de painel para Administradores e Proprietários" (admin-only). Ligado → admin/proprietário também passam a digitar senha.
- [ ] Restrito sem nenhuma conta vinculada vê empty-state amigável ("Nenhuma conta de WhatsApp liberada para você. Peça ao administrador.").
- [ ] Webhooks/Logs deixam de ficar visíveis pra não-admin (hoje vazam pra qualquer um com acesso).
- [ ] Nada quebra pra privilegiado (regressão): listar contas, dashboards, broadcast, eventos continuam funcionando.

## Fora de escopo
- Criptografia AES dos tokens (já é dívida MVP pré-existente).
- Permissão granular de "pode enviar/editar" por conta (só visibilidade + senha neste EM).
