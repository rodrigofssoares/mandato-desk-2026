/**
 * RankingBadge — exibe o ranking calculado automaticamente com breakdown em popover.
 *
 * O preview é otimista: recalcula em tempo real com os valores atuais do form
 * via computeRankingScore (espelho TS da função SQL).
 * Após salvar, o valor definitivo vem do banco (invalidação de query).
 *
 * @see src/lib/contactRanking.ts — lógica de cálculo (espelho do SQL)
 * @see supabase/migrations/037_compute_contact_ranking.sql — fonte de verdade
 */

import { Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { computeRankingScore, type ContactLike, type RankingCategoria } from '@/lib/contactRanking';

interface RankingBadgeProps {
  /** Dados do contato para cálculo do preview (valores do form ou do banco) */
  contact: ContactLike;
  /** Valores dos campos de campanha: field_id → boolean */
  campaignValues?: Record<string, boolean>;
  /** Total de campos de campanha configurados no tenant */
  totalCampaignFields?: number;
}

/** Determina a cor do badge por faixa de ranking */
function rankingClasses(ranking: number): {
  badge: string;
  numero: string;
} {
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
  // 9-10
  return {
    badge: 'border-yellow-500/40 bg-yellow-500/5',
    numero: 'text-yellow-600 dark:text-yellow-500',
  };
}

/** Barra de progresso simples para o breakdown por categoria */
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

/** Seção de uma categoria no popover */
function CategoriaSection({ cat }: { cat: RankingCategoria }) {
  const itensContribuindo = cat.itens.filter((i) => i.marcado);
  const itensFaltando = cat.itens.filter((i) => !i.marcado);

  return (
    <div className="space-y-1">
      {/* Header da categoria */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-foreground">
          {cat.categoria}. {cat.label}
        </span>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {cat.pontosObtidos}/{cat.pontosMaximos} pts
        </span>
      </div>

      <BarraProgresso obtidos={cat.pontosObtidos} maximo={cat.pontosMaximos} />

      {/* Campos que contribuíram */}
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

      {/* Campos faltando com potencial */}
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
}: RankingBadgeProps) {
  const breakdown = computeRankingScore(contact, campaignValues, totalCampaignFields);
  const { ranking, score, categorias } = breakdown;
  const classes = rankingClasses(ranking);

  const semDados = score === 0;

  return (
    <div className="flex items-center gap-3">
      {/* Badge com número grande */}
      <div
        className={cn(
          'flex items-center justify-center w-14 h-14 rounded-xl border-2 font-bold text-3xl transition-colors',
          classes.badge,
          classes.numero
        )}
        aria-label={`Ranking ${ranking} de 10`}
      >
        {ranking}
      </div>

      {/* Legenda e botão de info */}
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-medium text-foreground">Ranking</span>
        <span className="text-[11px] text-muted-foreground">calculado automaticamente</span>
        <span className="text-[11px] text-muted-foreground">{score}/100 pts</span>
      </div>

      {/* Popover de breakdown */}
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
            {/* Título */}
            <div>
              <h4 className="text-sm font-semibold">Como esse ranking foi calculado?</h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                Escala 0-100 pts → ranking 0-10 (fórmula: pts ÷ 10, arredondado pra baixo)
              </p>
            </div>

            {/* Mensagem para contato sem nenhum dado */}
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

            {/* Footer com total */}
            <div className="border-t pt-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Total</span>
              <span className="text-xs font-semibold">
                {score}/100 pts = Ranking {ranking}
              </span>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
