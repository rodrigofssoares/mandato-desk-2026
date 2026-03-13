# Design System — Nosso CRM (Thales Laray)

Documentação completa do sistema de design do projeto CRM.

**Stack:** Next.js 16 + React 19 + Tailwind CSS v4 + shadcn/ui + Framer Motion
**Tema padrão:** Dark Mode (OKLCH color space)
**Idioma:** Português (pt-BR)

---

## 1. Cores & Temas

### Paleta Primária (Sky Blue)

| Token | Hex | Uso |
|-------|-----|-----|
| `primary-50` | `#f0f9ff` | Background sutil |
| `primary-100` | `#e0f2fe` | Hover leve |
| `primary-200` | `#bae6fd` | Borders accent |
| `primary-300` | `#7dd3fc` | Links secundários |
| `primary-400` | `#38bdf8` | Ícones, destaques |
| `primary-500` | `#0ea5e9` | **Cor principal** |
| `primary-600` | `#0284c7` | Hover primário |
| `primary-700` | `#0369a1` | Pressed state |
| `primary-800` | `#075985` | Texto sobre fundo claro |
| `primary-900` | `#0c4a6e` | Texto forte |

### Cores do Dark Theme

| Token | Hex | Uso |
|-------|-----|-----|
| `dark-bg` | `#020617` | Background principal |
| `dark-card` | `#0f172a` | Cards, painéis |
| `dark-border` | `#1e293b` | Bordas |
| `dark-hover` | `#334155` | Hover states |

### Cores Semânticas (OKLCH)

#### Light Mode

| Token | OKLCH | Uso |
|-------|-------|-----|
| `--color-bg` | `oklch(97% 0.005 90)` | Background (creme suave) |
| `--color-surface` | `oklch(99% 0.002 90)` | Superfícies elevadas |
| `--color-muted` | `oklch(95% 0.008 90)` | Backgrounds secundários |
| `--color-border` | `oklch(90% 0.01 90)` | Bordas padrão |
| `--color-border-subtle` | `oklch(93% 0.008 90)` | Bordas sutis |

#### Dark Mode

| Token | OKLCH | Uso |
|-------|-------|-----|
| `--color-bg` | `oklch(11% 0.025 260)` | Background (slate profundo) |
| `--color-surface` | `oklch(15% 0.02 260)` | Superfícies elevadas |
| `--color-muted` | `oklch(22% 0.015 260)` | Backgrounds secundários |
| `--color-border` | `oklch(26% 0.012 260)` | Bordas padrão |
| `--color-border-subtle` | `oklch(22% 0.01 260 / 0.6)` | Bordas sutis (com transparência) |

### Cores de Status

| Status | Light | Dark | Background | Texto Light | Texto Dark |
|--------|-------|------|------------|-------------|------------|
| **Success** | `oklch(65% 0.17 145)` | `oklch(70% 0.17 145)` | `oklch(... / 0.1)` | `oklch(40% 0.15 145)` | `oklch(70% 0.17 145)` |
| **Warning** | `oklch(75% 0.15 85)` | `oklch(80% 0.14 85)` | `oklch(... / 0.1)` | `oklch(50% 0.14 85)` | `oklch(80% 0.14 85)` |
| **Error** | `oklch(62% 0.25 25)` | `oklch(68% 0.24 25)` | `oklch(... / 0.1)` | `oklch(45% 0.23 25)` | `oklch(68% 0.24 25)` |
| **Info** | `oklch(60% 0.20 240)` | `oklch(70% 0.19 240)` | `oklch(... / 0.1)` | `oklch(40% 0.18 240)` | `oklch(70% 0.19 240)` |
| **Orange** | `oklch(70% 0.18 55)` | `oklch(75% 0.17 55)` | - | - | - |

### Cores de Texto

| Token | Light | Dark |
|-------|-------|------|
| `--color-text-primary` | `oklch(25% 0.015 260)` | `oklch(98% 0.002 260)` |
| `--color-text-secondary` | `oklch(45% 0.02 260)` | `oklch(83% 0.015 260)` |
| `--color-text-muted` | `oklch(55% 0.025 260)` | `oklch(72% 0.02 260)` |
| `--color-text-subtle` | `oklch(62% 0.025 260)` | `oklch(62% 0.025 260)` |

