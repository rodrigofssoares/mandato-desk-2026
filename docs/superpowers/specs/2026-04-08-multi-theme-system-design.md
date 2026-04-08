# Spec: Sistema de Multi-Temas — Mandato Desk 2026

## Contexto
O Mandato Desk 2026 usa sky blue como primary e tem 2 modos (light/dark) via `next-themes`. O usuario escolheu a paleta Navy Institucional como padrao e quer que o usuario final possa alternar entre 3 temas: Navy (light), Midnight Dark e Obsidian Navy.

## Decisoes
- **Tema padrao:** Navy Institucional (light)
- **Temas disponiveis:** navy (light), midnight (dark azul/purple), obsidian (dark teal/coral)
- **Seletor:** Pagina Personalizacao (`/branding`) — cards visuais com preview
- **Persistencia:** `localStorage` key `mandato_theme` (ja gerenciado por next-themes)
- **Fontes:** Nao mudam (Space Grotesk + Inter + Cinzel)
- **Sidebar:** Clara em todos os temas (usuario escolheu)
- **Header toggle:** Manter sun/moon — cicla entre os 3 temas em ordem

## Arquitetura

### Como funciona hoje
- `next-themes` com `ThemeProvider attribute="class" defaultTheme="dark"`
- CSS: `:root` (light) e `.dark` (dark) em `src/index.css`
- Tailwind: `darkMode: ["class"]`
- Toggle no Header: `setTheme(theme === 'dark' ? 'light' : 'dark')`
- Branding page: 3 opcoes (light, dark, system)

### Como vai funcionar
- `next-themes` com `themes={['navy', 'midnight', 'obsidian']}` e `defaultTheme="navy"`
- CSS: `.navy` (light navy), `.midnight` (dark blue/purple), `.obsidian` (dark teal/coral)
- Tailwind: `darkMode: ["class"]` — classes `.midnight` e `.obsidian` adicionadas ao dark mode via `darkMode: ["selector", '[class*="midnight"],[class*="obsidian"]']` OU manter `["class"]` e aplicar `.dark` junto com `.midnight`/`.obsidian`
- Toggle no Header: cicla navy → midnight → obsidian → navy
- Branding page: 3 cards visuais com preview real de cada tema

### Abordagem CSS simplificada
Para manter compatibilidade com `dark:` do Tailwind, os temas dark (midnight/obsidian) tambem aplicam classe `dark` no HTML. Assim:
- `.navy` = tema light (sem classe `dark`)
- `.midnight` = `dark midnight` no `<html>` — tokens do midnight sobreescrevem `.dark`
- `.obsidian` = `dark obsidian` no `<html>` — tokens do obsidian sobreescrevem `.dark`

Isso garante que `dark:text-white` e similar continuem funcionando.

## Arquivos a modificar

### 1. `src/index.css` — CSS Variables
Substituir `:root` e `.dark` por:

```css
/* Navy (light) — padrao */
:root, .navy {
  --background: 213 25% 97%;
  --foreground: 215 50% 8%;
  --primary: 213 65% 30%;        /* #1A4480 */
  --primary-foreground: 0 0% 100%;
  --ring: 213 65% 30%;
  /* ... demais tokens navy */
}

/* Midnight Dark */
.dark, .midnight {
  --background: 228 60% 6%;      /* #06091A */
  --foreground: 228 30% 96%;
  --primary: 226 100% 69%;       /* #638BFF */
  --primary-foreground: 0 0% 100%;
  --ring: 226 100% 69%;
  /* ... demais tokens midnight */
}

/* Obsidian (sobreescreve .dark quando presente) */
.obsidian {
  --background: 220 50% 6%;      /* #080C18 */
  --foreground: 222 30% 95%;
  --primary: 171 65% 50%;        /* #2DD4BF */
  --primary-foreground: 0 0% 100%;
  --ring: 171 65% 50%;
  /* ... demais tokens obsidian */
}
```

OKLCH tokens tambem atualizados para cada tema.

### 2. `tailwind.config.ts` — Primary palette
Trocar hex values da escala primary de sky blue para navy:
```
50: '#EBF1F7', 100: '#D0DDE9', ..., 500: '#1A4480', ..., 900: '#08162C'
```

