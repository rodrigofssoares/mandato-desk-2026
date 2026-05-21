import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Star, Copy, RotateCcw, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { AgentMarkdown } from './AgentMarkdown';
import { useToggleFavorite } from '@/hooks/useAgentFavoritesMutation';
import type { AgentMessage } from '@/hooks/useAgentChat';
import type { AgentFavorite } from '@/hooks/useAgentFavorites';

// ============================================================================
// Helpers
// ============================================================================

function formatTime(iso: string): string {
  try {
    return format(new Date(iso), 'HH:mm', { locale: ptBR });
  } catch {
    return '';
  }
}

// ============================================================================
// Typing indicator
// ============================================================================

// @keyframes agentBounce definido globalmente em src/index.css
function TypingIndicator() {
  return (
    <div className="flex gap-1 items-center">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[7px] h-[7px] rounded-full"
          style={{
            background: 'hsl(var(--primary) / 0.5)',
            animation: 'agentBounce 1.2s infinite',
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </div>
  );
}

// ============================================================================
// Mensagem assistant
// ============================================================================

interface AssistantMessageProps {
  message: AgentMessage;
  favorite: AgentFavorite | undefined;
}

function AssistantMessage({ message, favorite }: AssistantMessageProps) {
  const toggleFavorite = useToggleFavorite();
  const isFavorited = !!favorite;

  function handleToggleFavorite() {
    toggleFavorite.mutate({
      message_id: message.id,
      favorite_id: favorite?.id ?? null,
    });
  }

  function handleCopy() {
    navigator.clipboard.writeText(message.content).then(() => {
      toast.success('Copiado para a área de transferência');
    }).catch(() => {
      toast.error('Falha ao copiar');
    });
  }

  function handleRegenerate() {
    toast.info('Regenerar — em breve');
  }

  function handleShare() {
    toast.info('Compartilhar — em breve');
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, filter: 'blur(3px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        'rounded-[14px] p-4 pb-3',
        'backdrop-blur-[8px]',
        'border border-border/60',
        isFavorited
          ? 'border-l-[3px] border-l-[hsl(var(--accent))] bg-[hsl(var(--accent)/0.04)]'
          : 'border-l-[3px] border-l-primary bg-card/60'
      )}
    >
      {/* Meta linha */}
      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border/40">
        <span
          className="text-[13px] font-semibold text-primary"
          style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        >
          Atendente
        </span>
        <span
          className="text-[9px] font-semibold uppercase tracking-[0.12em] text-accent-foreground px-2 py-[2px] rounded-[4px]"
          style={{
            fontFamily: "'Cinzel', serif",
            background: 'hsl(var(--accent) / 0.18)',
          }}
        >
          Resposta
        </span>
        <span className="ml-auto text-[11px] text-muted-foreground">
          {formatTime(message.created_at)}
        </span>
      </div>

      {/* Conteúdo markdown */}
      <AgentMarkdown
        content={message.content}
        className="text-[14.5px] leading-[1.65] text-foreground"
      />

      {/* Rodapé com ações */}
      <div className="flex items-center gap-1 mt-3 pt-2.5 border-t border-border/40">
        <button
          onClick={handleToggleFavorite}
          disabled={toggleFavorite.isPending}
          aria-label={isFavorited ? 'Desfavoritar' : 'Favoritar'}
          className={cn(
            'inline-flex items-center gap-[5px] px-2.5 py-1.5 rounded-lg text-[11.5px] transition-all duration-150',
            isFavorited
              ? 'bg-[hsl(var(--accent)/0.15)] text-accent-foreground'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'
          )}
        >
          <Star
            className="h-[13px] w-[13px]"
            fill={isFavorited ? 'hsl(var(--accent))' : 'none'}
            color={isFavorited ? 'hsl(var(--accent))' : 'currentColor'}
          />
          {isFavorited ? 'Favoritado' : 'Favoritar'}
        </button>

        <button
          onClick={handleCopy}
          aria-label="Copiar resposta"
          className="inline-flex items-center gap-[5px] px-2.5 py-1.5 rounded-lg text-[11.5px] text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-150"
        >
          <Copy className="h-[13px] w-[13px]" />
          Copiar
        </button>

        <button
          onClick={handleRegenerate}
          aria-label="Regenerar resposta"
          className="inline-flex items-center gap-[5px] px-2.5 py-1.5 rounded-lg text-[11.5px] text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-150"
        >
          <RotateCcw className="h-[13px] w-[13px]" />
          Regenerar
        </button>

        <button
          onClick={handleShare}
          aria-label="Compartilhar"
          className="inline-flex items-center gap-[5px] px-2.5 py-1.5 rounded-lg text-[11.5px] text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-150"
        >
          <Share2 className="h-[13px] w-[13px]" />
          Compartilhar
        </button>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Mensagem user
// ============================================================================

function UserMessage({ message }: { message: AgentMessage }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10, filter: 'blur(3px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="flex justify-end"
    >
      <div
        className="max-w-[80%] px-4 py-3 text-[14px] leading-relaxed text-primary-foreground"
        style={{
          background: 'hsl(var(--primary))',
          borderRadius: '16px 16px 4px 16px',
        }}
      >
        {message.content}
      </div>
    </motion.div>
  );
}

// ============================================================================
// Componente principal
// ============================================================================

interface AgentChatMessagesProps {
  messages: AgentMessage[];
  favorites: AgentFavorite[];
  isLoading: boolean;
}

export function AgentChatMessages({
  messages,
  favorites,
  isLoading,
}: AgentChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Mapa message_id → favorito para lookup O(1)
  const favByMessageId = new Map(favorites.map((f) => [f.message_id, f]));

  // Scroll automático apenas quando o usuário está perto do fim (< 120px)
  // Se o usuário subiu para reler, não interrompe a leitura
  useEffect(() => {
    const container = containerRef.current?.closest('[class*="overflow-y-auto"]') as HTMLElement | null;
    if (!container) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      return;
    }
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    if (distanceFromBottom < 120) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, isLoading]);

  return (
    <div ref={containerRef} className="flex flex-col gap-[18px]">
      {messages.map((msg) =>
        msg.role === 'user' ? (
          <UserMessage key={msg.id} message={msg} />
        ) : (
          <AssistantMessage
            key={msg.id}
            message={msg}
            favorite={favByMessageId.get(msg.id)}
          />
        )
      )}

      {/* Typing indicator enquanto aguarda resposta */}
      {isLoading && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[14px] p-4 backdrop-blur-[8px] border border-border/60 border-l-[3px] border-l-primary bg-card/60"
        >
          <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border/40">
            <span
              className="text-[13px] font-semibold text-primary"
              style={{ fontFamily: "'Space Grotesk', sans-serif" }}
            >
              Atendente
            </span>
            <span
              className="text-[9px] font-semibold uppercase tracking-[0.12em] text-accent-foreground px-2 py-[2px] rounded-[4px]"
              style={{ fontFamily: "'Cinzel', serif", background: 'hsl(var(--accent) / 0.18)' }}
            >
              processando
            </span>
          </div>
          <TypingIndicator />
        </motion.div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