### Efeito Glass (Glassmorphism)

| Propriedade | Light | Dark |
|-------------|-------|------|
| Background | `oklch(99% 0.002 90 / 0.8)` | `oklch(15% 0.02 260 / 0.75)` |
| Blur | `10px` | `12px` |
| Border | `oklch(90% 0.01 90 / 0.5)` | `oklch(100% 0 0 / 0.05)` |

### Cores de Gráficos (Charts)

| Token | Light | Dark |
|-------|-------|------|
| Text | `#64748b` | `#94a3b8` |
| Grid | `rgba(148, 163, 184, 0.1)` | `rgba(255, 255, 255, 0.1)` |
| Tooltip BG | `#0f172a` | `#1e293b` |
| Tooltip Border | `rgba(255, 255, 255, 0.1)` | `rgba(255, 255, 255, 0.1)` |
| Tooltip Text | `#f8fafc` | `#f8fafc` |

---

## 2. Tipografia

### Famílias de Fontes

| Classe Tailwind | Font Family | Uso |
|-----------------|-------------|-----|
| `font-sans` | `Inter`, sans-serif | Corpo do texto, labels, botões |
| `font-display` | `Space Grotesk`, sans-serif | Títulos, headings, ênfase |
| `font-serif` | `Cinzel`, serif | Destaques especiais |

### Escala Tipográfica

| Contexto | Tamanho | Peso | Classes |
|----------|---------|------|---------|
| Título do Card | 2xl | semibold | `text-2xl font-semibold` |
| Título do Modal | base → lg | bold | `text-base sm:text-lg font-bold font-display` |
| Descrição do Card | sm | normal | `text-sm` |
| Botão | sm | medium | `text-sm font-medium` |
| Badge | xs | semibold | `text-xs font-semibold` |
| Tab Trigger | sm | medium | `text-sm font-medium` |
| Alert Title | normal | medium | `font-medium` |
| Form Label | xs | bold | `text-xs font-bold` |
| Mensagem de Erro | xs | normal | `text-xs` |

---

## 3. Espaçamento

### Escala Base

Unidade base: **4px** (sistema Tailwind padrão).

| Token | Valor | Exemplos de uso |
|-------|-------|-----------------|
| `0.5` | 2px | Gaps mínimos |
| `1` | 4px | Padding interno pequeno |
| `2` | 8px | Gap entre ícone e texto |
| `3` | 12px | Padding mobile |
| `4` | 16px | Padding padrão, gap de form |
| `5` | 20px | Padding desktop de modal body |
| `6` | 24px | Padding de card |

### Espaçamento por Componente

| Componente | Área | Classes |
|------------|------|---------|
| **Card** | Header | `p-6`, `space-y-1.5` |
| **Card** | Content | `p-6 pt-0` |
| **Card** | Footer | `p-6 pt-0` |
| **Button** | Default | `h-10 px-4 py-2` |
| **Button** | Small | `h-9 px-3` |
| **Button** | Large | `h-11 px-8` |
| **Button** | Icon | `h-10 w-10` |
| **Modal** | Header | `p-3 sm:p-4` |
| **Modal** | Body | `p-4 sm:p-5` |
| **Modal** | Footer | `p-4 sm:p-5` |
| **Badge** | - | `px-2.5 py-0.5` |
| **Form** | Container | `space-y-4` |
| **Input** | Interno | `px-3 py-2` |

---

## 4. Border Radius

| Tamanho | Classe | Uso |
|---------|--------|-----|
| sm | `rounded-sm` | Acentos pequenos |
| md | `rounded-md` | Botões, badges |
| lg | `rounded-lg` | Cards, inputs, modais (mobile) |
| xl | `rounded-xl` | Componentes customizados |
| 2xl | `rounded-2xl` | Modais (desktop), sheets |
| full | `rounded-full` | Badges, avatares, botões de ícone |

---

## 5. Sombras

