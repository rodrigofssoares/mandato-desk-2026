import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useBoards } from '@/hooks/useBoards';
import { useBoardStages } from '@/hooks/useBoardStages';

interface FunnelSelectorProps {
  selectedBoardId: string | null;
  selectedStageIds: string[];
  onBoardChange: (boardId: string | null, boardNome?: string) => void;
  onStageIdsChange: (stageIds: string[]) => void;
}

export function FunnelSelector({
  selectedBoardId,
  selectedStageIds,
  onBoardChange,
  onStageIdsChange,
}: FunnelSelectorProps) {
  const { data: boards = [], isLoading: boardsLoading } = useBoards('contact');
  const { data: stages = [], isLoading: stagesLoading } = useBoardStages(selectedBoardId);

  // Seleciona o primeiro funil por padrão quando a lista carrega
  useEffect(() => {
    if (!selectedBoardId && boards.length > 0) {
      const primeiro = boards[0];
      onBoardChange(primeiro.id, primeiro.nome);
    }
  }, [boards, selectedBoardId, onBoardChange]);

  // Quando estágios carregam (ou mudam), marca todos por padrão
  useEffect(() => {
    if (stages.length > 0) {
      onStageIdsChange(stages.map((s) => s.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stages]);

  if (boardsLoading) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-6 w-48" />
      </div>
    );
  }

  if (boards.length === 0) {
    return (
      <div className="flex flex-col gap-2 p-4 border rounded-lg bg-muted/30">
        <p className="text-sm text-muted-foreground">
          Nenhum funil criado — crie seu primeiro funil em Configurações &rarr; Funis
        </p>
        <Button variant="outline" size="sm" asChild className="w-fit">
          <Link to="/settings?tab=funis">Criar funil</Link>
        </Button>
      </div>
    );
  }

  function handleBoardChange(boardId: string) {
    const board = boards.find((b) => b.id === boardId);
    // Limpa seleção de estágios — useEffect acima re-marca todos ao carregar novos
    onStageIdsChange([]);
    onBoardChange(boardId, board?.nome);
  }

  function handleToggleStage(stageId: string, checked: boolean) {
    if (checked) {
      onStageIdsChange([...selectedStageIds, stageId]);
    } else {
      onStageIdsChange(selectedStageIds.filter((id) => id !== stageId));
    }
  }

  function handleSelectAll() {
    onStageIdsChange(stages.map((s) => s.id));
  }

  function handleClearAll() {
    onStageIdsChange([]);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Seletor de funil */}
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Funil
        </Label>
        <Select value={selectedBoardId ?? ''} onValueChange={handleBoardChange}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Selecione um funil" />
          </SelectTrigger>
          <SelectContent>
            {boards.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.nome}
                {b.is_default ? ' (padrão)' : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Multi-select de estágios */}
      {selectedBoardId && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Estágios
            </Label>
            {stages.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-xs text-primary hover:underline"
                >
                  Todos
                </button>
                <span className="text-xs text-muted-foreground">/</span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-xs text-primary hover:underline"
                >
                  Nenhum
                </button>
              </div>
            )}
          </div>

          {stagesLoading ? (
            <div className="flex flex-col gap-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-5 w-48" />
              ))}
            </div>
          ) : stages.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Este funil não tem estágios configurados — acesse{' '}
              <Link to="/settings?tab=funis" className="text-primary underline">
                Configurações &rarr; Funis
              </Link>{' '}
              para adicionar estágios
            </p>
          ) : (
            <>
              <ScrollArea className="max-h-48">
                <div className="flex flex-col gap-2 pr-2">
                  {stages.map((stage) => (
                    <div key={stage.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`stage-${stage.id}`}
                        checked={selectedStageIds.includes(stage.id)}
                        onCheckedChange={(checked) =>
                          handleToggleStage(stage.id, Boolean(checked))
                        }
                      />
                      <div className="flex items-center gap-1.5">
                        <div
                          className="h-2.5 w-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: stage.cor ?? 'hsl(var(--primary))' }}
                        />
                        <Label
                          htmlFor={`stage-${stage.id}`}
                          className="text-sm cursor-pointer"
                        >
                          {stage.nome}
                        </Label>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {selectedStageIds.length === 0 && (
                <p className="text-xs text-destructive mt-1">
                  Selecione pelo menos um estágio
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
