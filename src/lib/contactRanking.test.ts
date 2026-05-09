/**
 * Testes unitários de computeRankingScore — EM049-T06
 *
 * Padrão AAA (Arrange / Act / Assert).
 * Função pura: sem mocks, sem jsdom, sem I/O.
 *
 * Equivalência com SQL:
 *   score_bruto → LEAST(FLOOR(score / 10), 10)
 *
 * Casos obrigatórios (critérios de aceite EM049-T06):
 *   1. Contato vazio → score=0, ranking=0
 *   2. Só declarou_voto=true → 20 pts → ranking=2
 *   3. Todos os booleans status (A/B/C/D completos) → ranking=5
 *   4. Caso happy path: declarou_voto + e_multiplicador + whatsapp → 43 pts → ranking=4
 *   5. Tudo preenchido → 100 pts → ranking=10
 *   6. totalCampaignFields=0 com campo marcado → sem divisão por zero
 *   7. Breakdown: validar estrutura (categorias, pontosObtidos vs max, itens)
 */

import { describe, it, expect } from 'vitest';
import { computeRankingScore, type ContactLike } from './contactRanking';

// Helpers de fixture
const contatoVazio: ContactLike = {};

const contatoCompleto: ContactLike = {
  whatsapp: '31999999999',
  telefone: '3130000000',
  email: 'contato@exemplo.com.br',
  data_nascimento: '1990-01-15',
  leader_id: '00000000-0000-0000-0000-000000000001',
  declarou_voto: true,
  e_multiplicador: true,
  aceita_whatsapp: true,
  em_canal_whatsapp: true,
  instagram: '@contato',
  twitter: '@contato',
  tiktok: '@contato',
  youtube: '@contato',
  cep: '30100-000',
  logradouro: 'Rua das Flores',
  bairro: 'Centro',
  cidade: 'Belo Horizonte',
  estado: 'MG',
};

// ============================================================================
// 1. Contato vazio → score=0, ranking=0
// ============================================================================
describe('computeRankingScore — contato vazio', () => {
  it('retorna score=0 e ranking=0 quando nenhum campo está preenchido', () => {
    // Arrange
    const contato = contatoVazio;

    // Act
    const resultado = computeRankingScore(contato, {}, 0);

    // Assert
    expect(resultado.score).toBe(0);
    expect(resultado.ranking).toBe(0);
  });
});

// ============================================================================
// 2. Só declarou_voto=true → 20 pts → ranking=2
// ============================================================================
describe('computeRankingScore — só declarou_voto', () => {
  it('retorna score=20 e ranking=2 com apenas declarou_voto=true', () => {
    // Arrange
    const contato: ContactLike = { declarou_voto: true };

    // Act
    const resultado = computeRankingScore(contato, {}, 0);

    // Assert
    expect(resultado.score).toBe(20);
    expect(resultado.ranking).toBe(2);
  });
});

// ============================================================================
// 3. Todos booleans do status (Cat. A completa) → 50 pts → ranking=5
// ============================================================================
describe('computeRankingScore — categoria A completa', () => {
  it('retorna score=50 e ranking=5 quando todos os booleans de status estão true', () => {
    // Arrange
    const contato: ContactLike = {
      declarou_voto: true,
      e_multiplicador: true,
      aceita_whatsapp: true,
      em_canal_whatsapp: true,
    };

    // Act
    const resultado = computeRankingScore(contato, {}, 0);

    // Assert
    expect(resultado.score).toBe(50);
    expect(resultado.ranking).toBe(5);
  });
});