| Classe | Uso |
|--------|-----|
| `shadow-sm` | Cards, elementos sutis |
| `shadow-md` | Dropdowns, popovers |
| `shadow-lg` | Modais, botões de submit |
| `shadow-xl` | Popovers importantes |
| `shadow-2xl` | Modais fullscreen, action sheets |
| `shadow-lg shadow-{color}-600/20` | Sombras coloridas (ex: botão primário) |

---

## 6. Animações & Transições

### Framer Motion

**Sheet / Action Sheet**
```typescript
// Entrada
initial: { y: 30, opacity: 0, filter: 'blur(10px)' }
animate: { y: 0, opacity: 1, filter: 'blur(0px)' }
exit:    { y: 20, opacity: 0, filter: 'blur(8px)' }

// Transição
transition: { type: 'tween', ease: [0.22, 1, 0.36, 1], duration: 0.22–0.28 }
```

**Backdrop / Overlay**
```typescript
initial: { opacity: 0 }
animate: { opacity: 1 }
exit:    { opacity: 0 }
```

### Animações Tailwind

| Animação | Uso |
|----------|-----|
| `animate-in` / `animate-out` | Fade, zoom, slide |
| `zoom-in-95` | Entrada de modal/dialog |
| `fade-in-0` | Entrada de popover |
| `slide-in-from-top-2` | Dropdown de cima |
| `slide-in-from-bottom-2` | Bottom sheet |
| `animate-spin` | Loading indicators |
| `animate-pulse` | Loading sutil / ênfase |

### Transições

| Classe | Duração | Uso |
|--------|---------|-----|
| `transition-colors` | - | Hover, focus |
| `duration-150` | 150ms | Interações rápidas |
| `duration-200` | 200ms | Interações padrão |
| `duration-300` | 300ms | Interações mais lentas |

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 7. Componentes

### shadcn/ui (Core)

| Componente | Arquivo | Variantes |
|------------|---------|-----------|
| **Button** | `components/ui/button.tsx` | default, destructive, outline, secondary, ghost, link × sm, default, lg, icon |
| **Card** | `components/ui/card.tsx` | CardHeader, CardTitle, CardDescription, CardContent, CardFooter |
| **Badge** | `components/ui/badge.tsx` | default, secondary, destructive, outline |
| **Alert** | `components/ui/alert.tsx` | default, destructive (AlertTitle, AlertDescription) |
| **Avatar** | `components/ui/avatar.tsx` | AvatarImage, AvatarFallback |
| **Tabs** | `components/ui/tabs.tsx` | TabsList, TabsTrigger, TabsContent |
| **Popover** | `components/ui/popover.tsx` | PopoverTrigger, PopoverContent |
| **Tooltip** | `components/ui/tooltip.tsx` | TooltipProvider, Tooltip, TooltipTrigger, TooltipContent |

### Modais & Sheets (Custom)

| Componente | Arquivo | Descrição |
|------------|---------|-----------|
| **Modal** | `components/ui/Modal.tsx` | Dialog com focus trap, Escape key, animação zoom-in, ARIA |
| **ActionSheet** | `components/ui/ActionSheet.tsx` | Bottom sheet estilo iOS, backdrop blur, borda teal |
| **Sheet** | `components/ui/Sheet.tsx` | Bottom sheet leve com framer-motion |
| **FullscreenSheet** | `components/ui/FullscreenSheet.tsx` | Fullscreen mobile com header/footer sticky |
| **LossReasonModal** | `components/ui/LossReasonModal.tsx` | Modal para captura de motivo de perda de deal |

### Formulários

| Componente | Descrição |
|------------|-----------|
| **FormField** | Wrapper com label, erro, hint, ícones de validação |
| **InputField** | Input de texto com estados (idle/valid/invalid) |
| **TextareaField** | Input multiline, min-height 80px |
| **SelectField** | Select HTML com opções e validação |
| **CheckboxField** | Checkbox com label e tratamento de erro |
| **SubmitButton** | Loading state, disabled, variantes (primary/secondary/danger) |
| **FormErrorSummary** | Alert listando todos os erros do formulário |

Todos em `components/ui/FormField.tsx`.

### Componentes Especiais

