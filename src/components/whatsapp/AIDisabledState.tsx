// Componente: AIDisabledState
//
// Estado vazio padronizado para quando um recurso de IA não está disponível.
// Três variantes:
//   - "not_configured": IA não configurada (sem chave/provider)
//   - "feature_disabled_global": recurso desabilitado globalmente em AISettingsTab
//   - "feature_disabled_account": recurso desabilitado nesta conta específica
//
// Referência: RAQ-MAND-EM073 — T93 (Fase 7 Onda B)

import { AlertCircle, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type AIDisabledVariant =
  | 'not_configured'
  | 'feature_disabled_global'
  | 'feature_disabled_account';

interface AIDisabledStateProps {
  variant: AIDisabledVariant;
  /** Tamanho compacto para uso dentro de seções pequenas (padrão: false) */
  compact?: boolean;
}

// ─── Conteúdo por variante ────────────────────────────────────────────────────

const VARIANT_CONTENT: Record<
  AIDisabledVariant,
  { message: string; linkLabel: string; linkTo: string }
> = {
  not_configured: {
    message: 'IA não configurada.',
    linkLabel: 'Configure nas Configurações',
    linkTo: '/settings#ai',
  },
  feature_disabled_global: {
    message: 'Este recurso está desativado globalmente.',
    linkLabel: 'Ativar em Configurações de IA',
    linkTo: '/settings#ai',
  },
  feature_disabled_account: {
    message: 'Este recurso está desativado nesta conta.',
    linkLabel: 'Ativar em Configurações de Conta',
    linkTo: '/whatsapp?tab=contas',
  },
};

// ─── AIDisabledState ──────────────────────────────────────────────────────────

export function AIDisabledState({ variant, compact = false }: AIDisabledStateProps) {
  const content = VARIANT_CONTENT[variant];

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        <span>{content.message}</span>
        <Link
          to={content.linkTo}
          className="text-primary hover:underline inline-flex items-center gap-0.5"
        >
          {content.linkLabel}
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-muted/20 px-3 py-2.5 space-y-1.5">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
        <span>{content.message}</span>
        <Link
          to={content.linkTo}
          className="text-primary hover:underline inline-flex items-center gap-0.5"
        >
          {content.linkLabel}
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
