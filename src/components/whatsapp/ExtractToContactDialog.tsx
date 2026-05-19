// ─── ExtractToContactDialog (T55 — #21) ──────────────────────────────────────
// Modal para salvar texto selecionado numa mensagem em um campo do contato.
// Usa supabase direto para update pontual — sem carregar ContactFormData completo.

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';

// ─── Campos suportados ────────────────────────────────────────────────────────

const CONTACT_FIELDS: { value: string; label: string }[] = [
  { value: 'nome', label: 'Nome' },
  { value: 'telefone', label: 'Telefone' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'E-mail' },
  { value: 'profissao', label: 'Profissão' },
  { value: 'bairro', label: 'Bairro' },
  { value: 'cidade', label: 'Cidade' },
  { value: 'estado', label: 'Estado' },
  { value: 'logradouro', label: 'Logradouro' },
  { value: 'cep', label: 'CEP' },
  { value: 'origem', label: 'Origem' },
  { value: 'observacoes', label: 'Observações' },
  { value: 'notas_assessor', label: 'Notas do assessor' },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface ExtractToContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
  selectedText: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function ExtractToContactDialog({
  open,
  onOpenChange,
  contactId,
  selectedText,
}: ExtractToContactDialogProps) {
  const [campo, setCampo] = useState<string>('observacoes');
  const [valor, setValor] = useState(selectedText.slice(0, 255));
  const [isPending, setIsPending] = useState(false);
  const queryClient = useQueryClient();

  async function handleSalvar() {
    if (!campo || !valor.trim()) return;
    const campoLabel = CONTACT_FIELDS.find((f) => f.value === campo)?.label ?? campo;
    setIsPending(true);
    try {
      const { error } = await supabase
        .from('contacts')
        .update({ [campo]: valor.trim() })
        .eq('id', contactId);
      if (error) throw error;
      // Invalida cache de contatos para refletir a mudança
      await queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success(`Campo "${campoLabel}" atualizado com sucesso`);
      onOpenChange(false);
    } catch {
      toast.error(`Erro ao atualizar campo "${campoLabel}"`);
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-4 w-4 text-primary" />
            Salvar em campo do contato
          </DialogTitle>
          <DialogDescription>
            O texto selecionado será salvo no campo escolhido do contato.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Texto selecionado */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Valor a salvar</Label>
            <Textarea
              value={valor}
              onChange={(e) => setValor(e.target.value.slice(0, 255))}
              className="text-sm min-h-[70px] resize-none"
              placeholder="Texto selecionado..."
            />
            {valor.length >= 255 && (
              <p className="text-[11px] text-amber-600">Truncado a 255 caracteres</p>
            )}
          </div>

          {/* Campo destino */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Campo destino</Label>
            <Select value={campo} onValueChange={setCampo}>
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Selecione um campo..." />
              </SelectTrigger>
              <SelectContent>
                {CONTACT_FIELDS.map((f) => (
                  <SelectItem key={f.value} value={f.value} className="text-sm">
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            onClick={handleSalvar}
            disabled={isPending || !valor.trim()}
          >
            {isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
