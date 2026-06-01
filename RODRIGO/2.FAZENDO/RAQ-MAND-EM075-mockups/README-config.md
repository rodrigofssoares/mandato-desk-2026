# RAQ-MAND-EM075 — 3 Mockups da tela de Configurações do Agente

**Layout vencedor da etapa anterior:** `mockup-3-institucional.html`. Agora os 3 abaixo são variações da **subaba "Agente"** dentro de Configurações, todos respeitando essa linha visual.

**Foco comum aos 3:** controle fino de modelos permitidos + **bloqueio padrão de modelos multimodais** (visão/áudio) pra evitar custo desnecessário. O agente é focado em texto.

---

## Layout A — Catálogo granular

**Arquivo:** `config-A-catalogo.html`

**Filosofia:** controle total e direto. Cada modelo é uma linha numa tabela com toggle individual.

**O que tem:**
- Tabela única com **11 modelos** (3 OpenAI, 3 Anthropic, 5 OpenRouter)
- Por modelo: ícone do provider · nome · ID técnico · contexto · preço in/out · capacidades (texto/visão/áudio) · botão "Definir padrão" · switch on/off
- **Master switch "Apenas modelos de texto"** no topo — desliga automaticamente todos os multimodais
- Modelos multimodais aparecem com fundo amarelo + tag "multimodal"
- Filtros por provider (Todos / OpenAI / Anthropic / OpenRouter) + busca + chips por faixa de preço
- **Adicionar modelo customizado** via input `provider/model-id` (input texto livre pra cobrir 100% do catálogo OpenRouter)
- **Painel lateral fixo** mostrando "O que o usuário vê" — preview do seletor de modelos no chat com dropdown aberto + summary cards
- Estimativa de custo R$/mês baseada na configuração atual
- Sliders pra limites: max tokens por resposta, histórico, temperatura

**Pra quem:** admin que quer ver tudo de uma vez e tomar decisões caso a caso. Densidade alta de informação.

**Interatividade testável:**
- Clica no switch → marca/desmarca modelo
- Clica em "Definir padrão" → muda o modelo padrão
- Clica nas tabs de provider → filtra a lista
- Busca por nome ou ID → filtra incremental
- Toggle master "Apenas texto" → desliga todos os multimodais de uma vez
- Sliders alteram os números acima em tempo real
- Adicionar modelo customizado → mostra toast

---

## Layout B — Presets curados

**Arquivo:** `config-B-presets.html`

**Filosofia:** decisão guiada. Admin não precisa entender 11 modelos — escolhe um perfil pré-pronto e ajusta se quiser.

**O que tem:**
- **Fluxo em 3 passos** com section headers "Passo 1" / "Passo 2" / "Passo 3" + Cinzel
- Passo 1: identidade (nome, prompt, ativo, quem pode usar)
- Passo 2: **4 cards de preset** lado a lado:
  - 🪙 **Econômico** (3 modelos, ~R$ 12/mês) — GPT-4o mini, Claude Haiku, Llama 70B
  - ⚖️ **Balanceado** (5 modelos, ~R$ 38/mês) — adiciona GPT-4o e Sonnet (selecionado por padrão)
  - ✨ **Premium** (4 modelos, ~R$ 180/mês) — GPT-4o, Sonnet, Opus 4, o3-mini
  - 🔧 **Personalizado** — partir do zero
- Cada preset tem cor + emoji + estatísticas + lista dos modelos incluídos
- **Regra base mestre** "Apenas modelos de texto" como banner explicativo separado
- Passo 3: **ajuste fino do preset escolhido** — mostra os 5 modelos do preset + 3 sugestões pra adicionar (uma delas multimodal vem bloqueada explicitamente)
- Botão "Resetar preset" pra voltar ao default original
- Input customizado pra qualquer model ID OpenRouter
- **Cost gauge final** grande mostrando estimativa total

**Pra quem:** admin que quer decidir rápido sem ler especificações. Decisão alto-nível ("quanto quero gastar?") → sistema cuida do resto.

**Interatividade testável:**
- Clica num card de preset → seleciona e altera os modelos abaixo
- Clica no toggle de um modelo → liga/desliga
- Clica "Definir padrão" → muda padrão (com tag visual ★)
- Adiciona um modelo das sugestões → vai pro preset
- Multimodal mostra warning ao clicar
- Toast em cada ação

---

## Layout C — Budget-driven com simulador

**Arquivo:** `config-C-budget.html`

