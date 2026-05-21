import { MessageSquare, Bot, Zap, Star, Shield } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { AgentPublicInfo } from '@/hooks/useAgentSettings';
import type { AgentMessage } from '@/hooks/useAgentChat';

// ============================================================================
// Helpers
// ============================================================================

function calcSessionTokens(messages: AgentMessage[]): number {
  return messages.reduce((acc, m) => acc + (m.tokens ?? 0), 0);
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

// ============================================================================
// Componente
// ============================================================================

interface AgentHeaderProps {
  agent: AgentPublicInfo | null;
  messages: AgentMessage[];
  favoritesCount: number;
  selectedModel: string | null;
  onOpenHistory: () => void;
  onOpenFavorites: () => void;
}

export function AgentHeader({
  agent,
  messages,
  favoritesCount,
  selectedModel,
  onOpenHistory,
  onOpenFavorites,
}: AgentHeaderProps) {
  const tokenCount = calcSessionTokens(messages);
  const agentName = agent?.name ?? 'Atendente Institucional';
  const modelLabel = selectedModel ?? 'claude-3.5-sonnet';

  return (
    <header
      className={cn(
        'h-[72px] flex items-center gap-4 px-8 flex-shrink-0 z-10 relative',
        'bg-card/70 backdrop-blur-[12px] border-b border-border/60',
        'sm:px-4 sm:gap-2.5 sm:h-16'
      )}
    >
      {/* Botão histórico */}
      <button
        onClick={onOpenHistory}
        title="Histórico de conversas"
        aria-label="Abrir histórico"
        className={cn(
          'flex-shrink-0 w-[38px] h-[38px] flex items-center justify-center',
          'bg-transparent border border-border rounded-[11px]',
          'text-foreground hover:bg-muted hover:translate-y-[-1px] transition-all duration-150 cursor-pointer'
        )}
      >
        <MessageSquare className="h-[18px] w-[18px]" />
      </button>

      {/* Marca / avatar do agente */}
      <div className="flex items-center gap-3.5">
        <div
          className="relative w-11 h-11 rounded-[14px] flex items-center justify-center text-primary-foreground flex-shrink-0 sm:w-[38px] sm:h-[38px] sm:rounded-[12px]"
          style={{
            background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.75) 100%)',
            boxShadow: '0 4px 12px hsl(var(--primary) / 0.25)',
          }}
          aria-hidden="true"
        >
          <Bot className="h-5 w-5" />
          {/* Status dot verde */}
          <span
            className="absolute bottom-[-2px] right-[-2px] w-3 h-3 rounded-full border-[2.5px] border-card"
            style={{ background: 'hsl(142 71% 45%)' }}
            aria-hidden="true"
          />
        </div>

        <div className="leading-tight">
          <span
            className="block text-[9.5px] font-semibold text-accent-foreground uppercase tracking-[0.18em] mb-[2px] sm:hidden"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            Agente do Gabinete
          </span>
          <span
            className="block text-[17px] font-semibold text-foreground sm:text-[15px]"
            style={{ fontFamily: "'Space Grotesk', sans-serif", letterSpacing: '-0.01em' }}
          >
            {agentName}
          </span>
        </div>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Pills */}
      <div className="hidden md:flex gap-2">
        {/* Modelo */}
        <span className="inline-flex items-center gap-1.5 px-[11px] py-[5px] border border-border bg-card rounded-full text-[11px] font-medium text-muted-foreground">
          <Zap className="h-[11px] w-[11px] text-primary" />
          {modelLabel}
        </span>

        {/* Tokens */}
        {tokenCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-[11px] py-[5px] border border-border bg-card rounded-full text-[11px] font-medium text-muted-foreground">
            {formatTokens(tokenCount)} tokens · sessão
          </span>
        )}

        {/* LGPD */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className="inline-flex items-center gap-1.5 px-[11px] py-[5px] rounded-full text-[11px] font-medium cursor-default"
              style={{
                background: 'hsl(48 96% 89%)',
                color: 'hsl(26 83% 30%)',
              }}
            >
              <Shield className="h-[11px] w-[11px]" />
              LGPD
            </span>
          </TooltipTrigger>
          <TooltipContent>
            Não use dados pessoais (CPF, nome completo, telefone) — LGPD
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Botão favoritos com badge */}
      <button
        onClick={onOpenFavorites}
        title={`Favoritas (${favoritesCount})`}
        aria-label={`Abrir favoritas (${favoritesCount})`}
        className={cn(
          'relative flex-shrink-0 w-[38px] h-[38px] flex items-center justify-center',
          'bg-transparent border border-border rounded-[11px]',
          'hover:bg-muted hover:translate-y-[-1px] transition-all duration-150 cursor-pointer'
        )}
      >
        <Star className="h-[18px] w-[18px] fill-current text-amber-500" />
        {favoritesCount > 0 && (
          <span
            className="absolute top-[-4px] right-[-4px] min-w-[18px] text-center px-[5px] py-[1px] text-[9px] font-bold rounded-full border-2 border-card"
            style={{ background: 'hsl(var(--accent))', color: 'hsl(var(--accent-foreground))' }}
          >
            {favoritesCount > 99 ? '99+' : favoritesCount}
          </span>
        )}
      </button>
    </header>
  );
}
