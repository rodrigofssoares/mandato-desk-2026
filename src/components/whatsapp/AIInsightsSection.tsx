// Componente: AIInsightsSection
//
// Exibe no ContactPanel a sugestão de próxima ação do contato gerada por IA (C37).
// Análise lazy: dispara ao montar se ai_next_action_at é null ou stale (> 24h).
// Botão "Reanalisar" força nova chamada.
//
// Referência: RAQ-MAND-EM073 — T86 (Fase 7 Onda A)

import { useEffect, useState } from 'react';
import { Loader2, RefreshCw, Lightbulb, AlertCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAINextAction, type NextActionResult } from '@/hooks/useAINextAction';
import type { RecursosConfig } from '@/lib/featureFlags';
import { isFeatureEnabled } from '@/lib/featureFlags';

// ─── Props ────────────────────────────────────────────────────────────────────

interface AIInsightsSectionProps {
  contactId: string;
  accountId: string;
  config: RecursosConfig;
  /** Dados atuais do contato (para exibir ai_next_action já salvo) */
  aiNextAction?: string | null;
  aiNextActionAt?: string | null;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Retorna true se stale (> 24h) ou sem dados. */
function isStale(nextActionAt: string | null | undefined): boolean {
  if (!nextActionAt) return true;
  return Date.now() - new Date(nextActionAt).getTime() > 24 * 60 * 60 * 1000;
}

// ─── AIInsightsSection ────────────────────────────────────────────────────────

export function AIInsightsSection({
  contactId,
  accountId,
  config,
  aiNextAction,
  aiNextActionAt,
}: AIInsightsSectionProps) {
  if (!isFeatureEnabled(config, 'c37')) return null;

  return (
    <AIInsightsSectionInner
      contactId={contactId}
      accountId={accountId}
      aiNextAction={aiNextAction}
      aiNextActionAt={aiNextActionAt}
    />
  );
}

interface InnerProps {
  contactId: string;
  accountId: string;
  aiNextAction?: string | null;
  aiNextActionAt?: string | null;
}

function AIInsightsSectionInner({ contactId, accountId, aiNextAction, aiNextActionAt }: InnerProps) {
  const [localAction, setLocalAction] = useState<string | null>(null);
  const [localActionAt, setLocalActionAt] = useState<string | null>(null);
  const nextAction = useAINextAction(contactId, accountId);

  const displayAction = localAction ?? aiNextAction;
  const displayAt = localActionAt ?? aiNextActionAt;

  // Dispara análise lazy ao montar se stale
  useEffect(() => {
    if (isStale(aiNextActionAt)) {
      nextAction.mutate(undefined, {
        onSuccess: (res: NextActionResult) => {
          if (!res.skipped && !res.error && res.next_action) {
            setLocalAction(res.next_action);
            setLocalActionAt(new Date().toISOString());
          }
        },
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId]);

  function handleReanalisar() {
    nextAction.mutate(undefined, {
      onSuccess: (res: NextActionResult) => {
        if (!res.skipped && !res.error && res.next_action) {
          setLocalAction(res.next_action);
          setLocalActionAt(new Date().toISOString());
        }
      },
    });
  }

  // Estado: IA não configurada
  const lastResult = nextAction.data;
  if (lastResult?.skipped && !displayAction) {
    return (
      <div className="space-y-2">
        <SectionHeader onReanalisar={handleReanalisar} isPending={false} />
        <div className="rounded-lg border bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>Configure a IA nas </span>
          <Link to="/settings" className="text-primary hover:underline inline-flex items-center gap-0.5">
            Configurações
            <ExternalLink className="h-3 w-3" />
          </Link>
          <span> para usar este recurso.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <SectionHeader
        onReanalisar={handleReanalisar}
        isPending={nextAction.isPending}
        actionAt={displayAt}
      />

      {nextAction.isPending && !displayAction ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-1">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Gerando sugestão...
        </div>
      ) : displayAction ? (
        <div className="rounded-lg border bg-amber-50/60 border-amber-200 px-3 py-2.5">
          <p className="text-xs text-amber-900 leading-relaxed">{displayAction}</p>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground italic">
          Nenhuma sugestão disponível.
        </p>
      )}
    </div>
  );
}

interface SectionHeaderProps {
  onReanalisar: () => void;
  isPending: boolean;
  actionAt?: string | null;
}

function SectionHeader({ onReanalisar, isPending, actionAt }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
        <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
        Próxima ação sugerida
      </p>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={onReanalisar}
              disabled={isPending}
              title="Reanalisar"
            >
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left" className="text-xs">
            {actionAt
              ? `Sugestão gerada ${formatDistanceToNow(new Date(actionAt), { addSuffix: true, locale: ptBR })}`
              : 'Gerar sugestão'}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
