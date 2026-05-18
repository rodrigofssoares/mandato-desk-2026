// useBroadcastPollVotes.ts
// Hook para leitura de votos de enquetes de broadcast (T75 / Fase 6 Onda B — C23).
// Inclui Realtime para atualização em tempo real.

import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface PollVote {
  id: string;
  broadcast_id: string;
  contact_id: string | null;
  phone: string;
  option_voted: string;
  received_at: string;
}

export interface PollResults {
  /** Total de votos (pode haver duplicatas por opção mudada) */
  totalVotes: number;
  /** Participantes únicos (por phone) */
  uniqueParticipants: number;
  /** Votos agrupados por opção */
  byOption: Record<string, number>;
}

export const pollVotesKeys = {
  byBroadcast: (broadcastId: string | null) => ['broadcast-poll-votes', broadcastId] as const,
};

// ─── useBroadcastPollVotes ────────────────────────────────────────────────────

/**
 * Busca e agrega votos de uma campanha de enquete.
 * Inclui Realtime para atualização sem reload.
 */
export function useBroadcastPollVotes(broadcastId: string | null | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: pollVotesKeys.byBroadcast(broadcastId ?? null),
    enabled: !!broadcastId,
    queryFn: async (): Promise<{ votes: PollVote[]; results: PollResults }> => {
      const { data, error } = await supabase
        .from('zapi_broadcast_poll_votes')
        .select('*')
        .eq('broadcast_id', broadcastId!)
        .order('received_at', { ascending: false });

      if (error) throw error;

      const votes = (data ?? []) as unknown as PollVote[];

      // Agrega resultados
      const byOption: Record<string, number> = {};
      const uniquePhones = new Set<string>();

      for (const vote of votes) {
        byOption[vote.option_voted] = (byOption[vote.option_voted] ?? 0) + 1;
        uniquePhones.add(vote.phone);
      }

      return {
        votes,
        results: {
          totalVotes: votes.length,
          uniqueParticipants: uniquePhones.size,
          byOption,
        },
      };
    },
  });

  // Realtime: atualiza quando novo voto chega
  useEffect(() => {
    if (!broadcastId) return;

    const channel = supabase
      .channel(`poll-votes-${broadcastId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'zapi_broadcast_poll_votes',
          filter: `broadcast_id=eq.${broadcastId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: pollVotesKeys.byBroadcast(broadcastId),
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [broadcastId, queryClient]);

  return query;
}