// ============================================================================
// 4. Happy path: declarou_voto + e_multiplicador + whatsapp → 43 pts → ranking=4
// ============================================================================
describe('computeRankingScore — happy path T01', () => {
  it('retorna score=43 e ranking=4 para declarou_voto + e_multiplicador + whatsapp', () => {
    // Arrange — equivale ao caso de teste da T01 e T02
    const contato: ContactLike = {
      declarou_voto: true,
      e_multiplicador: true,
      whatsapp: '31999000000',
    };

    // Act
    const resultado = computeRankingScore(contato, {}, 0);

    // Assert
    // A: 20 (declarou) + 15 (multi) = 35
    // B: 8 (whatsapp) = 8
    // Total: 43 → FLOOR(43/10) = 4
    expect(resultado.score).toBe(43);
    expect(resultado.ranking).toBe(4);
  });
});

// ============================================================================
// 5. Tudo preenchido → 100 pts → ranking=10
// ============================================================================
describe('computeRankingScore — máximo absoluto', () => {
  it('retorna score=100 e ranking=10 quando todos os campos estão preenchidos', () => {
    // Arrange
    const contato = contatoCompleto;
    // 2 campos de campanha, os 2 ativos → pts_por_campo = FLOOR(5/2) = 2 → 2*2 = 4 pts (< 5)
    // Para atingir 100: precisamos de 5 pts em E → usar 1 campo ativo com 1 total → FLOOR(5/1)*1 = 5
    const campaignValues = { field1: true };
    const totalCampaignFields = 1;

    // Act
    const resultado = computeRankingScore(contato, campaignValues, totalCampaignFields);

    // Assert
    // A: 20+15+10+5 = 50
    // B: 8+7+4+3+3 = 25
    // C: 7+4+2+2 = 15
    // D: 3 (instagram) + min(3, 2) = 3+2 = 5
    // E: 1 campo ativo * floor(5/1) = 5, capped em 5
    // Total: 50+25+15+5+5 = 100 → ranking 10
    expect(resultado.score).toBe(100);
    expect(resultado.ranking).toBe(10);
  });
});

// ============================================================================
// 6. totalCampaignFields=0 com campo marcado → sem divisão por zero
// ============================================================================
describe('computeRankingScore — divisão por zero (categoria E)', () => {
  it('retorna ptsE=0 e não lança erro quando totalCampaignFields=0', () => {
    // Arrange
    const contato: ContactLike = {};
    const campaignValues = { field1: true, field2: true };
    const totalCampaignFields = 0;

    // Act & Assert — não deve lançar
    expect(() => {
      const resultado = computeRankingScore(contato, campaignValues, totalCampaignFields);
      expect(resultado.score).toBe(0);
      expect(resultado.ranking).toBe(0);
      // Categoria E deve ter 0 pontos
      const catE = resultado.categorias.find((c) => c.categoria === 'E');
      expect(catE?.pontosObtidos).toBe(0);
    }).not.toThrow();
  });
});

