# Design Systems de CRMs Famosos — Referencia Completa

Pesquisa realizada em 07/04/2026 para evolucao do Design System do Mandato Desk 2026.

---

## 1. HubSpot Canvas

| Item | Detalhe |
|------|---------|
| **URL** | https://canvas.hubspot.com |
| **GitHub** | https://github.com/HubSpot/canvas (arquivado, read-only) |
| **Cor Primaria** | `#FF4800` (Orange) |
| **Fonte** | HubSpot Sans (Light 300, Medium 500) + HubSpot Serif (display) |
| **Fallback CJK** | Zen Kaku Gothic New |

### Paleta de Cores

| Token | Hex | Uso |
|-------|-----|-----|
| Primary Brand | `#FF4800` | Botoes, CTAs |
| Text Primary | `#1F1F1F` | Texto corpo |
| Background | `#FCFCFA` | Fundo principal |
| Success | `#00823A` | Status sucesso |
| Error | `#D9002B` | Status erro |
| Warning | `#EEB117` | Status aviso |
| Legacy Coral | `#FF7A59` | Brand anterior |
| Legacy Dark | `#2D3E50` | Dark accent |

### Destaques
- **100+ CSS variables** com suporte nativo light/dark
- Escala tipografica de 0.75rem (micro) ate 7rem (display-01)
- Grid system responsivo 4/8/12 colunas
- 5 principios: Clear, Human, Inbound, Integrated, Collaborative

### Licao para Mandato Desk
> Sistema de 100+ CSS variables com suporte nativo a light/dark theme. A abordagem de "evergreen maintenance" — um design system que se mantem atualizado continuamente.

---

## 2. Salesforce Lightning Design System (SLDS 2.0)

| Item | Detalhe |
|------|---------|
| **URL** | https://www.lightningdesignsystem.com |
| **SLDS 2 Colors** | https://www.lightningdesignsystem.com/2e1ef8501/p/655b28-color |
| **Cor Primaria** | `#3A49DA` (Accent Blue) |
| **Fonte** | Salesforce Sans (corpo) + Inter (navegacao) + AvantGardeForSalesforce (headings) |

### Paleta de Cores (Cosmos Theme)

| Token | Hex | Uso |
|-------|-----|-----|
| Primary Accent Blue | `#3A49DA` | Acoes primarias |
| Brand Blue | `#066AFE` | Cobertura/destaque |
| Success/Positive | `#41B658` | Status positivo |
| Warning | `#0176D3` | Alerta |
| Error/Negative | `#FE9339` | Status negativo |
| Info/Neutral | `#0D9DDA` | Informacao |
| Dark Text | `#001642` | Headings |
| Body Text | `#444444` | Texto corpo |
| Secondary Text | `#5C5C5C` | Texto secundario |
| Link Text | `#3A49DA` | Links |
| Active BG | `#E0E5F8` | Background ativo |
| Border | `#E5E5E5` | Bordas padrao |

### Destaques
- **57+ componentes** documentados
- **Global Styling Hooks** (CSS custom properties semanticas) substituem tokens tradicionais
- Cosmos Theme com densidade customizavel
- WCAG AA minimo 4.5:1 contraste

### Licao para Mandato Desk
> O sistema de "global styling hooks" (CSS custom properties semanticas) permite temas customizaveis sem tocar na estrutura dos componentes. Referencia em acessibilidade.

---

## 3. Freshworks Crayons

| Item | Detalhe |
|------|---------|
| **URL** | https://crayons.freshworks.com |
| **Docs** | https://crayons.freshworks.com/introduction/ |
| **GitHub** | https://github.com/freshworks/crayons |
| **Tech** | StencilJS (Web Components), Monorepo Lerna |
| **Fonte** | Roboto (100-900) |

### Paleta de Cores (Sistema Nominal)

| Categoria | Token | Hex |
|-----------|-------|-----|
| Elephant (dark teal) | elephant-900 | `#12344D` |
| Elephant | elephant-800 | `#264966` |
| Azure (blue) | azure-800 | `#2C5CC5` |
| Azure | azure-100 | `#BBDCFE` |
| Azure | azure-50 | `#E5F2FD` |
| Smoke (neutral) | smoke-700 | `#475867` |
| Smoke | smoke-300 | `#92A2B1` |
| Smoke | smoke-100 | `#CFD7DF` |
| Smoke | smoke-50 | `#EBEFF3` |
| Smoke | smoke-25 | `#F5F7F9` |
| Jungle (green) | jungle-800 | `#005C3F` |
| Jungle | jungle-500 | `#00A886` |
| Persimmon (red) | persimmon-800 | `#D72D30` |
| Casablanca (orange) | casablanca-700 | `#E86F25` |
| Brand Purple | primary | `#8512E0` |

