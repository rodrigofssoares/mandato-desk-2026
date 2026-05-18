// Hook: useTypingIndicator
//
// Assina o canal Realtime de presença do chat para exibir "digitando...".
// T40 — Fase 4 (Interações nativas do WhatsApp)
//
// O webhook envia broadcasts para o canal `typing-<chatId>` quando recebe
// um PresenceCallback da Z-API. Este hook assina esse canal e expõe o estado.
//
// Estado é efêmero: TTL de 30s sem novo evento → indicador some.

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

const TYPING_TTL_MS = 30_000;

export type TypingState = 'composing' | 'recording' | null;

interface TypingPayload {
  phone?: string;
  state?: string;
  chatId?: string;
}

/**
 * Retorna o estado de digitação do contato em um chat.
 *
 * @param chatId - UUID do chat. Sem assinatura quando null/undefined.
 * @returns
 *   - `isTyping` — true quando contato está digitando ou gravando.
 *   - `typingState` — 'composing' | 'recording' | null.
 */
export function useTypingIndicator(chatId: string | null | undefined) {
  const [typingState, setTypingState] = useState<TypingState>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!chatId) {
      setTypingState(null);
      return;
    }

    const channel = supabase
      .channel(`typing-${chatId}`)
      .on(
        'broadcast',
        { event: 'typing' },
        (msg) => {
          const payload = (msg.payload ?? {}) as TypingPayload;
          const state = payload.state;

          if (state === 'composing') {
            setTypingState('composing');
          } else if (state === 'recording') {
            setTypingState('recording');
          }

          // Reset do TTL a cada evento
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => {
            setTypingState(null);
          }, TYPING_TTL_MS);
        },
      )
      .on(
        'broadcast',
        { event: 'stopped-typing' },
        () => {
          if (timerRef.current) clearTimeout(timerRef.current);
          setTypingState(null);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (timerRef.current) clearTimeout(timerRef.current);
      setTypingState(null);
    };
  }, [chatId]);

  return {
    isTyping: typingState !== null,
    typingState,
  };
}
