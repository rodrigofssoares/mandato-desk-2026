# Plano de Personalização — Mandato Desk 2026

> Documento de planejamento para o módulo de Personalização (`/branding`).
> Criado em: 2026-03-13

---

## 📊 Estado Atual

O módulo atual (`src/pages/Branding.tsx`) oferece apenas:
- Nome do mandato (texto)
- Cor primária (color picker)
- Preview básico de botões

**Banco de dados:** tabela `branding_settings` com campos `mandate_name` e `primary_color`.

---

## 🎯 Visão: Módulo de Personalização Profissional

Transformar o módulo básico em um centro de personalização completo, organizado em **abas/seções**, similar aos melhores CRMs do mercado.

---

## 📋 Plano de Implementação — 6 Seções

### Seção 1: Tema (Claro / Escuro / Automático)

**O que faz:** Permite ao usuário escolher entre tema claro, escuro ou automático (segue o sistema operacional).

**Funcionalidades:**
- Toggle visual com 3 opções: ☀️ Claro / 🌙 Escuro / 💻 Sistema
- Preview em tempo real ao alternar
- Persistência por usuário (localStorage + Supabase para sincronizar entre dispositivos)
- O tema escuro já está configurado no CSS (`.dark` em `index.css`) e o `next-themes` já está instalado

**Esforço:** Baixo — a infraestrutura já existe. Só precisa melhorar o UX do toggle e adicionar a opção "Sistema".

**Referência:** HubSpot, Pipedrive, Monday.com — todos oferecem toggle claro/escuro nas preferências.

---

### Seção 2: Cores e Identidade Visual

**O que faz:** Expandir o color picker atual para um sistema completo de identidade visual.

**Funcionalidades:**
- **Cor primária** (já existe) — usada em botões, links, destaques
- **Cor secundária** — para acentos, badges, hover states
- **Cor da sidebar** — fundo e texto da navegação lateral
- **Paletas pré-definidas** — 8-12 paletas prontas para escolha rápida (ex: "Institucional Azul", "Governo Verde", "Elegante Cinza", "Energia Laranja")
- **Preview em tempo real** — componente que mostra como o CRM ficará com as cores escolhidas
- **Reset para padrão** — botão para voltar às cores originais

**Paletas sugeridas:**

| Nome | Primária | Secundária | Sidebar | Inspiração |
|------|----------|------------|---------|------------|
| Sky (padrão) | `#0ea5e9` | `#6366f1` | `#1e293b` | Atual |
| Governo | `#059669` | `#0d9488` | `#1a2e1a` | Institucional |
| Político Clássico | `#1d4ed8` | `#7c3aed` | `#1e1b4b` | Formal |
| Laranja Social | `#ea580c` | `#d97706` | `#431407` | Impactante |
| Rosa Moderno | `#db2777` | `#a855f7` | `#500724` | Moderno |
| Cinza Neutro | `#475569` | `#64748b` | `#0f172a` | Sóbrio |
| Verde Esperança | `#16a34a` | `#65a30d` | `#14532d` | Partido |
| Vermelho Ação | `#dc2626` | `#f97316` | `#450a0a` | Engajamento |

**Schema do banco (expandido):**
```sql
ALTER TABLE branding_settings ADD COLUMN secondary_color TEXT DEFAULT '#6366f1';
ALTER TABLE branding_settings ADD COLUMN sidebar_color TEXT DEFAULT '#1e293b';
ALTER TABLE branding_settings ADD COLUMN sidebar_text_color TEXT DEFAULT '#ffffff';
ALTER TABLE branding_settings ADD COLUMN preset_name TEXT DEFAULT 'sky';
```

**Referência:** Monday.com (paletas pré-definidas), Notion (cores de acento), Salesforce (Lightning Theme).

---

### Seção 3: Logo e Imagem de Marca

**O que faz:** Permite upload de logotipo e favicon personalizados.

