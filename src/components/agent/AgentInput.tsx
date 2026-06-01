import { useRef, useCallback, KeyboardEvent } from 'react';
import { Paperclip, Send } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================================================
// Componente
// ============================================================================

interface AgentInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isLoading: boolean;
  disabled?: boolean;
}

export function AgentInput({
  value,
  onChange,
  onSend,
  isLoading,
  disabled = false,
}: AgentInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize do textarea
  const handleInput = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    onChange(el.value);
  }, [onChange]);

  // Enter envia; Shift+Enter quebra linha
  const handleKeyDown = useCallback((e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isLoading && value.trim()) {
        onSend();
        // Reset height
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
        }
      }
    }
  }, [isLoading, onSend, value]);

  function handleSendClick() {
    if (!isLoading && value.trim()) {
      onSend();
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  }

  const canSend = !isLoading && !disabled && value.trim().length > 0;

  return (
    <div className="px-6 pb-5 pt-3 flex-shrink-0">
      <div className="max-w-[740px] mx-auto">
        {/* Wrapper com glass */}
        <div
          className={cn(
            'flex items-end gap-2 rounded-[18px] p-[10px_10px_10px_16px]',
            'bg-card/85 backdrop-blur-[14px] border border-border',
            'transition-all duration-150',
            'focus-within:border-primary/60 focus-within:shadow-[0_12px_32px_-10px_hsl(var(--primary)/0.25)]',
          )}
          style={{ boxShadow: '0 10px 30px -10px hsl(var(--primary) / 0.15)' }}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte ao agente do gabinete..."
            aria-label="Mensagem para o agente"
            rows={1}
            disabled={disabled || isLoading}
            className={cn(
              'flex-1 border-none outline-none bg-transparent resize-none',
              'text-[14.5px] text-foreground placeholder:text-muted-foreground',
              'py-1.5 min-h-6 max-h-[160px] leading-relaxed',
              'disabled:opacity-50 disabled:cursor-not-allowed'
            )}
          />

          {/* Botões de ação */}
          <div className="flex gap-1 pb-[2px]">
            {/* Anexar (desabilitado — Slice 2) */}
            <button
              type="button"
              disabled
              aria-label="Anexar arquivo (em breve)"
              title="Anexar (em breve)"
              className="w-9 h-9 flex items-center justify-center rounded-[10px] text-muted-foreground opacity-40 cursor-not-allowed"
            >
              <Paperclip className="h-[18px] w-[18px]" />
            </button>

            {/* Enviar */}
            <button
              type="button"
              onClick={handleSendClick}
              disabled={!canSend}
              aria-label="Enviar mensagem"
              className={cn(
                'w-9 h-9 flex items-center justify-center rounded-[10px]',
                'transition-all duration-150',
                canSend
                  ? 'bg-primary text-primary-foreground shadow-[0_3px_10px_hsl(var(--primary)/0.25)] hover:opacity-90 hover:translate-y-[-1px] cursor-pointer'
                  : 'bg-muted text-muted-foreground cursor-not-allowed opacity-50'
              )}
            >
              {isLoading ? (
                <span className="w-[17px] h-[17px] border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="h-[17px] w-[17px]" />
              )}
            </button>
          </div>
        </div>

        {/* Rodapé informativo */}
        <div className="flex items-center justify-between mt-2 text-[11px] text-muted-foreground">
          <span>
            <kbd className="bg-muted border border-border rounded px-[5px] py-[1px] font-mono text-[10.5px] font-semibold">
              Enter
            </kbd>{' '}
            envia ·{' '}
            <kbd className="bg-muted border border-border rounded px-[5px] py-[1px] font-mono text-[10.5px] font-semibold">
              Shift+Enter
            </kbd>{' '}
            quebra linha
          </span>
          <span
            className="uppercase tracking-[0.14em] text-[9.5px]"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            Histórico · 30 dias · Favoritas · sem expiração
          </span>
        </div>
      </div>
    </div>
  );
}
