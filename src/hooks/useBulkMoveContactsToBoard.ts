import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { toast } from 'sonner';
import { logActivity } from '@/lib/activityLog';

export interface BulkMoveInput {
  contactIds: string[];
  boardId: string;
  stageId: string;
}

export interface BulkMoveFailure {
  contactId: string;
  reason: string;
}

export interface BulkMoveResult {
  total: number;
  linked: number;
  moved: number;
  failed: BulkMoveFailure[];
}

const CHUNK_SIZE = 50;

type LinkRpcResponse = {
  status: 'ok' | 'warning';
  action?: 'linked' | 'moved';
  message?: string;
};

// api_link_contact_to_board ainda nao esta no types.ts gerado.
// IMPORTANTE: nao alias-a o metodo (const rpc = supabase.rpc) — perde o `this`
// do client e quebra com "Cannot read properties of undefined (reading 'rest')".
// Cast apenas o client e chame .rpc direto nele.
const rpcClient = supabase as unknown as {
  rpc: (
    fn: 'api_link_contact_to_board',
    args: {
      p_user_id: string;
      p_contact_id: string;
      p_board_ref: string;
      p_stage_ref: string;
    },
  ) => Promise<{ data: LinkRpcResponse | null; error: { message: string } | null }>;
};

async function callLinkRpc(
  userId: string,
  contactId: string,
  boardId: string,
  stageId: string,
): Promise<LinkRpcResponse> {
  const { data, error } = await rpcClient.rpc('api_link_contact_to_board', {
    p_user_id: userId,
    p_contact_id: contactId,
    p_board_ref: boardId,
    p_stage_ref: stageId,
  });

  if (error) {
    return { status: 'warning', message: error.message };
  }
  return data ?? { status: 'warning', message: 'sem resposta' };
}

export function useBulkMoveContactsToBoard() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation<BulkMoveResult, Error, BulkMoveInput>({
    mutationFn: async ({ contactIds, boardId, stageId }) => {
      if (!user?.id) throw new Error('Usuário não autenticado');
      if (contactIds.length === 0) throw new Error('Nenhum contato selecionado');

      const result: BulkMoveResult = {
        total: contactIds.length,
        linked: 0,
        moved: 0,
        failed: [],
      };

      for (let i = 0; i < contactIds.length; i += CHUNK_SIZE) {
        const chunk = contactIds.slice(i, i + CHUNK_SIZE);
        const outcomes = await Promise.all(
          chunk.map((id) =>
            callLinkRpc(user.id, id, boardId, stageId).then((r) => ({ id, r })),
          ),
        );

        for (const { id, r } of outcomes) {
          if (r.status === 'ok') {
            if (r.action === 'moved') result.moved += 1;
            else result.linked += 1;
          } else {
            result.failed.push({ contactId: id, reason: r.message ?? 'erro desconhecido' });
          }
        }
      }

      return result;
    },
    onSuccess: (result, { boardId }) => {
      queryClient.invalidateQueries({ queryKey: ['board_items', boardId] });
      queryClient.invalidateQueries({ queryKey: ['board_items', 'counts', boardId] });
      queryClient.invalidateQueries({ queryKey: ['contact-board-memberships'] });

      const successCount = result.linked + result.moved;
      if (result.failed.length === 0) {
        toast.success(
          `${successCount} contato(s) movidos — ${result.linked} adicionados, ${result.moved} atualizados`,
        );
      } else if (successCount === 0) {
        toast.error(`Falha ao mover ${result.failed.length} contato(s)`);
      } else {
        toast.warning(
          `${successCount} movidos, ${result.failed.length} falharam`,
        );
      }

      logActivity({
        type: 'update',
        entity_type: 'board_item',
        description: `Movimentação em massa: ${successCount} contatos movidos para o board`,
      });
    },
    onError: (error) => {
      toast.error(`Erro na movimentação em massa: ${error.message}`);
    },
  });
}
