# 14 — AI Key Security: Decisão e Upgrade Futuro

**Tipo:** Funcional (decisão + plano de upgrade)
**Fase:** 0 (decisão) / Futuro opcional (upgrade)
**Depende de:** 13-func-schema-ai-settings
**Desbloqueia:** —

## Contexto
A issue 13 cria a tabela `ai_settings` com uma coluna `api_key` em **texto plano**, protegida apenas por RLS admin-only. Isso é o bastante para um MVP single-tenant onde a superfície de ataque é pequena — mas é uma decisão que merece ser explicitada, e a porta para upgrade precisa estar clara.

Esta issue tem **duas partes**:
- **Parte A (obrigatória, executada junto com 13)**: reforçar o padrão texto-plano-mas-seguro do jeito certo
- **Parte B (opcional, futura)**: upgrade para Supabase Vault ou pgsodium quando/se compliance exigir

## Investigação realizada
Três padrões existem nos projetos irmãos do workspace:

| Projeto | Padrão | Ideal para |
|---------|--------|------------|
| **Nosso CRM (Thales)** | Texto plano + RLS admin-only + backend-only read | MVPs com admin confiável |
| **Prá Obra** | pgcrypto digest (hash SHA256) | **NÃO serve** — hash não é reversível, e aqui precisamos da chave real para chamar a API |
| **NaMi V2** | `.env` (VITE_*) | Single-user dev, sem UI de admin |

**Supabase Vault** existe (extensão `vault`) mas precisa `CREATE EXTENSION` explícito. É a opção enterprise para upgrade futuro.

## Decisão: padrão Thales (texto plano + RLS admin-only + máscara no frontend)

O racional:
1. É single-tenant interno — o admin é o cliente, não um terceiro
2. A base de ataque é apenas "alguém com DB service_role key", que já é game-over de qualquer jeito
3. O padrão é **já validado em produção** no Nosso CRM do Thales
4. Zero dependências novas, deploy em minutos

## Parte A — Reforços obrigatórios (junto com issue 13)

Estes itens precisam estar na issue 13 mas estão sendo **detalhados aqui** para ficar claro o que é o mínimo aceitável de segurança:

### A.1 RLS estritamente admin
```sql
CREATE POLICY "ai_settings_admin_only_select" ON ai_settings
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role = 'admin'
        AND status_aprovacao = 'ATIVO'   -- não basta ser admin, tem que estar ativo
    )
  );

CREATE POLICY "ai_settings_admin_only_update" ON ai_settings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin' AND status_aprovacao = 'ATIVO'
    )
  );
```

Não criar policy de DELETE — single row, não deve ser deletável.

### A.2 Máscara no frontend (`useAISettings`)
```ts
// src/hooks/useAISettings.ts
export function useAISettings() {
  const { isAdmin } = useUserRole();

  return useQuery({
    queryKey: ['ai_settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_settings')
        .select('*')
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;

      // Para não-admins, não devolver chave (mesmo que RLS já bloqueie, defense in depth)
      return {
        ...data,
        api_key: isAdmin && data.api_key
          ? maskKey(data.api_key)   // "sk-...ABCD" (só 4 últimos chars)
          : null,
      };
    },
  });
}

function maskKey(key: string): string {
  if (key.length <= 8) return '•'.repeat(8);
  return `${key.slice(0, 3)}${'•'.repeat(12)}${key.slice(-4)}`;
}
```

**IMPORTANTE**: o `maskKey` retorna a chave MASCARADA ao **exibir**, nunca a chave real ao frontend do usuário. A leitura da chave real só ocorre:
- No próprio save (quando admin digita/cola e vai direto para o Supabase)
- No uso real da feature de IA (que deve ser **sempre backend/edge function**, nunca frontend)

### A.3 Uso da chave SEMPRE via backend
Quando alguma feature de IA for usada (ex: resumo automático de demanda), a chamada à API do provider **não pode** acontecer no browser. Deve ser:

- Uma **Supabase Edge Function** (`supabase/functions/ai-call/index.ts`) que lê `ai_settings` com `service_role key` e chama Anthropic/OpenAI/Google server-side
- Ou um **endpoint próprio** do backend (não há backend custom hoje — Edge Function é o caminho)

Isto **não está no escopo deste merge** (IA não é ligada no MVP — ver seção "Fora do escopo" do master). Mas a arquitetura precisa deixar isso claro como requisito futuro.

### A.4 Warning explícito no UI
Na aba IA de Settings (issue 35), adicionar um banner:
```
⚠ A chave API fica armazenada no banco de dados protegida por RLS (apenas
admins podem lê-la). As chamadas à API do provedor acontecem no servidor —
nunca no navegador. Não compartilhe o acesso admin com terceiros.
```

