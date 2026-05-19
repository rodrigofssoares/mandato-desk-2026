// src/lib/ai/aiGating.ts
//
// Lógica pura de triple gate de IA — testável sem mock de rede.
//
// As Edge Functions usam a versão Deno em _shared/ai-security.ts, que implementa
// a mesma lógica mas com acesso ao banco. Este módulo expõe as funções puras
// reutilizáveis no client (hooks) e testáveis em Vitest.
//
// Mapa de flags globais (ai_settings.features.*) por código de recurso da conta:
//   c33 → resumo_conversa
//   c34 → sugestao_resposta
//   c35 → classificacao_assunto
//   c36 → analise_sentimento
//   c37 → next_best_action
//   c38 → transcricao_audio
//
// RAQ-MAND-EM073 — Hardening de segurança (Fase 7 IA)

import { isFeatureEnabled, type RecursosConfig } from '@/lib/featureFlags';

// ── Mapa: código de recurso da conta → chave em ai_settings.features ──────────

export const FEATURE_KEY_MAP: Readonly<Record<string, string>> = {
  c33: 'resumo_conversa',
  c34: 'sugestao_resposta',
  c35: 'classificacao_assunto',
  c36: 'analise_sentimento',
  c37: 'next_best_action',
  c38: 'transcricao_audio',
} as const;

// ── Tipos ─────────────────────────────────────────────────────────────────────

export type AIFeaturesConfig = Record<string, boolean> | null | undefined;

export interface AISettings {
  ai_enabled: boolean;
  api_key?: string | null;
  features?: AIFeaturesConfig;
}

export interface GateSkipped {
  skipped: true;
  reason:
    | 'ai_not_configured'
    | 'ai_disabled'
    | 'api_key_missing'
    | 'feature_disabled_global'
    | 'features_disabled';
}

export interface GatePass {
  skipped: false;
}

export type GateResult = GateSkipped | GatePass;

// ── Triple Gate puro ──────────────────────────────────────────────────────────

/**
 * Verifica os 3 gates de IA de forma completamente síncrona e pura.
 *
 * Gate 1 — ai_enabled = true + api_key presente
 * Gate 2 — ai_settings.features.{globalKey} = true (flag GLOBAL do recurso)
 * Gate 3 — recursos_config.{featureCode} = true (flag da CONTA)
 *
 * @param featureCode   - Código do recurso da conta (ex: 'c33', 'c34')
 * @param accountConfig - Objeto recursos_config da conta
 * @param aiSettings    - Configurações de IA (ai_enabled, features, api_key)
 */
export function evaluateTripleGate(
  featureCode: string,
  accountConfig: RecursosConfig,
  aiSettings: AISettings | null | undefined,
): GateResult {
  // Gate 1 — ai_settings configurado
  if (!aiSettings) {
    return { skipped: true, reason: 'ai_not_configured' };
  }
  if (!aiSettings.ai_enabled) {
    return { skipped: true, reason: 'ai_disabled' };
  }
  if (!aiSettings.api_key) {
    return { skipped: true, reason: 'api_key_missing' };
  }

  // Gate 2 — flag global do recurso em ai_settings.features
  const globalKey = FEATURE_KEY_MAP[featureCode];
  if (globalKey) {
    const features = aiSettings.features as Record<string, boolean> | null | undefined;
    if (!features || features[globalKey] !== true) {
      return { skipped: true, reason: 'feature_disabled_global' };
    }
  }

  // Gate 3 — flag da conta
  if (!isFeatureEnabled(accountConfig, featureCode)) {
    return { skipped: true, reason: 'features_disabled' };
  }

  return { skipped: false };
}

/**
 * Variante para zapi-ai-analyze-chat que avalia 3 recursos juntos (c33/c35/c36).
 * Retorna quais recursos passaram pelos 3 gates.
 *
 * Retorna { c33, c35, c36 } — true se (gate1 && gate2 && gate3) para cada um.
 * Se nenhum passar, também retorna o motivo do skip global.
 */
export function evaluateAnalyzeChatGates(
  accountConfig: RecursosConfig,
  aiSettings: AISettings | null | undefined,
): {
  c33: boolean;
  c35: boolean;
  c36: boolean;
  anyEnabled: boolean;
  skipReason?: GateSkipped['reason'];
} {
  // Pré-check gate 1 (comum aos 3)
  if (!aiSettings) {
    return { c33: false, c35: false, c36: false, anyEnabled: false, skipReason: 'ai_not_configured' };
  }
  if (!aiSettings.ai_enabled) {
    return { c33: false, c35: false, c36: false, anyEnabled: false, skipReason: 'ai_disabled' };
  }
  if (!aiSettings.api_key) {
    return { c33: false, c35: false, c36: false, anyEnabled: false, skipReason: 'api_key_missing' };
  }

  const features = aiSettings.features as Record<string, boolean> | null | undefined;

  const c33 = (isFeatureEnabled(accountConfig, 'c33')) &&
               (features?.['resumo_conversa'] === true);
  const c35 = (isFeatureEnabled(accountConfig, 'c35')) &&
               (features?.['classificacao_assunto'] === true);
  const c36 = (isFeatureEnabled(accountConfig, 'c36')) &&
               (features?.['analise_sentimento'] === true);

  const anyEnabled = c33 || c35 || c36;

  return {
    c33,
    c35,
    c36,
    anyEnabled,
    skipReason: anyEnabled ? undefined : 'feature_disabled_global',
  };
}
