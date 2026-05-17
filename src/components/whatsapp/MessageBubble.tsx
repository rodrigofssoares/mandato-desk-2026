import type { ReactNode } from 'react';
import {
  Check,
  CheckCheck,
  AlertTriangle,
  FileText,
  Download,
  MapPin,
  User,
  BarChart3,
  Music,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ZapiMessage } from '@/hooks/useZapiMessages';

interface MessageBubbleProps {
  message: ZapiMessage;
  /** T17: termo de busca para highlight no corpo da mensagem */
  highlightTerm?: string;
  /** T17: função que converte texto + termo em ReactNode com <mark> */
  highlightText?: (text: string, term: string) => ReactNode;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function StatusIcon({ status }: { status: ZapiMessage['status'] }) {
  if (status === 'error') {
    return <AlertTriangle className="h-3.5 w-3.5 text-destructive" aria-label="Erro no envio" />;
  }
  if (status === 'read') {
    return <CheckCheck className="h-3.5 w-3.5 text-sky-300" aria-label="Lida" />;
  }
  if (status === 'delivered') {
    return <CheckCheck className="h-3.5 w-3.5 opacity-80" aria-label="Entregue" />;
  }
  return <Check className="h-3.5 w-3.5 opacity-80" aria-label="Enviada" />;
}

interface MediaMetadata {
  question?: string;
  options?: string[];
  allow_multiple_answers?: boolean;
  latitude?: number;
  longitude?: number;
  name?: string;
  address?: string;
  displayName?: string;
  vCard?: string;
  seconds?: number;
  ptt?: boolean;
  // Campos de reação do WhatsApp (media_type='reaction')
  emoji?: string;
  reaction_message_id?: string | null;
  reaction_by?: string | null;
  reaction_time?: number | null;
}

function getMetadata(message: ZapiMessage): MediaMetadata | null {
  const m = (message as { media_metadata?: unknown }).media_metadata;
  if (!m || typeof m !== 'object') return null;
  return m as MediaMetadata;
}

export function MessageBubble({ message, highlightTerm, highlightText }: MessageBubbleProps) {
  const isOutbound = message.direction === 'outbound';
  const mediaType = (message as { media_type?: string }).media_type ?? 'text';

  return (
    <div className={cn('flex w-full', isOutbound ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[75%] rounded-2xl text-sm shadow-sm overflow-hidden',
          isOutbound
            ? 'bg-primary text-primary-foreground rounded-br-sm'
            : 'bg-muted text-foreground rounded-bl-sm',
        )}
      >
        <div className="px-3 pt-2 pb-1">
          {renderContent(message, mediaType, isOutbound, highlightTerm, highlightText)}
        </div>
        <div
          className={cn(
            'px-3 pb-1.5 flex items-center gap-1 text-[10px]',
            isOutbound ? 'justify-end opacity-90' : 'justify-start opacity-60',
          )}
        >
          <span>{formatTime(message.sent_at)}</span>
          {isOutbound && <StatusIcon status={message.status} />}
        </div>
      </div>
    </div>
  );
}

function renderContent(
  message: ZapiMessage,
  mediaType: string,
  isOutbound: boolean,
  highlightTerm?: string,
  highlightText?: (text: string, term: string) => ReactNode,
): JSX.Element {
  const url = (message as { media_url?: string | null }).media_url ?? null;
  const caption = (message as { media_caption?: string | null }).media_caption ?? message.body ?? null;
  const filename = (message as { media_filename?: string | null }).media_filename ?? null;
  const meta = getMetadata(message);

  switch (mediaType) {
    case 'image':
      return (
        <div className="-mx-3 -mt-2 mb-1">
          {url ? (
            <a href={url} target="_blank" rel="noopener noreferrer">
              <img
                src={url}
                alt={caption ?? 'Imagem'}
                className="w-full max-h-80 object-cover hover:opacity-90 transition-opacity"
                loading="lazy"
              />
            </a>
          ) : (
            <div className="px-3 py-4 text-center text-xs italic opacity-70">[Imagem indisponível]</div>
          )}
          {caption && (
            <p className="px-3 mt-2 whitespace-pre-wrap break-words">{caption}</p>
          )}
        </div>
      );

    case 'video':
      return (
        <div className="-mx-3 -mt-2 mb-1">
          {url ? (
            <video controls className="w-full max-h-80 bg-black" preload="metadata">
              <source src={url} />
              Seu navegador não suporta vídeo HTML5.
            </video>
          ) : (
            <div className="px-3 py-4 text-center text-xs italic opacity-70">[Vídeo indisponível]</div>
          )}
          {caption && (
            <p className="px-3 mt-2 whitespace-pre-wrap break-words">{caption}</p>
          )}
        </div>
      );

    case 'audio': {
      const sec = meta?.seconds;
      const ptt = meta?.ptt;
      return (
        <div className="flex items-center gap-2 min-w-[200px]">
          <Music className="h-4 w-4 shrink-0 opacity-70" />
          {url ? (
            <audio controls className="flex-1 h-8">
              <source src={url} />
            </audio>
          ) : (
            <p className="text-xs italic opacity-70">[Áudio indisponível]</p>
          )}
          {sec ? (
            <span className="text-[10px] opacity-70 shrink-0">
              {ptt ? 'Voz · ' : ''}{Math.round(sec)}s
            </span>
          ) : null}
        </div>
      );
    }

    case 'document': {
      const display = filename ?? 'Documento';
      return (
        <a
          href={url ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'flex items-center gap-3 -mx-1 px-3 py-2 rounded-md transition-colors',
            isOutbound ? 'hover:bg-primary-foreground/10' : 'hover:bg-foreground/5',
          )}
          download={filename ?? undefined}
        >
          <div
            className={cn(
              'h-9 w-9 rounded-md flex items-center justify-center shrink-0',
              isOutbound ? 'bg-primary-foreground/20' : 'bg-foreground/10',
            )}
          >
            <FileText className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{display}</p>
            {caption && <p className="text-xs opacity-80 truncate">{caption}</p>}
            <p className="text-[10px] opacity-60 mt-0.5 flex items-center gap-1">
              <Download className="h-3 w-3" /> Baixar
            </p>
          </div>
        </a>
      );
    }

    case 'poll': {
      const question = meta?.question ?? message.body ?? 'Enquete';
      const options = Array.isArray(meta?.options) ? meta.options : [];
      return (
        <div className="space-y-2 min-w-[220px]">
          <div className="flex items-center gap-1.5 text-xs opacity-80">
            <BarChart3 className="h-3.5 w-3.5" />
            <span>Enquete</span>
          </div>
          <p className="font-medium whitespace-pre-wrap break-words">{question}</p>
          <ul className="space-y-1">
            {options.map((opt, i) => (
              <li
                key={i}
                className={cn(
                  'text-xs px-2 py-1.5 rounded',
                  isOutbound ? 'bg-primary-foreground/15' : 'bg-foreground/5',
                )}
              >
                {opt}
              </li>
            ))}
          </ul>
          {meta?.allow_multiple_answers && (
            <p className="text-[10px] opacity-70">Múltipla escolha permitida</p>
          )}
        </div>
      );
    }

    case 'location': {
      const lat = meta?.latitude;
      const lng = meta?.longitude;
      const label = meta?.name ?? meta?.address ?? 'Localização';
      const mapsUrl =
        typeof lat === 'number' && typeof lng === 'number'
          ? `https://www.google.com/maps?q=${lat},${lng}`
          : null;
      return (
        <a
          href={mapsUrl ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            'flex items-center gap-3 -mx-1 px-3 py-2 rounded-md transition-colors',
            isOutbound ? 'hover:bg-primary-foreground/10' : 'hover:bg-foreground/5',
          )}
        >
          <div
            className={cn(
              'h-9 w-9 rounded-md flex items-center justify-center shrink-0',
              isOutbound ? 'bg-primary-foreground/20' : 'bg-foreground/10',
            )}
          >
            <MapPin className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{label}</p>
            {meta?.address && meta.address !== label && (
              <p className="text-xs opacity-80 truncate">{meta.address}</p>
            )}
            {mapsUrl && <p className="text-[10px] opacity-60 mt-0.5">Abrir no Google Maps</p>}
          </div>
        </a>
      );
    }

