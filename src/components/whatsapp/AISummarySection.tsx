// Componente: AISummarySection
//
// Exibe no ContactPanel o resumo (C33), classificação de assunto (C35) e
// sentimento (C36) gerados por IA para uma conversa WhatsApp.
//
// Comportamento lazy: dispara análise ao montar se ai_analyzed_at é null
// ou stale (> 1h). Botão "Reanalisar" força nova chamada.
// Se IA não configurada (skipped: true), exibe link para /settings.
//
// Referência: RAQ-MAND-EM073 — T80 (Fase 7 Onda A)

import { useEffect, useState } from 'react';
import { Loader2, RefreshCw, Sparkles, AlertCircle, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAIAnalyzeChat, type AIAnalysisResult } from '@/hooks/useAIAnalyzeChat';
import type { ZapiChat } from '@/hooks/useZapiChats';
import { isFeatureEnabled } from '@/lib/featureFlags';
import type { RecursosConfig } from '@/lib/featureFlags';

// ─── Props ────────────────────────────────────────────────────────────────────

interface AISummarySectionProps {
  chat: ZapiChat;
  config: RecursosConfig;
}

// ─── Helpers de sentimento ────────────────────────────────────────────────────

type Sentimento = 'positivo' | 'neutro' | 'negativo' | 'urgente';

const SENTIMENT_LABELS: Record<Sentimento, string> = {
  positivo: 'Positivo',
  neutro:   'Neutro',
  negativo: 'Negativo',
  urgente:  'Urgente',
};

const SENTIMENT_CLASS: Record<Sentimento, string> = {
  positivo: 'bg-green-100  text-green-800  border-green-300',
  neutro:   'bg-gray-100   text-gray-700   border-gray-300',
  negativo: 'bg-red-100    text-red-700    border-red-300',
  urgente:  'bg-amber-100  text-amber-800  border-amber-300',
};

function isSentimento(v: string | null | undefined): v is Sentimento {
  return ['positivo', 'neutro', 'negativo', 'urgente'].includes(v ?? '');
}

/** Retorna true se analyzed_at existe e tem mais de 1h. */
function isStale(analyzedAt: string | null | undefined): boolean {
  if (!analyzedAt) return true;
  return Date.now() - new Date(analyzedAt).getTime() > 60 * 60 * 1000;
}

// ─── AISummarySection ─────────────────────────────────────────────────────────

export function AISummarySection({ chat, config }: AISummarySectionProps) {
  const c33 = isFeatureEnabled(config, 'c33');
  const c35 = isFeatureEnabled(config, 'c35');
  const c36 = isFeatureEnabled(config, 'c36');

  // Não renderiza se nenhum flag de IA estiver ativo
  if (!c33 && !c35 && !c36) return null;

  return <AISummarySectionInner chat={chat} c33={c33} c35={c35} c36={c36} />;
}

interface InnerProps {
  chat: ZapiChat;
  c33: boolean;
  c35: boolean;
  c36: boolean;
}

function AISummarySectionInner({ chat, c33, c35, c36 }: InnerProps) {
  const [localResult, setLocalResult] = useState<AIAnalysisResult | null>(null);
  const analyze = useAIAnalyzeChat(chat.id, chat.account_id ?? null);

  // Dados consolidados: preferir dados locais (mais recentes) sobre os do chat
  const summary   = localResult?.summary   ?? (chat as ZapiChat & { ai_summary?: string | null }).ai_summary;
  const intent    = localResult?.intent    ?? (chat as ZapiChat & { ai_intent?: string | null }).ai_intent;
  const rawSent   = localResult?.sentiment ?? (chat as ZapiChat & { ai_sentiment?: string | null }).ai_sentiment;
  const sentiment = isSentimento(rawSent) ? rawSent : null;
  const analyzedAt = localResult?.analyzed_at
    ?? (chat as ZapiChat & { ai_analyzed_at?: string | null }).ai_analyzed_at;

  // Dispara análise lazy ao montar se stale ou sem dados
  useEffect(() => {
    const hasData = summary || intent || sentiment;
    if (!hasData || isStale(analyzedAt)) {
      analyze.mutate(undefined, {
        onSuccess: (res) => {
          if (!res.skipped && !res.error) setLocalResult(res);
        },
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.id]);

  function handleReanalisar() {
    analyze.mutate(undefined, {
      onSuccess: (res) => {
        if (!res.skipped && !res.error) setLocalResult(res);
      },
    });
  }

  // Estado: IA não configurada (skipped)
  const lastResult = analyze.data;
  if (lastResult?.skipped && !summary && !intent && !sentiment) {
    return (
      <div className="space-y-2">
        <SectionHeader />
        <div className="rounded-lg border bg-muted/20 px-3 py-2.5 space-y-1.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>Configure a IA nas </span>
            <Link to="/settings" className="text-primary hover:underline inline-flex items-center gap-0.5">
              Configurações
              <ExternalLink className="h-3 w-3" />
            </Link>
            <span> para usar este recurso.</span>
          </div>
        </div>
      </div>
    );
  }

  // Estado: erro do provider (mas sem dados ainda)
  if (lastResult?.error && !summary && !intent && !sentiment) {
    return (
      <div className="space-y-2">
        <SectionHeader />
        <div className="rounded-lg border bg-red-50 px-3 py-2 text-xs text-red-700 flex items-center gap-1.5">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          Não foi possível analisar a conversa.
        </div>
      </div>
    );
  }

  const hasData = summary || intent || sentiment;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <SectionHeader />
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleReanalisar}
                disabled={analyze.isPending}
                title="Reanalisar com IA"
              >
                {analyze.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="left" className="text-xs">
              {analyzedAt
                ? `Analisado ${formatDistanceToNow(new Date(analyzedAt), { addSuffix: true, locale: ptBR })}`
                : 'Reanalisar'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {analyze.isPending && !hasData ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-1">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Analisando conversa...
        </div>
      ) : hasData ? (
        <div className="rounded-lg border bg-muted/20 px-3 py-2.5 space-y-2">
          {/* Sentimento (C36) */}
          {c36 && sentiment && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide w-20 shrink-0">
                Sentimento
              </span>
              <Badge
                variant="outline"
                className={`text-[11px] font-medium ${SENTIMENT_CLASS[sentiment]}`}
              >
                {sentiment === 'urgente' && '⚠ '}
                {SENTIMENT_LABELS[sentiment]}
              </Badge>
            </div>
          )}

          {/* Classificação de assunto (C35) */}
          {c35 && intent && (
            <div className="flex items-start gap-2">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide w-20 shrink-0 pt-0.5">
                Assunto
              </span>
              <Badge variant="secondary" className="text-[11px] font-normal max-w-full whitespace-normal text-left h-auto py-0.5">
                {intent}
              </Badge>
            </div>
          )}

          {/* Resumo (C33) */}
          {c33 && summary && (
            <div className="space-y-0.5">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Resumo
              </span>
              <p className="text-xs text-foreground/80 leading-relaxed">{summary}</p>
            </div>
          )}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground italic">Nenhuma análise disponível.</p>
      )}
    </div>
  );
}

function SectionHeader() {
  return (
    <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
      <Sparkles className="h-3.5 w-3.5 text-primary" />
      Análise de IA
    </p>
  );
}
