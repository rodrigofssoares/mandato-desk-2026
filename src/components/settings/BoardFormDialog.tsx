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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import {
  useCreateBoard,
  useUpdateBoard,
  type Board,
} from '@/hooks/useBoards';
import { useCreateBoardStage } from '@/hooks/useBoardStages';
import { STAGE_COLORS, nextStageColor, stageDotClass } from './stageColors';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  board?: Board | null; // undefined/null = criar; preenchido = editar
}

interface InitialStage {
  nome: string;
  cor: string;
}

export function BoardFormDialog({ open, onOpenChange, board }: Props) {
  const isEdit = !!board;

  const [nome, setNome] = useState('');
  const [descricao, setDescricao] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [stages, setStages] = useState<InitialStage[]>([
    { nome: '', cor: STAGE_COLORS[0] },
    { nome: '', cor: STAGE_COLORS[1] },
  ]);

  const createBoard = useCreateBoard();
  const updateBoard = useUpdateBoard();
  const createStage = useCreateBoardStage();
  const isSaving =
    createBoard.isPending || updateBoard.isPending || createStage.isPending;

  useEffect(() => {
    if (!open) return;
    if (board) {
      setNome(board.nome);
      setDescricao(board.descricao ?? '');
      setIsDefault(board.is_default);
    } else {
      setNome('');
      setDescricao('');
      setIsDefault(false);
      setStages([
        { nome: '', cor: STAGE_COLORS[0] },
        { nome: '', cor: STAGE_COLORS[1] },
      ]);
    }
  }, [open, board]);

  const handleAddStage = () => {
    setStages((prev) => [
      ...prev,
      { nome: '', cor: nextStageColor(prev.length) },
    ]);
  };

  const handleRemoveStage = (index: number) => {
    setStages((prev) => (prev.length > 2 ? prev.filter((_, i) => i !== index) : prev));
  };

  const handleChangeStageNome = (index: number, value: string) => {
    setStages((prev) => prev.map((s, i) => (i === index ? { ...s, nome: value } : s)));
  };

  const handleChangeStageCor = (index: number, cor: string) => {
    setStages((prev) => prev.map((s, i) => (i === index ? { ...s, cor } : s)));
  };

  const handleSave = async () => {
    const nomeTrimmed = nome.trim();
    if (!nomeTrimmed) return;

    try {
      if (isEdit && board) {
        await updateBoard.mutateAsync({
          id: board.id,
          patch: {
            nome: nomeTrimmed,
            descricao: descricao.trim() || null,
            is_default: isDefault,
          },
        });
      } else {
        const stagesValidos = stages
          .map((s) => ({ nome: s.nome.trim(), cor: s.cor }))
          .filter((s) => s.nome.length > 0);
        if (stagesValidos.length < 2) return;

        const created = await createBoard.mutateAsync({
          nome: nomeTrimmed,
          descricao: descricao.trim() || null,
          tipo_entidade: 'contact',
          is_default: isDefault,
        });

        // Cria estágios iniciais sequencialmente para preservar ordem
        for (let i = 0; i < stagesValidos.length; i++) {
          await createStage.mutateAsync({
            board_id: created.id,
            nome: stagesValidos[i].nome,
            cor: stagesValidos[i].cor,
            ordem: i,
          });
        }
      }
      onOpenChange(false);
    } catch {
      // toast já disparado pelos hooks
    }
  };

  const stagesValidosCount = isEdit
    ? 0
    : stages.map((s) => s.nome.trim()).filter((n) => n.length > 0).length;

  const podeSalvar =
    !!nome.trim() && (isEdit || stagesValidosCount >= 2) && !isSaving;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar funil' : 'Novo funil'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Atualize nome, descrição e padrão do funil. Estágios são gerenciados depois no painel.'
              : 'Crie um novo funil de contatos com estágios iniciais. Você poderá reordenar e editar cada estágio depois.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="board-nome">Nome *</Label>
            <Input
              id="board-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Seguidores, Ação de Rua, Eventos…"
              disabled={isSaving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="board-descricao">Descrição</Label>
            <Textarea
              id="board-descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Para que serve esse funil?"
              rows={2}
              disabled={isSaving}
            />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div className="space-y-0.5">
              <Label htmlFor="board-default" className="cursor-pointer">
                Marcar como padrão
              </Label>
              <p className="text-xs text-muted-foreground">
                O funil padrão é o que aparece na página Funil por default. Apenas um pode ser padrão
                por vez.
              </p>
            </div>
            <Switch
              id="board-default"
              checked={isDefault}
              onCheckedChange={setIsDefault}
              disabled={isSaving}
            />
          </div>

          {!isEdit && (
            <div className="space-y-2">
              <Label>Estágios iniciais (mínimo 2)</Label>
              <div className="space-y-2">
                {stages.map((stage, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <ColorDot
                      cor={stage.cor}
                      onSelect={(c) => handleChangeStageCor(index, c)}
                      disabled={isSaving}
                    />
                    <Input
                      value={stage.nome}
                      onChange={(e) => handleChangeStageNome(index, e.target.value)}
                      placeholder={`Estágio ${index + 1}`}
                      disabled={isSaving}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveStage(index)}
                      disabled={stages.length <= 2 || isSaving}
                      title="Remover estágio"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddStage}
                  disabled={isSaving}
                  className="w-full"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar estágio
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!podeSalvar}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEdit ? 'Salvar alterações' : 'Criar funil'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ColorDot({
  cor,
  onSelect,
  disabled,
}: {
  cor: string;
  onSelect: (c: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Escolher cor"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className={`h-8 w-8 rounded-full border-2 border-border hover:scale-105 transition-transform disabled:opacity-50 ${stageDotClass(cor)}`}
      />
      {open && (
        <div className="absolute z-50 top-10 left-0 flex gap-1 rounded-md border bg-popover p-2 shadow-md">
          {STAGE_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                onSelect(c);
                setOpen(false);
              }}
              className={`h-6 w-6 rounded-full ring-offset-2 hover:ring-2 hover:ring-primary ${stageDotClass(c)}`}
              aria-label={c}
            />
          ))}
        </div>
      )}
    </div>
  );
}