### A.5 Audit log de mudanças
Toda vez que `ai_settings` é atualizada, logar via `logActivity`:
```ts
await logActivity({
  tipo: 'update',
  tabela: 'ai_settings',
  descricao: `Configuração de IA alterada por ${user.email}`,
  // NUNCA incluir a chave em si no log
});
```

## Parte B — Upgrade futuro (opcional, quando justificar)

**Trigger para executar a Parte B:** quando alguma das situações abaixo acontecer:
- Cliente exige compliance formal (LGPD auditada, ISO 27001, etc.)
- Passa a ter múltiplos admins que não se conhecem
- Passa a ter edge functions que precisam de outros secrets (aí vale a pena ativar Vault para tudo)
- Incidente real de exposição (improvável mas possível)

### B.1 Opção 1: Supabase Vault (recomendado)

Criar migration nova:
```sql
-- Ativar extensão
CREATE EXTENSION IF NOT EXISTS vault WITH SCHEMA vault;

-- Criar secret
SELECT vault.create_secret(
  'INITIAL_PLACEHOLDER',     -- secret_value (será sobrescrito via UI)
  'ai_provider_key',          -- secret_name
  'API key do provider de IA ativo'
);

-- Mudar tabela ai_settings: em vez de armazenar api_key, guarda só um id de secret
ALTER TABLE ai_settings DROP COLUMN api_key;
ALTER TABLE ai_settings ADD COLUMN secret_id uuid REFERENCES vault.secrets(id);
```

Leitura (só via edge function, com service_role):
```ts
// supabase/functions/ai-call/index.ts
const { data: secretData } = await supabase
  .from('vault.decrypted_secrets')
  .select('decrypted_secret')
  .eq('name', 'ai_provider_key')
  .single();

const apiKey = secretData.decrypted_secret;
// ... chama provider
```

**Prós:** gerenciado pelo próprio Supabase, chave nunca trafega no cliente, audit trail automático.
**Contras:** obriga ter Edge Function (adiciona 1 runtime a manter), UI de edição fica mais complexa (via RPC).

### B.2 Opção 2: pgsodium symmetric encryption

```sql
CREATE EXTENSION IF NOT EXISTS pgsodium;

-- Encrypt
UPDATE ai_settings SET api_key_encrypted = pgsodium.crypto_aead_det_encrypt(
  'chave-real-aqui'::bytea,
  'ai_settings'::bytea,
  (SELECT id FROM pgsodium.valid_key WHERE name = 'master' LIMIT 1)
);

-- Decrypt (só via RPC security definer)
CREATE FUNCTION get_ai_key(requesting_user uuid) RETURNS text AS $$
  -- checa admin, decrypta, retorna
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Prós:** tudo em Postgres, sem Edge Function obrigatória.
**Contras:** pgsodium tem sua própria curva de aprendizado, chave mestra precisa ser gerenciada.

### B.3 Recomendação entre as duas
**Vault** é mais simples para este uso. pgsodium faz mais sentido se precisar de muitos secrets (ex: credenciais OAuth, webhook signing, etc.) em múltiplas tabelas.

## Critérios de Aceite — Parte A (obrigatória junto com 13)
- [ ] RLS com check extra `status_aprovacao = 'ATIVO'`
- [ ] `maskKey()` implementado e usado no `useAISettings`
- [ ] Banner de warning na aba IA (issue 35 já prevê)
- [ ] Log de audit em updates
- [ ] Documentado em comentário no topo de `ai_settings` migration que o uso da chave **nunca** pode ser frontend

## Critérios de Aceite — Parte B (quando executada)
- [ ] Migration de upgrade aplicada sem downtime
- [ ] Chave migrada para Vault/pgsodium
- [ ] Edge Function `ai-call` funcional
- [ ] Rollback plan documentado (voltar para texto-plano temporariamente se algo quebrar)
- [ ] Testes manuais com admin + não-admin confirmam o comportamento

## Referências
- Padrão Thales: `C:/Users/Sporte/Antigravity/Nosso CRM - Thales Laray/supabase/migrations/*organization_settings*.sql` + `app/api/ai/chat/route.ts`
- Supabase Vault docs: https://supabase.com/docs/guides/database/vault (buscar "vault" nas docs oficiais antes de executar Parte B)
- pgsodium docs: https://supabase.github.io/pgsodium/

## Nota para quem for executar
Esta issue é **híbrida**: a Parte A é implementada **junto** com a issue 13 (mesma migration/hook). A Parte B só deve ser executada se o trigger ocorrer. Não criar a Parte B especulativamente.