### Destaques
- **40+ web components** framework-agnostic
- Nomes de cores memoraveis (Elephant, Azure, Jungle, Persimmon, Casablanca)
- Pacotes: `@freshworks/crayons`, `@freshworks/crayons-icon`, `@freshworks/crayons-i18n`

### Licao para Mandato Desk
> Nomes de cores baseados em nomes proprios facilitam comunicacao no time e sao mais memoraveis que "gray-600".

---

## 4. Monday.com Vibe

| Item | Detalhe |
|------|---------|
| **URL** | https://vibe.monday.com |
| **GitHub** | https://github.com/mondaycom/vibe |
| **Brand Colors** | https://www.brand-monday.com/colors |
| **Dev Docs** | https://developer.monday.com/apps/docs/vibe-design-system |
| **Cor Primaria** | `#6161FF` (Monday Purple) |
| **Fonte** | Figtree (body) + Poppins (headings) + "Monday Pop" (custom) |

### Paleta de Cores

| Token | Hex | Nome |
|-------|-----|------|
| Brand Primary | `#6161FF` | Monday Purple |
| Vibe Purple | `#605CD4` | Vibe accent |
| Hover State | `#2E2AA0` | Dark Purple |
| Active State | `#222077` | Darkest Purple |
| Brand Dark | `#181B34` | Mirage |
| Brand Light BG | `#F0F3FF` | Monday Light |
| Success | `#00CA72` | Green Done |
| Warning | `#FFCC00` | Yellow Working |
| Error | `#FB275D` | Red Stuck |
| Logo Green | `#00854D` | Capsule |
| Logo Orange | `#D79700` | Capsule |
| Logo Red | `#B1123B` | Capsule |

### Destaques
- **50+ componentes React** com Storybook interativo
- Cores de status semanticas: "Done", "Working on It", "Stuck"
- Theming & Data Display, Navigation, Feedback, Inputs, Pickers

### Licao para Mandato Desk
> Cores de status nomeadas ("Done", "Em andamento", "Bloqueado") mapeadas a cores fixas no Kanban melhoram a DX. Combo Figtree + Poppins e moderna e legivel.

---

## 5. Attio

| Item | Detalhe |
|------|---------|
| **Site** | https://attio.com |
| **SDK Design** | https://docs.attio.com/sdk/guides/design-guidelines |
| **Analise** | https://strategybreakdowns.com/p/how-attio-does-design |
| **Cor Primaria** | `#0097B2` (Teal) |
| **Fonte** | Poppins / Open Sans |

### Paleta de Cores (extraida)

| Uso | Hex |
|-----|-----|
| Primary Teal | `#0097B2` |
| Background | `#F9FAFB` |
| Text Dark | `#222222` |
| Brand Dark | `#1C1D1F` |
| Accent Gold | `#DFD150` |

### Filosofia de Design
- **"Notion-like CRM"** — clean, minimal, data-first
- Progressive disclosure (revelar complexidade gradualmente)
- Gradientes sutis, hover states tateis, animacoes cubic-bezier suaves
- Corner radius automatico (30% do tamanho do icone) + outline 10% opacidade
- Cross-functional: engenheiros fazem design, designers constroem

### Licao para Mandato Desk
> Progressive disclosure — revelar complexidade gradualmente em vez de mostrar tudo de uma vez. Micro-interacoes (gradientes sutis, hover states tateis) fazem TODA a diferenca na percepcao de qualidade.

---

## 6. Folk CRM

| Item | Detalhe |
|------|---------|
| **Site** | https://folk.app |
| **Screenshots** | https://www.saasui.design/application/folk |
| **Mobbin** | https://mobbin.com/colors/brand/folk |
| **NicelyDone** | https://nicelydone.club/apps/folk |
| **Cor Primaria** | `#000000` (Black) |
| **Cores** | OKLCH perceptualmente uniforme |

### Paleta de Cores

| Uso | Hex | Nome |
|-----|-----|------|
| Primary | `#000000` | Black |
| Background | `#FFFFFF` | White |
| Accent Warm | `#FFF8BB` | Buttermilk |
| Accent Pink | `#FCE5F3` | Wisp Pink |
| Accent Blue | `#E6EDFE` | Hawkes Blue |

### Numeros
- **231 telas UI** + **30 telas marketing**
- **48 componentes tabela**, 43 modals, 43 workflows criacao
- 33 telas perfil, 21 empty states, **8 UI components core**

