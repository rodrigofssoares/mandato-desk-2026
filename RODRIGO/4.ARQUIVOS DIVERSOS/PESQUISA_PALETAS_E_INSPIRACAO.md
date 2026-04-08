# Pesquisa: Paletas de Cores Institucionais + Inspiracao para CRM Politico

**Projeto:** Mandato Desk 2026
**Data:** 2026-04-07
**Objetivo:** Fundamentar escolhas de cor e design com base em design systems governamentais reais e psicologia das cores para contexto politico/institucional.

---

## PARTE 1 — PALETAS DE CORES PARA CRM POLITICO/INSTITUCIONAL

---

### 1.1 Fontes de Referencia: Design Systems Governamentais

#### USWDS (U.S. Web Design System)
- URL: https://designsystem.digital.gov/design-tokens/color/overview/
- Sistema de tokens com escala 0-100 de luminosidade
- Paleta primaria baseada em azul institucional (#005ea2)
- Cores semanticas completas para estados de interface

**Tokens Tematicos USWDS:**
| Token | Hex |
|-------|-----|
| primary-lighter | #d9e8f6 |
| primary-light | #73b3e7 |
| primary | #005ea2 |
| primary-vivid | #0050d8 |
| primary-dark | #1a4480 |
| primary-darker | #162e51 |
| base-lightest | #f0f0f0 |
| base-lighter | #dfe1e2 |
| base-light | #a9aeb1 |
| base | #71767a |
| base-dark | #565c65 |
| base-darker | #3d4551 |
| base-darkest | #1b1b1b |
| accent-warm | #fa9441 |
| accent-warm-dark | #c05600 |
| accent-cool | #00bde3 |

**Cores de Estado USWDS:**
| Token | Hex |
|-------|-----|
| info-lighter | #e7f6f8 |
| info | #00bde3 |
| info-dark | #009ec1 |
| success-lighter | #ecf3ec |
| success | #00a91c |
| success-dark | #008817 |
| warning-lighter | #faf3d1 |
| warning | #ffbe2e |
| warning-dark | #e5a000 |
| error-lighter | #f4e3db |
| error | #d54309 |
| error-dark | #b50909 |

#### GOV.UK Design System
- URL: https://design-system.service.gov.uk/styles/colour/
- Abordagem minimalista com foco em acessibilidade

**Cores GOV.UK:**
| Token | Hex |
|-------|-----|
| brand | #1d70b8 |
| link | #1a65a6 |
| link-hover | #0f385c |
| link-visited | #54319f |
| text | #0b0c0c |
| secondary-text | #484949 |
| border | #cecece |
| template-background | #f4f8fb |
| body-background | #ffffff |
| focus | #ffdd00 |
| error | #ca3535 |
| success | #0f7a52 |

#### GOV.BR Design System (Brasil)
- URL: https://www.gov.br/ds/fundamentos-visuais/cores
- Sistema oficial do governo federal brasileiro

**Escala Azul GOV.BR:**
| Token | Hex |
|-------|-----|
| blue-5 | #eff6fb |
| blue-10 | #dbe8fb |
| blue-20 | #aacdec |
| blue-30 | #73b3e7 |
| blue-40 | #4f97d1 |
| blue-50 | #2378c3 |
| blue-60 | #2c608a |
| blue-70 | #274863 |
| blue-80 | #1f303e |
| blue-90 | #11181d |

**Cores Semanticas GOV.BR:**
| Funcao | Hex |
|--------|-----|
| Success | #00a91c / #168821 |
| Warning | #ffcd07 / #ffbe2e |
| Error | #e52207 / #b50909 |
| Info | #155bcb / #2670e8 |

---

### 1.2 Psicologia das Cores para Contexto Politico

**Fontes consultadas:**
- Sutton & Smart Political Consulting
- Color Psychology Organization
- UAE Design System Insights
- Medium/Bootcamp UX Analysis

**Principios-chave:**
1. **Azul marinho/Navy (#000080 a #1a4480)** — Projeta autoridade intelectual, expertise em politicas publicas, confianca. Usuarios avaliam interfaces em azul escuro como 23% mais confiaveis.
2. **Dourado/Gold (#c5a347 a #ca9a2c)** — Prosperidade, valor, tradicioi. Usado como acento em contextos governamentais (UAE usa #ca9a2c).
3. **Verde escuro (#006b48 a #0f7a52)** — Associado a cura, calma, crescimento. Usado para sinais de sucesso.
4. **Cinza neutro** — Profissionalismo, sobriedade. Base para interfaces que nao distraem do conteudo.
5. **Usuarios decidem se um design "parece confiavel" em 50ms** — a cor e o fator mais importante nessa decisao.
6. **Contraste minimo 4.5:1** para texto normal (WCAG 2.2 AA) — acessibilidade constroi confianca funcional.

---

### 1.3 TRES PROPOSTAS DE PALETA COMPLETA

---

#### PALETA A — Navy Institucional

Inspirada em USWDS + GOV.UK. Azul marinho profundo com acento dourado. Transmite autoridade, tradicioi e competencia.

**Primary (Navy Blue):**
| Nivel | Hex | Uso |
|-------|-----|-----|
| 50 | #f0f4f8 | Background sutil, hover leve |
| 100 | #d9e2ec | Badges background, selection |
| 200 | #bcccdc | Borders accent, dividers |
| 300 | #9fb3c8 | Icones desabilitados |
| 400 | #627d98 | Texto placeholder |
| 500 | #334e68 | Texto secundario |
| 600 | #243b53 | Texto primario sobre fundo claro |
| 700 | #1a4480 | **Cor principal — botoes, links** |
| 800 | #162e51 | Hover de botoes, headers |
| 900 | #102a43 | Background de sidebar, texto forte |

**Accent (Gold):**
| Token | Hex | Uso |
|-------|-----|-----|
| accent-light | #fdf6e3 | Background de destaque |
| accent | #c5a347 | Badges, indicadores, estrelas |
| accent-dark | #8e704f | Texto sobre fundo dourado |

**Secondary (Teal):**
| Token | Hex | Uso |
|-------|-----|-----|
| secondary-light | #e0f2f1 | Background alternativo |
| secondary | #0d7377 | Links secundarios, tags |
| secondary-dark | #014d40 | Hover de elementos secundarios |

**Neutros:**
| Token | Hex | Uso |
|-------|-----|-----|
| background | #ffffff | Fundo principal |
| surface | #f7f9fc | Cards, paineis elevados |
| border | #d9e2ec | Bordas padrao |
| border-subtle | #e4e8ee | Bordas sutis |
| text-primary | #102a43 | Texto principal |
| text-secondary | #486581 | Texto secundario |
| text-muted | #829ab1 | Texto terciario, placeholders |

**Semanticas:**
| Token | Hex | Uso |
|-------|-----|-----|
| success | #0f7a52 | Confirmacoes, status OK |
| success-light | #e6f4ed | Background de sucesso |
| warning | #e5a000 | Alertas, atencao |
| warning-light | #fef3cd | Background de alerta |
| error | #ca3535 | Erros, exclusao |
| error-light | #fce8e8 | Background de erro |
| info | #1d70b8 | Informacoes, dicas |
| info-light | #e7f0f8 | Background de info |

---

#### PALETA B — Slate Moderno

Inspirada em GOV.BR + shadcn/ui (Slate). Visual moderno e limpo com acento amber. Transmite modernidade, eficiencia e transparencia.

**Primary (Slate Blue):**
| Nivel | Hex | Uso |
|-------|-----|-----|
| 50 | #f8fafc | Background sutil |
| 100 | #f1f5f9 | Hover leve, zebra rows |
| 200 | #e2e8f0 | Borders, dividers |
| 300 | #cbd5e1 | Icones inativos |
| 400 | #94a3b8 | Placeholders |
| 500 | #64748b | Texto secundario |
| 600 | #475569 | Texto corpo |
| 700 | #334155 | Headers, labels |
| 800 | #1e293b | **Cor principal — sidebar, botoes** |
| 900 | #0f172a | Background forte, modo escuro |

**Accent (Amber):**
| Token | Hex | Uso |
|-------|-----|-----|
| accent-light | #fffbeb | Background de destaque |
| accent | #f59e0b | Badges, notificacoes, CTAs |
| accent-dark | #b45309 | Texto sobre fundo amber |

**Secondary (Blue):**
| Token | Hex | Uso |
|-------|-----|-----|
| secondary-light | #eff6ff | Background alternativo |
| secondary | #2563eb | Links, botoes secundarios |
| secondary-dark | #1d4ed8 | Hover de links |

**Neutros:**
| Token | Hex | Uso |
|-------|-----|-----|
| background | #ffffff | Fundo principal |
| surface | #f8fafc | Cards, paineis |
| border | #e2e8f0 | Bordas padrao |
| border-subtle | #f1f5f9 | Bordas sutis |
| text-primary | #0f172a | Texto principal |
| text-secondary | #475569 | Texto secundario |
| text-muted | #94a3b8 | Placeholders, hints |

**Semanticas:**
| Token | Hex | Uso |
|-------|-----|-----|
| success | #16a34a | Confirmacoes |
| success-light | #f0fdf4 | Background sucesso |
| warning | #eab308 | Alertas |
| warning-light | #fefce8 | Background alerta |
| error | #dc2626 | Erros |
| error-light | #fef2f2 | Background erro |
| info | #2563eb | Informacoes |
| info-light | #eff6ff | Background info |

---

#### PALETA C — Dark Mode First

Inspirada na abordagem do "Nosso CRM" (DESIGN_SYSTEM.md existente) + USWDS dark. Para uso com dark mode como padrao, com light mode como secundario.

**Background & Surface (Dark):**
| Token | Hex | Uso |
|-------|-----|-----|
| bg-primary | #0c1222 | Background principal |
| bg-secondary | #111827 | Background de secoes |
| surface | #1a2332 | Cards, modais |
| surface-elevated | #243044 | Dropdowns, popovers |
| border | #2d3a4e | Bordas padrao |
| border-subtle | #1f2937 | Bordas sutis |

**Background & Surface (Light — alternativo):**
| Token | Hex | Uso |
|-------|-----|-----|
| bg-primary | #f8fafc | Background principal |
| bg-secondary | #f1f5f9 | Background de secoes |
| surface | #ffffff | Cards, modais |
| surface-elevated | #ffffff | Dropdowns, popovers |
| border | #e2e8f0 | Bordas padrao |
| border-subtle | #f1f5f9 | Bordas sutis |

**Texto (Dark):**
| Token | Hex | Uso |
|-------|-----|-----|
| text-primary | #f1f5f9 | Texto principal |
| text-secondary | #94a3b8 | Texto secundario |
| text-muted | #64748b | Placeholders, hints |

**Texto (Light):**
| Token | Hex | Uso |
|-------|-----|-----|
| text-primary | #0f172a | Texto principal |
| text-secondary | #475569 | Texto secundario |
| text-muted | #94a3b8 | Placeholders |

**Primary (Azul vibrante):**
| Nivel | Hex | Uso |
|-------|-----|-----|
| 50 | #eff6ff | Background sutil (light) |
| 100 | #dbeafe | Selection (light) |
| 200 | #bfdbfe | Borders accent |
| 300 | #93c5fd | Links inativos |
| 400 | #60a5fa | Icones, destaques |
| 500 | #3b82f6 | **Cor principal** |
| 600 | #2563eb | Hover primario |
| 700 | #1d4ed8 | Pressed state |
| 800 | #1e40af | Headers |
| 900 | #1e3a5f | Background accent |

**Accent (Cyan/Teal):**
| Token | Hex | Uso |
|-------|-----|-----|
| accent-light | #ecfeff | Background accent (light) |
| accent | #06b6d4 | Badges, metricas, graficos |
| accent-dark | #0891b2 | Hover de accent |

**Semanticas (funcionam em ambos os modos):**
| Token | Dark Hex | Light Hex | Uso |
|-------|----------|-----------|-----|
| success | #22c55e | #16a34a | Confirmacoes |
| success-bg | #052e16 | #f0fdf4 | Background sucesso |
| warning | #eab308 | #ca8a04 | Alertas |
| warning-bg | #422006 | #fefce8 | Background alerta |
| error | #ef4444 | #dc2626 | Erros |
| error-bg | #450a0a | #fef2f2 | Background erro |
| info | #38bdf8 | #0ea5e9 | Informacoes |
| info-bg | #082f49 | #f0f9ff | Background info |

---

### 1.4 Comparativo Rapido

| Aspecto | Paleta A (Navy) | Paleta B (Slate) | Paleta C (Dark First) |
|---------|----------------|------------------|----------------------|
| Sensacao | Tradicional, autoritativo | Moderno, limpo | Tech-forward, premium |
| Melhor para | Gabinetes conservadores | Mandatos jovens/modernos | Equipes tech-savvy |
| Acessibilidade | Excelente (alto contraste) | Excelente | Boa (requer cuidado) |
| Referencia | USWDS + GOV.UK | shadcn/ui + GOV.BR | Nosso CRM + USWDS dark |
| Cor dominante | Navy #1a4480 | Slate #1e293b | Blue #3b82f6 |
| Acento | Gold #c5a347 | Amber #f59e0b | Cyan #06b6d4 |

---

## PARTE 2 — SITES DE INSPIRACAO E RECURSOS

---

### 2.1 Dribbble — CRM Dashboard Designs

| # | URL | Descricao | Utilidade |
|---|-----|-----------|-----------|
| 1 | https://dribbble.com/tags/crm-dashboard | Tag principal de CRM Dashboard — 800+ designs | Visao geral de tendencias visuais para dashboards CRM |
| 2 | https://dribbble.com/tags/crm-dashboard-design | Designs especificos de CRM Dashboard Design | Layouts de dashboard com KPIs e graficos |
| 3 | https://dribbble.com/tags/crm-design | CRM Design geral — inclui telas alem do dashboard | Fluxos completos: lista de contatos, pipelines, formularios |
| 4 | https://dribbble.com/tags/crm-system | CRM System — foco em sistemas completos | Arquitetura de navegacao e sidebar de CRM |
| 5 | https://dribbble.com/search/crm-dashboard | Busca direta por CRM Dashboard | Resultados mais recentes, ordenados por relevancia |

### 2.2 Behance — CRM UI Design Projects

| # | URL | Descricao | Utilidade |
|---|-----|-----------|-----------|
| 1 | https://www.behance.net/gallery/215887035/Stratus-CRM-SaaS-UX-UI-Dashboard-Design | Stratus CRM — 3K likes, 54K views. Design completo SaaS | Layout de dashboard profissional com hierarquia clara |
| 2 | https://www.behance.net/gallery/225392757/AI-Cloud-CRM-Dashboard-UI-UX-Design | AI Cloud CRM Dashboard (2025) | Integracao de IA em CRM, tendencia relevante |
| 3 | https://www.behance.net/gallery/192839517/Salesforce-CRM-SaaS-UX-UI-Design-Dashboard | Salesforce CRM redesign — 2.9K likes | Referencia de como redesenhar um CRM enterprise |
| 4 | https://www.behance.net/gallery/216727985/Salesforce-CRM-SaaS-Web-Dashboard-UI-UX | Salesforce CRM Web Dashboard (Jan 2025) — 1.2K likes | Dashboard web com data viz moderna |
| 5 | https://www.behance.net/gallery/211526839/Revanto-Sales-SaaS-CRM-UI-UX-Dashboard-Design | Revanto Sales CRM — SaaS Dashboard | Pipeline de vendas e analytics de performance |

### 2.3 Figma Community — CRM Templates

| # | URL | Descricao | Utilidade |
|---|-----|-----------|-----------|
| 1 | https://www.figma.com/community/file/1280859785089566943/customer-relationship-management-design-kit | Customer Relationship Management Design Kit | Kit completo de CRM com componentes reutilizaveis |
| 2 | https://www.figma.com/community/file/1314473325670153023/crm-system | CRM System — template completo | Sistema CRM com multiplas telas e fluxos |
| 3 | https://www.figma.com/community/file/1225543896057231775/twilio-crm-template | Twilio CRM Template — usa Paste design system | Referencia de call center CRM, canais de comunicacao |
| 4 | https://www.figma.com/community/file/1079247176455024827/crm-dashboard | CRM Dashboard template | Dashboard especifico com graficos e metricas |
| 5 | https://www.figma.com/community/file/1554177993232416414/shadcn-ui-design-system-2025-free | Shadcn/UI Design System 2025 (FREE) | **Altamente relevante** — componentes shadcn que usamos no projeto |

### 2.4 Mobbin — Dashboard/CRM Patterns

| # | URL | Descricao | Utilidade |
|---|-----|-----------|-----------|
| 1 | https://mobbin.com/explore/web/app-categories/crm | CRM Web Design — categoria completa | Screenshots reais de CRMs em producao |
| 2 | https://mobbin.com/explore/web/screens/dashboard | Dashboard Web — 990+ designs | Padroes de layout de dashboard reais |
| 3 | https://mobbin.com/explore/mobile/app-categories/crm | CRM Mobile — apps reais | Referencia para responsividade |
| 4 | https://mobbin.com/collections/3972e0eb-4e54-4a98-b954-4652433c84c5/web/screens | Dashboard CRM Collection (curada) | Colecao focada em CRM dashboard |
| 5 | https://mobbin.com/collections/4d26c749-ffea-41ca-848b-aaa4ccb7c15e/web/screens | CRM Chart Ideas Collection | Ideias de graficos e data viz para CRM |

### 2.5 Muzli — Dashboard Inspiration

| # | URL | Descricao | Utilidade |
|---|-----|-----------|-----------|
| 1 | https://muz.li/blog/best-dashboard-design-examples-inspirations-for-2026/ | 50 Best Dashboard Designs 2026 | Tendencias atuais, organizadas por tipo |
| 2 | https://muz.li/inspiration/dashboard-inspiration/ | 60+ Dashboards, admin panels & analytics | Colecao geral de dashboards e paineis admin |
| 3 | https://muz.li/blog/top-dashboard-design-examples-inspirations-for-2025/ | Top Dashboard Examples 2025 | Evolucao de tendencias ano anterior |
| 4 | https://search.muz.li/NzA4ZjBkZDhj | CustomerGo CRM Dashboard UI Kit | Kit especifico de CRM no Muzli |
| 5 | https://muz.li/inspiration/ | Design Inspiration Collections (geral) | Colecoes curadas por categoria |

### 2.6 Refero.design

| # | URL | Descricao | Utilidade |
|---|-----|-----------|-----------|
| 1 | https://refero.design/ | Biblioteca principal — 124K+ screenshots reais | Buscar por "CRM", "dashboard", "contacts" |
| 2 | https://demo.refero.design/ | Demo/Research do Refero | Testar busca antes de assinar |

**Nota:** Refero requer cadastro para acesso completo. A versao gratuita permite buscas limitadas. Contem screenshots reais de SaaS em producao — mais util que mockups de Dribbble para decisoes de produto.

### 2.7 SaaS Landing Pages & CRM Marketing

| # | URL | Descricao | Utilidade |
|---|-----|-----------|-----------|
| 1 | https://saaslandingpage.com/tag/crm/ | 12 Best CRM Landing Pages | Como CRMs se apresentam ao mercado |
| 2 | https://www.saasframe.io/landing-page-examples/crm | 17 CRM Landing Page Examples (2026) | Exemplos mais recentes de landing pages CRM |
| 3 | https://www.landingfolio.com/inspiration/landing-page/crm | CRM Landing Page Designs — Landingfolio | Colecao curada de landing pages CRM |
| 4 | https://saaspo.com/industry/crm-saas-websites-inspiration | 39 CRM SaaS Landing Pages — Saaspo | Grande colecao de sites CRM |
| 5 | https://www.saasui.design/ | SaaS UI UX Patterns — screenshots reais | Padroes de UI de SaaS em producao |

### 2.8 Component Libraries & Theme Tools

| # | URL | Descricao | Utilidade |
|---|-----|-----------|-----------|
| 1 | https://www.tremor.so/ | Tremor — 35+ componentes React para dashboards | Charts, KPIs, tabelas. Usa Tailwind + Recharts (mesmo que nos) |
| 2 | https://npm.tremor.so/ | Tremor NPM — docs de componentes | Referencia de API e exemplos |
| 3 | https://ui.shadcn.com/docs/theming | shadcn/ui Theming docs | **Base do nosso projeto** — como customizar cores |
| 4 | https://ui.shadcn.com/create | shadcn/ui Theme Creator | Gerar tema custom com preview |
| 5 | https://tweakcn.com/ | tweakcn — Theme Editor visual para shadcn/ui | Editor visual com preview em tempo real, export CSS |
| 6 | https://shadcnstudio.com/theme-generator | Shadcn Studio — gerador de temas | Gerar paleta completa para shadcn |
| 7 | https://shadcnthemer.com/ | ShadCN Themer — temas da comunidade | Navegar temas prontos da comunidade |
| 8 | https://uicolorful.com/ | UI Colorful — gerador de cores shadcn + Tailwind | Gerar paleta com preview de componentes |
| 9 | https://tailwindcss.com/plus | Tailwind Plus (ex-Tailwind UI) — 500+ componentes | Templates e componentes premium |
| 10 | https://tailadmin.com/ | TailAdmin — dashboard admin gratuito | Template completo de admin com Tailwind |

---

### 2.9 Design Systems Governamentais (Referencia de Autoridade)

| # | URL | Descricao | Utilidade |
|---|-----|-----------|-----------|
| 1 | https://designsystem.digital.gov/ | USWDS — U.S. Web Design System | Referencia #1 em design governamental |
| 2 | https://design-system.service.gov.uk/ | GOV.UK Design System | Minimalismo e acessibilidade britanica |
| 3 | https://www.gov.br/ds/fundamentos-visuais/cores | GOV.BR Design System — Cores | Sistema oficial brasileiro |
| 4 | https://designsystem.gov.ae/ | UAE Design System | Perspectiva nao-ocidental sobre confianca |
| 5 | https://dsgov.estaleiro.serpro.gov.br/ | DS Gov (SERPRO) — versao anterior | Versao legacy do DS Gov brasileiro |

---

## PARTE 3 — RECOMENDACAO

Para o **Mandato Desk 2026**, considerando que:
- E um CRM para gabinetes politicos brasileiros
- Precisa transmitir confianca e competencia
- Usa React + shadcn/ui + Tailwind (facil de customizar)
- Ja tem infrastructure dark mode do projeto anterior

**Recomendacao:** Comecar com **Paleta A (Navy Institucional)** como base, com opcao de dark mode usando elementos da **Paleta C**. O navy transmite autoridade sem ser pesado, o dourado como acento da sofisticacao sem ser ostentoso, e as cores semanticas sao comprovadas por 3 design systems governamentais.

**Ferramentas para implementar:**
1. Usar https://tweakcn.com/ para gerar o CSS variables
2. Consultar https://ui.shadcn.com/docs/theming para estrutura
3. Buscar inspiracao de layout em https://mobbin.com/explore/web/app-categories/crm
4. Componentes de graficos/KPI: https://www.tremor.so/

---

*Pesquisa realizada com dados de: USWDS, GOV.UK, GOV.BR, UAE Design System, Dribbble, Behance, Figma Community, Mobbin, Muzli, Refero, Tremor, shadcn/ui, Tailwind UI.*
