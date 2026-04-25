import { phoneComparisonKey } from './normalization';
import type { DuplicateContact, DuplicateGroup } from '@/hooks/useDuplicates';

// ---------- Tipos ----------

export type DuplicateCategory = 'AUTO_HARD' | 'AUTO_SOFT' | 'DISMISS_NAME' | 'MANUAL';

export interface AnalyzedGroup {
  group: DuplicateGroup;
  category: DuplicateCategory;
  reason: string;
  hardConflictField?: string;
}

export interface CategoryStats {
  groups: number;
  contacts: number;
  duplicates: number; // soma de (n-1) por grupo (qto seria removido)
}

export interface DuplicateAnalysis {
  totalGroups: number;
  totalContacts: number;
  totalDuplicates: number;
  byCategory: Record<DuplicateCategory, CategoryStats>;
  groups: AnalyzedGroup[];
}

// ---------- Regras ----------

/**
 * Campos cuja divergencia DENTRO de um grupo sinaliza que sao pessoas
 * diferentes (mesmo se whatsapp/email coincidirem). Auto-merge nao toca.
 */
const HARD_CONFLICT_FIELDS = ['cpf', 'data_nascimento', 'genero'] as const;

/**
 * Campos cuja divergencia impede o AUTO_HARD (mesclagem 100% deterministica),
 * mas e resolvivel via regras suaves quando o telefone e o mesmo.
 */
const SOFT_CONFLICT_FIELDS = [
  'nome',
  'nome_whatsapp',
  'email',
  'instagram',
  'twitter',
  'tiktok',
  'youtube',
  'logradouro',
  'numero',
  'complemento',
  'bairro',
  'cidade',
  'estado',
  'cep',
  'origem',
  'observacoes',
  'notas_assessor',
  'leader_id',
] as const;

function readField(c: DuplicateContact, key: string): unknown {
  return (c as unknown as Record<string, unknown>)[key];
}

function normText(val: unknown): string {
  if (val === null || val === undefined || val === '') return '';
  return String(val).trim().toLowerCase();
}

function distinctValues(contacts: DuplicateContact[], key: string): Set<string> {
  const set = new Set<string>();
  for (const c of contacts) {
    const v = normText(readField(c, key));
    if (v) set.add(v);
  }
  return set;
}

function findHardConflict(contacts: DuplicateContact[]): string | null {
  for (const f of HARD_CONFLICT_FIELDS) {
    if (distinctValues(contacts, f).size > 1) return f;
  }
  return null;
}

function hasSoftConflict(contacts: DuplicateContact[]): boolean {
  for (const f of SOFT_CONFLICT_FIELDS) {
    if (distinctValues(contacts, f).size > 1) return true;
  }
  return false;
}

/**
 * True se TODOS os contatos do grupo tem o mesmo telefone normalizado
 * (whatsapp ou telefone). Falso se algum nao tem telefone ou se algum
 * diverge.
 */
function allShareSamePhone(contacts: DuplicateContact[]): boolean {
  const keys = new Set<string>();
  for (const c of contacts) {
    const k = phoneComparisonKey(c.whatsapp) || phoneComparisonKey(c.telefone);
    if (!k) return false;
    keys.add(k);
  }
  return keys.size === 1;
}

// ---------- API ----------

/**
 * Classifica cada grupo de duplicados em uma de 4 categorias e devolve um
 * resumo agregado. Roda 100% local, sem custo de banco.
 *
 *   AUTO_HARD     -> grupo por whatsapp, sem nenhuma divergencia. Mescla
 *                    deterministicamente (comportamento atual do auto-merge).
 *   AUTO_SOFT     -> todos compartilham o mesmo telefone normalizado, mas ha
 *                    divergencia em campos resolviveis por regras (nome maior,
 *                    email mais recente, observacoes concatenadas, etc).
 *   DISMISS_NAME  -> agrupado apenas por nome igual com telefones distintos.
 *                    Falso positivo classico ("Ana", "Maria", placeholder).
 *   MANUAL        -> qualquer outro caso. Conflito real em CPF/nascimento/genero
 *                    ou whatsapp diferente em mesmo email -> exige humano.
 */
export function analyzeDuplicates(groups: DuplicateGroup[]): DuplicateAnalysis {
  const empty = (): CategoryStats => ({ groups: 0, contacts: 0, duplicates: 0 });
  const analysis: DuplicateAnalysis = {
    totalGroups: groups.length,
    totalContacts: groups.reduce((s, g) => s + g.contacts.length, 0),
    totalDuplicates: groups.reduce((s, g) => s + Math.max(0, g.contacts.length - 1), 0),
    byCategory: {
      AUTO_HARD: empty(),
      AUTO_SOFT: empty(),
      DISMISS_NAME: empty(),
      MANUAL: empty(),
    },
    groups: [],
  };

  for (const g of groups) {
    if (g.contacts.length < 2) continue;

    const hardField = findHardConflict(g.contacts);
    const sharesPhone = allShareSamePhone(g.contacts);
    const softConflict = hasSoftConflict(g.contacts);

    let category: DuplicateCategory;
    let reason: string;

    if (hardField) {
      category = 'MANUAL';
      reason = `Conflito real em ${hardField} — provavelmente pessoas diferentes`;
    } else if (g.match_field === 'whatsapp' && !softConflict) {
      category = 'AUTO_HARD';
      reason = 'Mesmo telefone, sem nenhuma divergencia';
    } else if (sharesPhone) {
      category = 'AUTO_SOFT';
      reason = 'Mesmo telefone, divergencias resolviveis por regras suaves';
    } else if (g.match_field === 'nome') {
      category = 'DISMISS_NAME';
      reason = 'Nomes iguais com telefones distintos — falso positivo';
    } else {
      category = 'MANUAL';
      reason = 'Mesmo email mas telefones distintos — provavelmente pessoas diferentes';
    }

    analysis.byCategory[category].groups++;
    analysis.byCategory[category].contacts += g.contacts.length;
    analysis.byCategory[category].duplicates += g.contacts.length - 1;
    analysis.groups.push({ group: g, category, reason, hardConflictField: hardField ?? undefined });
  }

  return analysis;
}

export function groupKey(g: DuplicateGroup): string {
  return `${g.match_field}:${g.match_value}`;
}
