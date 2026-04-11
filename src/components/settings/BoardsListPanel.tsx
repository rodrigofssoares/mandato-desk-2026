import { useState } from 'react';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ChevronDown,
  ChevronRight,
  Flag,
  Loader2,
  Pencil,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';
import {
  useBoards,
  useUpdateBoard,
  useDeleteBoard,
  type Board,
} from '@/hooks/useBoards';
import { useBoardStages } from '@/hooks/useBoardStages';
import { useBoardItemCounts } from '@/hooks/useBoardItems';
import { BoardFormDialog } from './BoardFormDialog';
import { BoardStagesManager } from './BoardStagesManager';

export function BoardsListPanel() {
  const { data: boards = [], isLoading } = useBoards('contact');
  const updateBoard = useUpdateBoard();
  const deleteBoard = useDeleteBoard();

  const [formOpen, setFormOpen] = useState(false);
  const [editingBoard, setEditingBoard] = useState<Board | null>(null);
  const [deleting, setDeleting] = useState<Board | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const handleNew = () => {
    setEditingBoard(null);
    setFormOpen(true);
  };

  const handleEdit = (board: Board) => {
    setEditingBoard(board);
    setFormOpen(true);
  };

  const handleToggleDefault = (board: Board) => {
    if (board.is_default) return; // já é default, não faz nada
    updateBoard.mutate({
      id: board.id,
      patch: { is_default: true },
    });
  };

  const handleConfirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteBoard.mutateAsync(deleting.id);
    } catch {
      // toast já tratado
    } finally {
      setDeleting(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Crie funis de jornada para os seus contatos. Cada board tem seus próprios estágios
          configuráveis e pode ser usado na página Board.
        </p>
        <Button onClick={handleNew} className="shrink-0">
          <Plus className="h-4 w-4 mr-2" />
          Novo board
        </Button>
      </div>

      {boards.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-12 text-center">
          <Flag className="h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">Nenhum funil criado</p>
          <p className="text-xs text-muted-foreground mt-1">
            Crie o primeiro clicando em "Novo board" acima.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {boards.map((board) => (
            <BoardCard
              key={board.id}
              board={board}
              isExpanded={expandedId === board.id}
              onToggleExpand={() =>
                setExpandedId((curr) => (curr === board.id ? null : board.id))
              }
              onEdit={() => handleEdit(board)}
              onDelete={() => setDeleting(board)}
              onToggleDefault={() => handleToggleDefault(board)}
            />
          ))}
        </div>
      )}

      <BoardFormDialog open={formOpen} onOpenChange={setFormOpen} board={editingBoard} />

      <AlertDialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir board "{deleting?.nome}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso apagará o board, todos os seus estágios e os posicionamentos de contatos nele. Os
              contatos em si NÃO serão removidos, apenas tirados deste funil.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBoard.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteBoard.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteBoard.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir board
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function BoardCard({
  board,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
  onToggleDefault,
}: {
  board: Board;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleDefault: () => void;
}) {
  const { data: stages = [] } = useBoardStages(board.id);
  const { data: counts = {} } = useBoardItemCounts(board.id);

  const totalContacts = Object.values(counts).reduce((acc, n) => acc + n, 0);

  return (
    <Card>
      <CardContent className="p-0">
        <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
          <div className="flex items-center gap-3 p-4">
            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground"
                aria-label={isExpanded ? 'Fechar' : 'Expandir'}
              >
                {isExpanded ? (
                  <ChevronDown className="h-5 w-5" />
                ) : (
                  <ChevronRight className="h-5 w-5" />
                )}
              </button>
            </CollapsibleTrigger>

            <Flag className="h-5 w-5 text-muted-foreground shrink-0" />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold truncate">{board.nome}</h3>
                {board.is_default && (
                  <Badge variant="secondary" className="gap-1">
                    <Star className="h-3 w-3" />
                    Padrão
                  </Badge>
                )}
              </div>
              {board.descricao && (
                <p className="text-sm text-muted-foreground truncate mt-0.5">{board.descricao}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                {stages.length} estágio{stages.length === 1 ? '' : 's'} · {totalContacts} contato
                {totalContacts === 1 ? '' : 's'}
              </p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleDefault}
                disabled={board.is_default}
                title={board.is_default ? 'Já é o padrão' : 'Marcar como padrão'}
              >
                <Star
                  className={`h-4 w-4 ${board.is_default ? 'fill-amber-500 text-amber-500' : ''}`}
                />
              </Button>
              <Button variant="ghost" size="icon" onClick={onEdit} title="Editar board">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={onDelete} title="Excluir board">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          </div>

          <CollapsibleContent>
            <div className="border-t px-4 py-4 bg-muted/20">
              <BoardStagesManager boardId={board.id} />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
