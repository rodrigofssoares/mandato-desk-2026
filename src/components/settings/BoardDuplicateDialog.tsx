import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Copy, Loader2, Users } from 'lucide-react';
import { useDuplicateBoard, type Board } from '@/hooks/useBoards';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  board: Board | null;
}

/**
 * Diálogo de confirmação para duplicar um funil.
 * Pergunta se o usuário quer copiar também os contatos posicionados.
 * Toda a estrutura (estágios, templates, checklist e anexos) é sempre copiada.
 */
export function BoardDuplicateDialog({ open, onOpenChange, board }: Props) {
  const duplicateBoard = useDuplicateBoard();
  const [copyContacts, setCopyContacts] = useState(false);

  // Reseta a escolha sempre que reabre
  useEffect(() => {
    if (open) setCopyContacts(false);
  }, [open]);

  const handleConfirm = async () => {
    if (!board) return;
    try {
      await duplicateBoard.mutateAsync({
        sourceBoardId: board.id,
        copyContacts,
      });
      onOpenChange(false);
    } catch {
      // toast já tratado no hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !duplicateBoard.isPending && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Copy className="h-5 w-5" />
            Duplicar funil
          </DialogTitle>
          <DialogDescription>
            Será criada uma cópia de <strong>"{board?.nome}"</strong> com todos os estágios,
            templates de mensagem e checklists. O novo funil terá o sufixo{' '}
            <strong>"(cópia)"</strong> no nome, que você poderá renomear depois.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-start justify-between gap-3 rounded-md border p-3 my-2">
          <div className="flex items-start gap-3">
            <Users className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="space-y-0.5">
              <Label htmlFor="copy-contacts" className="cursor-pointer">
                Copiar também os contatos
              </Label>
              <p className="text-xs text-muted-foreground">
                Se ativado, os contatos posicionados serão copiados para os mesmos estágios no
                novo funil. Caso contrário, o novo funil começa vazio.
              </p>
            </div>
          </div>
          <Switch
            id="copy-contacts"
            checked={copyContacts}
            onCheckedChange={setCopyContacts}
            disabled={duplicateBoard.isPending}
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={duplicateBoard.isPending}
          >
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={duplicateBoard.isPending || !board}>
            {duplicateBoard.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Duplicar funil
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
