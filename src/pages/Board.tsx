import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Loader2, Plus, Search, Settings as SettingsIcon, KanbanSquare, ListOrdered, Users, CheckSquare, X, ChevronRight } from 'lucide-react';
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
import { useContact } from '@/hooks/useContacts';
import { usePermissions } from '@/hooks/usePermissions';
import { getContactDisplayName } from '@/lib/contactDisplay';

import { BoardSelector } from '@/components/board/BoardSelector';
import { BoardKanban } from '@/components/board/BoardKanban';
import { AddContactToBoardDialog } from '@/components/board/AddContactToBoardDialog';
import { BulkMoveByTagDrawer } from '@/components/board/BulkMoveByTagDrawer';
import { BoardFormDialog } from '@/components/settings/BoardFormDialog';
import { BoardStagesManager } from '@/components/settings/BoardStagesManager';
import { ContactDialog } from '@/components/contacts/ContactDialog';

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
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const { data: editingContact } = useContact(editingContactId ?? undefined);
  const [removeTarget, setRemoveTarget] = useState<BoardItemWithContact | null>(null);
  const [addStageId, setAddStageId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [stagesEditorOpen, setStagesEditorOpen] = useState(false);
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);

  // Modo selecao — usuario marca N cards com checkbox e move todos juntos
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [bulkMoveSelectedOpen, setBulkMoveSelectedOpen] = useState(false);

  // Busca de leads dentro do funil ativo (client-side, so enxerga items do activeBoardId)
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useMemo(
    () => ({ timer: null as ReturnType<typeof setTimeout> | null }),
    [],
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchInput(value);
      if (debounceRef.timer) clearTimeout(debounceRef.timer);
      debounceRef.timer = setTimeout(() => setDebouncedSearch(value), 300);
    },
    [debounceRef],
  );

  const clearSearch = useCallback(() => {
    if (debounceRef.timer) clearTimeout(debounceRef.timer);
    setSearchInput('');
    setDebouncedSearch('');
  }, [debounceRef]);

  // Sai do modo selecao e reseta busca quando troca de funil
  useEffect(() => {
    setSelectionMode(false);
    setSelectedItemIds(new Set());
    clearSearch();
    setSearchOpen(false);
  }, [activeBoardId, clearSearch]);

  const handleToggleSelect = (item: BoardItemWithContact) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  };

  const selectedContactsForDrawer = useMemo(
    () =>
      items
        .filter((i) => selectedItemIds.has(i.id) && i.contact)
        .map((i) => ({ id: i.contact!.id, nome: i.contact!.nome })),
    [items, selectedItemIds],
  );

  const existingContactIds = useMemo(
    () => new Set(items.map((i) => i.contact?.id).filter((id): id is string => !!id)),
    [items],
  );

  // Items filtrados pela busca. Usado APENAS no Kanban. Selecao e "Adicionar contato"
  // continuam usando a lista original pra nao perder estado/contexto quando filtra.
  // Busca em: nome, @ (instagram/twitter/tiktok/youtube), e-mail e telefones (whatsapp/telefone).
  // Telefone: usuario pode digitar "(21) 98765-4321" e casar com "21987654321" salvo.
  const filteredItems = useMemo(() => {
    const q = debouncedSearch.trim();
    if (!q) return items;
    const normText = (s: string) =>
      s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const normDigits = (s: string) => s.replace(/\D/g, '');
    const textNeedle = normText(q);
    const digitNeedle = normDigits(q);

    return items.filter((it) => {
      const c = it.contact;
      if (!c) return false;
      const textFields = [c.nome, c.instagram, c.twitter, c.tiktok, c.youtube, c.email];
      if (textFields.some((f) => f && normText(f).includes(textNeedle))) return true;
      if (digitNeedle) {
        const phoneFields = [c.whatsapp, c.telefone];
        if (phoneFields.some((f) => f && normDigits(f).includes(digitNeedle))) return true;
      }
      return false;
    });
  }, [items, debouncedSearch]);

  // Toast com contagem de resultados quando a busca muda. Usa ref pra ler a
  // contagem mais recente sem disparar toast a cada mudanca de `items` (drag,
  // refetch etc). `id` fixo faz o sonner substituir o toast anterior.
  const filteredCountRef = useRef(0);
  filteredCountRef.current = filteredItems.length;
  useEffect(() => {
    if (!debouncedSearch) return;
    const count = filteredCountRef.current;
    const id = 'board-search-result';
    if (count === 0) {
      toast.info(`Nenhum lead encontrado para "${debouncedSearch}"`, { id });
    } else if (count === 1) {
      toast.info('1 lead localizado no funil', { id });
    } else {
      toast.info(`${count} leads localizados no funil`, { id });
    }
  }, [debouncedSearch]);

  const handleConfirmRemove = async () => {
    if (!removeTarget) return;
    try {
      await removeMutation.mutateAsync(removeTarget.id);
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
              Novo funil
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
          <p className="text-sm font-medium">Nenhum funil criado ainda</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            {canCreate
              ? 'Crie seu primeiro funil para começar a organizar contatos por estágio.'
              : 'Peça ao administrador para criar um funil.'}
          </p>
          {canCreate && (
            <Button onClick={() => setCreateBoardOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Criar primeiro funil
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
            {activeBoardId && (
              <Popover open={searchOpen} onOpenChange={setSearchOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant={debouncedSearch ? 'default' : 'outline'}
                    size="sm"
                    title="Pesquisar leads no funil"
                  >
                    <Search className="h-4 w-4 mr-2" />
                    {debouncedSearch ? `"${debouncedSearch}"` : 'Buscar lead'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-80 p-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      autoFocus
                      value={searchInput}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setSearchOpen(false);
                      }}
                      placeholder="Nome, @, e-mail, telefone..."
                      className="pl-9 pr-9"
                    />
                    {searchInput && (
                      <button
                        type="button"
                        onClick={clearSearch}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-muted"
                        aria-label="Limpar busca"
                      >
                        <X className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {debouncedSearch
                      ? `${filteredItems.length} de ${items.length} lead${items.length === 1 ? '' : 's'} correspondem`
                      : `Pesquisa apenas no funil ativo (${items.length} lead${items.length === 1 ? '' : 's'})`}
                  </p>
                </PopoverContent>
              </Popover>
            )}
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
            {activeBoardId && canCreate && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkMoveOpen(true)}
              >
                <Users className="h-4 w-4 mr-2" />
                Mover em massa
              </Button>
            )}
            {activeBoardId && canCreate && (
              <Button
                variant={selectionMode ? 'destructive' : 'outline'}
                size="sm"
                onClick={() => {
                  if (selectionMode) {
                    setSelectionMode(false);
                    setSelectedItemIds(new Set());
                  } else {
                    setSelectionMode(true);
                  }
                }}
              >
                {selectionMode ? (
                  <>
                    <X className="h-4 w-4 mr-2" />
                    Cancelar seleção
                  </>
                ) : (
                  <>
                    <CheckSquare className="h-4 w-4 mr-2" />
                    Selecionar contatos
                  </>
                )}
              </Button>
            )}
            {selectionMode && selectedItemIds.size > 0 && (
              <Button
                size="sm"
                onClick={() => setBulkMoveSelectedOpen(true)}
                className="shadow-lg shadow-primary/30"
              >
                <ChevronRight className="h-4 w-4 mr-1" />
                Mover {selectedItemIds.size} selecionado{selectedItemIds.size > 1 ? 's' : ''}
              </Button>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : stages.length === 0 ? (
            <div className="rounded-lg border border-dashed py-16 text-center">
              <p className="text-sm font-medium">Este funil não tem estágios</p>
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
              items={filteredItems}
              onCardClick={(item) => {
                if (item.contact?.id) setEditingContactId(item.contact.id);
              }}
              onCardRemove={(item) => {
                if (!canDelete) return;
                setRemoveTarget(item);
              }}
              onAddContact={(stageId) => {
                if (!canCreate) return;
                setAddStageId(stageId);
                setAddOpen(true);
              }}
              selectionMode={selectionMode}
              selectedIds={selectedItemIds}
              onToggleSelect={handleToggleSelect}
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

      <BulkMoveByTagDrawer
        open={bulkMoveOpen}
        onOpenChange={setBulkMoveOpen}
        initialBoardId={activeBoardId}
      />

      {/* Drawer para mover cards selecionados dentro do board atual.
          Nao limpa selecao no close — usuario pode ter cancelado e quer
          reabrir. Sair do modo selecao via botao "Cancelar selecao". */}
      <BulkMoveByTagDrawer
        open={bulkMoveSelectedOpen}
        onOpenChange={setBulkMoveSelectedOpen}
        initialBoardId={activeBoardId}
        initialContacts={selectedContactsForDrawer}
      />


      <ContactDialog
        open={!!editingContactId && !!editingContact}
        onOpenChange={(open) => {
          if (!open) setEditingContactId(null);
        }}
        contact={editingContact ?? null}
      />

      <AlertDialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Remover {removeTarget?.contact ? getContactDisplayName(removeTarget.contact) : 'contato'} do funil?
            </AlertDialogTitle>
            <AlertDialogDescription>
              O contato continua existindo no sistema — apenas o vínculo com este funil é
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
