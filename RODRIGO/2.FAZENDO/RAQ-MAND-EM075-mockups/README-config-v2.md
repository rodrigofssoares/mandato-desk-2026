# RAQ-MAND-EM075 — Configurações do Agente · v2 (D, E, F)

Refeitos com os apontamentos da revisão:

✅ **Bloco de Conexões com chave API** pros 3 provedores (OpenAI, Anthropic, OpenRouter) — toggle de conectado/desconectado, botão "Testar chave", link pra gerar chave, status visual
✅ **Upload de arquivos** na identidade do agente — drag&drop, lista com nome/tamanho/tokens/status, remoção
✅ **Removido "Quem pode usar"** — agora delegado à matriz de Permissões global
✅ **Base = Layout C** (budget hero + simulador) + **caixas de preset estilo B com toggle granular individual** (pode tirar Llama do Balanceado, adicionar Mistral, etc.)
✅ Multimodal bloqueado por padrão (master switch "Apenas modelos de texto")

---

## Layout D — Single-page vertical · caixas por **provedor**

**Arquivo:** `config-D-single-page.html`

**Filosofia:** uma página linear, seções numeradas 1→5, sem tabs internas.

**Estrutura:**
1. **Identidade & documentos** — nome, prompt, status ativo + **upload de arquivos** com 3 docs mockados (PDF, DOCX, TXT) mostrando tokens indexados
2. **Conexões com provedores** — 3 cards lado-a-lado (OpenAI/Anthropic/OpenRouter), cada um com chave API, botão Testar, link "Gerar chave ↗"
3. **Modelos permitidos** — **3 caixas por provedor** (OpenAI / Anthropic / OpenRouter) com modelos do provedor dentro de cada caixa. Cada modelo tem toggle individual + botão "Padrão" + "+ Adicionar modelo"
4. **Orçamento & limites** — budget hero grande + alertas de threshold + sliders de uso
5. **Simulador** — cenários (Conservador/Real/Pico/Crise)

**Vantagem:** caixa por provedor agrupa logicamente — você vê a chave + modelos daquele provedor juntos. Fácil entender o que cada chave habilita.

**Desvantagem:** se trocar de preset (Econômico vs Premium), modelos espalham por 3 caixas — visão menos clara do "perfil de uso".

---

## Layout E — Sub-tabs internas (1→2→3→4) · caixas por **preset**

**Arquivo:** `config-E-subtabs.html`

**Filosofia:** wizard com 4 passos numerados em sub-tabs, stepper visual com check de progresso.

**Estrutura:**
- **Budget strip sticky no topo** sempre visível (em todas as sub-tabs)
- **Sub-tabs:** 1️⃣ Identidade · 2️⃣ Conexões · 3️⃣ Modelos · 4️⃣ Orçamento
- **Passo 1 — Identidade:** upload de arquivos + nome + prompt + toggle ativo
- **Passo 2 — Conexões:** 3 cards de provedor (OpenAI/Anthropic/OpenRouter) com chave API, teste, link gerar chave
- **Passo 3 — Modelos:** master switch "apenas texto" + **3 caixas de preset** (🪙 Econômico · ⚖️ Balanceado · ✨ Premium) com:
  - Modelos dentro de cada caixa com **dot colorido do provedor** + toggle individual + botão padrão
  - **Botão "Adicionar"** com **dropdown popup** mostrando outros modelos disponíveis pra incluir naquele preset
  - Botão "Usar este preset" / "✓ Em uso"
- **Passo 4 — Orçamento:** alertas + sliders + simulador grande no final
- Footer com setas "Anterior" / "Próximo"

**Vantagem:** decisão guiada — admin que nunca configurou IA antes não se perde. Stepper visual e linguagem progressiva.

**Desvantagem:** precisa clicar entre tabs pra ver tudo — não é "uma tela só". Quem já sabe o que quer pode se irritar com os passos.

---

## Layout F — Two-column · coluna direita sticky (budget+sim+status)

**Arquivo:** `config-F-two-column.html`

**Filosofia:** edita à esquerda, vê o impacto à direita o tempo todo.

**Estrutura:**
- **Coluna esquerda (scroll):** seções numeradas em sequência (Identidade+Files → Conexões → Modelos → Limites/Alertas)
- **Coluna direita (sticky 380px):** sempre visível enquanto você rola:
  - **Budget hero** compacto com R$ 100/mês, barra de progresso, input pra ajustar valor
  - **Status atual** (8 linhas com bullets coloridos): agente ativo, 2 conexões, OpenRouter desconectado, 4 modelos, padrão GPT-4o mini, 3 docs, multimodais bloqueados
  - **Projeção mensal** com 4 cenários clicáveis (Conservador/Real/Pico/Crise)
- **Conexões em accordion vertical** (OpenAI aberto por padrão, outros colapsados) — mais compacto que 3 cards lado-a-lado
- **3 caixas de preset** em grid (Econômico/Balanceado/Premium) com mesma estrutura granular dos outros

**Vantagem:** **feedback contínuo** — você muda algo na esquerda e vê na hora o impacto no orçamento à direita. Status sempre visível ajuda admin a ter "saúde" do agente de relance.

**Desvantagem:** em telas <1200px a coluna direita desce — perde o sticky. Layout denso em desktop.

---

## Comparativo

| Critério | D — Single-page | E — Sub-tabs | F — Two-column |
|---|---|---|---|
| Estrutura geral | scroll linear | wizard 4 passos | edição + preview |
| Caixas de modelos | por **provedor** | por **preset** | por **preset** |
| Toggle granular nos modelos | ✅ | ✅ | ✅ |
| + Adicionar modelo no preset | ✅ | ✅ com dropdown | ✅ |
| Upload de arquivos | ✅ | ✅ | ✅ |
| Chaves de API (3 providers) | ✅ 3 cards lado-a-lado | ✅ 3 cards lado-a-lado | ✅ accordion vertical |
| Budget+simulador sempre visível | ⚠️ no fim da página | ⚠️ strip sticky no topo | ✅ sticky direita |
| Curva de aprendizado | ✅ baixa | ✅ baixa (guiado) | ⚠️ média |
| Densidade visual | ⚠️ alta | ✅ média | ⚠️ alta |
| Mobile | ✅ tudo empilha | ✅ tudo empilha | ⚠️ direita desce |
| "Vejo o impacto enquanto edito" | ✕ | ⚠️ só budget | ✅ tudo |

---

## Como decidir

**Pergunta-guia:** como você prefere editar configurações longas?

1. **"Quero scroll de cima a baixo, sem clicar entre abas"** → **D** (single-page)
2. **"Quero ser guiado, passo a passo, sem me perder"** → **E** (sub-tabs)
3. **"Quero ver o impacto da minha edição em tempo real"** → **F** (two-column)

**Híbrido viável:** pegar a **estrutura two-column do F** + **wizard com etapas claras do E** (numerar as seções e ter "Anterior/Próximo" no fim de cada uma) + **caixas por preset do E/F** (em vez de por provedor como no D). Combina o melhor: linear pra quem prefere scroll, mas com feedback contínuo da coluna direita.

---

## Próximos passos

Você escolhe um dos 3 (ou pede ajuste) e eu:
1. Atualizo o backlog refletindo o layout escolhido
2. Disparo a cadeia Fullstack → Security → CR → QA pra implementar o Slice 1 do MVP