| Componente | Arquivo | Descrição |
|------------|---------|-----------|
| **AudioPlayer** | `components/ui/AudioPlayer.tsx` | Play/Pause, waveform, barra de progresso, variantes (sent/received/preview) |
| **ContactSearchCombobox** | `components/ui/ContactSearchCombobox.tsx` | Busca fuzzy por nome/email/telefone, auto-select empresa |

---

## 8. Tokens de Modal

Definidos em `components/ui/modalStyles.ts`:

```typescript
// Overlay
'fixed inset-0 md:left-[var(--app-sidebar-width,0px)] z-[9999]
 flex items-stretch sm:items-center justify-center
 bg-slate-900/60 backdrop-blur-sm p-2 sm:p-4'

// Painel
'bg-white dark:bg-dark-card border border-slate-200 dark:border-white/10
 shadow-2xl w-full flex flex-col overflow-hidden rounded-xl sm:rounded-2xl'

// Viewport
'max-h-[calc(90dvh-1rem)] sm:max-h-[calc(90dvh-2rem)]'

// Header
'p-3 sm:p-4 border-b border-slate-200 dark:border-white/10
 flex items-center justify-between shrink-0'

// Título
'text-base sm:text-lg font-bold text-slate-900 dark:text-white font-display'

// Botão fechar
'p-2 hover:bg-slate-100 dark:hover:bg-white/5 rounded-lg
 transition-colors focus-visible-ring'

// Body
'p-4 sm:p-5'

// Footer
'p-4 sm:p-5 border-t border-slate-200 dark:border-white/10
 bg-white dark:bg-dark-card shrink-0'
```

---

## 9. Acessibilidade

### Focus Ring

```css
/* Padrão */
.focus-visible-ring:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: 2px;
}
.dark .focus-visible-ring:focus-visible {
  outline-color: #60a5fa;
}

/* Alto contraste */
.focus-visible-high:focus-visible {
  outline: 3px solid #1d4ed8;
  outline-offset: 2px;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.3);
}
```

### Atributos ARIA Utilizados

| Atributo | Contexto |
|----------|----------|
| `role="dialog"` | Modais |
| `aria-modal="true"` | Dialogs |
| `aria-labelledby` | Título do modal |
| `aria-describedby` | Descrições |
| `aria-invalid="true\|false"` | Inputs de formulário |
| `aria-required="true"` | Campos obrigatórios |
| `aria-busy="true"` | Durante loading |
| `aria-label` | Botões de ícone |
| `aria-hidden="true"` | Elementos decorativos |
| `role="alert"` | Mensagens de erro |
| `aria-live="polite"` | Anúncios de status |
| `role="slider"` | Range inputs |

### Suporte a Leitor de Tela

- **Skip Link** — visível no focus, posição absoluta
- **Live Regions** — anúncios de mudança de status
- **`.sr-only`** — labels escondidos visualmente
- **IDs + labels** — corretamente vinculados em formulários

---

## 10. Design Responsivo

### Breakpoints

| Breakpoint | Largura | Uso |
|------------|---------|-----|
| `sm` | 640px | Tablets pequenos |
| `md` | 768px | Tablets |
| `lg` | 1024px | Desktop |
| `xl` | 1280px | Desktop grande |
| `2xl` | 1536px | Telas wide |

### Padrões Mobile-First

| Contexto | Mobile | Desktop |
|----------|--------|---------|
| Modal | Full width, `rounded-xl` | Centralizado, `rounded-2xl` |
| Padding | `p-3` | `sm:p-4`, `sm:p-5` |
| Texto | `text-base` | `sm:text-lg` |
| Layout | `items-stretch` | `sm:items-center` |
| Sidebar | Escondida | `md:left-[var(--app-sidebar-width)]` |

### Safe Area (Mobile)

```css
padding-bottom: var(--app-safe-area-bottom, 0px);
padding-top: var(--app-safe-area-top, 0px);
```

---

## 11. Estados de Interação

### Validação de Formulários

| Estado | Bordas | Background |
|--------|--------|------------|
| **Idle** | `border-slate-200 dark:border-slate-700` | Padrão |
| **Válido** | `border-green-500 dark:border-green-400` | Padrão |
| **Inválido** | `border-red-500 dark:border-red-400` | `bg-red-50/50 dark:bg-red-900/10` |

