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
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Check, Loader2, Plus, X } from 'lucide-react';
import { useCreateLeader, useUpdateLeader } from '@/hooks/useLeaders';
import { useLeaderTypes, useCreateLeaderType } from '@/hooks/useLeaderTypes';
import type { Leader } from '@/hooks/useLeaders';

const leaderSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  leader_type_id: z.string().uuid('Tipo inválido'),
  whatsapp: z.string().min(1, 'WhatsApp é obrigatório'),
  email: z.string().email('Email inválido').or(z.literal('')).optional(),
  phone: z.string().optional(),
  region: z.string().optional(),
  city: z.string().optional(),
  neighborhoods_text: z.string().optional(),
  birth_date: z.string().optional(),
  address: z.string().optional(),
  instagram: z.string().optional(),
  active: z.boolean(),
});

type LeaderFormData = z.infer<typeof leaderSchema>;

interface LeaderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leader?: Leader | null;
}

export function LeaderDialog({ open, onOpenChange, leader }: LeaderDialogProps) {
  const createLeader = useCreateLeader();
  const updateLeader = useUpdateLeader();
  const { data: leaderTypes = [] } = useLeaderTypes();
  const createLeaderType = useCreateLeaderType();
  const isEdit = !!leader;

  const [isAddingType, setIsAddingType] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LeaderFormData>({
    resolver: zodResolver(leaderSchema),
    defaultValues: {
      name: '',
      leader_type_id: '',
      whatsapp: '',
      email: '',
      phone: '',
      region: '',
      city: '',
      neighborhoods_text: '',
      birth_date: '',
      address: '',
      instagram: '',
      active: true,
    },
  });

  useEffect(() => {
    if (leader) {
      reset({
        name: leader.nome,
        leader_type_id: leader.leader_type_id,
        whatsapp: leader.whatsapp ?? '',
        email: leader.email ?? '',
        phone: leader.phone ?? '',
        region: leader.region ?? '',
        city: leader.city ?? '',
        neighborhoods_text: leader.neighborhoods?.join(', ') ?? '',
        birth_date: leader.birth_date ?? '',
        address: leader.address ?? '',
        instagram: leader.instagram ?? '',
        active: leader.active,
      });
    } else {
      reset({
        name: '',
        leader_type_id: '',
        whatsapp: '',
        email: '',
        phone: '',
        region: '',
        city: '',
        neighborhoods_text: '',
        birth_date: '',
        address: '',
        instagram: '',
        active: true,
      });
    }
    setIsAddingType(false);
    setNewTypeName('');
  }, [leader, reset, open]);

  const watchType = watch('leader_type_id');
  const watchActive = watch('active');

  // Quando abre em modo "novo" e ainda nao tem tipo selecionado, padroniza em "Cabo Eleitoral"
  useEffect(() => {
    if (!isEdit && !watchType && leaderTypes.length > 0) {
      const cabo = leaderTypes.find((t) => t.slug === 'cabo_eleitoral');
      if (cabo) setValue('leader_type_id', cabo.id);
    }
  }, [isEdit, watchType, leaderTypes, setValue]);

  const handleCreateType = async () => {
    const label = newTypeName.trim();
    if (!label) return;
    try {
      const created = await createLeaderType.mutateAsync({ label });
      setValue('leader_type_id', created.id, { shouldValidate: true });
      setIsAddingType(false);
      setNewTypeName('');
    } catch {
      /* erro ja tratado pelo toast no hook */
    }
  };

  // Esconde "Outro" do dropdown, exceto se for o valor atual (edit de registro legado)
  const visibleTypes = leaderTypes.filter(
    (t) => t.slug !== 'outro' || t.id === watchType
  );

  const onSubmit = async (data: LeaderFormData) => {
    const { neighborhoods_text, ...rest } = data;
    const neighborhoods = neighborhoods_text
      ? neighborhoods_text.split(',').map((n) => n.trim()).filter(Boolean)
      : [];

    const payload: any = {
      nome: data.name,
      leader_type_id: data.leader_type_id,
      whatsapp: data.whatsapp,
      region: data.region || undefined,
      active: data.active,
      neighborhoods,
      email: rest.email || undefined,
      phone: rest.phone || undefined,
      city: rest.city || undefined,
      birth_date: rest.birth_date || undefined,
      address: rest.address || undefined,
      instagram: rest.instagram || undefined,
    };

    if (isEdit) {
      await updateLeader.mutateAsync({ id: leader.id, ...payload });
    } else {
      await createLeader.mutateAsync(payload);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? 'Editar Articulador' : 'Novo Articulador'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="leader-name">Nome *</Label>
            <Input id="leader-name" {...register('name')} placeholder="Nome completo" />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Tipo</Label>
            {!isAddingType ? (
              <div className="flex gap-2">
                <Select
                  value={watchType || undefined}
                  onValueChange={(v) => {
                    if (v === '__add_new__') {
                      setIsAddingType(true);
                      return;
                    }
                    setValue('leader_type_id', v, { shouldValidate: true });
                  }}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecione um tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {visibleTypes.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.label}
                      </SelectItem>
                    ))}
                    <SelectSeparator />
                    <SelectItem value="__add_new__">
                      <span className="flex items-center gap-2 text-primary">
                        <Plus className="h-3.5 w-3.5" />
                        Adicionar novo tipo
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title="Adicionar novo tipo"
                  onClick={() => setIsAddingType(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input
                  autoFocus
                  placeholder="Ex: Entusiasta"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleCreateType();
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      setIsAddingType(false);
                      setNewTypeName('');
                    }
                  }}
                />
                <Button
                  type="button"
                  size="icon"
                  onClick={handleCreateType}
                  disabled={createLeaderType.isPending || !newTypeName.trim()}
                  title="Salvar tipo"
                >
                  {createLeaderType.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setIsAddingType(false);
                    setNewTypeName('');
                  }}
                  title="Cancelar"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            {errors.leader_type_id && (
              <p className="text-sm text-destructive">{errors.leader_type_id.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="leader-whatsapp">WhatsApp *</Label>
              <Input
                id="leader-whatsapp"
                {...register('whatsapp')}
                placeholder="(00) 00000-0000"
              />
              {errors.whatsapp && (
                <p className="text-sm text-destructive">{errors.whatsapp.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="leader-phone">Telefone</Label>
              <Input
                id="leader-phone"
                {...register('phone')}
                placeholder="(00) 0000-0000"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="leader-email">Email</Label>
            <Input
              id="leader-email"
              {...register('email')}
              placeholder="email@exemplo.com"
              type="email"
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="leader-region">Região</Label>
              <Input id="leader-region" {...register('region')} placeholder="Região" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="leader-city">Cidade</Label>
              <Input id="leader-city" {...register('city')} placeholder="Cidade" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="leader-neighborhoods">Bairros (separados por vírgula)</Label>
            <Input
              id="leader-neighborhoods"
              {...register('neighborhoods_text')}
              placeholder="Centro, Copacabana, Botafogo"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="leader-birth-date">Data de Nascimento</Label>
              <Input
                id="leader-birth-date"
                {...register('birth_date')}
                type="date"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="leader-instagram">Instagram</Label>
              <Input
                id="leader-instagram"
                {...register('instagram')}
                placeholder="@usuario"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="leader-address">Endereço</Label>
            <Input
              id="leader-address"
              {...register('address')}
              placeholder="Endereço completo"
            />
          </div>

          <div className="flex items-center gap-3">
            <Switch
              checked={watchActive}
              onCheckedChange={(v) => setValue('active', v)}
            />
            <Label>{watchActive ? 'Ativo' : 'Inativo'}</Label>
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
