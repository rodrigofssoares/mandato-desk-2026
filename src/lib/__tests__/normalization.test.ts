import { describe, it, expect } from 'vitest';
import { phoneComparisonKey, normalizePhone, formatPhoneDisplay } from '../normalization';

describe('phoneComparisonKey', () => {
  it('remove DDI 55 quando presente', () => {
    expect(phoneComparisonKey('+5511930423594')).toBe('11930423594');
    expect(phoneComparisonKey('5511930423594')).toBe('11930423594');
    expect(phoneComparisonKey('11930423594')).toBe('11930423594');
    expect(phoneComparisonKey('(11) 93042-3594')).toBe('11930423594');
  });

  it('adiciona 9 em movel BR sem nono digito (pos-2014)', () => {
    // O caso real do bug — Florianopolis, mesmo numero em formatos diferentes
    expect(phoneComparisonKey('554891932106')).toBe('48991932106');
    expect(phoneComparisonKey('5548991932106')).toBe('48991932106');
    expect(phoneComparisonKey('4891932106')).toBe('48991932106');
    expect(phoneComparisonKey('48991932106')).toBe('48991932106');
  });

  it('NAO adiciona 9 em telefone fixo (DDD + 2-5)', () => {
    expect(phoneComparisonKey('1140001234')).toBe('1140001234'); // SP fixo
    expect(phoneComparisonKey('554140001234')).toBe('4140001234'); // Curitiba fixo
    expect(phoneComparisonKey('1132401234')).toBe('1132401234'); // SP fixo
  });

  it('lida com vazios e invalidos', () => {
    expect(phoneComparisonKey('')).toBe('');
    expect(phoneComparisonKey(null)).toBe('');
    expect(phoneComparisonKey(undefined)).toBe('');
    expect(phoneComparisonKey('abc')).toBe('');
  });

  it('preserva formato pos-2014 (11 digitos)', () => {
    expect(phoneComparisonKey('11930423594')).toBe('11930423594');
    expect(phoneComparisonKey('48991932106')).toBe('48991932106');
  });
});

describe('normalizePhone', () => {
  it('adiciona prefixo 55 quando ausente', () => {
    expect(normalizePhone('11930423594')).toBe('5511930423594');
    expect(normalizePhone('1140001234')).toBe('551140001234');
  });

  it('mantem 55 quando ja presente', () => {
    expect(normalizePhone('5511930423594')).toBe('5511930423594');
    expect(normalizePhone('+5511930423594')).toBe('5511930423594');
  });
});

describe('formatPhoneDisplay', () => {
  it('aplica mascara brasileira', () => {
    expect(formatPhoneDisplay('5511930423594')).toBe('(11) 93042-3594');
    expect(formatPhoneDisplay('11930423594')).toBe('(11) 93042-3594');
    expect(formatPhoneDisplay('1140001234')).toBe('(11) 4000-1234');
  });
});
