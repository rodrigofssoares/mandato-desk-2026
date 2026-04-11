# 51 — Redirects Legacy → /settings

**Tipo:** Funcional
**Fase:** 6
**Depende de:** 32-func-page-settings-hub, 50-func-sidebar-nova
**Desbloqueia:** —

## Objetivo
As rotas antigas (`/branding`, `/users`, `/permissoes`, `/google-integration`, `/api`, `/webhooks`, `/tags`) saíram da sidebar mas ainda podem estar em bookmarks, links externos e webhooks antigos. Converter cada uma em **redirect 301 client-side** para `/settings?tab=xxx`.

## Arquivo a modificar
- `src/App.tsx`

## Diff alvo
```tsx
import { Navigate } from 'react-router-dom';

<Routes>
  {/* ... rotas existentes ... */}

  {/* Legacy redirects — remover após 90 dias */}
  <Route path="/branding"           element={<Navigate to="/settings?tab=brand" replace />} />
  <Route path="/users"              element={<Navigate to="/settings?tab=equipe" replace />} />
  <Route path="/permissoes"         element={<Navigate to="/settings?tab=perms" replace />} />
  <Route path="/google-integration" element={<Navigate to="/settings?tab=integ&sub=google" replace />} />
  <Route path="/api"                element={<Navigate to="/settings?tab=integ&sub=api" replace />} />
  <Route path="/webhooks"           element={<Navigate to="/settings?tab=integ&sub=webhooks" replace />} />
  <Route path="/tags"               element={<Navigate to="/settings?tab=geral#tags" replace />} />
</Routes>
```

## Nota
Manter os componentes de página antigos (`src/pages/Users.tsx`, etc.) no repositório **apenas como wrappers** que chamam o mesmo conteúdo extraído na issue 32 — ou apagar se não forem mais usados por ninguém. **Não deletar o conteúdo** extraído em `src/components/users/UsersContent.tsx` (esse continua sendo usado pelas tabs).

## Critérios de Aceite
- [ ] Todas as 7 rotas legacy redirecionam corretamente
- [ ] Deep link com query string preservado no destino
- [ ] Recarregar página em `/branding` leva direto para `/settings?tab=brand`
- [ ] Sem warnings de console
- [ ] Build passa
- [ ] Qualquer link interno no código que ainda aponte para `/users`, `/branding`, etc. foi atualizado para apontar para `/settings?tab=...`

## Verificação
- Acessar manualmente cada URL antiga → confirmar redirect
- Usar `grep` para achar links internos ainda apontando para rotas legacy e atualizar
- Testar com histórico do navegador (voltar/avançar funciona)

## Comando para achar links legacy no código
```bash
grep -rn "href=\"/users\"\|href=\"/branding\"\|href=\"/permissoes\"\|href=\"/api\"\|href=\"/webhooks\"\|href=\"/tags\"\|href=\"/google-integration\"" src/
grep -rn "to=\"/users\"\|to=\"/branding\"\|..." src/
grep -rn "navigate(\"/users\")\|navigate(\"/branding\")\|..." src/
```
