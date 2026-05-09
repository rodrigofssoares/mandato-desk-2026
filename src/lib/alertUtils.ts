/**
 * Utilitários para alertas do dashboard (RAQ-MAND-EM067).
 * Funções puras — sem side effects, sem I/O.
 */

// ─── Mapeamento de prefixo → label legível ────────────────────────────────────

const ALERT_KEY_PREFIX_LABELS: Record<string, string> = {
  'parado-': 'Contato parado no funil',
  'vencida-': 'Tarefa vencida',
  'ani-': 'Aniversariante sem tarefa',
};

/**
 * Converte um alert_key sintético em label legível para exibição na tela
 * de alertas dispensados em Configurações.
 *
 * Exemplos:
 *   formatAlertKey('parado-abc123')  → 'Contato parado no funil'
 *   formatAlertKey('vencida-def456') → 'Tarefa vencida'
 *   formatAlertKey('ani-uuid')       → 'Aniversariante sem tarefa'
 *   formatAlertKey('outro-xyz')      → 'outro-xyz' (fallback: chave bruta)
 */
export function formatAlertKey(alertKey: string): string {
  for (const [prefix, label] of Object.entries(ALERT_KEY_PREFIX_LABELS)) {
    if (alertKey.startsWith(prefix)) return label;
  }
  return alertKey;
}
