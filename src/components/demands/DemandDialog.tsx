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
import { useAuth } from '@/context/AuthContext';
import { useDemandBoardId, useDemandStages } from '@/hooks/useDemandColumns';
import { ContactPickerField } from './ContactPickerField';
import type { Demand } from '@/hooks/useDemands';

const demandSchema = z.object({
  title: z.string().min(1, 'Título é obrigatório'),
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
  /** RAQ-MAND-EM085: quando informado, o contato vem travado (fluxo WhatsApp). */
  lockedContactId?: string | null;
  /** Callback chamado após criar uma nova demanda (usado para vincular ao chat). */
  onCreated?: (demand: { id: string }) => void;
}

export function DemandDialog({
  open,
  onOpenChange,
  demand,
  lockedContactId = null,
  onCreated,
}: DemandDialogProps) {
  const createDemand = useCreateDemand();
  const updateDemand = useUpdateDemand();
  const deleteDemand = useDeleteDemand();
  const { can } = usePermissions();
  const { profile } = useAuth();
  const { data: tags = [] } = useTags();
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  // RAQ-MAND-EM085: coluna do kanban (board_stages). Quando há colunas
  // configuradas, o campo "Status" dá lugar ao seletor de "Coluna".
  const { data: demandBoardId } = useDemandBoardId();
  const { data: demandStages = [] } = useDemandStages(demandBoardId);
  const dynamicColumns = demandStages.length > 0;
  const [stageId, setStageId] = useState<string | null>(null);

  const isEdit = !!demand;

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
      setStageId(demand.stage_id ?? null);
    } else {
      reset({
        title: '',
        description: '',
        status: 'open',
        priority: 'medium',
        // RAQ-MAND-EM085: contato travado no fluxo WhatsApp. Responsável pela
        // atividade começa vazio (escolha deliberada); o criador vai em created_by.
        contact_id: lockedContactId ?? null,
        responsible_id: null,
        neighborhood: '',
      });
      setSelectedTagIds([]);
      setStageId(null);
    }
  }, [demand, reset, lockedContactId]);

  // Default da coluna em nova demanda: primeira coluna assim que carregarem.
  // Usa updater funcional pra não depender de `stageId` nas deps (evita o
  // anti-padrão de efeito que reage à própria mudança de state).
  useEffect(() => {
    if (!demand && demandStages.length > 0) {
      setStageId((prev) => (prev === null ? demandStages[0].id : prev));
    }
  }, [demand, demandStages]);

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
    // RAQ-MAND-EM085: quando há colunas configuradas, a posição vem do stageId.
    const resolvedStageId = dynamicColumns
      ? stageId ?? demandStages[0]?.id ?? null
      : undefined;

    if (isEdit) {
      await updateDemand.mutateAsync({
        id: demand.id,
        ...data,
        contact_id: data.contact_id || null,
        responsible_id: data.responsible_id || null,
        ...(resolvedStageId !== undefined ? { stage_id: resolvedStageId } : {}),
        tag_ids: selectedTagIds,
      });
    } else {
      const created = await createDemand.mutateAsync({
        title: data.title,
        description: data.description,
        status: data.status,
        priority: data.priority,
        contact_id: data.contact_id || null,
        responsible_id: data.responsible_id || null,
        neighborhood: data.neighborhood,
        ...(resolvedStageId !== undefined ? { stage_id: resolvedStageId } : {}),
        tag_ids: selectedTagIds,
      });
      if (created?.id) onCreated?.({ id: created.id });
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
            <Label htmlFor="title">Título *</Label>
            <Input id="title" {...register('title')} placeholder="Título da demanda" />
            {errors.title && (
              <p className="text-sm text-destructive">{errors.title.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              {...register('description')}
              placeholder="Descreva a demanda..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="neighborhood">Bairro</Label>
            <Input
              id="neighborhood"
              {...register('neighborhood')}
              placeholder="Bairro"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              {dynamicColumns ? (
                <>
                  <Label>Coluna</Label>
                  <Select
                    value={stageId ?? undefined}
                    onValueChange={(v) => setStageId(v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione a coluna" />
                    </SelectTrigger>
                    <SelectContent>
                      {demandStages.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </>
              ) : (
                <>
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
                </>
              )}
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
            <ContactPickerField
              value={watchContactId ?? null}
              onChange={(id) => setValue('contact_id', id)}
              locked={!!lockedContactId}
            />
          </div>

          <div className="space-y-2">
            <Label>Responsável pela atividade</Label>
            <Select
              value={watchResponsibleId ?? '_none'}
              onValueChange={(v) => setValue('responsible_id', v === '_none' ? null : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione quem vai acompanhar" />
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

          {/* RAQ-MAND-EM085: quem inseriu a demanda no sistema (created_by) —
              preenchido automaticamente, somente leitura. */}
          <div className="space-y-2">
            <Label>Responsável pela criação</Label>
            <Input
              value={
                isEdit
                  ? demand?.creator?.nome ?? '—'
                  : profile?.nome ?? 'Você'
              }
              readOnly
              disabled
              className="bg-muted/40"
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
