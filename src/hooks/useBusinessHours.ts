// ─── useBusinessHours (T51 — C27) ────────────────────────────────────────────
// Calcula se o horário de atendimento está ativo para uma conta Z-API.
// O cálculo é puramente client-side (sem EF, sem cron).
//
// Estrutura do JSONB:
//   { "seg": {"inicio": "08:00", "fim": "18:00", "ativo": true}, ... }
// Dias: seg=Segunda, ter=Terça, qua=Quarta, qui=Quinta, sex=Sexta, sab=Sábado, dom=Domingo
// NULL = feature desligada (isOpen = true por padrão — sem restrição).

import { useMemo } from 'react';
import type { ZapiAccount } from '@/hooks/useZapiAccounts';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface DaySchedule {
  inicio: string; // "HH:MM"
  fim: string;    // "HH:MM"
  ativo: boolean;
}

export interface BusinessHoursConfig {
  seg: DaySchedule;
  ter: DaySchedule;
  qua: DaySchedule;
  qui: DaySchedule;
  sex: DaySchedule;
  sab: DaySchedule;
  dom: DaySchedule;
}

export type DayKey = keyof BusinessHoursConfig;

/** Dia-da-semana JS (0=dom, 1=seg...) → chave do JSONB */
const DAY_MAP: DayKey[] = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sab'];

/** Dias para exibição na UI */
export const DAY_LABELS: Record<DayKey, string> = {
  seg: 'Segunda-feira',
  ter: 'Terça-feira',
  qua: 'Quarta-feira',
  qui: 'Quinta-feira',
  sex: 'Sexta-feira',
  sab: 'Sábado',
  dom: 'Domingo',
};

export const DAY_ORDER: DayKey[] = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];

/** Horário padrão ao habilitar um dia. */
const DEFAULT_DAY: DaySchedule = { inicio: '08:00', fim: '18:00', ativo: true };

/** Config padrão para quando não houver config salva. */
export function buildDefaultConfig(): BusinessHoursConfig {
  return {
    seg: { ...DEFAULT_DAY },
    ter: { ...DEFAULT_DAY },
    qua: { ...DEFAULT_DAY },
    qui: { ...DEFAULT_DAY },
    sex: { ...DEFAULT_DAY },
    sab: { inicio: '09:00', fim: '12:00', ativo: false },
    dom: { inicio: '09:00', fim: '12:00', ativo: false },
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** "HH:MM" → minutos desde meia-noite. */
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Calcula se agora está dentro do horário de atendimento. */
function calcIsOpen(config: BusinessHoursConfig, now: Date): boolean {
  const dayKey = DAY_MAP[now.getDay()];
  if (!dayKey) return true;
  const day = config[dayKey];
  if (!day || !day.ativo) return false;

  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const start = timeToMinutes(day.inicio);
  const end = timeToMinutes(day.fim);
  return currentMinutes >= start && currentMinutes < end;
}

/** Calcula a próxima abertura (máximo 7 dias à frente). */
function calcNextOpenTime(config: BusinessHoursConfig, now: Date): Date | null {
  for (let daysAhead = 0; daysAhead <= 7; daysAhead++) {
    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() + daysAhead);

    const dayKey = DAY_MAP[candidate.getDay()];
    if (!dayKey) continue;
    const day = config[dayKey];
    if (!day || !day.ativo) continue;

    const start = timeToMinutes(day.inicio);
    const currentMinutes = daysAhead === 0 ? now.getHours() * 60 + now.getMinutes() : -1;

    if (currentMinutes < start || daysAhead > 0) {
      const result = new Date(candidate);
      result.setHours(Math.floor(start / 60), start % 60, 0, 0);
      return result;
    }
  }
  return null;
}

/** Garante que o JSONB vindo do banco seja um BusinessHoursConfig válido. */
function parseConfig(raw: unknown): BusinessHoursConfig | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const allDays: DayKey[] = ['seg', 'ter', 'qua', 'qui', 'sex', 'sab', 'dom'];
  const result = {} as BusinessHoursConfig;
  for (const key of allDays) {
    const d = obj[key];
    if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
    const day = d as Record<string, unknown>;
    result[key] = {
      inicio: typeof day.inicio === 'string' ? day.inicio : '08:00',
      fim: typeof day.fim === 'string' ? day.fim : '18:00',
      ativo: typeof day.ativo === 'boolean' ? day.ativo : false,
    };
  }
  return result;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseBusinessHoursResult {
  /** true quando dentro do horário configurado. true quando config é null (sem restrição). */
  isOpen: boolean;
  /** Próximo horário de abertura. null quando aberto ou sem config. */
  nextOpenTime: Date | null;
  /** Config parsed (null se account não tem horario_atendimento). */
  config: BusinessHoursConfig | null;
}

/**
 * Calcula se o horário de atendimento da conta está ativo agora.
 * Cálculo puramente client-side usando `new Date()` no fuso do browser.
 * Resultado é memoizado — recalcula apenas quando `account` muda.
 */
export function useBusinessHours(account: ZapiAccount | null): UseBusinessHoursResult {
  return useMemo(() => {
    const raw = account?.horario_atendimento ?? null;
    const config = parseConfig(raw);

    if (!config) {
      // Sem config = sem restrição = sempre aberto
      return { isOpen: true, nextOpenTime: null, config: null };
    }

    const now = new Date();
    const isOpen = calcIsOpen(config, now);
    const nextOpenTime = isOpen ? null : calcNextOpenTime(config, now);

    return { isOpen, nextOpenTime, config };
  }, [account]);
}
