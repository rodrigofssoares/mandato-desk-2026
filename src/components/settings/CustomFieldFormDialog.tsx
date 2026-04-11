import { useEffect, useMemo, useState } from 'react';
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
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import { slugify } from '@/lib/slugify';
import {
  useCreateCustomField,
  useUpdateCustomField,
  type CampoPersonalizado,
  type CampoPersonalizadoTipo,
} from '@/hooks/useCustomFields';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  campo?: CampoPersonalizado | null; // undefined/null = criar; preenchido = editar
}

const TIPO_OPCOES: { value: CampoPersonalizadoTipo; label: string }[] = [
  { value: 'texto', label: 'Texto' },
  { value: 'numero', label: 'Número' },
  { value: 'data', label: 'Data' },
  { value: 'booleano', label: 'Sim / Não' },
  { value: 'selecao', label: 'Seleção (lista fixa)' },
];

export function CustomFieldFormDialog({ open, onOpenChange, campo }: Props) {
  const isEdit = !!campo;

  const [rotulo, setRotulo] = useState('');
  const [tipo, setTipo] = useState<CampoPersonalizadoTipo>('texto');
  const [filtravel, setFiltravel] = useState(true);
  const [opcoes, setOpcoes] = useState<string[]>(['', '']);

  const createMutation = useCreateCustomField();
  const updateMutation = useUpdateCustomField();
  const isSaving = createMutation.isPending || updateMutation.isPending;

  // Sincroniza form quando o dialog abre com um campo diferente
  useEffect(() => {
    if (!open) return;
    if (campo) {
      setRotulo(campo.rotulo);
      setTipo(campo.tipo);
      setFiltravel(campo.filtravel);
      setOpcoes(campo.opcoes && campo.opcoes.length > 0 ? [...campo.opcoes] : ['', '']);
    } else {
      setRotulo('');
      setTipo('texto');
      setFiltravel(true);
      setOpcoes(['', '']);
    }
  }, [open, campo]);

  const chavePreview = useMemo(() => slugify(rotulo), [rotulo]);

  const handleAddOpcao = () => setOpcoes((prev) => [...prev, '']);
  const handleRemoveOpcao = (index: number) => {
    setOpcoes((prev) => (prev.length > 2 ? prev.filter((_, i) => i !== index) : prev));
  };
  const handleChangeOpcao = (index: number, value: string) => {
    setOpcoes((prev) => prev.map((o, i) => (i === index ? value : o)));
  };

  const handleSave = async () => {
    const rotuloTrimmed = rotulo.trim();
    if (!rotuloTrimmed) return;

    const opcoesClean =
      tipo === 'selecao' ? opcoes.map((o) => o.trim()).filter((o) => o.length > 0) : null;

    if (tipo === 'selecao' && (opcoesClean?.length ?? 0) < 2) {
      // Validação bloqueada no botão Salvar também, mas redundância aqui
      return;
    }

    try {
      if (isEdit && campo) {
        await updateMutation.mutateAsync({
          id: campo.id,
          patch: {
            rotulo: rotuloTrimmed,
            opcoes: tipo === 'selecao' ? opcoesClean : null,
            filtravel,
          },
        });
      } else {
        await createMutation.mutateAsync({
          rotulo: rotuloTrimmed,
          tipo,
          opcoes: tipo === 'selecao' ? opcoesClean : null,
          filtravel,
        });
      }
      onOpenChange(false);
    } catch {
      // erro já tratado por toast no hook
    }
  };

  const opcoesValidas =
    tipo !== 'selecao' ||
    opcoes.map((o) => o.trim()).filter((o) => o.length > 0).length >= 2;

  const podeSalvar = !!rotulo.trim() && opcoesValidas && !isSaving;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar campo personalizado' : 'Novo campo personalizado'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Você pode alterar o rótulo e as opções — a chave permanece a mesma para preservar os valores já salvos.'
              : 'Defina um campo extra para os contatos. A chave é gerada automaticamente a partir do rótulo.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="rotulo">Rótulo *</Label>
            <Input
              id="rotulo"
              value={rotulo}
              onChange={(e) => setRotulo(e.target.value)}
              placeholder="Ex: Cargo de Liderança"
              disabled={isSaving}
            />
            {chavePreview && (
              <p className="text-xs text-muted-foreground">
                Chave: <code className="font-mono">{chavePreview}</code>
                {isEdit && ' (somente leitura na edição)'}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tipo">Tipo *</Label>
            <Select
              value={tipo}
              onValueChange={(v) => setTipo(v as CampoPersonalizadoTipo)}
              disabled={isSaving || isEdit}
            >
              <SelectTrigger id="tipo">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPO_OPCOES.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isEdit && (
              <p className="text-xs text-muted-foreground">
                Tipo não pode ser alterado após criação.
              </p>
            )}
          </div>

          {tipo === 'selecao' && (
            <div className="space-y-2">
              <Label>Opções (mínimo 2)</Label>
              <div className="space-y-2">
                {opcoes.map((opcao, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={opcao}
                      onChange={(e) => handleChangeOpcao(index, e.target.value)}
                      placeholder={`Opção ${index + 1}`}
                      disabled={isSaving}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveOpcao(index)}
                      disabled={opcoes.length <= 2 || isSaving}
                      title="Remover opção"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddOpcao}
                  disabled={isSaving}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar opção
                </Button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="filtravel" className="cursor-pointer">
                Filtrável na listagem
              </Label>
              <p className="text-xs text-muted-foreground">
                Quando ativo, o campo aparece nos filtros da aba Contatos.
              </p>
            </div>
            <Switch
              id="filtravel"
              checked={filtravel}
              onCheckedChange={setFiltravel}
              disabled={isSaving}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!podeSalvar}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEdit ? 'Salvar alterações' : 'Criar campo'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
