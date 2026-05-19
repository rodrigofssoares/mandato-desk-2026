// ─── useMessageQueue (T54 — C32) ─────────────────────────────────────────────
// Fila local de mensagens que falharam ao enviar por falta de conexão.
// Persiste em localStorage, reenvia automaticamente ao detectar `window.online`.
// Sem banco, sem EF — resiliência de frontend.

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSendZapiMessage } from '@/hooks/useZapiMessages';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface SendZapiMessageInput {
  account_id: string;
  phone: string;
  message: string;
  quoted_message_id?: string;
}

export interface QueuedMessage {
  id: string;
  chatId: string;
  message: SendZapiMessageInput;
  attempts: number;
  status: 'pendente' | 'tentando' | 'falha_permanente';
  createdAt: string;
}

export interface EnqueueInput {
  chatId: string;
  message: SendZapiMessageInput;
}

const MAX_ATTEMPTS = 3;
const RETRY_INTERVAL_MS = 30_000;

function storageKey(accountId: string) {
  return `zapi_msg_queue_${accountId}`;
}

function loadQueue(accountId: string): QueuedMessage[] {
  try {
    const raw = localStorage.getItem(storageKey(accountId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedMessage[]) : [];
  } catch {
    return [];
  }
}

function saveQueue(accountId: string, queue: QueuedMessage[]) {
  try {
    localStorage.setItem(storageKey(accountId), JSON.stringify(queue));
  } catch {
    // ignora quota errors
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMessageQueue(accountId: string) {
  const [queue, setQueue] = useState<QueuedMessage[]>(() => loadQueue(accountId));
  const sendMessage = useSendZapiMessage();
  const processingRef = useRef(false);

  // Sincronizar state com localStorage (memoizado para deps estáveis)
  const updateQueue = useCallback((updater: (prev: QueuedMessage[]) => QueuedMessage[]) => {
    setQueue((prev) => {
      const next = updater(prev);
      saveQueue(accountId, next);
      return next;
    });
  }, [accountId]);

  // Enfileirar mensagem
  const enqueue = useCallback((input: EnqueueInput) => {
    const item: QueuedMessage = {
      id: crypto.randomUUID(),
      chatId: input.chatId,
      message: input.message,
      attempts: 0,
      status: 'pendente',
      createdAt: new Date().toISOString(),
    };
    updateQueue((prev) => [...prev, item]);
  }, [updateQueue]);

  // Processar fila (tenta reenviar todos os itens pendentes)
  const processQueue = useCallback(async () => {
    if (processingRef.current || !navigator.onLine) return;
    processingRef.current = true;

    setQueue((prev) => {
      const pendentes = prev.filter(
        (q) => q.status === 'pendente' || q.status === 'tentando',
      );
      if (pendentes.length === 0) {
        processingRef.current = false;
        return prev;
      }
      return prev;
    });

    // Obter snapshot atual da fila
    const current = loadQueue(accountId);
    const pendentes = current.filter(
      (q) => q.status === 'pendente' || q.status === 'tentando',
    );

    for (const item of pendentes) {
      if (!navigator.onLine) break;

      // Marcar como tentando
      updateQueue((prev) =>
        prev.map((q) => (q.id === item.id ? { ...q, status: 'tentando' as const } : q))
      );

      try {
        await sendMessage.mutateAsync(item.message);
        // Sucesso: remover da fila
        updateQueue((prev) => prev.filter((q) => q.id !== item.id));
      } catch {
        const newAttempts = item.attempts + 1;
        if (newAttempts >= MAX_ATTEMPTS) {
          updateQueue((prev) =>
            prev.map((q) =>
              q.id === item.id
                ? { ...q, attempts: newAttempts, status: 'falha_permanente' as const }
                : q
            )
          );
        } else {
          updateQueue((prev) =>
            prev.map((q) =>
              q.id === item.id
                ? { ...q, attempts: newAttempts, status: 'pendente' as const }
                : q
            )
          );
        }
      }

      // Delay entre tentativas (backoff simples)
      if (pendentes.indexOf(item) < pendentes.length - 1) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    processingRef.current = false;
  }, [accountId, updateQueue, sendMessage]);

  // Limpar itens com falha permanente
  const clearFailed = useCallback(() => {
    updateQueue((prev) => prev.filter((q) => q.status !== 'falha_permanente'));
  }, [updateQueue]);

  // Listener para evento online
  useEffect(() => {
    const handleOnline = () => {
      processQueue();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [processQueue]);

  // Polling a cada 30s quando online e há itens pendentes
  useEffect(() => {
    const intervalId = setInterval(() => {
      const hasPending = queue.some(
        (q) => q.status === 'pendente' || q.status === 'tentando',
      );
      if (hasPending && navigator.onLine) {
        processQueue();
      }
    }, RETRY_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [queue, processQueue]);

  // Processar ao montar se online (apenas uma vez — processQueue é estável via useCallback)
  useEffect(() => {
    if (navigator.onLine) {
      processQueue();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- intencional: executar só na montagem
  }, []);

  const failedCount = queue.filter((q) => q.status === 'falha_permanente').length;

  return { queue, enqueue, processQueue, failedCount, clearFailed };
}
