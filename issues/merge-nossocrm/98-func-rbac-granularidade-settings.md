# 98 — RBAC Granular: Sub-seções em Configurações

**Tipo:** Funcional (refatoração RBAC)
**Fase:** Futura / Opcional — executar só quando houver demanda real
**Depende de:** 99-func-rbac-novas-secoes
**Desbloqueia:** —

## Contexto
A issue 99 adiciona `board`, `tarefas` e `configuracoes` como seções do RBAC. No MVP, `configuracoes` é um **bloco único admin-only**: ou o user tem acesso a tudo (todas as 7 abas), ou a nada. Isso é suficiente para começar.

Mas em algum momento o cliente pode pedir granularidade: "a assistente X pode mexer em Campos Personalizados mas não em Usuários". Essa é a hora de executar esta issue.

## O que descobrimos na investigação

O sistema RBAC tem **hardcoding triplo**:

1. **Tipo TypeScript** em `src/types/permissions.ts`:
   ```ts
   export type Secao = 'dashboard' | 'contatos' | 'liderancas' | /* ... */ ;
   export const SECOES: Secao[] = [...];
   export const SECAO_LABELS: Record<Secao, string> = {...};
   ```

2. **Mapeamento rota→seção** em `src/components/layout/AppSidebar.tsx`:
   ```ts
   const NAV_ITEMS: NavItem[] = [...];
   const SECAO_TO_PERMISSION: Record<Secao, (can) => boolean> = {...};
   ```

3. **Seed default** em `src/hooks/usePermissoesAdmin.ts` (função `generateDefaultPermissions`): cria 1 row por `(role, secao)` combinando cada role com cada seção.

**E mais um ponto**: todas as RLS policies das tabelas do Supabase chamam uma função SQL `has_permission(user_id, secao_text, acao_text)` que consulta `permissoes_perfil` por igualdade exata de `secao`.

A coluna `secao` é TEXT sem constraint — tecnicamente aceita qualquer string, incluindo `configuracoes.geral`. Mas o código TypeScript não reconhece essas subs como valores válidos.

## Estratégia: convenção de ponto + refatoração mínima

Em vez de criar um sistema hierárquico real (com tabela filha ou JSONB), usar **strings com ponto** e tratar a hierarquia por convenção:

```
configuracoes           ← guard geral: pode entrar em /settings?
configuracoes.geral     ← pode mexer na aba Geral (campos custom, tags, página inicial)
configuracoes.funis     ← pode criar/editar boards em Settings → Funis
configuracoes.equipe    ← pode gerenciar usuários
configuracoes.perms     ← pode editar matriz de permissões (perigoso, admin-only)
configuracoes.integracoes
configuracoes.ia
configuracoes.branding
```

Regra: `can(x.y)` implica `can(x)` — se o usuário pode em `configuracoes.funis`, ele automaticamente pode em `configuracoes` (para conseguir acessar a página).

## Arquivos a modificar

### 1. `src/types/permissions.ts`
Adicionar as novas seções:
```ts
export type Secao =
  | 'dashboard' | 'contatos' | 'liderancas' | 'demandas' | 'mapa'
  | 'importacao' | 'board' | 'tarefas'
  | 'configuracoes'
  | 'configuracoes.geral'
  | 'configuracoes.funis'
  | 'configuracoes.equipe'
  | 'configuracoes.perms'
  | 'configuracoes.integracoes'
  | 'configuracoes.ia'
  | 'configuracoes.branding';

export const SECOES: Secao[] = [ /* atualizar lista */ ];

export const SECAO_LABELS: Record<Secao, string> = {
  // ... existentes
  'configuracoes': 'Configurações (geral)',
  'configuracoes.geral': '└ Geral',
  'configuracoes.funis': '└ Funis',
  'configuracoes.equipe': '└ Equipe',
  'configuracoes.perms': '└ Permissões',
  'configuracoes.integracoes': '└ Integrações',
  'configuracoes.ia': '└ Central de IA',
  'configuracoes.branding': '└ Personalização',
};
```

