import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Search, UserPlus } from 'lucide-react';
import { useContacts } from '@/hooks/useContacts';
import { useAddContactToBoard } from '@/hooks/useBoardItems';
import type { BoardStage } from '@/hooks/useBoardStages';

interface AddContactToBoardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  boardId: string;
  stages: BoardStage[];
  /** Stage que o usuário clicou em "+ Adicionar". Pode ser null pra deixar escolher. */
  initialStageId: string | null;
  /** IDs já presentes no board (qualquer stage), para filtrar duplicados. */
  existingContactIds: Set<string>;
}

export function AddContactToBoardDialog({
  open,
  onOpenChange,
  boardId,
  stages,
  initialStageId,
  existingContactIds,
}: AddContactToBoardDialogProps) {
  const [search, setSearch] = useState('');
  const [stageId, setStageId] = useState<string | null>(initialStageId);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

  const { data: contactsResult, isLoading } = useContacts({
    search: search || undefined,
    per_page: 30,
  });
  const addMutation = useAddContactToBoard();

  // useContacts retorna { contacts, total } ou similar — normalizar
  const contacts = useMemo(() => {
    if (!contactsResult) return [];
    if (Array.isArray(contactsResult)) return contactsResult;
    const maybe = contactsResult as { contacts?: unknown[] };
    if (Array.isArray(maybe.contacts)) return maybe.contacts as Array<{ id: string; nome: string }>;
    return [];
  }, [contactsResult]);

  // Reset state quando abre/fecha
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setSearch('');
      setSelectedContactId(null);
    } else {
      setStageId(initialStageId);
    }
    onOpenChange(next);
  };

  const handleAdd = async () => {
    if (!selectedContactId || !stageId) return;
    try {
      await addMutation.mutateAsync({
        board_id: boardId,
        stage_id: stageId,
        contact_id: selectedContactId,
      });
      handleOpenChange(false);
    } catch {
      // toast já disparado no hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Adicionar contato ao board</DialogTitle>
          <DialogDescription>
            Busque um contato existente para adicionar a este funil.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Estágio</Label>
            <select
              className="w-full h-9 px-3 rounded-md border bg-background text-sm"
              value={stageId ?? ''}
              onChange={(e) => setStageId(e.target.value || null)}
            >
              <option value="">Escolher...</option>
              {stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="search-contact">Buscar contato</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="search-contact"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nome ou telefone..."
                className="pl-8"
              />
            </div>
          </div>

          <ScrollArea className="h-64 border rounded-md">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : contacts.length === 0 ? (
              <p className="text-center text-xs text-muted-foreground py-8">
                Nenhum contato encontrado
              </p>
            ) : (
              <div className="p-1">
                {contacts.map((contact) => {
                  const already = existingContactIds.has(contact.id);
                  const isSelected = selectedContactId === contact.id;
                  return (
                    <button
                      key={contact.id}
                      type="button"
                      disabled={already}
                      onClick={() => setSelectedContactId(contact.id)}
                      className={`w-full text-left px-3 py-2 rounded text-sm flex items-center justify-between ${
                        isSelected
                          ? 'bg-primary/10 text-primary'
                          : 'hover:bg-muted'
                      } ${already ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <span className="truncate">{contact.nome}</span>
                      {already && (
                        <span className="text-[10px] uppercase text-muted-foreground ml-2">
                          já no board
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleAdd}
            disabled={!selectedContactId || !stageId || addMutation.isPending}
          >
            {addMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4 mr-2" />
            )}
            Adicionar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
