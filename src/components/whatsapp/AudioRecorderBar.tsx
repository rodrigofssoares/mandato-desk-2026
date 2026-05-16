import { Loader2, Send, Square, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { UseAudioRecorder } from '@/hooks/useAudioRecorder';

interface AudioRecorderBarProps {
  recorder: UseAudioRecorder;
  /** true enquanto o áudio gravado está sendo enviado (upload + Z-API). */
  isSending: boolean;
  /** Dispara o envio do áudio gravado. */
  onSend: () => void;
}

/** Formata segundos como mm:ss. */
function formatDuration(totalSec: number): string {
  const safe = Math.max(0, Math.floor(totalSec));
  const min = Math.floor(safe / 60);
  const sec = safe % 60;
  return `${min}:${String(sec).padStart(2, '0')}`;
}

/**
 * Barra de gravação de áudio que substitui o campo de texto do composer.
 *
 * - Estado `recording`: ponto vermelho pulsando + cronômetro + descartar + parar.
 * - Estado `recorded`: player de pré-escuta + descartar + enviar.
 *
 * Não é renderizada no estado `idle` — o ChatPanel cuida da troca.
 */
export function AudioRecorderBar({ recorder, isSending, onSend }: AudioRecorderBarProps) {
  const { status, durationSec, previewUrl, stop, reset } = recorder;

  if (status === 'recording') {
    return (
      <div className="flex flex-1 items-center gap-3 rounded-md border bg-muted/30 px-3 py-2">
        <span
          className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-destructive"
          aria-hidden="true"
        />
        <span className="text-sm font-medium tabular-nums" aria-live="polite">
          {formatDuration(durationSec)}
        </span>
        <span className="text-xs text-muted-foreground">Gravando áudio...</span>
        <div className="ml-auto flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={reset}
            title="Descartar gravação"
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            Descartar
          </Button>
          <Button type="button" size="sm" onClick={stop} title="Parar gravação">
            <Square className="h-4 w-4 mr-1.5" />
            Parar
          </Button>
        </div>
      </div>
    );
  }

  if (status === 'recorded') {
    return (
      <div className="flex flex-1 items-center gap-3 rounded-md border bg-muted/30 px-3 py-2">
        {previewUrl && (
          <audio src={previewUrl} controls className="h-9 min-w-0 flex-1" />
        )}
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {formatDuration(durationSec)}
        </span>
        <div className="flex shrink-0 items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={reset}
            disabled={isSending}
            title="Descartar gravação"
            aria-label="Descartar gravação"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={onSend}
            disabled={isSending}
            title="Enviar áudio"
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-1.5" />
            )}
            {isSending ? 'Enviando...' : 'Enviar'}
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
