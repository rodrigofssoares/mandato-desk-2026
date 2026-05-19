// ─── featureFlags.ts ─────────────────────────────────────────────────────────
// Funções puras para leitura de feature flags de contas Z-API (C40).
//
// Padrão de dados:
//   recursos_config: { "c33": true, "c34": false, "c38": true, ... }
//   Chave ausente = false (default seguro — opt-in consciente).
//
// Códigos de features configuráveis (catálogo V3):
//   IA:        c33 (resumo), c34 (sugestão de resposta), c35 (classificação),
//              c36 (sentimento), c37 (next-best-action), c38 (transcrição)
//   Automação: c9 (agendar envio), c17 (broadcast), c22 (régua), c23 (campanhas), c32 (fila)
//   Engajamento: c19 (aniversário), c20 (convite evento), c24 (opt-in LGPD),
//                c27 (horário), c28 (SLA), c29 (CSAT), c30 (supervisor)

export type RecursosConfig = Record<string, boolean>;

/**
 * Features que são habilitados por default (não precisam de flag explícita).
 * c24 (opt-in LGPD) e c21 (bairro/zona) têm default=true por razões de conformidade/UX.
 */
const DEFAULT_ENABLED: ReadonlySet<string> = new Set(['c24', 'c21']);

/**
 * Retorna se um feature está habilitado na conta.
 * Função pura — sem efeitos colaterais, sem chamadas de rede.
 *
 * @param config  - O objeto `recursos_config` da conta (pode ser null/undefined).
 * @param feature - Código do feature (ex: "c33", "c38").
 * @returns boolean — false quando config for null/undefined ou a chave estiver ausente.
 *                    Exceto c24/c21 que retornam true quando ausentes (default ativo).
 */
export function isFeatureEnabled(
  config: RecursosConfig | null | undefined,
  feature: string,
): boolean {
  // Features com default true: retornam true a menos que explicitamente false
  if (DEFAULT_ENABLED.has(feature)) {
    if (!config || typeof config !== 'object') return true;
    return config[feature] !== false;
  }
  if (!config || typeof config !== 'object') return false;
  return config[feature] === true;
}

/**
 * Retorna a contagem de features habilitados na config.
 * Útil para o badge "X recursos ativos" no AccountCard.
 */
export function countEnabledFeatures(config: RecursosConfig | null | undefined): number {
  if (!config || typeof config !== 'object') return 0;
  return Object.values(config).filter((v) => v === true).length;
}

/**
 * Catálogo de features configuráveis por categoria.
 * Usado pela UI da aba Recursos no AccountFormDialog.
 */
export const FEATURES_CATALOG = {
  ia: [
    { code: 'c33', label: 'Resumo automático da conversa' },
    { code: 'c34', label: 'Sugestão de resposta com IA' },
    { code: 'c35', label: 'Classificação de assunto' },
    { code: 'c36', label: 'Análise de sentimento' },
    { code: 'c37', label: 'Next-best-action' },
    { code: 'c38', label: 'Transcrição de áudios' },
  ],
  automacao: [
    { code: 'c9',  label: 'Agendar envio de mensagem' },
    { code: 'c17', label: 'Broadcast segmentado' },
    { code: 'c22', label: 'Régua de relacionamento' },
    { code: 'c23', label: 'Campanhas e pesquisa de opinião' },
    { code: 'c32', label: 'Fila de reenvio offline' },
  ],
  engajamento: [
    { code: 'c19', label: 'Lembrete de aniversário' },
    { code: 'c20', label: 'Convite a evento' },
    { code: 'c24', label: 'Consentimento / Opt-in LGPD' },
    { code: 'c27', label: 'Horário de atendimento' },
    { code: 'c28', label: 'SLA e alerta de conversa parada' },
    { code: 'c29', label: 'CSAT — pesquisa de satisfação' },
    { code: 'c30', label: 'Modo supervisor' },
  ],
  // T95 (Fase 7 Onda B): multi-instância — visão consolidada de todos os números
  multi_instancia: [
    { code: 'c26', label: 'Visão consolidada multi-instância' },
  ],
} as const;

export type FeatureCode =
  | typeof FEATURES_CATALOG.ia[number]['code']
  | typeof FEATURES_CATALOG.automacao[number]['code']
  | typeof FEATURES_CATALOG.engajamento[number]['code']
  | typeof FEATURES_CATALOG.multi_instancia[number]['code'];
