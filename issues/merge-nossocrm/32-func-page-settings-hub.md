# 32 — Settings Hub (shell com abas)

**Tipo:** Funcional
**Fase:** 2
**Depende de:** 04-proto-settings-hub-wireframes
**Desbloqueia:** 33, 34, 35, 41, 51

## Objetivo
Transformar o protótipo em hub funcional, absorvendo as páginas existentes (Branding, Users, Permissoes, Google, API, Webhooks, Tags) como abas internas. Nessa issue ainda não plugamos features novas (Funis, IA, Campos) — apenas a estrutura de tabs + as abas existentes funcionando.

## Arquivos a criar/modificar
- `src/pages/Settings.tsx`
- `src/App.tsx` (adicionar rota `/settings`)
- `src/components/settings/GeneralTab.tsx`
- `src/components/settings/TeamTab.tsx` → importa conteúdo de `src/pages/Users.tsx`
- `src/components/settings/PermsTab.tsx` → importa de `src/pages/Permissoes.tsx`
- `src/components/settings/IntegrationsTab.tsx` → Google + API + Webhooks em sub-abas internas
- `src/components/settings/BrandingTab.tsx` → importa de `src/pages/Branding.tsx`

## Refatoração necessária
As páginas atuais (`Users.tsx`, `Branding.tsx`, etc.) podem ter layout próprio com `<AppLayout>` wrapper. Extrair o **miolo** dessas páginas em componentes reutilizáveis:

```tsx
// src/pages/Users.tsx (antes)
export default function Users() {
  return <AppLayout><UsersContent /></AppLayout>;
}

// src/components/users/UsersContent.tsx (novo — extraído)
export function UsersContent() { /* ... */ }

// settings/TeamTab.tsx
import { UsersContent } from '@/components/users/UsersContent';
export function TeamTab() { return <UsersContent />; }
```

Assim a rota antiga `/users` continua funcionando E `/settings?tab=equipe` também.

## Tabs
```
Geral | Funis | Equipe | Permissões | Integrações | IA | Personalização
```
Aba "Funis" fica desabilitada com tooltip "Em breve" até a issue 34.
Aba "IA" também fica desabilitada até a issue 35.
Aba "Geral" mostra placeholder até a issue 33 preencher com Campos Personalizados.

## URL state
- `/settings` → default para `?tab=geral`
- Troca de aba atualiza URL sem recarregar
- Deep link `?tab=equipe` abre na aba certa

## Critérios de Aceite
- [ ] Rota `/settings` funcional
- [ ] 7 abas visíveis
- [ ] Abas absorvidas (Equipe, Perms, Integ, Brand) renderizam conteúdo real
- [ ] Sub-abas internas em Integrações (Google | API | Webhooks)
- [ ] URL sincroniza com aba ativa
- [ ] Abas "Funis" e "IA" aparecem desabilitadas (não quebram)
- [ ] Build passa

## Verificação
- `/settings?tab=equipe` → lista de usuários aparece
- `/settings?tab=brand` → form de branding aparece
- Clicar em "Funis" mostra tooltip "em breve"
