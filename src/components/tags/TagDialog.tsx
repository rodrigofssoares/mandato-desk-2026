import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectSeparator,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Loader2, Plus, X } from 'lucide-react';
import { useCreateTag, useUpdateTag } from '@/hooks/useTags';
import { useTagGroups, useCreateTagGroup, MAX_TAG_GROUPS } from '@/hooks/useTagGroups';
import type { Tag } from '@/hooks/useTags';

const PRESET_COLORS = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E',
  '#3B82F6', '#8B5CF6', '#EC4899', '#6B7280',
];

const NEW_GROUP_VALUE = '__new_group__';

const tagSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  group_id: z.string().uuid('Selecione um grupo'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor inválida'),
});

type TagFormData = z.infer<typeof tagSchema>;

interface TagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag?: Tag | null;
  defaultGroupId?: string;
}

export function TagDialog({ open, onOpenChange, tag, defaultGroupId }: TagDialogProps) {
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const { data: groups = [] } = useTagGroups();
  const createGroup = useCreateTagGroup();
  const isEdit = !!tag;
  const groupsAtLimit = groups.length >= MAX_TAG_GROUPS;

  const [creatingGroup, setCreatingGroup] = useState(false);
  const [newGroupLabel, setNewGroupLabel] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TagFormData>({
    resolver: zodResolver(tagSchema),
    defaultValues: {
      name: '',
      group_id: '',
      color: '#6B7280',
    },
  });

  useEffect(() => {
    if (!open) return;
    const fallbackGroup = defaultGroupId ?? groups[0]?.id ?? '';
    if (tag) {
      reset({
        name: tag.nome,
        group_id: tag.group_id,
        color: tag.cor,
      });
    } else {
      reset({
        name: '',
        group_id: fallbackGroup,
        color: '#6B7280',
      });
    }
    setCreatingGroup(false);
    setNewGroupLabel('');
  }, [tag, defaultGroupId, groups, reset, open]);

  const watchColor = watch('color');
  const watchGroupId = watch('group_id');

  const handleSelectChange = (value: string) => {
    if (value === NEW_GROUP_VALUE) {
      setCreatingGroup(true);
      return;
    }
    setValue('group_id', value, { shouldValidate: true });
  };

  const handleConfirmNewGroup = async () => {
    const label = newGroupLabel.trim();
    if (!label) return;
    try {
      const group = await createGroup.mutateAsync({ label });
      setValue('group_id', group.id, { shouldValidate: true });
      setCreatingGroup(false);
      setNewGroupLabel('');
    } catch {
      // toast handled in hook
    }
  };

  const onSubmit = async (data: TagFormData) => {
    if (isEdit) {
      await updateTag.mutateAsync({
        id: tag.id,
        nome: data.name,
        group_id: data.group_id,
        cor: data.color,
      });
    } else {
      await createTag.mutateAsync({
        nome: data.name,
        group_id: data.group_id,
        cor: data.color,
      });
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Etiqueta' : 'Nova Etiqueta'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="tag-name">Nome *</Label>
            <Input id="tag-name" {...register('name')} placeholder="Nome da etiqueta" />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Grupo</Label>
            {creatingGroup ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    autoFocus
                    value={newGroupLabel}
                    onChange={(e) => setNewGroupLabel(e.target.value)}
                    placeholder="Nome do novo grupo (ex: Redes Sociais)"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleConfirmNewGroup();
                      }
                    }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleConfirmNewGroup}
                    disabled={!newGroupLabel.trim() || createGroup.isPending}
                  >
                    {createGroup.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Criar'
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setCreatingGroup(false);
                      setNewGroupLabel('');
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {groups.length}/{MAX_TAG_GROUPS} grupos criados
                </p>
              </div>
            ) : (
              <Select value={watchGroupId} onValueChange={handleSelectChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um grupo" />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.label}
                    </SelectItem>
                  ))}
                  <SelectSeparator />
                  {groupsAtLimit ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="relative flex items-center gap-2 pl-8 pr-2 py-1.5 text-sm text-muted-foreground cursor-not-allowed">
                            <Plus className="h-3.5 w-3.5" />
                            Criar novo grupo...
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          Limite de {MAX_TAG_GROUPS} grupos atingido
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <SelectItem value={NEW_GROUP_VALUE}>
                      <span className="flex items-center gap-2">
                        <Plus className="h-3.5 w-3.5" />
                        Criar novo grupo...
                      </span>
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            )}
            {errors.group_id && (
              <p className="text-sm text-destructive">{errors.group_id.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tag-color">Cor</Label>
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-full border-2 border-border shrink-0"
                style={{ backgroundColor: watchColor }}
              />
              <Input
                id="tag-color"
                {...register('color')}
                placeholder="#6B7280"
                className="font-mono"
              />
            </div>
            {errors.color && (
              <p className="text-sm text-destructive">{errors.color.message}</p>
            )}
            <div className="flex gap-2 mt-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`w-6 h-6 rounded-full border-2 transition-transform hover:scale-110 ${
                    watchColor === color ? 'border-foreground scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                  onClick={() => setValue('color', color)}
                />
              ))}
            </div>
          </div>

          {isEdit && tag && (
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">Código da Etiqueta</Label>
              <div
                className="bg-muted/50 border border-border rounded-md px-3 py-2 font-mono text-xs text-muted-foreground cursor-pointer select-all"
                onClick={() => {
                  navigator.clipboard.writeText(tag.id);
                }}
                title="Clique para copiar"
              >
                {tag.id}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
