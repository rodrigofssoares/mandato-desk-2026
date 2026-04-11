import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { useCreateDemand, useUpdateDemand, useDeleteDemand } from '@/hooks/useDemands';
import { useTags } from '@/hooks/useTags';
import { usePermissions } from '@/hooks/usePermissions';
import type { Demand } from '@/hooks/useDemands';

const demandSchema = z.object({
  title: z.string().min(1, 'Titulo e obrigatorio'),
  description: z.string().optional(),
  status: z.enum(['open', 'in_progress', 'resolved']),
  priority: z.enum(['low', 'medium', 'high']),
  contact_id: z.string().optional().nullable(),
  responsible_id: z.string().optional().nullable(),
  neighborhood: z.string().optional(),
});

type DemandFormData = z.infer<typeof demandSchema>;

interface DemandDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  demand?: Demand | null;
}

export function DemandDialog({ open, onOpenChange, demand }: DemandDialogProps) {
  const createDemand = useCreateDemand();
  const updateDemand = useUpdateDemand();
  const deleteDemand = useDeleteDemand();
  const { can } = usePermissions();
  const { data: tags = [] } = useTags();
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const isEdit = !!demand;

  // Fetch contacts for the select
  const { data: contacts = [] } = useQuery({
    queryKey: ['contacts-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, nome')
        .is('merged_into', null)
        .order('nome')
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  // Fetch profiles for responsible select
  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-select'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, nome')
        .eq('status_aprovacao', 'ATIVO')
        .order('nome');
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<DemandFormData>({
    resolver: zodResolver(demandSchema),
    defaultValues: {
      title: '',
      description: '',
      status: 'open',
      priority: 'medium',
      contact_id: null,
      responsible_id: null,
      neighborhood: '',
    },
  });

  useEffect(() => {
    if (demand) {
      reset({
        title: demand.title,
        description: demand.description ?? '',
        status: demand.status,
        priority: demand.priority,
        contact_id: demand.contact_id,
        responsible_id: demand.responsible_id,
        neighborhood: demand.neighborhood ?? '',
      });
      setSelectedTagIds(demand.demand_tags?.map((dt) => dt.tag_id) ?? []);
    } else {
      reset({
        title: '',
        description: '',
        status: 'open',
        priority: 'medium',
        contact_id: null,
        responsible_id: null,
        neighborhood: '',
      });
      setSelectedTagIds([]);
    }
  }, [demand, reset]);

  const watchStatus = watch('status');
  const watchPriority = watch('priority');
  const watchContactId = watch('contact_id');
  const watchResponsibleId = watch('responsible_id');

  const toggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const onSubmit = async (data: DemandFormData) => {
    if (isEdit) {
      await updateDemand.mutateAsync({
        id: demand.id,
        ...data,
        contact_id: data.contact_id || null,
        responsible_id: data.responsible_id || null,
        tag_ids: selectedTagIds,
      });
    } else {
      await createDemand.mutateAsync({
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority,
        contact_id: data.contact_id || null,
        responsible_id: data.responsible_id || null,
        neighborhood: data.neighborhood,
        tag_ids: selectedTagIds,
      });
    }
    onOpenChange(false);
  };

  const handleDelete = async () => {
    if (!demand) return;
    await deleteDemand.mutateAsync(demand.id);
    onOpenChange(false);
  };

  const demandsTags = tags.filter((t) => t.group_slug === 'demandas');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar Demanda' : 'Nova Demanda'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Titulo *</Label>
            <Input id="title" {...register('title')} placeholder="Titulo da demanda" />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descricao</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Descreva a demanda..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={watchStatus}
                onValueChange={(v) => setValue('status', v as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Aberta</SelectItem>
                  <SelectItem value="in_progress">Em Andamento</SelectItem>
                  <SelectItem value="resolved">Resolvida</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select
                value={watchPriority}
                onValueChange={(v) => setValue('priority', v as any)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Media</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Contato</Label>
            <Select
              value={watchContactId ?? '_none'}
              onValueChange={(v) => setValue('contact_id', v === '_none' ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um contato" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Nenhum</SelectItem>
                {contacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Responsavel</Label>
            <Select
              value={watchResponsibleId ?? '_none'}
              onValueChange={(v) => setValue('responsible_id', v === '_none' ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o responsavel" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">Nenhum</SelectItem>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="neighborhood">Bairro</Label>
            <Input
              id="neighborhood"
              {...register('neighborhood')}
              placeholder="Bairro"
            />
          </div>

          {demandsTags.length > 0 && (
            <div className="space-y-2">
              <Label>Etiquetas</Label>
              <div className="flex flex-wrap gap-2">
                {demandsTags.map((tag) => {
                  const isSelected = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                    >
                      <Badge
                        variant={isSelected ? 'default' : 'outline'}
                        className="cursor-pointer transition-colors"
                        style={
                          isSelected
                            ? { backgroundColor: tag.cor, borderColor: tag.cor }
                            : { borderColor: tag.cor, color: tag.cor }
                        }
                      >
                        {tag.nome}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            {isEdit && can.deleteDemand() && (
              <Button
                type="button"
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteDemand.isPending}
              >
                Excluir
              </Button>
            )}
            <div className="flex-1" />
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