### 3. `src/App.tsx` — ThemeProvider config
```tsx
<ThemeProvider 
  attribute="class" 
  defaultTheme="navy"
  themes={['navy', 'midnight', 'obsidian']}
  enableSystem={false}
>
```

Para midnight/obsidian, precisamos que `next-themes` aplique tambem `dark`:
- Usar `value` prop: `value={{ navy: '', midnight: 'dark midnight', obsidian: 'dark obsidian' }}`

### 4. `src/pages/Branding.tsx` — Seletor de temas
Substituir os 3 cards atuais (light/dark/system) por:

```tsx
const themeOptions = [
  { value: 'navy', label: 'Navy', icon: Sun, description: 'Institucional e confiavel', colors: { bg: '#F5F7FA', sidebar: '#F8FAFC', primary: '#1A4480' } },
  { value: 'midnight', label: 'Midnight', icon: Moon, description: 'Dark mode azul e moderno', colors: { bg: '#06091A', sidebar: '#0D1225', primary: '#638BFF' } },
  { value: 'obsidian', label: 'Obsidian', icon: Moon, description: 'Dark mode teal sofisticado', colors: { bg: '#080C18', sidebar: '#0F1423', primary: '#2DD4BF' } },
];
```

Cards com mini-preview usando as cores reais de cada tema.

### 5. `src/components/layout/Header.tsx` — Toggle atualizado
Ciclar entre 3 temas:
```tsx
const nextTheme = { navy: 'midnight', midnight: 'obsidian', obsidian: 'navy' };
onClick={() => setTheme(nextTheme[theme] || 'navy')}
```
Icone: Sun para navy, Moon para midnight/obsidian.

## Paletas completas

### Navy (Light)
| Token | HSL | Hex |
|-------|-----|-----|
| background | 213 25% 97% | #F5F7FA |
| foreground | 215 50% 8% | #0C1829 |
| card | 0 0% 100% | #FFFFFF |
| primary | 213 65% 30% | #1A4480 |
| secondary | 213 25% 95% | #EEF2F7 |
| muted | 213 25% 95% | #EEF2F7 |
| muted-foreground | 215 16% 53% | #6B7F96 |
| accent | 213 25% 95% | #EEF2F7 |
| border | 213 25% 87% | #D4DCE8 |
| destructive | 0 84% 60% | #EF4444 |

### Midnight (Dark)
| Token | HSL | Hex |
|-------|-----|-----|
| background | 228 60% 6% | #06091A |
| foreground | 228 30% 96% | #F0F2F8 |
| card | 228 40% 10% | #0D1225 |
| primary | 226 100% 69% | #638BFF |
| secondary | 228 40% 15% | #151C3A |
| muted | 228 40% 15% | #151C3A |
| muted-foreground | 228 15% 54% | #8B93B0 |
| accent | 228 40% 15% | #151C3A |
| border | 228 40% 15% | #1A2345 |
| destructive | 0 86% 71% | #F87171 |

### Obsidian (Dark)
| Token | HSL | Hex |
|-------|-----|-----|
| background | 220 50% 6% | #080C18 |
| foreground | 222 30% 95% | #EDF0F7 |
| card | 222 35% 10% | #0F1423 |
| primary | 171 65% 50% | #2DD4BF |
| secondary | 222 35% 15% | #181F35 |
| muted | 222 35% 15% | #181F35 |
| muted-foreground | 222 15% 49% | #7E8AA0 |
| accent | 222 35% 15% | #181F35 |
| border | 222 35% 15% | #1E2742 |
| destructive | 0 86% 71% | #F87171 |

## Verificacao
1. `npm run build` — deve compilar sem erros
2. Abrir no browser — tema navy deve ser o padrao
3. Ir em Personalizacao — trocar para Midnight, verificar que dark mode funciona
4. Trocar para Obsidian — verificar cores teal
5. Recarregar pagina — tema deve persistir
6. Toggle no header — deve ciclar navy → midnight → obsidian
7. Verificar que `dark:` classes do Tailwind funcionam em midnight e obsidian
