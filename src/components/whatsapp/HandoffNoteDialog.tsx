import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import type { UserProfile } from '@/hooks/useUsers';

interface HandoffNoteDialogProps {
  open: boolean;
  targetUser: UserProfile | null;
  onConfirm: (nota: string) => Promise<void>;
  onCancel: () => void;
}

export function HandoffNoteDialog({
  open,
  targetUser,
  onConfirm,
  onCancel,
}: HandoffNoteDialogProps) {
  const [nota, setNota] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleConfirm() {
    if (nota.trim().length < 10) return;
    setLoading(true);
    try {
      await onConfirm(nota.trim());
      setNota('');
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    setNota('');
    onCancel();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nota de transferência</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {targetUser && (
            <p className="text-sm text-muted-foreground">
              Transferindo para <strong>{targetUser.nome}</strong>. Descreva o contexto
              para o próximo atendente.
            </p>
          )}
          <Textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Descreva o contexto para o próximo atendente..."
            rows={4}
            disabled={loading}
            maxLength={2000}
          />
          <p className="text-xs text-muted-foreground">
            Mínimo 10 caracteres. {nota.trim().length}/2000
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={handleCancel} disabled={loading}>
            Cancelar
          </Button>
          <Button
            onClick={() => void handleConfirm()}
            disabled={nota.trim().length < 10 || loading}
          >
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar transferência
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