**Funcionalidades:**
- **Logo principal** — exibido no topo da sidebar e na tela de login
- **Logo compacto** — ícone usado quando a sidebar está colapsada
- **Favicon** — ícone da aba do navegador
- Upload via Supabase Storage (bucket `branding`)
- Suporte a PNG, SVG, JPG (max 2MB)
- Crop/resize automático com preview
- Opção de remover e voltar ao texto padrão

**Schema do banco:**
```sql
ALTER TABLE branding_settings ADD COLUMN logo_url TEXT;
ALTER TABLE branding_settings ADD COLUMN logo_compact_url TEXT;
ALTER TABLE branding_settings ADD COLUMN favicon_url TEXT;
```

**Referência:** Bitrix24 (logo + favicon customizável), Freshdesk (logo na sidebar + login), Zoho CRM (marca completa).

---

### Seção 4: Layout e Navegação

**O que faz:** Permite ajustar a disposição visual do CRM.

**Funcionalidades:**
- **Posição da sidebar:** Esquerda (padrão) ou Direita
- **Sidebar colapsada por padrão:** Sim / Não
- **Densidade do conteúdo:** Compacto / Normal / Espaçoso (altera padding/gap)
- **Fonte:** Inter (padrão) / Roboto / Poppins / Nunito (fontes populares e legíveis)
- **Tamanho da fonte base:** Pequeno (14px) / Médio (16px) / Grande (18px)
- **Formato de data:** DD/MM/AAAA / AAAA-MM-DD
- **Cards com bordas arredondadas:** Sim / Não

**Schema do banco:**
```sql
ALTER TABLE branding_settings ADD COLUMN sidebar_position TEXT DEFAULT 'left';
ALTER TABLE branding_settings ADD COLUMN sidebar_collapsed BOOLEAN DEFAULT false;
ALTER TABLE branding_settings ADD COLUMN content_density TEXT DEFAULT 'normal';
ALTER TABLE branding_settings ADD COLUMN font_family TEXT DEFAULT 'Inter';
ALTER TABLE branding_settings ADD COLUMN font_size TEXT DEFAULT 'medium';
ALTER TABLE branding_settings ADD COLUMN date_format TEXT DEFAULT 'DD/MM/YYYY';
ALTER TABLE branding_settings ADD COLUMN rounded_cards BOOLEAN DEFAULT true;
```

**Referência:** ClickUp (densidade + fonte), Asana (layout compacto/confortável), Jira (sidebar colapsável + posição).

---

### Seção 5: Página de Login Personalizada

**O que faz:** Customizar a tela de login para refletir a identidade do mandato.

**Funcionalidades:**
- **Imagem de fundo** — upload ou escolha entre 6-8 backgrounds pré-definidos (Brasília, Câmara, paisagens institucionais)
- **Texto de boas-vindas** — ex: "Bem-vindo ao Gabinete do Vereador João"
- **Subtítulo** — ex: "Sistema de Gestão do Mandato"
- **Estilo do card de login:** Glassmorphism / Sólido / Minimal
- **Cor do overlay** sobre a imagem de fundo

**Schema do banco:**
```sql
ALTER TABLE branding_settings ADD COLUMN login_bg_url TEXT;
ALTER TABLE branding_settings ADD COLUMN login_bg_preset TEXT DEFAULT 'default';
ALTER TABLE branding_settings ADD COLUMN login_title TEXT DEFAULT 'Bem-vindo';
ALTER TABLE branding_settings ADD COLUMN login_subtitle TEXT DEFAULT 'Sistema de Gestão do Mandato';
ALTER TABLE branding_settings ADD COLUMN login_card_style TEXT DEFAULT 'glass';
ALTER TABLE branding_settings ADD COLUMN login_overlay_color TEXT DEFAULT 'rgba(0,0,0,0.5)';
```

**Referência:** Salesforce (login page builder), Bitrix24 (background + logo no login), Freshdesk (tela de login brandada).

---

### Seção 6: Preferências Pessoais (por usuário)

**O que faz:** Configurações individuais que NÃO afetam outros usuários.

