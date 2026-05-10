import { useEffect, useState } from 'react';
import { Plus, Trash2, Loader2, BarChart3 } from 'lucide-react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { useSendZapiPoll } from '@/hooks/useZapiMedia';

interface PollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  phone: string;
  onSent?: () => void;
}

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 12;

export function PollDialog({ open, onOpenChange, accountId, phone, onSent }: PollDialogProps) {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [allowMulti, setAllowMulti] = useState(false);
  const sendPoll = useSendZapiPoll();

  useEffect(() => {
    if (open) {
      setQuestion('');
      setOptions(['', '']);
      setAllowMulti(false);
    }
  }, [open]);

  function updateOption(idx: number, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === idx ? value : o)));
  }

  function addOption() {
    if (options.length >= MAX_OPTIONS) return;
    setOptions((prev) => [...prev, '']);
  }

  function removeOption(idx: number) {
    if (options.length <= MIN_OPTIONS) return;
    setOptions((prev) => prev.filter((_, i) => i !== idx));
  }

  const trimmedOptions = options.map((o) => o.trim());
  const filledOptions = trimmedOptions.filter((o) => o.length > 0);
  const hasDuplicates = new Set(filledOptions).size !== filledOptions.length;
  const canSubmit =
    question.trim().length > 0 &&
    filledOptions.length >= MIN_OPTIONS &&
    filledOptions.length <= MAX_OPTIONS &&
    !hasDuplicates &&
    !sendPoll.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    try {
      await sendPoll.mutateAsync({
        account_id: accountId,
        phone,
        question: question.trim(),
        options: filledOptions,
        allow_multiple_answers: allowMulti,
      });
      onSent?.();
      onOpenChange(false);
    } catch {
      // toast pelo hook
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !sendPoll.isPending && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" /> Nova enquete
          </DialogTitle>
          <DialogDescription>
            Pergunta + 2 a 12 opções. Os destinatários poderão votar diretamente no WhatsApp.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="poll-question">Pergunta</Label>
            <Input
              id="poll-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ex: Qual horário prefere para a reunião?"
              maxLength={255}
              disabled={sendPoll.isPending}
              autoFocus
            />
            <p className="text-[10px] text-muted-foreground text-right">{question.length}/255</p>
          </div>

          <div className="space-y-2">
            <Label>Opções</Label>
            <div className="space-y-2">
              {options.map((opt, idx) => (
                <div key={idx} className="flex gap-2">
                  <Input
                    value={opt}
                    onChange={(e) => updateOption(idx, e.target.value)}
                    placeholder={`Opção ${idx + 1}`}
                    maxLength={100}
                    disabled={sendPoll.isPending}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeOption(idx)}
                    disabled={options.length <= MIN_OPTIONS || sendPoll.isPending}
                    title="Remover opção"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            {options.length < MAX_OPTIONS && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addOption}
                disabled={sendPoll.isPending}
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Adicionar opção
              </Button>
            )}
            {hasDuplicates && (
              <p className="text-xs text-destructive">Opções não podem se repetir.</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="poll-multi"
              checked={allowMulti}
              onCheckedChange={(c) => setAllowMulti(c === true)}
              disabled={sendPoll.isPending}
            />
            <Label htmlFor="poll-multi" className="text-sm font-normal cursor-pointer">
              Permitir múltiplas respostas
            </Label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={sendPoll.isPending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {sendPoll.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {sendPoll.isPending ? 'Enviando...' : 'Enviar enquete'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
