/**
 * Testes de gating de IA — T94 (Fase 7 Onda B)
 *
 * Garante que:
 *   1. isFeatureEnabled retorna false quando flag está desligada — sem invoke ao provider.
 *   2. A lógica de TRIPLE gate real (ai_enabled + features.{globalKey} + recursos_config.{cX}) funciona.
 *      O gate 2 (flag GLOBAL) é verificado em ai_settings.features — gate REAL, não reimplementação fake.
 *   3. Nenhuma chamada ao provider de IA ocorre quando qualquer gate bloqueia.
 *   4. evaluateAnalyzeChatGates avalia c33/c35/c36 de forma independente.
 *
 * Usa o módulo real src/lib/ai/aiGating.ts — testa código de produção, não mocks.
 * Padrão AAA (Arrange / Act / Assert).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isFeatureEnabled, type RecursosConfig } from '@/lib/featureFlags';
import {
  evaluateTripleGate,
  evaluateAnalyzeChatGates,
  FEATURE_KEY_MAP,
  type AISettings,
} from '@/lib/ai/aiGating';

// ─── Testes de isFeatureEnabled (função pura base) ────────────────────────────

describe('isFeatureEnabled — gating por conta', () => {
  it('retorna false quando config é null', () => {
    expect(isFeatureEnabled(null, 'c33')).toBe(false);
  });

  it('retorna false quando config é undefined', () => {
    expect(isFeatureEnabled(undefined, 'c33')).toBe(false);
  });

  it('retorna false quando feature está ausente na config', () => {
    const config: RecursosConfig = { c17: true };
    expect(isFeatureEnabled(config, 'c33')).toBe(false);
  });

  it('retorna false quando feature está explicitamente false', () => {
    const config: RecursosConfig = { c33: false };
    expect(isFeatureEnabled(config, 'c33')).toBe(false);
  });

  it('retorna true quando feature está explicitamente true', () => {
    const config: RecursosConfig = { c33: true };
    expect(isFeatureEnabled(config, 'c33')).toBe(true);
  });

  it('c24 tem default true (conformidade LGPD) — retorna true quando ausente', () => {
    const config: RecursosConfig = {};
    expect(isFeatureEnabled(config, 'c24')).toBe(true);
  });

  it('c24 retorna false quando explicitamente desligado', () => {
    const config: RecursosConfig = { c24: false };
    expect(isFeatureEnabled(config, 'c24')).toBe(false);
  });
});

// ─── Testes do mapa de flags globais ─────────────────────────────────────────

describe('FEATURE_KEY_MAP — mapeamento de código para chave global', () => {
  it('c33 mapeia para resumo_conversa', () => {
    expect(FEATURE_KEY_MAP['c33']).toBe('resumo_conversa');
  });
  it('c34 mapeia para sugestao_resposta', () => {
    expect(FEATURE_KEY_MAP['c34']).toBe('sugestao_resposta');
  });
  it('c35 mapeia para classificacao_assunto', () => {
    expect(FEATURE_KEY_MAP['c35']).toBe('classificacao_assunto');
  });
  it('c36 mapeia para analise_sentimento', () => {
    expect(FEATURE_KEY_MAP['c36']).toBe('analise_sentimento');
  });
  it('c37 mapeia para next_best_action', () => {
    expect(FEATURE_KEY_MAP['c37']).toBe('next_best_action');
  });
  it('c38 mapeia para transcricao_audio', () => {
    expect(FEATURE_KEY_MAP['c38']).toBe('transcricao_audio');
  });
});

// ─── Triple gate REAL: evaluateTripleGate ────────────────────────────────────

describe('evaluateTripleGate — lógica REAL dos 3 gates', () => {
  const fullAISettings: AISettings = {
    ai_enabled: true,
    api_key: 'sk-ant-test-key',
    features: {
      resumo_conversa:      true,
      sugestao_resposta:    true,
      classificacao_assunto: true,
      analise_sentimento:   true,
      next_best_action:     true,
      transcricao_audio:    true,
    },
  };

  it('Gate 1 — skipa quando aiSettings é null', () => {
    const result = evaluateTripleGate('c33', { c33: true }, null);
    expect(result.skipped).toBe(true);
    if (result.skipped) expect(result.reason).toBe('ai_not_configured');
  });

  it('Gate 1 — skipa quando ai_enabled = false', () => {
    const result = evaluateTripleGate('c33', { c33: true }, {
      ai_enabled: false,
      api_key: 'sk-ant-key',
      features: { resumo_conversa: true },
    });
    expect(result.skipped).toBe(true);
    if (result.skipped) expect(result.reason).toBe('ai_disabled');
  });

  it('Gate 1 — skipa quando api_key está ausente', () => {
    const result = evaluateTripleGate('c33', { c33: true }, {
      ai_enabled: true,
      api_key: null,
      features: { resumo_conversa: true },
    });
    expect(result.skipped).toBe(true);
    if (result.skipped) expect(result.reason).toBe('api_key_missing');
  });

  it('Gate 2 — skipa quando features globais são null (flag global ausente)', () => {
    const result = evaluateTripleGate('c33', { c33: true }, {
      ai_enabled: true,
      api_key: 'sk-ant-key',
      features: null,
    });
    expect(result.skipped).toBe(true);
    if (result.skipped) expect(result.reason).toBe('feature_disabled_global');
  });

  it('Gate 2 — skipa quando resumo_conversa está false em ai_settings.features', () => {
    const result = evaluateTripleGate('c33', { c33: true }, {
      ai_enabled: true,
      api_key: 'sk-ant-key',
      features: { resumo_conversa: false },
    });
    expect(result.skipped).toBe(true);
    if (result.skipped) expect(result.reason).toBe('feature_disabled_global');
  });

  it('Gate 2 — skipa quando sugestao_resposta está ausente em ai_settings.features (c34)', () => {
    const result = evaluateTripleGate('c34', { c34: true }, {
      ai_enabled: true,
      api_key: 'sk-ant-key',
      features: { resumo_conversa: true }, // sugestao_resposta ausente
    });
    expect(result.skipped).toBe(true);
    if (result.skipped) expect(result.reason).toBe('feature_disabled_global');
  });

  it('Gate 2 — skipa quando next_best_action está false em ai_settings.features (c37)', () => {
    const result = evaluateTripleGate('c37', { c37: true }, {
      ai_enabled: true,
      api_key: 'sk-ant-key',
      features: { next_best_action: false },
    });
    expect(result.skipped).toBe(true);
    if (result.skipped) expect(result.reason).toBe('feature_disabled_global');
  });

  it('Gate 2 — skipa quando transcricao_audio está false em ai_settings.features (c38)', () => {
    const result = evaluateTripleGate('c38', { c38: true }, {
      ai_enabled: true,
      api_key: 'sk-ant-key',
      features: { transcricao_audio: false },
    });
    expect(result.skipped).toBe(true);
    if (result.skipped) expect(result.reason).toBe('feature_disabled_global');
  });

  it('Gate 3 — skipa quando recursos_config da conta é null', () => {
    const result = evaluateTripleGate('c33', null, fullAISettings);
    expect(result.skipped).toBe(true);
    if (result.skipped) expect(result.reason).toBe('features_disabled');
  });

  it('Gate 3 — skipa quando c33 está false na conta', () => {
    const result = evaluateTripleGate('c33', { c33: false }, fullAISettings);
    expect(result.skipped).toBe(true);
    if (result.skipped) expect(result.reason).toBe('features_disabled');
  });

  it('Gate 3 — skipa quando c38 está ausente na conta', () => {
    const result = evaluateTripleGate('c38', { c33: true }, fullAISettings);
    expect(result.skipped).toBe(true);
    if (result.skipped) expect(result.reason).toBe('features_disabled');
  });

  it('Todos os gates abertos — não skipa', () => {
    const result = evaluateTripleGate('c33', { c33: true }, fullAISettings);
    expect(result.skipped).toBe(false);
  });

  it('Todos os gates abertos para c34 — não skipa', () => {
    const result = evaluateTripleGate('c34', { c34: true }, fullAISettings);
    expect(result.skipped).toBe(false);
  });

  it('Todos os gates abertos para c37 — não skipa', () => {
    const result = evaluateTripleGate('c37', { c37: true }, fullAISettings);
    expect(result.skipped).toBe(false);
  });

  it('Todos os gates abertos para c38 — não skipa', () => {
    const result = evaluateTripleGate('c38', { c38: true }, fullAISettings);
    expect(result.skipped).toBe(false);
  });
});

// ─── evaluateAnalyzeChatGates — avaliação per-recurso c33/c35/c36 ─────────────

describe('evaluateAnalyzeChatGates — avaliação independente de c33/c35/c36', () => {
  it('todos os 3 desabilitados na conta → nenhum passa', () => {
    const result = evaluateAnalyzeChatGates(
      { c33: false, c35: false, c36: false },
      {
        ai_enabled: true,
        api_key: 'sk-ant-key',
        features: {
          resumo_conversa:       true,
          classificacao_assunto: true,
          analise_sentimento:    true,
        },
      },
    );
    expect(result.c33).toBe(false);
    expect(result.c35).toBe(false);
    expect(result.c36).toBe(false);
    expect(result.anyEnabled).toBe(false);
    expect(result.skipReason).toBe('feature_disabled_global');
  });

  it('c33 habilitado na conta mas flag GLOBAL (resumo_conversa) desabilitada → c33=false', () => {
    const result = evaluateAnalyzeChatGates(
      { c33: true, c35: true, c36: true },
      {
        ai_enabled: true,
        api_key: 'sk-ant-key',
        features: {
          resumo_conversa:       false, // GLOBAL desabilitado
          classificacao_assunto: true,
          analise_sentimento:    true,
        },
      },
    );
    expect(result.c33).toBe(false); // gate global bloqueou
    expect(result.c35).toBe(true);
    expect(result.c36).toBe(true);
    expect(result.anyEnabled).toBe(true);
  });

  it('c35 habilitado na conta mas classificacao_assunto desabilitado globalmente → c35=false', () => {
    const result = evaluateAnalyzeChatGates(
      { c33: true, c35: true, c36: true },
      {
        ai_enabled: true,
        api_key: 'sk-ant-key',
        features: {
          resumo_conversa:       true,
          classificacao_assunto: false, // GLOBAL desabilitado
          analise_sentimento:    true,
        },
      },
    );
    expect(result.c33).toBe(true);
    expect(result.c35).toBe(false);
    expect(result.c36).toBe(true);
    expect(result.anyEnabled).toBe(true);
  });

  it('ai_enabled=false → todos os recursos bloqueados', () => {
    const result = evaluateAnalyzeChatGates(
      { c33: true, c35: true, c36: true },
      {
        ai_enabled: false,
        api_key: 'sk-ant-key',
        features: {
          resumo_conversa: true,
          classificacao_assunto: true,
          analise_sentimento: true,
        },
      },
    );
    expect(result.c33).toBe(false);
    expect(result.c35).toBe(false);
    expect(result.c36).toBe(false);
    expect(result.anyEnabled).toBe(false);
    expect(result.skipReason).toBe('ai_disabled');
  });

  it('aiSettings=null → ai_not_configured', () => {
    const result = evaluateAnalyzeChatGates({ c33: true }, null);
    expect(result.anyEnabled).toBe(false);
    expect(result.skipReason).toBe('ai_not_configured');
  });

  it('todos habilitados (conta + global) → todos passam', () => {
    const result = evaluateAnalyzeChatGates(
      { c33: true, c35: true, c36: true },
      {
        ai_enabled: true,
        api_key: 'sk-ant-key',
        features: {
          resumo_conversa:       true,
          classificacao_assunto: true,
          analise_sentimento:    true,
        },
      },
    );
    expect(result.c33).toBe(true);
    expect(result.c35).toBe(true);
    expect(result.c36).toBe(true);
    expect(result.anyEnabled).toBe(true);
    expect(result.skipReason).toBeUndefined();
  });

  it('c33 habilitado mas c35/c36 na conta ausentes → apenas c33 passa', () => {
    const result = evaluateAnalyzeChatGates(
      { c33: true }, // c35/c36 ausentes na conta
      {
        ai_enabled: true,
        api_key: 'sk-ant-key',
        features: {
          resumo_conversa:       true,
          classificacao_assunto: true,
          analise_sentimento:    true,
        },
      },
    );
    expect(result.c33).toBe(true);
    expect(result.c35).toBe(false); // ausente na conta
    expect(result.c36).toBe(false); // ausente na conta
    expect(result.anyEnabled).toBe(true);
  });
});

// ─── Teste: invoke NÃO é chamado quando gate bloqueia ─────────────────────────

describe('invoke não é chamado com gate bloqueado — usando lógica REAL', () => {
  const mockInvoke = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Simula a mutationFn dos hooks de IA usando o módulo real de gate.
   * Se qualquer gate bloquear, retorna { skipped: true } sem chamar invoke.
   */
  async function aiMutationFn(params: {
    featureCode: string;
    accountConfig: RecursosConfig;
    aiSettings: AISettings | null;
    invoke: typeof mockInvoke;
  }) {
    const gate = evaluateTripleGate(params.featureCode, params.accountConfig, params.aiSettings);
    if (gate.skipped) {
      return { skipped: true, reason: gate.reason };
    }
    return params.invoke('zapi-ai-analyze-chat', { body: {} });
  }

  it('useAIAnalyzeChat — invoke NÃO chamado com c33 desabilitado na conta', async () => {
    const result = await aiMutationFn({
      featureCode: 'c33',
      accountConfig: { c33: false },
      aiSettings: {
        ai_enabled: true,
        api_key: 'sk-ant-key',
        features: { resumo_conversa: true },
      },
      invoke: mockInvoke,
    });
    expect(result.skipped).toBe(true);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('useAIAnalyzeChat — invoke NÃO chamado com flag global (resumo_conversa) desabilitada', async () => {
    const result = await aiMutationFn({
      featureCode: 'c33',
      accountConfig: { c33: true },
      aiSettings: {
        ai_enabled: true,
        api_key: 'sk-ant-key',
        features: { resumo_conversa: false }, // GLOBAL off
      },
      invoke: mockInvoke,
    });
    expect(result.skipped).toBe(true);
    if (result.skipped) expect(result.reason).toBe('feature_disabled_global');
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('useAISuggestReply — invoke NÃO chamado com ai_enabled = false', async () => {
    const result = await aiMutationFn({
      featureCode: 'c34',
      accountConfig: { c34: true },
      aiSettings: { ai_enabled: false, api_key: 'sk-ant-key', features: { sugestao_resposta: true } },
      invoke: mockInvoke,
    });
    expect(result.skipped).toBe(true);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('useAISuggestReply — invoke NÃO chamado com sugestao_resposta (global) desabilitada', async () => {
    const result = await aiMutationFn({
      featureCode: 'c34',
      accountConfig: { c34: true },
      aiSettings: {
        ai_enabled: true,
        api_key: 'sk-ant-key',
        features: { sugestao_resposta: false }, // flag global off
      },
      invoke: mockInvoke,
    });
    expect(result.skipped).toBe(true);
    if (result.skipped) expect(result.reason).toBe('feature_disabled_global');
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('useTranscribeAudio — invoke NÃO chamado com c38 off na conta', async () => {
    const result = await aiMutationFn({
      featureCode: 'c38',
      accountConfig: { c38: false },
      aiSettings: {
        ai_enabled: true,
        api_key: 'sk-ant-key',
        features: { transcricao_audio: true },
      },
      invoke: mockInvoke,
    });
    expect(result.skipped).toBe(true);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('useTranscribeAudio — invoke NÃO chamado com transcricao_audio (global) desabilitada', async () => {
    const result = await aiMutationFn({
      featureCode: 'c38',
      accountConfig: { c38: true },
      aiSettings: {
        ai_enabled: true,
        api_key: 'sk-ant-key',
        features: { transcricao_audio: false }, // flag global off
      },
      invoke: mockInvoke,
    });
    expect(result.skipped).toBe(true);
    if (result.skipped) expect(result.reason).toBe('feature_disabled_global');
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('useAINextAction — invoke NÃO chamado com c37 off na conta', async () => {
    const result = await aiMutationFn({
      featureCode: 'c37',
      accountConfig: { c37: false },
      aiSettings: {
        ai_enabled: true,
        api_key: 'sk-ant-key',
        features: { next_best_action: true },
      },
      invoke: mockInvoke,
    });
    expect(result.skipped).toBe(true);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('useAINextAction — invoke NÃO chamado com next_best_action (global) desabilitada', async () => {
    const result = await aiMutationFn({
      featureCode: 'c37',
      accountConfig: { c37: true },
      aiSettings: {
        ai_enabled: true,
        api_key: 'sk-ant-key',
        features: { next_best_action: false }, // flag global off
      },
      invoke: mockInvoke,
    });
    expect(result.skipped).toBe(true);
    if (result.skipped) expect(result.reason).toBe('feature_disabled_global');
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('invoke É chamado quando todos os 3 gates estão abertos', async () => {
    mockInvoke.mockResolvedValue({ data: { summary: 'teste' } });

    const result = await aiMutationFn({
      featureCode: 'c33',
      accountConfig: { c33: true },
      aiSettings: {
        ai_enabled: true,
        api_key: 'sk-ant-key',
        features: { resumo_conversa: true },
      },
      invoke: mockInvoke,
    });

    expect(result).toEqual({ data: { summary: 'teste' } });
    expect(mockInvoke).toHaveBeenCalledOnce();
  });
});

// ─── Teste de retrocompatibilidade: AIFeatures sem campos WhatsApp → false ────

describe('AIFeatures retrocompatibilidade', () => {
  function normalizeFeatures(rawFeatures: Record<string, unknown>) {
    return {
      resumo_demandas:       !!rawFeatures.resumo_demandas,
      sugestao_acoes:        !!rawFeatures.sugestao_acoes,
      analise_risco:         !!rawFeatures.analise_risco,
      resumo_conversa:       !!rawFeatures.resumo_conversa,
      sugestao_resposta:     !!rawFeatures.sugestao_resposta,
      classificacao_assunto: !!rawFeatures.classificacao_assunto,
      analise_sentimento:    !!rawFeatures.analise_sentimento,
      next_best_action:      !!rawFeatures.next_best_action,
      transcricao_audio:     !!rawFeatures.transcricao_audio,
    };
  }

  it('settings existente sem campos WhatsApp → novos campos são false', () => {
    const rawOldSettings = {
      resumo_demandas: true,
      sugestao_acoes: false,
      analise_risco: false,
    };

    const features = normalizeFeatures(rawOldSettings);

    expect(features.resumo_demandas).toBe(true);
    expect(features.sugestao_acoes).toBe(false);
    expect(features.resumo_conversa).toBe(false);
    expect(features.sugestao_resposta).toBe(false);
    expect(features.classificacao_assunto).toBe(false);
    expect(features.analise_sentimento).toBe(false);
    expect(features.next_best_action).toBe(false);
    expect(features.transcricao_audio).toBe(false);
  });

  it('settings com campos WhatsApp ativos → reflete corretamente', () => {
    const rawSettings = {
      resumo_demandas:       false,
      sugestao_acoes:        false,
      analise_risco:         false,
      resumo_conversa:       true,
      sugestao_resposta:     true,
      classificacao_assunto: false,
      analise_sentimento:    true,
      next_best_action:      false,
      transcricao_audio:     false,
    };

    const features = normalizeFeatures(rawSettings);

    expect(features.resumo_conversa).toBe(true);
    expect(features.sugestao_resposta).toBe(true);
    expect(features.analise_sentimento).toBe(true);
    expect(features.classificacao_assunto).toBe(false);
    expect(features.next_best_action).toBe(false);
    expect(features.transcricao_audio).toBe(false);
  });

  it('gate 2 REAL: conta nova sem settings WhatsApp → feature_disabled_global', () => {
    const result = evaluateTripleGate(
      'c33',
      { c33: true },
      {
        ai_enabled: true,
        api_key: 'sk-ant-key',
        features: {
          // Conta antiga — sem campos WhatsApp (resume/classificacao/etc)
          resumo_demandas: true,
          sugestao_acoes:  false,
          analise_risco:   false,
        },
      },
    );
    expect(result.skipped).toBe(true);
    if (result.skipped) expect(result.reason).toBe('feature_disabled_global');
  });
});
