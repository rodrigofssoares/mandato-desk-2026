/**
 * WhatsAppSegmentedControl.tsx
 *
 * Segmented control tri-state para filtro de aceite de WhatsApp.
 * Componente reutilizado no funil (WhatsAppFilterControl) e na aba Contatos.
 *
 * - "Todos": sem filtro
 * - "Aceita": aceita_whatsapp = true (dot verde)
 * - "Não aceita": aceita_whatsapp = false (dot vermelho)
 *
 * null é tratado como "sem informação" — só aparece em "Todos".
 *
 * Acessibilidade: role="radiogroup" + aria-checked + title tooltip em cada botão.
 * (não usa aria-pressed: ARIA não permite combinar role="radio" + aria-pressed
 * no mesmo elemento — confunde screen readers.)
 */

import type { WhatsAppFilterMode } from '@/lib/boardFilterStorage';

interface WhatsAppSegmentedControlProps {
  value: WhatsAppFilterMode;
  onChange: (value: WhatsAppFilterMode) => void;
  /** Rótulo opcional exibido antes do controle */
  label?: string;
  /** Desabilita todos os botões */
  disabled?: boolean;
}

export function WhatsAppSegmentedControl({
  value,
  onChange,
  label = 'Aceite WhatsApp:',
  disabled = false,
}: WhatsAppSegmentedControlProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {label && (
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
          {label}
        </span>
      )}

      <div
        role="radiogroup"
        aria-label="Filtro de aceite WhatsApp"
        className="inline-flex rounded-lg border border-input overflow-hidden bg-background"
      >
        {/* Todos */}
        <button
          type="button"
          role="radio"
          aria-checked={value === 'all'}
          disabled={disabled}
          title="Mostra todos os contatos — sem filtrar por aceite de WhatsApp"
          onClick={() => onChange('all')}
          className={[
            'px-3 py-1.5 text-xs font-medium transition-colors outline-none',
            'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            value === 'all'
              ? 'bg-primary text-primary-foreground'
              : 'text-foreground hover:bg-muted',
          ].join(' ')}
        >
          Todos
        </button>

        {/* Aceita */}
        <button
          type="button"
          role="radio"
          aria-checked={value === 'yes'}
          disabled={disabled}
          title="Apenas contatos que marcaram 'Aceita WhatsApp = Sim'"
          onClick={() => onChange('yes')}
          className={[
            'px-3 py-1.5 text-xs font-medium border-l border-input transition-colors',
            'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'inline-flex items-center gap-1.5',
            value === 'yes'
              ? 'bg-primary text-primary-foreground'
              : 'text-foreground hover:bg-muted',
          ].join(' ')}
        >
          <span
            className={[
              'inline-block w-2 h-2 rounded-full flex-shrink-0',
              value === 'yes' ? 'bg-green-300' : 'bg-green-600',
            ].join(' ')}
            aria-hidden="true"
          />
          Aceita
        </button>

        {/* Não aceita */}
        <button
          type="button"
          role="radio"
          aria-checked={value === 'no'}
          disabled={disabled}
          title="Apenas contatos que marcaram 'Aceita WhatsApp = Não'"
          onClick={() => onChange('no')}
          className={[
            'px-3 py-1.5 text-xs font-medium border-l border-input transition-colors',
            'outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            'inline-flex items-center gap-1.5',
            value === 'no'
              ? 'bg-primary text-primary-foreground'
              : 'text-foreground hover:bg-muted',
          ].join(' ')}
        >
          <span
            className={[
              'inline-block w-2 h-2 rounded-full flex-shrink-0',
              value === 'no' ? 'bg-red-300' : 'bg-red-500',
            ].join(' ')}
            aria-hidden="true"
          />
          Não aceita
        </button>
      </div>
    </div>
  );
}