    case 'contact': {
      const display = meta?.displayName ?? message.body ?? 'Contato';
      return (
        <div className="flex items-center gap-3 min-w-[200px]">
          <div
            className={cn(
              'h-9 w-9 rounded-full flex items-center justify-center shrink-0',
              isOutbound ? 'bg-primary-foreground/20' : 'bg-foreground/10',
            )}
          >
            <User className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{display}</p>
            <p className="text-[10px] opacity-60">Cartão de contato</p>
          </div>
        </div>
      );
    }

    case 'sticker':
      return url ? (
        <img src={url} alt="Sticker" className="h-32 w-32 object-contain" loading="lazy" />
      ) : (
        <p className="text-xs italic opacity-70">[Sticker]</p>
      );

    case 'reaction': {
      const emoji = meta?.emoji ?? '';
      const reactionBy = meta?.reaction_by ?? null;
      if (!emoji) {
        // Reação removida — eleitor retirou o emoji
        return <p className="italic opacity-70 text-sm">Reação removida</p>;
      }
      return (
        <div className="space-y-0.5">
          <p className="text-2xl leading-tight">{emoji}</p>
          {reactionBy && (
            <p className="text-[11px] opacity-70 leading-snug">{reactionBy} reagiu</p>
          )}
        </div>
      );
    }

    case 'unknown':
      return <p className="italic opacity-70">[Mensagem não suportada]</p>;

    case 'text':
    default:
      return message.body ? (
        <p className="whitespace-pre-wrap break-words">
          {highlightTerm && highlightText
            ? highlightText(message.body, highlightTerm)
            : message.body}
        </p>
      ) : (
        <p className="italic opacity-70">[mensagem vazia]</p>
      );
  }
}
