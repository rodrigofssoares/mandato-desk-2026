import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Settings as SettingsIcon, KanbanSquare, ListOrdered } from 'lucide-react';
import { Link } from 'react-router-dom';
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

import { Card, CardContent } from '@/components/ui/card';

import { useBoards } from '@/hooks/useBoards';
import { useBoardStages } from '@/hooks/useBoardStages';
import { useBoardItems, useRemoveBoardItem, type BoardItemWithContact } from '@/hooks/useBoardItems';
import { usePermissions } from '@/hooks/usePermissions';

import { BoardSelector } from '@/components/board/BoardSelector';
import { BoardKanban } from '@/components/board/BoardKanban';
import { BoardCardDetailSheet } from '@/components/board/BoardCardDetailSheet';
import { AddContactToBoardDialog } from '@/components/board/AddContactToBoardDialog';
import { BoardFormDialog } from '@/components/settings/BoardFormDialog';
import { BoardStagesManager } from '@/components/settings/BoardStagesManager';

export default function Board() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlBoardId = searchParams.get('board');

  const { can, isLoading: isPermLoading } = usePermissions();
  const canViewPage = can.viewBoard();
  const canCreate = can.createBoardItem();
  const canDelete = can.deleteBoardItem();

  const { data: boards = [], isLoading: boardsLoading } = useBoards('contact');

  // Determinar boardId ativo: URL > default > primeiro
  const activeBoardId = useMemo<string | null>(() => {
    if (urlBoardId && boards.some((b) => b.id === urlBoardId)) return urlBoardId;
    const defaultBoard = boards.find((b) => b.is_default);
    if (defaultBoard) return defaultBoard.id;
    return boards[0]?.id ?? null;
  }, [urlBoardId, boards]);

  // Sincroniza URL quando seleciona via dropdown
  const handleSelectBoard = (id: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('board', id);
    setSearchParams(next, { replace: true });
  };

  // Limpa o searchParam se o board ativo veio de fallback (mantém URL limpa)
  useEffect(() => {
    if (activeBoardId && !urlBoardId) {
      const next = new URLSearchParams(searchParams);
      next.set('board', activeBoardId);
      setSearchParams(next, { replace: true });
    }
  }, [activeBoardId, urlBoardId, searchParams, setSearchParams]);

  const { data: stages = [], isLoading: stagesLoading } = useBoardStages(activeBoardId);
  const { data: items = [], isLoading: itemsLoading } = useBoardItems(activeBoardId);
  const removeMutation = useRemoveBoardItem();

  // UI state
  const [createBoardOpen, setCreateBoardOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<BoardItemWithContact | null>(null);
  const [removeTarget, setRemoveTarget] = useState<BoardItemWithContact | null>(null);
  const [addStageId, setAddStageId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [stagesEditorOpen, setStagesEditorOpen] = useState(false);

  const existingContactIds = useMemo(
    () => new Set(items.map((i) => i.contact?.id).filter((id): id is string => !!id)),
    [items],
  );

  const stageNameById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of stages) map[s.id] = s.nome;
    return map;
  }, [stages]);

  const handleConfirmRemove = async () => {
    if (!removeTarget) return;
    try {
      await removeMutation.mutateAsync(removeTarget.id);
      // Se removeu o item que estava aberto no sheet, fecha
      if (detailItem?.id === removeTarget.id) setDetailItem(null);
    } catch {
      // toast no hook
    } finally {
      setRemoveTarget(null);
    }
  };

  const isLoading = boardsLoading || (activeBoardId && (stagesLoading || itemsLoading));

  if (isPermLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!canViewPage) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Você não tem permissão para acessar esta página.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col items-start gap-2">
        <div className="flex items-center gap-3">
          <KanbanSquare className="h-6 w-6 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Funis</h1>
        </div>
        {canCreate && (
          <div className="flex items-center gap-2 flex-wrap">
            <Button asChild variant="outline" size="sm">
              <Link to="/settings?tab=funis">
                <SettingsIcon className="h-4 w-4 mr-2" />
                Gerenciar funis
              </Link>
            </Button>
            <Button onClick={() => setCreateBoardOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Novo board
            </Button>
          </div>
        )}
      </div>

      {boardsLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : boards.length === 0 ? (
        <div className="rounded-lg border border-dashed py-16 text-center">
          <KanbanSquare className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium">Nenhum board criado ainda</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            {canCreate
              ? 'Crie seu primeiro funil para começar a organizar contatos por estágio.'
              : 'Peça ao administrador para criar um funil.'}
          </p>
          {canCreate && (
            <Button onClick={() => setCreateBoardOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Criar primeiro board
            </Button>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <BoardSelector
              boards={boards}
              value={activeBoardId}
              onChange={handleSelectBoard}
            />
            {activeBoardId && canCreate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStagesEditorOpen(true)}
              >
                <ListOrdered className="h-4 w-4 mr-2" />
                Editar estágios
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : stages.length === 0 ? (
            <div className="rounded-lg border border-dashed py-16 text-center">
              <p className="text-sm font-medium">Este board não tem estágios</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">
                Adicione estágios em Configurações → Funis para começar.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link to="/settings?tab=funis">Gerenciar estágios</Link>
              </Button>
            </div>
          ) : (
            <BoardKanban
              stages={stages}
              items={items}
              onCardClick={setDetailItem}
              onCardRemove={(item) => {
                if (!canDelete) return;
                setRemoveTarget(item);
              }}
              onAddContact={(stageId) => {
                if (!canCreate) return;
                setAddStageId(stageId);
                setAddOpen(true);
              }}
            />
          )}
        </>
      )}

      {/* Dialogs */}
      <BoardFormDialog open={createBoardOpen} onOpenChange={setCreateBoardOpen} />

      <Sheet open={stagesEditorOpen} onOpenChange={setStagesEditorOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Editar estágios</SheetTitle>
            <SheetDescription>
              Arraste para reordenar, edite nome ou cor, ou exclua estágios vazios. Mudanças
              persistem direto no banco.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            {activeBoardId && <BoardStagesManager boardId={activeBoardId} />}
          </div>
        </SheetContent>
      </Sheet>

      {activeBoardId && (
        <AddContactToBoardDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          boardId={activeBoardId}
          stages={stages}
          initialStageId={addStageId}
          existingContactIds={existingContactIds}
        />
      )}

      <BoardCardDetailSheet
        open={!!detailItem}
        onOpenChange={(open) => !open && setDetailItem(null)}
        item={detailItem}
        stageName={detailItem ? stageNameById[detailItem.stage_id] ?? '—' : '—'}
        onRemove={() => {
          if (!canDelete) return;
          if (detailItem) setRemoveTarget(detailItem);
        }}
        removing={removeMutation.isPending}
      />

      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remover {removeTarget?.contact?.nome ?? 'contato'} do board?
            </AlertDialogTitle>
            <AlertDialogDescription>
              O contato continua existindo no sistema — apenas o vínculo com este board é
              removido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemove}
              disabled={removeMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
