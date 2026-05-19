import { useZapiAccounts } from '@/hooks/useZapiAccounts';
import { isFeatureEnabled, countEnabledFeatures, type RecursosConfig } from '@/lib/featureFlags';

// ─── useAccountFeatures ───────────────────────────────────────────────────────

/**
 * Hook que expõe os feature flags de uma conta Z-API.
 *
 * Lê do cache react-query de useZapiAccounts — sem query extra ao banco.
 *
 * Retorna:
 *   - `config`            : o objeto JSON bruto de recursos_config (ou {})
 *   - `isEnabled(feature)`: helper que chama isFeatureEnabled com a config da conta
 *   - `activeCount`       : quantidade de features habilitados
 *
 * Default seguro: quando accountId é null/undefined, retorna config vazia (todos desligados).
 * Quando `recursos_config` não existe no banco (conta antiga), trata como {}.
 */
export function useAccountFeatures(accountId: string | null | undefined) {
  const { data: accounts } = useZapiAccounts();

  const config: RecursosConfig =
    accountId
      ? (accounts?.find((a) => a.id === accountId)?.recursos_config ?? {})
      : {};

  return {
    config,
    isEnabled: (feature: string) => (accountId ? isFeatureEnabled(config, feature) : false),
    activeCount: countEnabledFeatures(config),
  };
}
