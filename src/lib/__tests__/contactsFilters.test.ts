import { describe, it, expect } from 'vitest';
import {
  applyContactsClientFilters,
  buildContactsSelectClause,
} from '../contactsFilters';
import type { Contact, ContactFilters } from '@/hooks/useContacts';

// Factory mínima — só os campos relevantes pra filtros client-side.
function makeContact(overrides: Partial<Contact> = {}): Contact {
  return {
    id: overrides.id ?? 'c-1',
    nome: overrides.nome ?? 'Fulano',
    created_at: overrides.created_at ?? '2026-01-01T00:00:00Z',
    ...overrides,
  } as Contact;
}

describe('buildContactsSelectClause', () => {
  it('sem filtros de tags/board: select padrão com hidratação completa', () => {
    const result = buildContactsSelectClause({});
    expect(result.usingTagFilter).toBe(false);
    expect(result.usingBoardFilter).toBe(false);
    expect(result.selectClause).toContain('contact_tags(tag_id, tags(id, nome, cor))');
    expect(result.selectClause).not.toContain('!inner');
  });

  it('com tags: usa !inner em contact_tags', () => {
    const result = buildContactsSelectClause({ tags: ['tag-1'] });
    expect(result.usingTagFilter).toBe(true);
    expect(result.selectClause).toContain('contact_tags!inner(tag_id)');
  });

  it('com board_id: usa !inner em board_items + hidrata tags normal', () => {
    const result = buildContactsSelectClause({ board_id: 'b-1' });
    expect(result.usingBoardFilter).toBe(true);
    expect(result.selectClause).toContain('board_items!inner(board_id, stage_id)');
    expect(result.selectClause).toContain('contact_tags(tag_id, tags(id, nome, cor))');
  });

  it('com tags + board: ambos !inner', () => {
    const result = buildContactsSelectClause({ tags: ['t'], board_id: 'b' });
    expect(result.usingTagFilter).toBe(true);
    expect(result.usingBoardFilter).toBe(true);
    expect(result.selectClause).toContain('contact_tags!inner(tag_id)');
    expect(result.selectClause).toContain('board_items!inner(board_id, stage_id)');
  });
});

describe('applyContactsClientFilters', () => {
  it('sem filtros relevantes: retorna o array intacto', () => {
    const rows = [makeContact({ id: 'a' }), makeContact({ id: 'b' })];
    expect(applyContactsClientFilters(rows, {})).toEqual(rows);
  });

  it('birthday_filter "month": só quem faz aniversário no mês corrente', () => {
    const now = new Date();
    const thisMonth = String(now.getMonth() + 1).padStart(2, '0');
    const otherMonth = thisMonth === '01' ? '02' : '01';

    const rows = [
      makeContact({ id: 'in', data_nascimento: `1990-${thisMonth}-15` }),
      makeContact({ id: 'out', data_nascimento: `1990-${otherMonth}-15` }),
      makeContact({ id: 'null', data_nascimento: null }),
    ];

    const filters: ContactFilters = { birthday_filter: 'month' };
    const result = applyContactsClientFilters(rows, filters);
    expect(result.map((c) => c.id)).toEqual(['in']);
  });

  it('birthday range que NÃO cruza fim de ano: inclui boundaries', () => {
    const rows = [
      makeContact({ id: 'before', data_nascimento: '1990-03-14' }),
      makeContact({ id: 'from', data_nascimento: '1990-03-15' }),
      makeContact({ id: 'middle', data_nascimento: '1990-05-01' }),
      makeContact({ id: 'to', data_nascimento: '1990-06-20' }),
      makeContact({ id: 'after', data_nascimento: '1990-06-21' }),
    ];

    const filters: ContactFilters = { birthday_from: '03-15', birthday_to: '06-20' };
    const result = applyContactsClientFilters(rows, filters);
    expect(result.map((c) => c.id)).toEqual(['from', 'middle', 'to']);
  });

  it('birthday range que CRUZA fim de ano (dez→jan): aceita ambos lados', () => {
    const rows = [
      makeContact({ id: 'nov', data_nascimento: '1990-11-30' }),
      makeContact({ id: 'dez-start', data_nascimento: '1990-12-20' }),
      makeContact({ id: 'dez-end', data_nascimento: '1990-12-31' }),
      makeContact({ id: 'jan-start', data_nascimento: '1990-01-01' }),
      makeContact({ id: 'jan-end', data_nascimento: '1990-01-10' }),
      makeContact({ id: 'fev', data_nascimento: '1990-02-01' }),
    ];

    const filters: ContactFilters = { birthday_from: '12-20', birthday_to: '01-10' };
    const result = applyContactsClientFilters(rows, filters);
    expect(result.map((c) => c.id).sort()).toEqual(
      ['dez-end', 'dez-start', 'jan-end', 'jan-start'].sort()
    );
  });

  it('birthday só "from": filtra a partir do dia (sem teto)', () => {
    const rows = [
      makeContact({ id: 'before', data_nascimento: '1990-05-09' }),
      makeContact({ id: 'eq', data_nascimento: '1990-05-10' }),
      makeContact({ id: 'after', data_nascimento: '1990-08-01' }),
    ];

    const filters: ContactFilters = { birthday_from: '05-10' };
    const result = applyContactsClientFilters(rows, filters);
    expect(result.map((c) => c.id)).toEqual(['eq', 'after']);
  });

  it('contato sem data_nascimento é descartado em qualquer filtro de aniversário', () => {
    const rows = [makeContact({ id: 'no-bday', data_nascimento: null })];
    const result = applyContactsClientFilters(rows, { birthday_from: '01-01', birthday_to: '12-31' });
    expect(result).toEqual([]);
  });
});
