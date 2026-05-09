/**
 * RankingBadge — exibe + edita o ranking do contato.
 *
 * Modo automático (override=false): número grande mostra o ranking calculado
 * por computeRankingScore (espelho TS da função SQL). Após salvar, o trigger
 * BEFORE em contacts grava o mesmo valor.
 *
 * Modo manual (override=true): número grande mostra o valor manual escolhido
 * pelo usuário. O trigger SQL respeita esse valor (não recalcula). Botão
 * "Voltar pro automático" volta ao modo auto.
 *
 * Em ambos os modos, os 11 botões 0-10 ficam clicáveis: clicar em qualquer
 * botão entra em modo manual com aquele valor.
 *
 * @see src/lib/contactRanking.ts — lógica de cálculo (espelho do SQL)
 * @see supabase/migrations/037_compute_contact_ranking.sql — fonte de verdade do auto
 * @see supabase/migrations/038_ranking_manual_override.sql — flag de override
 */

import { Info, Sparkles, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { computeRankingScore, type ContactLike, type RankingCategoria } from '@/lib/contactRanking';

interface RankingBadgeProps {
  /** Dados do contato pra cálculo automático (valores do form ou do banco) */
  contact: ContactLike;
  /** Valores dos campos de campanha: field_id → boolean */
  campaignValues?: Record<string, boolean>;
  /** Total de campos de campanha configurados no tenant */
  totalCampaignFields?: number;
  /** Valor manual atual (form.watch('ranking')); null/undefined em modo auto */
  manualValue: number | null | undefined;
  /** Modo manual ativo (form.watch('ranking_manual_override')) */
  manualOverride: boolean;
  /** Callback quando usuário clica num número 0-10 (entra em modo manual) */
  onSelectManual: (value: number) => void;
  /** Callback quando usuário clica em "Voltar pro automático" */
  onClearOverride: () => void;
}

const BOTOES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

/** Determina a cor do número grande por faixa de ranking */
function rankingClasses(ranking: number, manual: boolean): {
  badge: string;
  numero: string;
} {
  // Modo manual usa um esquema âmbar pra deixar claro que foi escolha humana
  if (manual) {
    return {
      badge: 'border-amber-500/40 bg-amber-500/5',
      numero: 'text-amber-600 dark:text-amber-500',
    };
  }
  if (ranking <= 3) {
    return {
      badge: 'border-border bg-muted/50',
      numero: 'text-muted-foreground',
    };
  }
  if (ranking <= 6) {
    return {
      badge: 'border-blue-500/30 bg-blue-500/5',
      numero: 'text-blue-600 dark:text-blue-400',
    };
  }
  if (ranking <= 8) {
    return {
      badge: 'border-green-500/30 bg-green-500/5',
      numero: 'text-green-600 dark:text-green-400',
    };
  }
  return {
    badge: 'border-yellow-500/40 bg-yellow-500/5',
    numero: 'text-yellow-600 dark:text-yellow-500',
  };
}

function BarraProgresso({ obtidos, maximo }: { obtidos: number; maximo: number }) {
  const pct = maximo === 0 ? 0 : Math.round((obtidos / maximo) * 100);
  return (
    <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
      <div
        className={cn(
          'h-full rounded-full transition-all',
          pct === 0 ? 'bg-muted-foreground/20' : pct < 50 ? 'bg-blue-400' : 'bg-green-500'
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function CategoriaSection({ cat }: { cat: RankingCategoria }) {
  const itensContribuindo = cat.itens.filter((i) => i.marcado);
  const itensFaltando = cat.itens.filter((i) => !i.marcado);

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-foreground">
          {cat.categoria}. {cat.label}
        </span>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {cat.pontosObtidos}/{cat.pontosMaximos} pts
        </span>
      </div>

      <BarraProgresso obtidos={cat.pontosObtidos} maximo={cat.pontosMaximos} />

      {itensContribuindo.map((item) => (
        <div key={item.label} className="flex items-center justify-between gap-1 pl-1">
          <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
            <span className="text-[10px]">✓</span>
            {item.label}
          </span>
          <span className="text-xs text-green-600 dark:text-green-400 font-medium">
            +{item.peso}
          </span>
        </div>
      ))}

      {itensFaltando.map((item) => (
        <div key={item.label} className="flex items-center justify-between gap-1 pl-1">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <span className="text-[10px]">○</span>
            {item.label}
          </span>
          <span className="text-xs text-muted-foreground">
            +{item.peso}
          </span>
        </div>
      ))}
    </div>
  );
}

export function RankingBadge({
  contact,
  campaignValues = {},
  totalCampaignFields = 0,
  manualValue,
  manualOverride,
  onSelectManual,
  onClearOverride,
}: RankingBadgeProps) {
  const breakdown = computeRankingScore(contact, campaignValues, totalCampaignFields);
  const { ranking: rankingAuto, score, categorias } = breakdown;

  // Valor exibido depende do modo. Em manual, respeita manualValue (clamp 0-10).
  const rankingExibido = manualOverride
    ? Math.max(0, Math.min(10, manualValue ?? 0))
    : rankingAuto;

  const classes = rankingClasses(rankingExibido, manualOverride);
  const semDados = score === 0;

  return (
    <div className="space-y-3">
      {/* Linha 1: badge grande + indicador de modo + popover */}
      <div className="flex items-center gap-3 flex-wrap">
        <div
          className={cn(
            'flex items-center justify-center w-14 h-14 rounded-xl border-2 font-bold text-3xl transition-colors shrink-0',
            classes.badge,
            classes.numero
          )}
          aria-label={`Ranking ${rankingExibido} de 10${manualOverride ? ' (manual)' : ' (calculado)'}`}
        >
          {rankingExibido}
        </div>

        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="text-xs font-medium text-foreground">Ranking</span>
          {manualOverride ? (
            <span className="text-[11px] text-amber-600 dark:text-amber-500 flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              definido manualmente
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">
              calculado automaticamente — {score}/100 pts
            </span>
          )}

          {manualOverride && (
            <button
              type="button"
              onClick={onClearOverride}
              className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 self-start mt-0.5"
            >
              <RotateCcw className="h-3 w-3" />
              voltar para automático ({rankingAuto})
            </button>
          )}
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Ver como o ranking foi calculado"
            >
              <Info className="h-4 w-4" />
              <span className="hidden sm:inline">Como foi calculado?</span>
            </button>
          </PopoverTrigger>

          <PopoverContent
            className="w-80 max-h-[28rem] overflow-y-auto"
            align="end"
            side="left"
          >
            <div className="space-y-3">
              <div>
                <h4 className="text-sm font-semibold">Como esse ranking foi calculado?</h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Escala 0-100 pts → ranking 0-10 (fórmula: pts ÷ 10, arredondado pra baixo).
                </p>
                {manualOverride && (
                  <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                    Este contato está em modo manual ({rankingExibido}). O cálculo
                    automático sugere {rankingAuto}.
                  </p>
                )}
              </div>

              {semDados ? (
                <p className="text-xs text-muted-foreground italic">
                  Preencha mais dados para aumentar a pontuação.
                </p>
              ) : (
                <div className="space-y-3">
                  {categorias.map((cat) => (
                    <CategoriaSection key={cat.categoria} cat={cat} />
                  ))}
                </div>
              )}

              <div className="border-t pt-2 flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Total</span>
                <span className="text-xs font-semibold">
                  {score}/100 pts = Ranking {rankingAuto}
                </span>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Linha 2: botões 0-10 pra override manual */}
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Selecionar ranking manual">
        {BOTOES.map((n) => {
          const ativo = n === rankingExibido;
          const sugestao = !manualOverride && n === rankingAuto;
          return (
            <button
              key={n}
              type="button"
              onClick={() => onSelectManual(n)}
              aria-pressed={ativo}
              aria-label={`Definir ranking ${n} manualmente`}
              className={cn(
                'h-9 min-w-9 px-2 rounded-lg border text-sm font-semibold transition-colors',
                ativo
                  ? manualOverride
                    ? 'bg-amber-600 text-white border-amber-600 hover:bg-amber-700'
                    : 'bg-primary text-primary-foreground border-primary hover:bg-primary/90'
                  : sugestao
                    ? 'bg-primary/5 border-primary/30 text-primary hover:bg-primary/10'
                    : 'bg-background border-border text-foreground hover:bg-muted'
              )}
            >
              {n}
            </button>
          );
        })}
      </div>

      {!manualOverride && (
        <p className="text-[11px] text-muted-foreground">
          Clique num número acima para sobrescrever manualmente.
        </p>
      )}
    </div>
  );
}