### Licao para Mandato Desk
> Acentos pastel quentes (Buttermilk, Wisp Pink, Hawkes Blue) criam sensacao acolhedora em CRM — tirando a frieza corporativa. Paleta OKLCH e a evolucao tecnica de cores.

---

## 7. Close CRM

| Item | Detalhe |
|------|---------|
| **Site** | https://close.com |
| **Blog Design** | https://making.close.com/posts/light-and-dark-our-color-systems-journey/ |
| **Cor Primaria** | `#381696` (Purple, light) / `#9984D5` (Purple, dark) |
| **Fonte** | System font stack (sem fonte custom) |

### Sistema de Cores (LCH)
Pioneiro no uso de **LCH** (Lightness, Chroma, Hue) para ramps de cores:
- **Base Tokens:** `--colorGray01`, `--colorBlue20` (cor + nivel luminosidade)
- **Semantic Tokens:** `--color[Element][Component][Variant][State]`
  - Ex: `--colorBgTableCellHighlighted`
- Contraste WCAG AA minimo 4.5:1

### Licao para Mandato Desk
> Convencao de naming `--color[Element][Component][Variant][State]` e autodocumentante. System font stack para performance maxima.

---

## 8. Pipedrive

| Item | Detalhe |
|------|---------|
| **Site** | https://pipedrive.com |
| **Dark Theme** | https://www.pipedrive.com/en/blog/dark-theme |
| **UI Extensions** | https://pipedrive.readme.io/docs/custom-ui-extensions |
| **Cor Primaria** | `#08A742` (Green Haze) |

### Dark Mode
- **3 opcoes:** Light, Dark, System (sincroniza com OS)
- Paleta subdued que inverte proporcao preto/branco
- Configuracao individual por usuario
- **Dado importante: maior retencao entre usuarios que ativaram dark mode**

### Licao para Mandato Desk
> Dark mode aumenta retencao. As 3 opcoes (Light/Dark/System) sao o padrao minimo. Opcao "System" que sincroniza com OS e essencial.

---

## 9. Zoho

| Item | Detalhe |
|------|---------|
| **Branding** | https://www.zoho.com/branding/ |
| **Desk Blocks** | https://deskblocks.mohanvadivel.com/guidelines/typography |
| **Cor CRM** | `#0974B0` (Honolulu Blue) |
| **Fonte** | Proxima Nova (CRM), Zoho Puvi / Roboto / Lato (Desk) |

### Paleta Multi-Color

| Uso | Hex |
|-----|-----|
| Zoho Red | `#E42527` |
| Zoho Green | `#089949` |
| Zoho Blue | `#226DB4` |
| Zoho Yellow | `#F9B21D` |
| CRM Blue | `#0974B0` |
| UI Coral | `#E85555` |
| UI Charcoal | `#232525` |
| Success | `#1CB75E` |
| Info/Links | `#03A9F5` |
| Warning | `#FFA23A` |
| Error | `#FF0000` |

### Licao para Mandato Desk
> Sistema multi-produto (cada produto = uma cor) e relevante para expansao. CRM-specific blue como cor dominante com cores funcionais bem definidas.

---

## Resumo Comparativo

| CRM | Cor Primaria | Fonte | DS Publico? | Destaque |
|-----|-------------|-------|-------------|----------|
| HubSpot | `#FF4800` orange | HubSpot Sans | Sim | 100+ CSS vars, light/dark |
| Salesforce | `#3A49DA` blue | Salesforce Sans | Sim | 57+ components, Cosmos hooks |
| Freshworks | `#2C5CC5` azure | Roboto | Sim | Web Components StencilJS |
| Monday | `#6161FF` purple | Figtree + Poppins | Sim | 50+ components, Storybook |
| Attio | `#0097B2` teal | Poppins | Nao | Progressive disclosure |
| Folk | `#000000` black | System | Nao | OKLCH, pastel accents |
| Close | `#381696` purple | System stack | Parcial | LCH color system |
| Pipedrive | `#08A742` green | Serif custom | Nao | Dark mode = retencao |
| Zoho | `#0974B0` blue | Proxima Nova | Nao | Multi-color, multi-product |

---

## Top 5 Licoes para Mandato Desk 2026

1. **Tokens semanticos** (Close/SLDS): usar nomes como `--colorBgCardHover` em vez de `--blue-100`
2. **Dark mode com 3 opcoes** (Pipedrive): Light / Dark / System — aumenta retencao
3. **Cores de status nomeadas** (Monday): "Concluido" / "Em andamento" / "Bloqueado" com cores fixas no Kanban
4. **Progressive disclosure** (Attio): revelar complexidade gradualmente
5. **Acentos pastel quentes** (Folk): suavizar a frieza de um CRM politico
