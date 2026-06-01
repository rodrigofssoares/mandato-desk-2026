# Auditoria de Seguranca - RAQ-MAND-EM075 Onda 4

Data: 2026-05-21
Branch: rodrigo/feature/RAQ-MAND-EM075-agente-de-ia-integrado-ao-crm-agente
Commits: 98b5e18, 3311a43, 47df489, 28c89b1, 846ddbf, 9da2e34, 81cdfec

---

## Escopo
18 arquivos auditados: Agente.tsx, 9 components/agent/*.tsx, 4 hooks, usePermissions.tsx, AppSidebar.tsx, App.tsx, package.json

## Layer 1 - 13 VibeCoding

| # | Vulnerabilidade | Status | Local |
|---|---|---|---|
| 1 | Race Condition | NA | Sem ops financeiras |
| 2 | IDOR | PARCIAL | useAgentFavoritesMutation.ts:25 |
| 3 | SQL Injection | SEGURO | .eq() parametrizado |
| 4 | XSS | SEGURO | sem rehype-raw; img bloqueada |
| 5 | Image Tracker | SEGURO | img: () => null |
| 6 | Upload Malicioso | NA | botao disabled |
| 7 | Mass Assignment | SEGURO | whitelist explicita |
| 8 | Input Flooding | BAIXO | AgentInput.tsx:72 sem maxLength |
| 9 | Enumeracao Usuarios | NA | sem fluxo auth |
| 10 | Logica de Negocio | SEGURO | rollback optimistic ok |
| 11 | Secrets | SEGURO | sem hardcoded keys |
| 12 | JWT Inseguro | SEGURO | via supabase.auth.getSession() |
| 13 | Bypass URL | SEGURO | rel=noopener; sem redirect |

## Layer 2 - OWASP Top 10 + STRIDE

A01 Access Control: sidebar SECAO_TO_PERMISSION.agente_ia correto. Rota com ProtectedRoute + can.viewAgente(). RLS filtra server-side.

A03 XSS (foco principal):
- react-markdown@10.1.0 + remark-gfm apenas. rehype-raw NAO instalado.
- remark-rehype apenas como dep transitiva sem allowDangerousHtml.
- img: () => null bloqueia XSS via imagem.
- dangerouslySetInnerHTML ausente em todos 18 arquivos.
- Mensagem user renderizada como texto puro (nao via markdown).
- Smoke test: payload <img src=x onerror=alert(1)> -> texto literal. Nao executa.

A04 Design: optimistic rollback correto. Race entre mutations sem vazamento.
A05 Config: CSP ausente - PRE-EXISTENTE, nao desta onda.
A09 Logging: zero console.log nos arquivos - sem vazamento de conteudo.

## STRIDE

| Categoria | Mitigacao |
|---|---|
| Spoofing session_id | RLS auth.uid() server-side |
| Tampering LLM output | react-markdown sem rehype-raw; img=null |
| Info Disclosure favoritos | RLS; hook sem userId externo |
| DoS input gigante | EF body limit Deno 4MB |
| Elevation permissao | RLS + EF validam server-side |

## Sumario

- CRITICAS: 0
- ALTAS: 0
- MEDIAS: 0
- BAIXAS: 2

## Finding 1 - [BAIXA / VibeCoding #2 / OWASP A01 / CWE-639]
Delete favorito sem user_id no client
Arquivo: src/hooks/useAgentFavoritesMutation.ts:25
Descricao: .delete().eq('id', favorite_id) sem filtro por user_id.
Impacto: Nenhum se RLS correta (validada Onda 2). Ausencia defense-in-depth.
Acao: Confirmar no Dashboard Supabase que policy DELETE exige auth.uid() = user_id.
Opcional: adicionar .eq('user_id', user.id) como segunda camada.

## Finding 2 - [BAIXA / VibeCoding #8 / OWASP A04 / CWE-770]
Input sem maxLength
Arquivo: src/components/agent/AgentInput.tsx:72
Descricao: textarea sem atributo maxLength.
Impacto: Baixo - EF tem body limit Deno 4MB e valida server-side.
Correcao: <textarea maxLength={4000} /> e slice(0,4000) no handleSend.

## Nota - CSP (pre-existente)
CSP nao configurado em index.html nem vite.config.ts. Problema anterior a esta onda.
Com markdown renderer para LLM, CSP seria camada adicional valiosa. Issue separada.

## Veredicto

APROVADO - sem findings altas/criticas.

XSS via output de LLM esta completamente mitigado:
- react-markdown sem rehype-raw
- img: () => null
- remark-rehype transitivo sem allowDangerousHtml
- zero dangerouslySetInnerHTML

## Proximos passos
1. Fullstack opcional: maxLength={4000} no AgentInput
2. Verificacao: RLS DELETE em ai_chat_favorites no Supabase Dashboard
3. Issue separada: CSP headers para o projeto