**Filosofia:** orçamento é o herói. Toda decisão sobre modelos é contextualizada pelo "quanto custa" no canto da tela em tempo real.

**O que tem:**
- **Hero card vinho** com orçamento mensal grande (R$ 100), barra de progresso visual, gasto atual, input pra ajustar valor
- **Alertas de threshold** com 3 níveis: amarelo 70% / vermelho 90% / **bloqueio automático 100%** (agente para de responder até admin liberar)
- **Caps por uso** com sliders:
  - Tokens máximos por resposta
  - Histórico enviado
  - Mensagens por usuário/dia
  - **Custo máximo por usuário/mês** (cap individual — protege contra um usuário sozinho gastar tudo)
- **Tabela compacta de modelos** com nova coluna: **"Impact %"** mostrando quanto cada modelo contribui pro gasto projetado (low/med/high coloridos)
- Master switch "Apenas texto" inline na lista
- **Simulador lateral à direita (sticky):**
  - Projeção mensal grande (R$ 78) com cor que muda se passar do limite
  - Barra horizontal de % do orçamento
  - **4 cenários clicáveis:** Conservador / Real atual / Pico / Crise (5usr × 10/30/60/120 msg/dia)
  - **Breakdown por modelo** mostrando quanto cada um custa no cenário escolhido
  - Botão "Ver histórico real" (pra futuro)

**Pra quem:** admin que tem medo de custo descontrolado e quer decisões guiadas por números. Especialmente útil pra Raquel ou outros clientes que paguem do bolso.

**Interatividade testável:**
- Clica num cenário → recalcula projeção + barra + breakdown
- Cenário "Crise" mostra alerta vermelho "Excede orçamento em R$ 220"
- Ajusta orçamento → barra de progresso muda
- Toggle "Apenas texto" → bloqueia multimodais
- Slider de custo por usuário → muda o número em tempo real
- Threshold switches → alterna alertas

---

## Comparativo rápido

| Critério | Layout A (Catálogo) | Layout B (Presets) | Layout C (Budget) |
|----------|---------------------|---------------------|--------------------|
| Decisão direta | ✅ tabela direta | ⚠️ 3 passos guiados | ⚠️ 3 passos guiados |
| Curva de aprendizado | ⚠️ alta (precisa entender modelos) | ✅ baixa (pega preset pronto) | ⚠️ média (entende budget primeiro) |
| Controle fino | ✅ máximo | ✅ alto (no passo 3) | ✅ alto |
| Foco em custo | ⚠️ secundário (preview lateral) | ✅ médio (custo por preset) | ✅ máximo (orçamento é hero) |
| Bloqueio multimodal | ✅ master switch | ✅ regra base + filtros | ✅ master switch inline |
| Adicionar modelo livre | ✅ inline na tabela | ✅ inline no passo 3 | ✕ não exposto (pode adicionar) |
| Hard cap automático | ✕ não tem | ✕ não tem | ✅ bloqueio 100% |
| Densidade visual | ⚠️ alta | ✅ média | ⚠️ alta |
| Mobile (iPhone SE) | ✅ tabela colapsa | ✅ presets empilham | ✅ panels empilham |
| Esforço de implementação | ⚠️ médio (tabela + filtros) | ⚠️ médio (presets + lógica de aplicar) | ⚠️ alto (simulador é cálculo extra) |

---

## Como decidir

**Pergunta-guia:** o que mais te trava na hora de configurar custos de IA?

1. **"Quero ver e controlar tudo"** → Layout A. Tabela explícita.
2. **"Não quero pensar, quero um perfil pronto"** → Layout B. Presets.
3. **"Meu medo é estourar orçamento"** → Layout C. Budget + caps.

**Híbrido viável:** pegar a **estrutura do C (orçamento hero + simulador)** + **tabela compacta do A (com Impact %)** + **botão "Aplicar preset" do B** como atalho. Combina o melhor dos três sem inflar a tela.

---

## Próximos passos

Você escolhe um dos 3 (ou pede ajuste / híbrido) e eu:

1. Atualizo o backlog (`RAQ-MAND-EM075-Backlog-tasks.md`) refletindo o layout escolhido
2. Disparo a cadeia Fullstack → Security → CR → QA pra implementar o Slice 1 do MVP, agora com:
   - Aba "Agente" no menu (Layout 3 já escolhido)
   - Subaba "Agente" em Configurações (este layout que você escolher)
   - Chat + histórico 30d + favoritos 500
   - **Modelos permitidos** com bloqueio multimodal padrão
   - Limites por uso configuráveis