**Funcionalidades:**
- **Módulo inicial** — qual página abrir após login (Dashboard, Contatos, Demandas)
- **Notificações sonoras** — ligar/desligar
- **Idioma da interface** — pt-BR (padrão), en-US, es-ES (futuro)
- **Animações reduzidas** — para acessibilidade (prefers-reduced-motion)
- **Itens por página** — 10 / 25 / 50 / 100 em listagens

**Nota:** Estas configurações são por usuário, não globais. Precisam de uma tabela separada.

**Schema do banco (nova tabela):**
```sql
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  initial_page TEXT DEFAULT '/',
  sound_notifications BOOLEAN DEFAULT true,
  locale TEXT DEFAULT 'pt-BR',
  reduced_motion BOOLEAN DEFAULT false,
  items_per_page INTEGER DEFAULT 25,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);
```

**Referência:** Notion (preferências pessoais separadas), Linear (configurações de notificação + tema por usuário), HubSpot (defaults por conta).

---

## 🏗️ Arquitetura da Implementação

### Estrutura de Componentes

```
src/
├── pages/
│   └── Branding.tsx                    # Página principal (refatorada com abas)
├── components/
│   └── branding/
│       ├── BrandingTabs.tsx            # Container de abas (Tabs do shadcn)
│       ├── ThemeSection.tsx            # Seção 1: Tema claro/escuro
│       ├── ColorsSection.tsx           # Seção 2: Cores e paletas
│       ├── ColorPresetCard.tsx         # Card de paleta pré-definida
│       ├── LogoSection.tsx             # Seção 3: Upload de logos
│       ├── LogoUploader.tsx            # Componente de upload com preview
│       ├── LayoutSection.tsx           # Seção 4: Layout e navegação
│       ├── LoginCustomSection.tsx      # Seção 5: Tela de login
│       ├── LoginPreview.tsx            # Preview da tela de login
│       ├── UserPreferencesSection.tsx  # Seção 6: Preferências pessoais
│       └── BrandingPreview.tsx         # Preview geral em tempo real
├── hooks/
│   ├── useBranding.ts                  # (expandir) Hook de branding global
│   └── useUserPreferences.ts           # (novo) Hook de preferências por usuário
└── context/
    └── BrandingContext.tsx              # (novo) Context para aplicar branding globalmente
```

### Fluxo de Dados

```
Supabase (branding_settings)
  → useBranding() hook
    → BrandingContext (Provider no App.tsx)
      → CSS Variables aplicadas dinamicamente no :root
        → Todos os componentes refletem as mudanças
```

### Aplicação Dinâmica de Cores

```typescript
// BrandingContext.tsx — aplica as cores do branding como CSS variables
useEffect(() => {
  const root = document.documentElement;
  if (branding?.primary_color) {
    const hsl = hexToHSL(branding.primary_color);
    root.style.setProperty('--primary', `${hsl.h} ${hsl.s}% ${hsl.l}%`);
  }
  if (branding?.secondary_color) {
    const hsl = hexToHSL(branding.secondary_color);
    root.style.setProperty('--accent', `${hsl.h} ${hsl.s}% ${hsl.l}%`);
  }
  // ... sidebar, etc.
}, [branding]);
```

---

## 📊 Referências de CRMs Profissionais

### 1. **HubSpot CRM**
- Tema claro/escuro
- Logo customizável
- Cores da marca aplicadas em emails e landing pages
- Branding da conta (nome, domínio, favicon)
- **Destaque:** Aplica branding em todas as comunicações externas

### 2. **Salesforce Lightning**
- "Lightning App Builder" com temas customizáveis
- Paletas de cores completas
- Logo na navegação e login
- Temas por app (diferentes áreas do CRM podem ter temas distintos)
- **Destaque:** Nível enterprise de customização visual

### 3. **Pipedrive**
- Tema claro/escuro
- Logo da empresa no topo
- Preferências de visualização por usuário
- **Destaque:** Simplicidade — poucas opções mas muito bem executadas

### 4. **Monday.com**
- Paletas pré-definidas (9 opções)
- Tema claro/escuro
- Logo + favicon customizável
- Opção de ocultar logo Monday
- **Destaque:** Paletas prontas que facilitam a vida do usuário

