# Code Review - RAQ-MAND-EM075 Onda 4

**Data:** 2026-05-21
**Branch:** rodrigo/feature/RAQ-MAND-EM075-agente-de-ia-integrado-ao-crm-agente
**Commits:** 98b5e18, 3311a43, 47df489, 28c89b1, 846ddbf, 9da2e34, 81cdfec

---

## Escopo

- Diff: 13 arquivos, 9 components/agent, 3 hooks, delta App.tsx AppSidebar.tsx usePermissions.tsx
- Build/lint/typecheck: tsc --noEmit verde. npm run lint sem erros nesta onda. Warning: setSelectedModelId unused (Agente.tsx:32).

## Aprovacao geral

Onda bem executada. Composicao em 9 componentes equilibrada. AgentMarkdown isolado com comentario XSS exemplar. Optimistic update com rollback correto. Separacao useAgentMessages/useSendAgentMessage boa. Rota e sidebar integrados limpos.

## Must-fix (bloqueiam merge)

### issue Agente.tsx:87-112 - handleSuggestion duplica handleSend via setTimeout(0)

O bloco dentro do setTimeout eh identico a handleSend. DRY violado: mudancas em handleSend (rate limit, validacoes) nao se propagam para handleSuggestion. Alem disso setInputValue(prompt)+setInputValue('') causa flash desnecessario no input.

Correcao: chamar a logica de envio diretamente com o prompt sem setTimeout:



### issue Agente.tsx:32 - setSelectedModelId nunca usado (dead state)

Linter aponta: setSelectedModelId is assigned a value but never used. AgentHeader recebe selectedModel mas nao expoe onModelChange. O usuario nao consegue trocar o modelo pela UI.
Opcoes: remover o state enquanto seletor nao for implementado, ou conectar ao header com prop onModelChange.

## Should-fix

### suggestion useAgentFavorites.ts:39 + useAgentFavoritesMutation.ts - query key inconsistente

Messages/sessions usam hifen (agent-messages, agent-sessions). Favoritos usa underscore (agent_favorites). Padronizar para agent-favorites.

### suggestion AgentDrawerSessions.tsx:134 - cast fragil via (e as unknown as React.MouseEvent)

handleRenameConfirm espera MouseEvent mas recebe KeyboardEvent. O cast mascara o type mismatch. Extrair logica em funcao commitRename() sem dependencia do evento.

### suggestion AgentChatMessages.tsx:229-231 - scroll forca o final sem preservar posicao

scrollIntoView dispara em toda nova mensagem. Checar isNearBottom (< 120px) antes de rolar para preservar posicao quando usuario scrollou para cima.

### suggestion AgentChatMessages.tsx:43-44 - tag style inline no TypingIndicator

@keyframes agentBounce reinserida no DOM a cada mount. Mover para index.css ou usar animate-bounce do Tailwind.

## Nitpicks

- nitpick hooks agente - 18x as never porque tabelas nao estao em types.ts. Limpar quando migration for refletida.
- nitpick AgentChatMessages.tsx:109 - Atendente hardcoded. Passar agentName como prop para consistir com header.
- nitpick AgentChatMessages.tsx:82-86 - Regenerar/Compartilhar sao stubs sem indicador visual. Adicionar title=Em breve ou opacidade reduzida.
- nitpick AgentDrawerSessions.tsx:80 + AgentDrawerFavorites.tsx:64 - window.confirm nativo, inconsistente com AlertDialog do shadcn/ui.

## Questions

### question Agente.tsx:52-56 - useEffect pode cancelar Nova conversa

Quando handleNewSession seta currentSessionId=null, o effect (com currentSessionId nas deps) roda e seta sessions[0].id de volta, cancelando a intencao do usuario.
Sugestao: remover currentSessionId das deps, rodar so quando sessions carrega pela primeira vez.

### question AgentHeader.tsx:43 - fallback hardcoded claude-3.5-sonnet

const modelLabel = selectedModel ?? claude-3.5-sonnet
Se o agente usa outro modelo e preset ainda nao carregou, o header mostra modelo incorreto. Melhor traço ou omitir pill enquanto carrega.

## Praise

- praise AgentMarkdown.tsx - componente exemplar: isolado, comentario XSS explicando o why, sem rehype-raw, img=null, rel=noopener, todas variantes semanticas cobertas.
- praise useAgentChat.ts:113-154 - optimistic update com rollback por livro: cancelQueries + snapshot + setQueryData + onError restore.
- praise AgentDrawerSessions.tsx:28-54 - agrupamento temporal elegante (hoje/ontem/semana/antigas) com GROUP_ORDER separado.
- praise AgentNoAccessCard + AgentInactiveCard - dois estados distintos com mensagens claras.

## Verificacoes especificas

1. rehype-raw - ausente confirmado. Apenas remarkGfm, sem rehypePlugins.
2. Realtime - nenhuma subscription. Sem cleanup necessario.
3. Scroll - sem preservacao de posicao. Ver suggestion AgentChatMessages:229.
4. Sessao default - risco de cancelar Nova conversa. Ver question Agente.tsx:52.
5. framer-motion - animacoes simples 0.32s, performance ok em mobile.
6. Mockup Layout 3 - validacao visual cabe ao QA.

## Veredicto

[x] BLOQUEAR - must-fix precisa resolver antes do merge

2 must-fixes:
1. Agente.tsx:87-112 - refatorar handleSuggestion (remover setTimeout + DRY break)
2. Agente.tsx:32 - remover setSelectedModelId dead state OU conectar seletor ao header

Apos corrigir os 2 must-fixes, codigo em condicao de merge. Should-fixes podem ser corrigidos na mesma branch ou proxima onda.