### 2. `src/hooks/usePermissoes.ts` — helper de prefix-implica
```ts
const canView = (secao: Secao): boolean => {
  if (isAdminEffective) return true;
  // Match exato
  if (findPermissao(secao)?.pode_ver) return true;
  // Se perguntou por 'configuracoes' (sem sub), aceita se TEM qualquer configuracoes.*
  if (!secao.includes('.')) {
    return permissoes.some(p => p.secao.startsWith(`${secao}.`) && p.pode_ver);
  }
  // Se perguntou por 'configuracoes.geral', aceita se TEM configuracoes (pai)
  const parent = secao.split('.')[0] as Secao;
  return findPermissao(parent)?.pode_ver ?? false;
};
```

**Regra clara:** ter permissão em qualquer filho habilita o pai (para navegação). Ter permissão no pai habilita todos os filhos (herança descendente).

### 3. `src/pages/Settings.tsx` — guardar cada aba
```tsx
const { canView } = usePermissoes();

<Tabs>
  <TabsList>
    {canView('configuracoes.geral')       && <TabsTrigger value="geral">Geral</TabsTrigger>}
    {canView('configuracoes.funis')       && <TabsTrigger value="funis">Funis</TabsTrigger>}
    {canView('configuracoes.equipe')      && <TabsTrigger value="equipe">Equipe</TabsTrigger>}
    {canView('configuracoes.perms')       && <TabsTrigger value="perms">Permissões</TabsTrigger>}
    {canView('configuracoes.integracoes') && <TabsTrigger value="integ">Integrações</TabsTrigger>}
    {canView('configuracoes.ia')          && <TabsTrigger value="ia">IA</TabsTrigger>}
    {canView('configuracoes.branding')    && <TabsTrigger value="brand">Personalização</TabsTrigger>}
  </TabsList>
  {/* TabsContent idem com guards */}
</Tabs>
```

Se um user tenta acessar `/settings?tab=perms` sem permissão, mostrar empty state "Sem acesso a esta seção" em vez de redirect (preserva contexto).

### 4. `src/pages/Permissoes.tsx` — matriz com indentação
A UI da matriz agora mostra sub-seções indentadas:
```
Configurações (geral)                [ver] [criar] [editar] [deletar]
  └ Geral                             [ver] [criar] [editar] [deletar]
  └ Funis                             [ver] [criar] [editar] [deletar]
  └ Equipe                            [ver] [criar] [editar] [deletar]
  ...
```

Marcar a linha pai como "rollup": sua permissão é ligada automaticamente quando qualquer filho é ligado. Marcar visualmente como readonly.

### 5. `src/components/layout/AppSidebar.tsx`
Item "Configurações" continua como um só (nav é sobre a página, não sobre as abas). Só mostrar o item se `canView('configuracoes')` — com a herança nova, isso retorna true se o usuário tem acesso a qualquer sub.

### 6. `src/hooks/usePermissoesAdmin.ts` — seed default
```ts
function generateDefaultPermissions(role: Role): PermissaoPerfilSeed[] {
  const baseAdmin = { pode_ver: true, pode_criar: true, pode_editar: true, pode_deletar: true };
  const baseRead  = { pode_ver: true, pode_criar: false, pode_editar: false, pode_deletar: false };
  const baseNone  = { pode_ver: false, pode_criar: false, pode_editar: false, pode_deletar: false };

  if (role === 'admin') {
    return SECOES.map(secao => ({ role, secao, ...baseAdmin }));
  }
  if (role === 'proprietario') {
    return SECOES.map(secao => ({
      role, secao,
      ...(secao.startsWith('configuracoes.perms') ? baseNone : baseAdmin),
    }));
  }
  // ... assessor, assistente, estagiario
}
```

### 7. Migration de dados (opcional)
Migrar permissões atuais para a nova estrutura. Se no momento da execução `configuracoes` já existe como bloco único, a migration expande:

