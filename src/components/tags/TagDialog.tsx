import { useEffect } from 'react';
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
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useCreateTag, useUpdateTag } from '@/hooks/useTags';
import type { Tag } from '@/hooks/useTags';

const PRESET_COLORS = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E',
  '#3B82F6', '#8B5CF6', '#EC4899', '#6B7280',
];

const tagSchema = z.object({
  name: z.string().min(1, 'Nome e obrigatorio'),
  category: z.enum(['professionals', 'relationships', 'demands']),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Cor invalida'),
});

type TagFormData = z.infer<typeof tagSchema>;

interface TagDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag?: Tag | null;
  defaultCategory?: string;
}

export function TagDialog({ open, onOpenChange, tag, defaultCategory }: TagDialogProps) {
  const createTag = useCreateTag();
  const updateTag = useUpdateTag();
  const isEdit = !!tag;

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
      category: (defaultCategory as any) ?? 'professionals',
      color: '#6B7280',
    },
  });

  useEffect(() => {
    if (tag) {
      reset({
        name: tag.nome,
        category: tag.categoria,
        color: tag.cor,
      });
    } else {
      reset({
        name: '',
        category: (defaultCategory as any) ?? 'professionals',
        color: '#6B7280',
      });
    }
  }, [tag, defaultCategory, reset]);

  const watchColor = watch('color');
  const watchCategory = watch('category');

  const onSubmit = async (data: TagFormData) => {
    if (isEdit) {
      await updateTag.mutateAsync({ id: tag.id, nome: data.name, categoria: data.category, cor: data.color });
    } else {
      await createTag.mutateAsync({ nome: data.name, categoria: data.category, cor: data.color });
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
            <Label>Categoria</Label>
            <Select
              value={watchCategory}
              onValueChange={(v) => setValue('category', v as any)}
              disabled={isEdit}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="professionals">Profissionais</SelectItem>
                <SelectItem value="relationships">Relacionamentos</SelectItem>
                <SelectItem value="demands">Demandas</SelectItem>
              </SelectContent>
            </Select>
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
