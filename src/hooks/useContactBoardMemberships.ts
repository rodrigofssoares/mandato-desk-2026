import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ContactBoardMembership {
  boardItemId: string;
  boardId: string;
  boardNome: string;
  stageId: string;
  stageNome: string;
  stageCor: string | null;
  stageOrdem: number;
  totalStages: number;
  /** Quando o contato foi adicionado ao board (insert inicial). */
  createdAt: string;
  /** Última vez que o contato mudou de etapa. Igual a createdAt se nunca moveu. */
  movedAt: string;
}

interface BoardItemRow {
  id: string;
  board_id: string;
  stage_id: string;
  moved_at: string;
  created_at: string;
  board: { id: string; nome: string } | null;
  stage: { id: string; nome: string; cor: string | null; ordem: number } | null;
}

interface StageCountRow {
  board_id: string;
  id: string;
}

export function useContactBoardMemberships(contactId: string | null | undefined) {
  return useQuery<ContactBoardMembership[]>({
    queryKey: ['contact-board-memberships', contactId],
    enabled: !!contactId,
    queryFn: async () => {
      if (!contactId) return [];

      const { data: items, error } = await supabase
        .from('board_items')
        .select(
          `id, board_id, stage_id, moved_at, created_at,
           board:boards(id, nome),
           stage:board_stages(id, nome, cor, ordem)`,
        )
        .eq('contact_id', contactId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      const rows = (items ?? []) as unknown as BoardItemRow[];
      if (rows.length === 0) return [];

      const boardIds = Array.from(new Set(rows.map((r) => r.board_id)));
      const { data: stages, error: stagesError } = await supabase
        .from('board_stages')
        .select('id, board_id')
        .in('board_id', boardIds);
      if (stagesError) throw stagesError;

      const totalByBoard = new Map<string, number>();
      for (const s of (stages ?? []) as StageCountRow[]) {
        totalByBoard.set(s.board_id, (totalByBoard.get(s.board_id) ?? 0) + 1);
      }

      return rows
        .filter((r) => r.board && r.stage)
        .map<ContactBoardMembership>((r) => ({
          boardItemId: r.id,
          boardId: r.board_id,
          boardNome: r.board!.nome,
          stageId: r.stage_id,
          stageNome: r.stage!.nome,
          stageCor: r.stage!.cor,
          stageOrdem: r.stage!.ordem,
          totalStages: totalByBoard.get(r.board_id) ?? 1,
          createdAt: r.created_at,
          movedAt: r.moved_at,
        }));
    },
  });
}
