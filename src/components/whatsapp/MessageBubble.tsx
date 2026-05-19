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
  Reply,
  Star,
  Smile,
  Forward,
  Trash2,
  Image as ImageIcon,
  Video,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ZapiMessage } from '@/hooks/useZapiMessages';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Popover,
  PopoverClose,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

// ─── Constantes ──────────────────────────────────────────────────────────────

/** 6 emojis padrão de reação do WhatsApp (T36) */
export const REACTION_EMOJIS = ['❤️', '👍', '😂', '😮', '😢', '👏'] as const;

const STATUS_TOOLTIP: Record<string, string> = {
  sent: 'Enviada',
  delivered: 'Entregue',
  read: 'Lida',
  error: 'Erro no envio',
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: ZapiMessage;
  /** T17: termo de busca para highlight no corpo da mensagem */
  highlightTerm?: string;
  /** T17: função que converte texto + termo em ReactNode com <mark> */
  highlightText?: (text: string, term: string) => ReactNode;
  /** T34: callback disparado ao clicar em "Responder" */
  onReply?: (message: ZapiMessage) => void;
  /** T35: callback disparado ao clicar na estrela (toggle favorito) */
  onFlag?: (messageId: string) => void;
  /** T35: indica se esta mensagem está favoritada pelo usuário atual */
  isFlagged?: boolean;
  /** T36: callback disparado ao selecionar emoji de reação */
  onReact?: (messageId: string, emoji: string) => void;
  /** T37: callback disparado ao clicar em "Encaminhar" */
  onForward?: (message: ZapiMessage) => void;
  /** T84 (Fase 7): se feature c38 está ativa para a conta */
  transcriptionEnabled?: boolean;
  /** T84 (Fase 7): callback para transcrever o áudio desta mensagem */
  onTranscribe?: (messageId: string) => void;
  /** T84 (Fase 7): indica se a transcrição desta mensagem está sendo gerada */
  isTranscribing?: boolean;
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

/** T39: ícone de status com tooltip de texto descritivo */
function StatusIcon({ status }: { status: ZapiMessage['status'] }) {
  const label = STATUS_TOOLTIP[status] ?? 'Enviada';

  let icon: ReactNode;
  if (status === 'error') {
    icon = <AlertTriangle className="h-3.5 w-3.5 text-destructive" />;
  } else if (status === 'read') {
    icon = <CheckCheck className="h-3.5 w-3.5 text-sky-300" />;
  } else if (status === 'delivered') {
    icon = <CheckCheck className="h-3.5 w-3.5 opacity-80" />;
  } else {
    icon = <Check className="h-3.5 w-3.5 opacity-80" />;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span aria-label={label} className="inline-flex items-center">{icon}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
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

// ─── QuotedMessageBlock (T34) ─────────────────────────────────────────────────

interface QuotedBlockProps {
  body: string | null;
  type: string | null;
  isOutbound: boolean;
}

/** Reutilizável tanto no bubble (mensagem citada recebida) quanto no composer (preview de reply). */
export function QuotedMessageBlock({ body, type, isOutbound }: QuotedBlockProps) {
  const mediaIcon = () => {
    switch (type) {
      case 'image': return <ImageIcon className="h-3.5 w-3.5 shrink-0" />;
      case 'video': return <Video className="h-3.5 w-3.5 shrink-0" />;
      case 'audio': return <Music className="h-3.5 w-3.5 shrink-0" />;
      case 'document': return <FileText className="h-3.5 w-3.5 shrink-0" />;
      default: return null;
    }
  };

  const displayText = () => {
    if (!body && type && type !== 'text') {
      const labels: Record<string, string> = {
        image: '[Imagem]',
        video: '[Vídeo]',
        audio: '[Áudio]',
        document: '[Documento]',
      };
      return labels[type] ?? '[Mídia]';
    }
    if (!body) return '[mensagem]';
    return body.length > 80 ? `${body.slice(0, 80)}...` : body;
  };

  return (
    <div
      className={cn(
        'flex items-start gap-1.5 px-2 py-1.5 mb-1.5 rounded text-xs border-l-2 opacity-80',
        isOutbound
          ? 'bg-primary-foreground/15 border-sky-300'
          : 'bg-foreground/5 border-muted-foreground',
      )}
    >
      {mediaIcon()}
      <span className="truncate">{displayText()}</span>
    </div>
  );
}

// ─── DeletedMessageBubble (T41) ───────────────────────────────────────────────

function DeletedMessageBubble({ isOutbound }: { isOutbound: boolean }) {
  return (
    <div className={cn('flex w-full', isOutbound ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[75%] rounded-2xl text-sm shadow-sm overflow-hidden',
          'bg-muted/50 text-muted-foreground rounded-bl-sm',
        )}
      >
        <div className="px-3 py-2 flex items-center gap-2 italic">
          <Trash2 className="h-3.5 w-3.5 shrink-0 opacity-60" />
          <span className="text-xs">Mensagem apagada</span>
        </div>
      </div>
    </div>
  );
}

// ─── MessageBubble ────────────────────────────────────────────────────────────

export function MessageBubble({
  message,
  highlightTerm,
  highlightText,
  onReply,
  onFlag,
  isFlagged,
  onReact,
  onForward,
  transcriptionEnabled = false,
  onTranscribe,
  isTranscribing = false,
}: MessageBubbleProps) {
  const isOutbound = message.direction === 'outbound';
  const mediaType = (message as { media_type?: string }).media_type ?? 'text';

  // T41: mensagem apagada → balão fantasma
  if (message.deleted_at) {
    return <DeletedMessageBubble isOutbound={isOutbound} />;
  }

  // T34: campos de citação (colunas da migration 062, já no tipos gerado)
  const quotedMessageId = message.quoted_message_id;
  const quotedBody = message.quoted_body;
  const quotedType = message.quoted_type;

  // T41: mensagem editada
  const editedBody = message.edited_body;

  const hasActions = onReply || onFlag !== undefined || onReact || onForward;

  return (
    <TooltipProvider>
      <div className={cn('flex w-full group', isOutbound ? 'justify-end' : 'justify-start')}>
        {/* Micro-toolbar: aparece ao hover (desktop) ou é sempre visível (mobile handled via group) */}
        {hasActions && (
          <div className={cn(
            'flex items-center gap-0.5 self-end mb-1.5 opacity-0 group-hover:opacity-100 transition-opacity',
            isOutbound ? 'order-first mr-1' : 'order-last ml-1',
          )}>
            {/* Botão Responder (T34) */}
            {onReply && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onReply(message)}
                    className="p-1 rounded hover:bg-accent transition-colors"
                    aria-label="Responder"
                  >
                    <Reply className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Responder</TooltipContent>
              </Tooltip>
            )}

            {/* Botão Reagir (T36) */}
            {onReact && (
              <Popover>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="p-1 rounded hover:bg-accent transition-colors"
                        aria-label="Reagir com emoji"
                      >
                        <Smile className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Reagir</TooltipContent>
                </Tooltip>
                <PopoverContent
                  side="top"
                  className="p-2 w-auto"
                  align={isOutbound ? 'end' : 'start'}
                >
                  <div className="flex gap-1">
                    {REACTION_EMOJIS.map((emoji) => (
                      <PopoverClose key={emoji} asChild>
                        <button
                          type="button"
                          onClick={() => onReact(message.message_id, emoji)}
                          className="text-xl hover:scale-125 transition-transform p-0.5 rounded"
                          aria-label={`Reagir com ${emoji}`}
                        >
                          {emoji}
                        </button>
                      </PopoverClose>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}

            {/* Botão Favoritar (T35) */}
            {onFlag !== undefined && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onFlag(message.message_id)}
                    className="p-1 rounded hover:bg-accent transition-colors"
                    aria-label={isFlagged ? 'Remover dos favoritos' : 'Favoritar mensagem'}
                  >
                    <Star
                      className={cn(
                        'h-3.5 w-3.5 transition-colors',
                        isFlagged
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-muted-foreground',
                      )}
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {isFlagged ? 'Remover dos favoritos' : 'Favoritar'}
                </TooltipContent>
              </Tooltip>
            )}

            {/* Botão Encaminhar (T37) */}
            {onForward && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onForward(message)}
                    className="p-1 rounded hover:bg-accent transition-colors"
                    aria-label="Encaminhar mensagem"
                  >
                    <Forward className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Encaminhar</TooltipContent>
              </Tooltip>
            )}
          </div>
        )}

        <div
          className={cn(
            'max-w-[75%] rounded-2xl text-sm shadow-sm overflow-hidden',
            isOutbound
              ? 'bg-primary text-primary-foreground rounded-br-sm'
              : 'bg-muted text-foreground rounded-bl-sm',
          )}
        >
          <div className="px-3 pt-2 pb-1">
            {/* T34: bloco de citação */}
            {quotedMessageId && (
              <QuotedMessageBlock
                body={quotedBody ?? null}
                type={quotedType ?? null}
                isOutbound={isOutbound}
              />
            )}
            {renderContent(message, mediaType, isOutbound, highlightTerm, highlightText, editedBody, transcriptionEnabled, onTranscribe, isTranscribing)}
          </div>
          <div
            className={cn(
              'px-3 pb-1.5 flex items-center gap-1 text-[10px]',
              isOutbound ? 'justify-end opacity-90' : 'justify-start opacity-60',
            )}
          >
            <span>{formatTime(message.sent_at)}</span>
            {/* T39: StatusIcon agora tem tooltip */}
            {isOutbound && <StatusIcon status={message.status} />}
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

function renderContent(
  message: ZapiMessage,
  mediaType: string,
  isOutbound: boolean,
  highlightTerm?: string,
  highlightText?: (text: string, term: string) => ReactNode,
  editedBody?: string | null,
  transcriptionEnabled?: boolean,
  onTranscribe?: (messageId: string) => void,
  isTranscribing?: boolean,
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
      const transcription = (message as ZapiMessage & { transcription?: string | null }).transcription;
      return (
        <div className="space-y-1.5 min-w-[200px]">
          <div className="flex items-center gap-2">
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
          {/* T84 (Fase 7): transcrição de áudio (C38) */}
          {transcription ? (
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/30 rounded px-2 py-1.5">
              <FileText className="h-3.5 w-3.5 shrink-0 mt-0.5 opacity-70" />
              <span className="leading-relaxed">{transcription}</span>
            </div>
          ) : transcriptionEnabled && url ? (
            <button
              type="button"
              onClick={() => onTranscribe?.(message.id)}
              disabled={isTranscribing}
              className="flex items-center gap-1 text-[11px] text-primary/70 hover:text-primary transition-colors disabled:opacity-50"
            >
              {isTranscribing ? (
                <Loader2 className="h-3 w-3 animate-spin shrink-0" />
              ) : (
                <FileText className="h-3 w-3 shrink-0" />
              )}
              {isTranscribing ? 'Transcrevendo...' : 'Transcrever'}
            </button>
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
    default: {
      // T41: se a mensagem foi editada, exibe editedBody em vez de body
      const displayBody = editedBody ?? message.body;
      return displayBody ? (
        <>
          <p className="whitespace-pre-wrap break-words">
            {highlightTerm && highlightText
              ? highlightText(displayBody, highlightTerm)
              : displayBody}
          </p>
          {/* T41: label "(editada)" quando há editedBody */}
          {editedBody && (
            <span className="block text-[10px] opacity-60 mt-0.5">(editada)</span>
          )}
        </>
      ) : (
        <p className="italic opacity-70">[mensagem vazia]</p>
      );
    }
  }
}
