# 99 — RBAC: Novas Seções (board, tarefas, configuracoes)

**Tipo:** Funcional
**Fase:** 6
**Depende de:** 30, 31, 32, 50
**Desbloqueia:** —

## Objetivo
Registrar as 3 novas seções na matriz `permissoes_perfil` para que o RBAC existente controle acesso a Board, Tarefas e Configurações. Também limpar seções mortas (que viraram abas).

## Arquivos a criar/modificar
- `supabase/migrations/NN_rbac_novas_secoes.sql`
- `src/context/AuthContext.tsx` ou equivalente (atualizar lista de seções conhecidas, se hardcoded)
- `src/pages/Permissoes.tsx` (ou `src/components/settings/PermsTab.tsx`) — garantir que as novas seções aparecem na matriz editável

## SQL
```sql
-- 1. Adicionar seções novas para cada role existente
INSERT INTO permissoes_perfil (role, secao, pode_ver, pode_criar, pode_editar, pode_deletar)
SELECT role, 'board',         true, true, true, true  FROM user_roles
ON CONFLICT (role, secao) DO NOTHING;

INSERT INTO permissoes_perfil (role, secao, pode_ver, pode_criar, pode_editar, pode_deletar)
SELECT role, 'tarefas',       true, true, true, true  FROM user_roles
ON CONFLICT (role, secao) DO NOTHING;

INSERT INTO permissoes_perfil (role, secao, pode_ver, pode_criar, pode_editar, pode_deletar)
SELECT role, 'configuracoes', CASE WHEN role='admin' THEN true ELSE false END,
                              CASE WHEN role='admin' THEN true ELSE false END,
                              CASE WHEN role='admin' THEN true ELSE false END,
                              CASE WHEN role='admin' THEN true ELSE false END
FROM user_roles
ON CONFLICT (role, secao) DO NOTHING;

-- 2. Opcional: remover seções mortas (etiquetas, usuarios, permissoes, google, api, webhooks, personalizacao)
-- NÃO DELETAR se alguma lógica no código ainda consulta essas seções por nome.
-- Preferir manter e marcar como deprecated. Deletar só depois que grep confirmar zero referências.
```

## Permissões default por role
- **admin**: tudo em board/tarefas/configuracoes
- **user**: board (ver+criar+editar sem deletar), tarefas (tudo), configuracoes (nada)
- **visualizador** (se existir): board (só ver), tarefas (só ver), configuracoes (nada)

Ajustar conforme as roles existentes no projeto.

## Sub-permissões por aba em configuracoes (opcional, para próxima iteração)
Se quiser granularidade, criar entries separadas:
- `configuracoes.geral`
- `configuracoes.funis`
- `configuracoes.ia`
- `configuracoes.equipe`
- ... etc

MVP: tratar `configuracoes` como bloco único (admin-only).

## Frontend: checagem
Onde o código hoje checa permissões (ex: `usePermissions().podeVer('contatos')`), garantir que as novas seções são reconhecidas:

```ts
type Secao =
  | 'dashboard' | 'contatos' | 'liderancas' | 'demandas' | 'mapa' | 'importacao'
  | 'board' | 'tarefas' | 'configuracoes';  // 🆕
```

## Critérios de Aceite
- [ ] Migration aplicada
- [ ] Matriz tem entries para `board`, `tarefas`, `configuracoes` para todas as roles
- [ ] Sidebar esconde itens quando usuário não tem `pode_ver` na seção
- [ ] Botões de ação (criar/editar/deletar) nos módulos novos respeitam permissões
- [ ] Admin vê e modifica a matriz na aba Permissões com as novas seções
- [ ] Build passa

## Verificação
- Logar como admin → editar matriz → remover `pode_ver` em `board` para role `user`
- Logar como user → sidebar não mostra mais Board
- Restaurar permissão → voltar a aparecer
- Tentar acessar `/board` diretamente via URL → mostra mensagem "sem permissão"