### 5. **ClickUp**
- Tema claro/escuro + 5 temas coloridos
- Densidade: Compact / Comfortable / Roomy
- Fonte customizável
- Sidebar: posição e comportamento
- **Destaque:** Maior quantidade de opções de personalização entre CRMs

### 6. **Bitrix24**
- Login page totalmente customizável
- Logo + favicon + cores
- Background da tela de login
- Menu lateral customizável (ordem, visibilidade)
- **Destaque:** Foco em white-label (remover marca Bitrix)

### 7. **Notion**
- Tema claro/escuro/sistema
- Fonte: Default / Serif / Mono
- Largura do conteúdo: Default / Full
- Preferências pessoais separadas de preferências do workspace
- **Destaque:** Separação clara entre configurações pessoais e do workspace

### 8. **Linear**
- Tema: claro/escuro/sistema
- Preferências de notificação granulares
- Display: compact/comfortable
- Atalhos de teclado customizáveis
- **Destaque:** UI minimalista e elegante para configurações

---

## 📅 Ordem de Implementação Sugerida

### Fase 1 — Fundação (Prioridade Alta)
1. **Seção 1: Tema** — Quick win, infraestrutura já existe
2. **Seção 2: Cores** — Expande o que já existe, alto impacto visual
3. **BrandingContext** — Necessário para aplicar mudanças globalmente

### Fase 2 — Identidade (Prioridade Média)
4. **Seção 3: Logo** — Requer Supabase Storage, mas alto valor
5. **Seção 5: Login** — Diferenciador forte para mandatos

### Fase 3 — Refinamento (Prioridade Normal)
6. **Seção 4: Layout** — Ajustes finos de UX
7. **Seção 6: Preferências** — Tabela nova + per-user logic

---

## 🎨 Mockup da Interface (Layout das Abas)

```
┌─────────────────────────────────────────────────────────┐
│  Personalização                                         │
│                                                         │
│  ┌──────┬────────┬──────┬────────┬───────┬─────────┐   │
│  │ Tema │ Cores  │ Logo │ Layout │ Login │ Pessoal │   │
│  └──────┴────────┴──────┴────────┴───────┴─────────┘   │
│                                                         │
│  ┌─────────────────────┐  ┌──────────────────────────┐  │
│  │                     │  │                          │  │
│  │   Configurações     │  │      Preview em          │  │
│  │   da aba ativa      │  │      Tempo Real          │  │
│  │                     │  │                          │  │
│  │   (formulários,     │  │   (mini-visualização     │  │
│  │    toggles,         │  │    do CRM com as         │  │
│  │    color pickers)   │  │    configurações         │  │
│  │                     │  │    aplicadas)            │  │
│  │                     │  │                          │  │
│  └─────────────────────┘  └──────────────────────────┘  │
│                                                         │
│  ┌──────────────────┐  ┌─────────────────────────────┐  │
│  │  Salvar Mudanças  │  │  Resetar para Padrão       │  │
│  └──────────────────┘  └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## ⚙️ Requisitos Técnicos

- **Supabase Storage** — bucket `branding` para logos e backgrounds
- **Migrations** — expandir tabela `branding_settings` + criar `user_preferences`
- **next-themes** — já instalado, expandir uso
- **react-colorful** ou similar — color picker mais profissional (opcional, pode manter o atual)
- **Conversão hex→HSL** — utilitário para aplicar cores nas CSS variables

---

## ❓ Decisões que Precisam do Usuário

1. **Quer implementar todas as 6 seções?** Ou começar com algumas específicas?
2. **Prioridade:** Quer seguir a ordem sugerida (Fase 1 → 2 → 3)?
3. **Preferências pessoais (Seção 6):** Implementar agora ou deixar para depois?
4. **Upload de logo:** Supabase Storage já está configurado no projeto?
5. **Quer adicionar opção de customizar a ordem dos itens do menu lateral?**

---

*Plano criado por Claude Opus 4.6 — Mandato Desk 2026*
