import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Board } from '@/hooks/useBoards';

interface BoardSelectorProps {
  boards: Board[];
  value: string | null;
  onChange: (boardId: string) => void;
}

export function BoardSelector({ boards, value, onChange }: BoardSelectorProps) {
  return (
    <Select value={value ?? undefined} onValueChange={onChange}>
      <SelectTrigger className="w-full sm:w-64">
        <SelectValue placeholder="Selecionar funil..." />
      </SelectTrigger>
      <SelectContent>
        {boards.map((board) => (
          <SelectItem key={board.id} value={board.id}>
            <div className="flex items-center gap-2">
              <span>{board.nome}</span>
              {board.is_default && (
                <span className="text-[10px] uppercase text-muted-foreground">padrão</span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
