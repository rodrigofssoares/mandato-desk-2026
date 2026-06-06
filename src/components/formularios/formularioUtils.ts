// EM054 — Utilitários compartilhados entre os componentes de formulários

import { format, formatDistanceToNow, isBefore, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Formata uma string ISO ou datetime-local para exibição curta em pt-BR.
 * Ex: "02/jun 08:00"
 */
export function formatarData(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const d = parseISO(iso);
    return format(d, "dd/MMM HH:mm", { locale: ptBR });
  } catch {
    return iso;
  }
}

/**
 * Formata datetime-local para exibição longa.
 * Ex: "14 de junho de 2026 às 23:59"
 */
export function formatarDataLonga(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const d = parseISO(iso);
    return format(d, "d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return iso ?? '';
  }
}

/**
 * Calcula contagem regressiva até encerra_em.
 * Retorna texto e flag urgente (< 3 dias).
 */
export function calcularContagem(
  encerraEm: string | null | undefined
): { texto: string; urgente: boolean } {
  if (!encerraEm) return { texto: '', urgente: false };
  try {
    const alvo = parseISO(encerraEm);
    if (isBefore(alvo, new Date())) return { texto: 'encerrado', urgente: false };
    const texto = formatDistanceToNow(alvo, { locale: ptBR, addSuffix: false });
    const diffMs = alvo.getTime() - Date.now();
    const urgente = diffMs < 3 * 24 * 60 * 60 * 1000;
    return { texto: `faltam ${texto}`, urgente };
  } catch {
    return { texto: '', urgente: false };
  }
}

/**
 * Converte valor de taxa de conversão (0-1) para string percentual.
 */
export function pctStr(taxa: number): string {
  return `${Math.round(taxa * 100)}%`;
}

/**
 * Formata uma data YYYY-MM-DD para exibição curta.
 * Ex: "05/jun"
 */
export function formatarDiaSerie(dia: string): string {
  try {
    const d = parseISO(dia);
    return format(d, 'dd/MMM', { locale: ptBR });
  } catch {
    return dia.slice(5); // fallback: MM-DD
  }
}
