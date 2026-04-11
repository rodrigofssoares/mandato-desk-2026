# 35 — Aba IA: Central de Configuração de IA

**Tipo:** Funcional
**Fase:** 2
**Depende de:** 13-func-schema-ai-settings, 32-func-page-settings-hub
**Desbloqueia:** (futuras features de IA)

## Objetivo
Implementar a aba "IA" onde o admin configura provider, modelo, chave API e feature flags. Esta issue cobre só a INFRAESTRUTURA — nenhuma feature de IA é ligada ainda.

## Arquivos a criar/modificar
- `src/components/settings/AISettingsTab.tsx`
- `src/hooks/useAISettings.ts`

## Layout
```
╔══ Central de I.A ══════════════════════════════════════════╗
║ Provider:  (•) Anthropic   ( ) OpenAI   ( ) Google         ║
║ Modelo:    [claude-opus-4-6           ▼]                   ║
║ Chave API: [••••••••••••••••••••••]  [Testar] [Salvar]   ║
║                                                             ║
║ [x] IA ativa na organização                                ║
║                                                             ║
║ Features disponíveis:                                       ║
║ [ ] Resumo automático de demandas                          ║
║ [ ] Sugestão de próximas ações em contatos                 ║
║ [ ] Análise de risco de eleitores                          ║
║                                                             ║
║ ⚠ Só admins podem alterar essas configurações               ║
╚════════════════════════════════════════════════════════════╝
```

## Modelos por provider (hardcoded)
```ts
const MODELOS = {
  anthropic: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
  openai: ['gpt-4.1', 'gpt-4.1-mini', 'o3'],
  google: ['gemini-2.5-pro', 'gemini-2.5-flash'],
};
```

## "Testar chave"
Faz uma request mínima ao provider selecionado (ex: list models endpoint) e mostra toast success/error. Implementar em `src/lib/ai/testApiKey.ts`.

## Permissões
- Form inteiro desabilitado se o usuário não é admin
- RLS já bloqueia leitura da chave para não-admin
- `useAISettings` esconde `api_key` no retorno para não-admin (ou retorna mascarado `••••`)

## Critérios de Aceite
- [ ] Form carrega config atual do Supabase
- [ ] Salvar persiste
- [ ] Toggle `ai_enabled` funcional
- [ ] Features salvas em `features` jsonb
- [ ] "Testar chave" retorna ok/erro sem salvar
- [ ] Não-admin vê form desabilitado com mensagem
- [ ] Chave API mascarada após salvar (só mostra 4 últimos dígitos)
- [ ] Build passa

## Verificação
- Admin: abrir aba → setar provider anthropic + chave → testar → salvar → recarregar → valor persistido
- User comum: abrir aba → ver mensagem "apenas admin"
