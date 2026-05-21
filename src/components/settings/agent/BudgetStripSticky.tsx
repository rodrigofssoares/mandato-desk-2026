import { DollarSign, PenLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAgentBudgetSpend } from '@/hooks/useAgentBudget';
import type { AgentSettings } from '@/hooks/useAgentSettings';

// ============================================================================
// Tipos
// ============================================================================

interface BudgetStripStickyProps {
  agentData: AgentSettings | null;
  onAdjust?: () => void;
}

// ============================================================================
// Componente
// ============================================================================

/**
 * Strip de orçamento sticky no topo da AgentSettingsTab.
 * Mostra o gasto do mês corrente vs limite configurado.
 */
export function BudgetStripSticky({ agentData, onAdjust }: BudgetStripStickyProps) {
  const { data: spend } = useAgentBudgetSpend();

  const limit = spend?.monthly_limit_brl ?? 50;
  const current = spend?.current_spend ?? 0;
  const pct = spend?.percent_used ?? 0;
  const status = spend?.status ?? 'ok';

  const barColor =
    status === 'blocked' || status === 'red'
      ? 'bg-destructive'
      : status === 'yellow'
      ? 'bg-yellow-500'
      : 'bg-[hsl(var(--accent))]';

  const now = new Date();
  const mesAno = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  if (!agentData) return null;

  return (
    <div
      className={cn(
        'rounded-xl px-4 py-3 flex items-center gap-4 sticky top-2 z-10',
        'text-white shadow-lg',
        'bg-gradient-to-r from-[hsl(351,61%,30%)] to-[hsl(351,61%,38%)]'
      )}
    >
      {/* ícone */}
      <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
        <DollarSign className="h-4 w-4 text-[hsl(40,62%,55%)]" />
      </div>

      {/* info */}
      <div className="flex-1 min-w-0">
        <p
          className="text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: 'hsl(40,62%,55%)' }}
        >
          Orçamento {mesAno}
        </p>
        <div className="flex items-baseline gap-1 mt-0.5">
          <span className="text-xl font-bold font-mono">
            R$ {limit.toFixed(0)}
          </span>
          <span className="text-xs opacity-70">/ mês</span>
        </div>
      </div>

      {/* barra progresso — oculta em mobile */}
      <div className="flex-1 max-w-[280px] hidden md:block">
        <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-500', barColor)}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>
        <p className="text-xs mt-1 opacity-80">
          Gasto: <strong>R$ {current.toFixed(2)}</strong> · Restam:{' '}
          <strong>R$ {Math.max(limit - current, 0).toFixed(2)}</strong>
        </p>
      </div>

      {/* botão ajustar */}
      {onAdjust && (
        <button
          type="button"
          onClick={onAdjust}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-medium bg-white/20 hover:bg-white/30 border border-white/30 transition-colors flex-shrink-0"
          aria-label="Ir para configurações de orçamento"
        >
          <PenLine className="h-3 w-3" />
          Ajustar
        </button>
      )}
    </div>
  );
}
