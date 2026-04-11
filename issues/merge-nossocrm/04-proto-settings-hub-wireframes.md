# 04 — Protótipo: Settings Hub com Abas

**Tipo:** Protótipo visual
**Fase:** 2
**Depende de:** —
**Desbloqueia:** 32-func-page-settings-hub

## Objetivo
Construir `/settings` com abas shadcn (`Tabs`), sem conteúdo funcional — cada aba renderiza apenas um placeholder. Serve como shell que depois será preenchido.

## Wireframe
```
╔══ CONFIGURAÇÕES ═══════════════════════════════════════════╗
║ [Geral] [Funis] [Equipe] [Perms] [Integrações] [IA] [Brand]║
╠════════════════════════════════════════════════════════════╣
║ ── Conteúdo da aba ativa ──                                 ║
║ [Placeholder: "Geral — em construção"]                      ║
╚════════════════════════════════════════════════════════════╝
```

## Arquivos a criar
- `src/pages/Settings.tsx`
- `src/components/settings/GeneralTab.tsx` (stub)
- `src/components/settings/FunisTab.tsx` (stub)
- `src/components/settings/TeamTab.tsx` (stub)
- `src/components/settings/PermsTab.tsx` (stub)
- `src/components/settings/IntegrationsTab.tsx` (stub)
- `src/components/settings/AISettingsTab.tsx` (stub)
- `src/components/settings/BrandingTab.tsx` (stub)

## Critérios de Aceite
- [ ] Rota `/settings` declarada
- [ ] 7 abas visíveis, cada uma clicável
- [ ] Aba ativa preserva estado em URL (`?tab=geral`)
- [ ] Cada stub mostra título da aba + mensagem "em construção"
- [ ] Responsivo: em mobile, abas viram scroll horizontal
- [ ] Visual alinhado ao Navy Institucional (DESIGN_SYSTEM.md)

## Como testar
- Acessar `/settings` → clicar em cada aba → URL muda
- Recarregar com `?tab=ia` → abre aba IA
