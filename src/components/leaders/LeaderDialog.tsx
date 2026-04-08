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
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2 } from 'lucide-react';
import { useCreateLeader, useUpdateLeader } from '@/hooks/useLeaders';
import type { Leader } from '@/hooks/useLeaders';

const leaderSchema = z.object({
  name: z.string().min(1, 'Nome e obrigatorio'),
  leadership_type: z.enum([
    'assessor_parlamentar',
    'lider_regional',
    'coordenador_area',
    'mobilizador',
    'multiplicador',
    'outro',
  ]),
  whatsapp: z.string().min(1, 'WhatsApp e obrigatorio'),
  email: z.string().email('Email invalido').or(z.literal('')).optional(),
  phone: z.string().optional(),
  region: z.string().min(1, 'Regiao e obrigatoria'),
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
  const isEdit = !!leader;

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
      leadership_type: 'outro',
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
        leadership_type: leader.leadership_type,
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
        leadership_type: 'outro',
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
  }, [leader, reset]);

  const watchType = watch('leadership_type');
  const watchActive = watch('active');

  const onSubmit = async (data: LeaderFormData) => {
    const { neighborhoods_text, ...rest } = data;
    const neighborhoods = neighborhoods_text
      ? neighborhoods_text.split(',').map((n) => n.trim()).filter(Boolean)
      : [];

    const payload: any = {
      nome: data.name,
      leadership_type: data.leadership_type,
      whatsapp: data.whatsapp,
      region: data.region,
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
            <Select
              value={watchType}
              onValueChange={(v) => setValue('leadership_type', v as any)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="assessor_parlamentar">Assessor Parlamentar</SelectItem>
                <SelectItem value="lider_regional">Lider Regional</SelectItem>
                <SelectItem value="coordenador_area">Coordenador de Area</SelectItem>
                <SelectItem value="mobilizador">Mobilizador</SelectItem>
                <SelectItem value="multiplicador">Multiplicador</SelectItem>
                <SelectItem value="outro">Outro</SelectItem>
              </SelectContent>
            </Select>
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
              <Label htmlFor="leader-region">Regiao *</Label>
              <Input id="leader-region" {...register('region')} placeholder="Regiao" />
              {errors.region && (
                <p className="text-sm text-destructive">{errors.region.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="leader-city">Cidade</Label>
              <Input id="leader-city" {...register('city')} placeholder="Cidade" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="leader-neighborhoods">Bairros (separados por virgula)</Label>
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
            <Label htmlFor="leader-address">Endereco</Label>
            <Input
              id="leader-address"
              {...register('address')}
              placeholder="Endereco completo"
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