// ============================================================================
// 7. Breakdown: validar estrutura completa
// ============================================================================
describe('computeRankingScore — estrutura do breakdown', () => {
  it('retorna exatamente 5 categorias com campos obrigatórios', () => {
    // Arrange
    const contato: ContactLike = { declarou_voto: true, whatsapp: '31999' };

    // Act
    const resultado = computeRankingScore(contato, {}, 0);

    // Assert estrutura
    expect(resultado.categorias).toHaveLength(5);

    const categorias = resultado.categorias.map((c) => c.categoria);
    expect(categorias).toEqual(['A', 'B', 'C', 'D', 'E']);

    for (const cat of resultado.categorias) {
      expect(cat).toHaveProperty('categoria');
      expect(cat).toHaveProperty('label');
      expect(cat).toHaveProperty('pontosObtidos');
      expect(cat).toHaveProperty('pontosMaximos');
      expect(cat).toHaveProperty('itens');
      expect(typeof cat.pontosObtidos).toBe('number');
      expect(typeof cat.pontosMaximos).toBe('number');
      expect(cat.pontosObtidos).toBeGreaterThanOrEqual(0);
      expect(cat.pontosObtidos).toBeLessThanOrEqual(cat.pontosMaximos);
      expect(Array.isArray(cat.itens)).toBe(true);
    }
  });

  it('marca corretamente os itens preenchidos vs vazios na categoria A', () => {
    // Arrange — só declarou_voto e aceita_whatsapp
    const contato: ContactLike = {
      declarou_voto: true,
      aceita_whatsapp: true,
    };

    // Act
    const resultado = computeRankingScore(contato, {}, 0);
    const catA = resultado.categorias.find((c) => c.categoria === 'A')!;

    // Assert
    const declarou = catA.itens.find((i) => i.label === 'Declarou voto');
    const multiplicador = catA.itens.find((i) => i.label === 'É multiplicador');
    const aceita = catA.itens.find((i) => i.label === 'Aceita WhatsApp');

    expect(declarou?.marcado).toBe(true);
    expect(multiplicador?.marcado).toBe(false);
    expect(aceita?.marcado).toBe(true);
    expect(catA.pontosObtidos).toBe(30); // 20 + 10
  });

  it('limita redes extras (twitter+tiktok+youtube) a no máximo 2 pontos', () => {
    // Arrange — todos as 3 redes extras preenchidas, sem instagram
    const contato: ContactLike = {
      twitter: '@teste',
      tiktok: '@teste',
      youtube: '@teste',
    };

    // Act
    const resultado = computeRankingScore(contato, {}, 0);
    const catD = resultado.categorias.find((c) => c.categoria === 'D')!;

    // Assert — sem instagram (0) + min(3 extras, 2) = 2
    expect(catD.pontosObtidos).toBe(2);
    expect(catD.pontosMaximos).toBe(5);
  });

  it('pontuação da categoria C exige bairro E cidade (não só um)', () => {
    // Arrange — só bairro, sem cidade
    const contatoSoBairro: ContactLike = { bairro: 'Centro' };
    const contatoSoCidade: ContactLike = { cidade: 'Belo Horizonte' };
    const contatoAmbos: ContactLike = { bairro: 'Centro', cidade: 'Belo Horizonte' };

    // Act & Assert
    const r1 = computeRankingScore(contatoSoBairro, {}, 0);
    const r2 = computeRankingScore(contatoSoCidade, {}, 0);
    const r3 = computeRankingScore(contatoAmbos, {}, 0);

    const catC1 = r1.categorias.find((c) => c.categoria === 'C')!;
    const catC2 = r2.categorias.find((c) => c.categoria === 'C')!;
    const catC3 = r3.categorias.find((c) => c.categoria === 'C')!;

    expect(catC1.pontosObtidos).toBe(0); // bairro sem cidade = 0
    expect(catC2.pontosObtidos).toBe(0); // cidade sem bairro = 0
    expect(catC3.pontosObtidos).toBe(7); // ambos = 7
  });
});

// ============================================================================
// Extras: consistência com tabela de pesos do PO
// ============================================================================
describe('computeRankingScore — verificações de consistência com PO', () => {
  it('contatos com declarou_voto + e_multiplicador têm ranking >= 3', () => {
    // Critério: 20+15 = 35 pts → FLOOR(35/10) = 3
    const contato: ContactLike = {
      declarou_voto: true,
      e_multiplicador: true,
    };
    const resultado = computeRankingScore(contato, {}, 0);
    expect(resultado.ranking).toBeGreaterThanOrEqual(3);
  });

  it('ranking nunca ultrapassa 10 mesmo com pontuação absurda', () => {
    const resultado = computeRankingScore(contatoCompleto, { f1: true }, 1);
    expect(resultado.ranking).toBeLessThanOrEqual(10);
  });

  it('maximos de cada categoria batem com tabela do PO', () => {
    const resultado = computeRankingScore(contatoCompleto, { f1: true }, 1);
    const maximos = resultado.categorias.map((c) => c.pontosMaximos);
    expect(maximos).toEqual([50, 25, 15, 5, 5]);
  });
});