```sql
-- Para cada row existente de (role, 'configuracoes'), criar rows filhas idênticas
INSERT INTO permissoes_perfil (role, secao, pode_ver, pode_criar, pode_editar, pode_deletar)
SELECT role,
       unnest(ARRAY['configuracoes.geral','configuracoes.funis','configuracoes.equipe',
                    'configuracoes.perms','configuracoes.integracoes',
                    'configuracoes.ia','configuracoes.branding']),
       pode_ver, pode_criar, pode_editar, pode_deletar
FROM permissoes_perfil WHERE secao = 'configuracoes'
ON CONFLICT (role, secao) DO NOTHING;
```

Opcionalmente **remover** a row `configuracoes` (mas melhor manter como "rollup" controlado pelo código).

### 8. Função SQL `has_permission` (opcional)
Não precisa mudar. A função usa igualdade exata de `secao`, e como usamos convenção de string, já funciona. Se quiser que ela também faça a herança ancestral-descendente para o backend, pode adicionar:

```sql
CREATE OR REPLACE FUNCTION has_permission(_user_id UUID, _module TEXT, _action TEXT)
RETURNS BOOLEAN AS $$
  -- ... lógica existente
  -- match exato
  IF FOUND THEN RETURN _perm.pode_ver; END IF;

  -- Tentativa de fallback para seção pai (se _module é 'configuracoes.xyz', tenta 'configuracoes')
  IF position('.' in _module) > 0 THEN
    SELECT * INTO _perm FROM permissoes_perfil
      WHERE role = _role AND secao = split_part(_module, '.', 1);
    IF FOUND THEN RETURN _perm.pode_ver; END IF;
  END IF;

  RETURN FALSE;
$$ LANGUAGE plpgsql;
```

Mas como as tabelas de configurações (`ai_settings`, `custom_fields`, etc.) já têm RLS próprias com check de `role = 'admin'`, talvez nem precise.

## Critérios de Aceite
- [ ] Tipo `Secao` estendido com as 7 sub-seções
- [ ] Hook `usePermissoes` implementa herança pai↔filho corretamente
- [ ] `/settings` mostra apenas as abas permitidas
- [ ] Matriz em `/permissoes` (ou `/settings?tab=perms`) renderiza com indentação
- [ ] Seed default preenche as novas sub-seções
- [ ] Migration de dados copia permissões existentes de `configuracoes` para as filhas
- [ ] Testes manuais: criar user com acesso só a `configuracoes.funis` → só vê a aba Funis, sidebar mostra item Configurações
- [ ] Admin continua vendo tudo sem mudança perceptível
- [ ] Build passa
- [ ] Zero regressão nas outras seções (contatos, demandas, etc.)

## Verificação
```bash
# SQL: verificar rows criadas
npx supabase db query --linked "
  SELECT role, secao, pode_ver FROM permissoes_perfil
  WHERE secao LIKE 'configuracoes%'
  ORDER BY role, secao;
"
```

Manualmente:
1. Logar como admin → criar um role "testador" que tem só `configuracoes.funis`
2. Trocar um user para role "testador"
3. Logar como user "testador" → sidebar mostra só Dashboard + Configurações
4. Clicar Configurações → só aba Funis visível
5. Tentar acessar `/settings?tab=equipe` direto → empty state "sem acesso"

## Por que deixar opcional?
Porque **refatoração de RBAC quando não há demanda** é pior que "perfeito inimigo do bom":
- Risco de regressão em todas as seções existentes
- Maior complexidade mental para quem lê o código depois
- Se o cliente nunca pedir granularidade, foi trabalho desperdiçado

**Executar só quando**:
- Cliente A pede especificamente "user X pode mexer em funis mas não em usuários"
- Ou há incidente de user mexendo em algo que não deveria
- Ou uma auditoria exige justificar o controle de acesso por aba

Até lá, a issue 99 (bloco único) é suficiente e segura.

## Referências no código
- `src/types/permissions.ts` — tipos centrais
- `src/hooks/usePermissoes.ts` — lógica de check
- `src/hooks/usePermissions.tsx` — wrapper com métodos específicos
- `src/pages/Permissoes.tsx` — UI da matriz
- `src/hooks/usePermissoesAdmin.ts` — seed default + mutations
- `supabase/migrations/*` — função `has_permission`
- `src/components/layout/AppSidebar.tsx` — `NAV_ITEMS` e `SECAO_TO_PERMISSION`
