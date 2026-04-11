# 05 — Protótipo: Campos Personalizados (Gerenciador + Aba no Contato)

**Tipo:** Protótipo visual
**Fase:** 2
**Depende de:** 04-proto-settings-hub
**Desbloqueia:** 33-func-tab-campos-personalizados, 41-func-contato-aba-personalizados

## Objetivo
Mockar visualmente (a) o gerenciador de campos personalizados dentro de Settings → Geral, e (b) a nova aba "Personalizados" no detalhe do contato. Sem persistência.

## Wireframe — Gerenciador
```
── Campos Personalizados ─── [+ Adicionar] ────────────────
┌─ Aplica-se a: Contatos ──────────────────────────────┐
│ Cargo Liderança     Texto     Filtrável  ✏ 🗑       │
│ Data últ. visita    Data      Filtrável  ✏ 🗑       │
│ Nº dependentes      Número    Filtrável  ✏ 🗑       │
│ Território          Lista     Filtrável  ✏ 🗑       │
└───────────────────────────────────────────────────────┘
```

## Wireframe — Aba no contato
```
[Dados Pessoais] [Endereço] [Tags] [Personalizados🆕] [Histórico]
── Personalizados ──
Cargo Liderança:    [Presidente Associação▼]
Data últ. visita:   [15/03/2026          ]
Nº dependentes:     [3                    ]
Território:         [Zona Sul     ▼]
[Salvar alterações]
```

## Arquivos a criar
- `src/components/settings/CustomFieldsManager.tsx`
- `src/components/settings/CustomFieldFormDialog.tsx` (criar/editar campo)
- `src/components/contacts/CustomFieldsPanel.tsx` (aba no contato)

## Critérios de Aceite
- [ ] Gerenciador mostra lista mockada com 4 campos
- [ ] Botão "+ Adicionar" abre dialog com campos: rótulo, tipo (select), opções (se tipo=seleção), filtrável (switch)
- [ ] Panel no contato renderiza form dinâmico baseado no array mockado
- [ ] Cada tipo renderiza input apropriado (text/number/date/switch/select)
- [ ] Visual alinhado ao resto do Settings

## Como testar
- Acessar `/settings?tab=geral` → ver gerenciador
- Clicar "+ Adicionar" → dialog abre
- Acessar detalhe de um contato → aba "Personalizados" aparece
