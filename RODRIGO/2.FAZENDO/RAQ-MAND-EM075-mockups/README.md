# RAQ-MAND-EM075 — 3 Mockups Interativos do Agente IA

**Como abrir:** clica duas vezes em cada `.html` que abre no navegador padrão. Tudo standalone (sem build, sem servidor). Funcionam em desktop e mobile.

Todos os três usam fielmente o **Burgundy Institucional** do Mandato Desk:
- Vinho `#7B1E2E` (primary) + dourado warm `#D4A446` (accent) + canvas creme `#FAF6F0`
- Fontes: **Inter** (corpo) · **Space Grotesk** (display) · **Cinzel** (eyebrows/destaques institucionais)
- Border radius `14px`, semantic tokens (success/warning/danger), focus-ring acessível
- Tema único (sem dark mode — Mandato Desk não usa dark)

---

## Layout 1 — Clássico (estilo ChatGPT)

**Arquivo:** `mockup-1-classico.html`

**Pra quem:** assessores que já usam ChatGPT e querem sentir-se em casa.

**Estrutura:**
- Sidebar esquerda fixa com histórico agrupado por data (Hoje / Ontem / Semana passada)
- Botão "Nova conversa" em destaque
- Centro: mensagens em formato chat clássico (avatar + bolha)
- Favoritos em **modal** (botão "Respostas favoritas" no rodapé da sidebar)
- Input fixo no rodapé com clipe (anexo) e botão enviar

**Interatividade testável:**
- Enviar mensagem (Enter / botão) → vê typing dots → resposta mockada
- Favoritar resposta no hover → toast feedback
- Copiar resposta
- Abrir modal de favoritas → busca + ações (copiar/editar nota/remover)
- Sidebar mobile colapsa em hamburger
- Tooltip do warning LGPD no header

**Vantagens:** menor curva de aprendizado, padrão familiar.
**Desvantagens:** favoritos "escondidos" em modal — frequência de uso pode cair.

---

## Layout 2 — Workspace Triplo (favoritos sempre à mão)

**Arquivo:** `mockup-2-workspace.html`

**Pra quem:** quem tem fluxo repetitivo (assessor que responde dezenas de demandas iguais por dia).

**Estrutura:**
- **3 colunas simultâneas em desktop:** histórico (240px) · chat (centro) · favoritos (320px)
- Favoritos visíveis durante a conversa — não precisa abrir modal
- **Drag & drop**: arrasta a mensagem do agente direto pro painel de favoritos
- Cada favorito mostra trecho + nota inline + data + fonte (conversa de origem)
- Mobile: colapsa em hamburger esquerdo (histórico) + ícone estrela direito (favoritos)

**Interatividade testável:**
- Arrastar mensagem do assistant pro painel direito → adiciona favorito com animação
- Botão "Favoritar" no hover da mensagem também funciona
- Drop zone com destaque visual quando arrastando
- Remover favorito com fade-out
- Contador "X / 500 favoritas"
- Suggested text "Arraste respostas para o painel direito" no rodapé

**Vantagens:** produtividade alta — favoritos servem como template à mão; ideal pra reduzir tempo de resposta.
**Desvantagens:** layout denso em desktop pequeno (<1100px o painel direito esconde).

---

## Layout 3 — Institucional (foco no conteúdo)

**Arquivo:** `mockup-3-institucional.html`

**Pra quem:** posicionamento premium do Mandato Desk como ferramenta institucional do gabinete.

**Estrutura:**
- Header sticky com glassmorphism (blur), avatar do agente quadrado com sombra colorida e dot de status
- **Welcome screen** com 4 sugestões de prompts curados (Atender pedido / Ofício / Demanda jurídica / Evento)
- Tipografia destacada: **Cinzel** em eyebrows ("AGENTE DO GABINETE", "MANDATO DESK · 2026")
- Mensagens do user em bolha à direita; mensagens do assistant em cards com borda lateral vinho + tag categorizada
- **Drawers laterais** (esquerda = histórico, direita = favoritos) — abrem por overlay com blur
- Pills no header: modelo atual · tokens · LGPD warning
- Sugestão visual de "uso clicável" pra reduzir bloqueio inicial

**Interatividade testável:**
- Clicar em sugestão preenche e envia a mensagem
- Welcome desaparece após primeira interação
- Drawers abrem com animação cubic-bezier (entrada lateral + blur no fundo)
- ESC fecha drawer
- Favoritar destaca a mensagem inteira (não só o botão) com borda dourada
- Toast vem do topo (centralizado)

**Vantagens:** premium, sinaliza valor; welcome reduz "tela em branco intimidante" pra estagiários.
**Desvantagens:** mais elementos pra renderizar (glass, pills, drawers); menos conversa visível no fold.

---

## Resumo comparativo

| Critério | Layout 1 (Clássico) | Layout 2 (Workspace) | Layout 3 (Institucional) |
|----------|---------------------|----------------------|--------------------------|
| Curva de aprendizado | ✅ Baixíssima | ⚠️ Média | ✅ Baixa |
| Acesso a favoritos | ⚠️ Modal | ✅ Sempre visível | ⚠️ Drawer |
| Densidade de info | ✅ Boa | ⚠️ Alta | ✅ Equilibrada |
| Diferenciação visual do CRM | ⚠️ Padrão | ✅ Único | ✅ Premium |
| Mobile (iPhone SE 375px) | ✅ Bom | ✅ Bom | ✅ Bom |
| Esforço de implementação | ✅ Menor | ⚠️ Médio (drag&drop) | ⚠️ Médio (glass, drawers) |
| Performance | ✅ Leve | ✅ Leve | ⚠️ +blur (mas aceitável) |

---

## Como decidir

**Pergunta-guia:** o que é mais importante pro usuário final do gabinete da Raquel?

1. **Familiaridade absoluta** → escolhe Layout 1 (ChatGPT clássico)
2. **Produtividade máxima** (reusar respostas o tempo todo) → escolhe Layout 2 (Workspace triplo)
3. **Sinalizar valor + reduzir intimidação inicial** → escolhe Layout 3 (Institucional)

**Híbrido também é viável:** podemos pegar o Layout 3 como base (welcome + drawers institucionais) e adicionar a coluna de favoritos sempre visível em desktop grande (>1280px) do Layout 2 — fica como "evolução natural".

---

## Próximos passos (após escolha)

1. Você escolhe 1 dos 3 (ou pede ajuste)
2. Decidir as 6 perguntas em aberto que estão em `RAQ-MAND-EM075-PO-refinamento.md` §7
3. Backlog (`RAQ-MAND-EM075-Backlog-tasks.md`) está atomizado em 17 tasks — Slice 1 MVP cobre US-01/03/05/06 com ~35-55h dev
4. Eu disparo o Fullstack + cadeia QG (Security + CR + QA) na implementação do Slice 1