### Estados de Botão

| Estado | Estilo |
|--------|--------|
| **Hover** | `hover:bg-primary/90`, `transition-colors` |
| **Disabled** | `opacity-50`, `pointer-events-none`, `cursor-not-allowed` |
| **Active** | `active:scale-95` (feedback físico) |
| **Focus** | Ring azul com offset |

---

## 12. Utilitários CSS Customizados

| Classe | Descrição |
|--------|-----------|
| `font-display` | `font-family: var(--font-display)` (Space Grotesk) |
| `bg-dots` | Padrão radial de pontos (grid 24px) |
| `glass` | Glassmorphism: background + backdrop-blur + border |
| `scrollbar-custom` | Scrollbar webkit customizada (8px, cores slate) |
| `focus-visible-ring` | Ring de foco acessível |
| `focus-visible-high` | Ring de foco alto contraste |

### Content Visibility (Performance)

| Classe | Tamanho Intrínseco | Uso |
|--------|-------------------|-----|
| `cv-auto` | - | Aplica `content-visibility: auto` |
| `cv-row-sm` | 40px | Linhas pequenas |
| `cv-row-md` | 60px | Linhas médias |
| `cv-row-lg` | 80px | Linhas grandes |
| `cv-card` | 120px | Cards |
| `cv-card-lg` | 200px | Cards grandes |

---

## 13. Variáveis CSS de Layout

```css
--app-sidebar-width: 0px;
--app-safe-area-bottom: 0px;
--app-safe-area-top: 0px;
--app-bottom-nav-height: 0px;
```

---

## 14. Utilitário `cn()`

```typescript
// lib/utils/cn.ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

Merge inteligente de classes Tailwind — usado em **todos** os componentes.

---

## 15. Theme Provider

```typescript
// context/ThemeContext.tsx
// Persistência: localStorage key "crm_dark_mode"
// Padrão: dark mode ATIVO
// Aplica/remove classe "dark" no <html>
// Hook: useTheme() → { darkMode: boolean, toggleDarkMode: () => void }
```

Root layout:
```html
<html lang="pt-BR" className="dark" suppressHydrationWarning>
```

---

## 16. Dependências de UI

### Radix UI Primitives

- `@radix-ui/react-accordion`
- `@radix-ui/react-avatar`
- `@radix-ui/react-checkbox`
- `@radix-ui/react-dialog`
- `@radix-ui/react-dropdown-menu`
- `@radix-ui/react-label`
- `@radix-ui/react-popover`
- `@radix-ui/react-scroll-area`
- `@radix-ui/react-select`
- `@radix-ui/react-separator`
- `@radix-ui/react-slider`
- `@radix-ui/react-slot`
- `@radix-ui/react-switch`
- `@radix-ui/react-tabs`
- `@radix-ui/react-tooltip`

### Animação & Motion

- `framer-motion` ^12.23.26

### Ícones

- `lucide-react` ^0.560.0

### CSS

- `class-variance-authority` ^0.7.1
- `clsx` ^2.1.1
- `tailwind-merge` ^3.4.0

### Formulários

- `react-hook-form` ^7.68.0
- `@hookform/resolvers` ^5.2.2
- `zod` ^4.1.13

### Gráficos

- `recharts` ^3.5.1

### Acessibilidade

- `focus-trap-react` ^11.0.4

---

## 17. Decisões de Design

1. **Dark Mode First** — tema escuro como padrão, cores OKLCH para consistência perceptual
2. **Acessibilidade Built-In** — focus traps, ARIA, navegação por teclado em todos os dialogs
3. **Mobile-First** — padding, sizing e layout escalam de mobile para desktop
4. **Glassmorphism** — fundos com blur para overlays e superfícies elevadas
5. **Performance** — `content-visibility: auto` para listas longas
6. **OKLCH** — espaço de cores perceptualmente uniforme em vez de RGB/HSL
7. **Componentes Composáveis** — shadcn/ui + padrões customizados
8. **Restauração de Foco** — modais retornam foco ao elemento de origem
9. **pt-BR** — toda interface e labels em português
