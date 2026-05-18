// _shared/feature-flags.ts
//
// Função pura para leitura de feature flags de contas Z-API.
// Espelha src/lib/featureFlags.ts para uso nas Edge Functions.
//
// Padrão: recursos_config: { "c17": true, "c18": false, ... }
// Chave ausente = false (default seguro — opt-in consciente).

export type RecursosConfig = Record<string, boolean> | null | undefined;

/**
 * Retorna se um feature está habilitado na conta.
 * Função pura — sem efeitos colaterais.
 *
 * @param config  - O objeto recursos_config da conta (pode ser null/undefined).
 * @param feature - Código do feature (ex: "c17", "c18").
 */
export function isFeatureEnabled(
  config: RecursosConfig,
  feature: string,
): boolean {
  if (!config || typeof config !== 'object') return false;
  return (config as Record<string, boolean>)[feature] === true;
}
