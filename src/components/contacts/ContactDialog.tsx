import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { contactSchema, type ContactFormData } from '@/lib/contactValidation';
import { useCreateContact, useUpdateContact, useContactTags, useLeaders, type Contact } from '@/hooks/useContacts';

interface ContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact | null;
}

const ESTADOS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA',
  'PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

export function ContactDialog({ open, onOpenChange, contact }: ContactDialogProps) {
  const isEditing = !!contact;
  const createMutation = useCreateContact();
  const updateMutation = useUpdateContact();
  const { data: allTags = [] } = useContactTags();
  const { data: leaders = [] } = useLeaders();

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      nome: '',
      whatsapp: '',
      email: '',
      telefone: '',
      genero: null,
      data_nascimento: '',
      logradouro: '',
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      estado: '',
      cep: '',
      instagram: '',
      twitter: '',
      tiktok: '',
      youtube: '',
      declarou_voto: false,
      ranking: 0,
      leader_id: '',
      origem: '',
      observacoes: '',
      notas_assessor: '',
      tag_ids: [],
    },
  });

  useEffect(() => {
    if (contact) {
      const tagIds = contact.contact_tags?.map((ct) => ct.tag_id) ?? [];
      form.reset({
        nome: contact.nome ?? '',
        whatsapp: contact.whatsapp ?? '',
        email: contact.email ?? '',
        telefone: contact.telefone ?? '',
        genero: (contact.genero as ContactFormData['genero']) ?? null,
        data_nascimento: contact.data_nascimento ?? '',
        logradouro: contact.logradouro ?? '',
        numero: contact.numero ?? '',
        complemento: contact.complemento ?? '',
        bairro: contact.bairro ?? '',
        cidade: contact.cidade ?? '',
        estado: contact.estado ?? '',
        cep: contact.cep ?? '',
        instagram: contact.instagram ?? '',
        twitter: contact.twitter ?? '',
        tiktok: contact.tiktok ?? '',
        youtube: contact.youtube ?? '',
        declarou_voto: contact.declarou_voto ?? false,
        ranking: contact.ranking ?? 0,
        leader_id: contact.leader_id ?? '',
        origem: contact.origem ?? '',
        observacoes: contact.observacoes ?? '',
        notas_assessor: contact.notas_assessor ?? '',
        tag_ids: tagIds,
      });
    } else {
      form.reset();
    }
  }, [contact, form]);

  const onSubmit = async (data: ContactFormData) => {
    if (isEditing && contact) {
      await updateMutation.mutateAsync({ id: contact.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
    onOpenChange(false);
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const selectedTagIds = form.watch('tag_ids') ?? [];

  function toggleTag(tagId: string) {
    const current = form.getValues('tag_ids') ?? [];
    if (current.includes(tagId)) {
      form.setValue('tag_ids', current.filter((id) => id !== tagId), { shouldDirty: true });
    } else {
      form.setValue('tag_ids', [...current, tagId], { shouldDirty: true });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 flex flex-col">
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle>{isEditing ? 'Editar Contato' : 'Novo Contato'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <ScrollArea className="flex-1 px-6">
            <Tabs defaultValue="pessoais" className="w-full">
              <TabsList className="w-full mb-4">
                <TabsTrigger value="pessoais" className="flex-1 text-xs">Pessoais</TabsTrigger>
                <TabsTrigger value="endereco" className="flex-1 text-xs">Endereço</TabsTrigger>
                <TabsTrigger value="redes" className="flex-1 text-xs">Redes</TabsTrigger>
                <TabsTrigger value="politico" className="flex-1 text-xs">Político</TabsTrigger>
                <TabsTrigger value="obs" className="flex-1 text-xs">Obs</TabsTrigger>
              </TabsList>

              {/* --- Dados Pessoais --- */}
              <TabsContent value="pessoais" className="space-y-4 mt-0">
                <div>
                  <Label htmlFor="nome">Nome *</Label>
                  <Input id="nome" {...form.register('nome')} placeholder="Nome completo" />
                  {form.formState.errors.nome && (
                    <p className="text-xs text-destructive mt-1">{form.formState.errors.nome.message}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="whatsapp">WhatsApp</Label>
                    <Input id="whatsapp" {...form.register('whatsapp')} placeholder="(00) 00000-0000" />
                  </div>
                  <div>
                    <Label htmlFor="telefone">Telefone</Label>
                    <Input id="telefone" {...form.register('telefone')} placeholder="(00) 0000-0000" />
                  </div>
                </div>
                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" {...form.register('email')} placeholder="email@exemplo.com" />
                  {form.formState.errors.email && (
                    <p className="text-xs text-destructive mt-1">{form.formState.errors.email.message}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="genero">Gênero</Label>
                    <Select
                      value={form.watch('genero') ?? ''}
                      onValueChange={(v) => form.setValue('genero', v as ContactFormData['genero'], { shouldDirty: true })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="masculino">Masculino</SelectItem>
                        <SelectItem value="feminino">Feminino</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                        <SelectItem value="prefiro_nao_informar">Prefiro não informar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="data_nascimento">Data de Nascimento</Label>
                    <Input id="data_nascimento" type="date" {...form.register('data_nascimento')} />
                  </div>
                </div>

                {/* Tags */}
                <div>
                  <Label>Etiquetas</Label>
                  <div className="border rounded-md p-3 mt-1 max-h-40 overflow-y-auto">
                    {allTags.length === 0 && (
                      <p className="text-xs text-muted-foreground">Nenhuma etiqueta cadastrada</p>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      {allTags.map((tag) => (
                        <label key={tag.id} className="flex items-center gap-2 text-sm cursor-pointer">
                          <Checkbox
                            checked={selectedTagIds.includes(tag.id)}
                            onCheckedChange={() => toggleTag(tag.id)}
                          />
                          <span
                            className="truncate"
                            style={tag.cor ? { color: tag.cor } : undefined}
                          >
                            {tag.nome}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </TabsContent>

              {/* --- Endereço --- */}
              <TabsContent value="endereco" className="space-y-4 mt-0">
                <div>
                  <Label htmlFor="logradouro">Logradouro</Label>
                  <Input id="logradouro" {...form.register('logradouro')} placeholder="Rua, Avenida..." />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="numero">Número</Label>
                    <Input id="numero" {...form.register('numero')} />
                  </div>
                  <div className="col-span-2">
                    <Label htmlFor="complemento">Complemento</Label>
                    <Input id="complemento" {...form.register('complemento')} placeholder="Apto, Bloco..." />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="bairro">Bairro</Label>
                    <Input id="bairro" {...form.register('bairro')} />
                  </div>
                  <div>
                    <Label htmlFor="cidade">Cidade</Label>
                    <Input id="cidade" {...form.register('cidade')} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="estado">Estado</Label>
                    <Select
                      value={form.watch('estado') ?? ''}
                      onValueChange={(v) => form.setValue('estado', v, { shouldDirty: true })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="UF" />
                      </SelectTrigger>
                      <SelectContent>
                        {ESTADOS.map((uf) => (
                          <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="cep">CEP</Label>
                    <Input id="cep" {...form.register('cep')} placeholder="00000-000" />
                  </div>
                </div>
              </TabsContent>

              {/* --- Redes Sociais --- */}
              <TabsContent value="redes" className="space-y-4 mt-0">
                <div>
                  <Label htmlFor="instagram">Instagram</Label>
                  <Input id="instagram" {...form.register('instagram')} placeholder="@usuario" />
                </div>
                <div>
                  <Label htmlFor="twitter">Twitter / X</Label>
                  <Input id="twitter" {...form.register('twitter')} placeholder="@usuario" />
                </div>
                <div>
                  <Label htmlFor="tiktok">TikTok</Label>
                  <Input id="tiktok" {...form.register('tiktok')} placeholder="@usuario" />
                </div>
                <div>
                  <Label htmlFor="youtube">YouTube</Label>
                  <Input id="youtube" {...form.register('youtube')} placeholder="Canal ou URL" />
                </div>
              </TabsContent>

              {/* --- Político --- */}
              <TabsContent value="politico" className="space-y-4 mt-0">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="declarou_voto"
                    checked={form.watch('declarou_voto')}
                    onCheckedChange={(checked) => form.setValue('declarou_voto', !!checked, { shouldDirty: true })}
                  />
                  <Label htmlFor="declarou_voto" className="cursor-pointer">Declarou voto</Label>
                </div>

                <div>
                  <Label>Ranking: {form.watch('ranking')}</Label>
                  <Slider
                    min={0}
                    max={10}
                    step={1}
                    value={[form.watch('ranking') ?? 0]}
                    onValueChange={([v]) => form.setValue('ranking', v, { shouldDirty: true })}
                    className="mt-2"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>0</span>
                    <span>10</span>
                  </div>
                </div>

                <div>
                  <Label htmlFor="leader_id">Liderança vinculada</Label>
                  <Select
                    value={form.watch('leader_id') ?? ''}
                    onValueChange={(v) => form.setValue('leader_id', v || '', { shouldDirty: true })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma liderança" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhuma</SelectItem>
                      {leaders.map((l) => (
                        <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </TabsContent>

              {/* --- Observações --- */}
              <TabsContent value="obs" className="space-y-4 mt-0">
                <div>
                  <Label htmlFor="origem">Origem</Label>
                  <Input id="origem" {...form.register('origem')} placeholder="Ex: Indicação, Evento..." />
                </div>
                <div>
                  <Label htmlFor="observacoes">Observações</Label>
                  <Textarea
                    id="observacoes"
                    {...form.register('observacoes')}
                    placeholder="Observações gerais sobre o contato..."
                    rows={4}
                  />
                </div>
                <div>
                  <Label htmlFor="notas_assessor">Notas do Assessor</Label>
                  <Textarea
                    id="notas_assessor"
                    {...form.register('notas_assessor')}
                    placeholder="Notas internas da assessoria..."
                    rows={4}
                  />
                </div>
              </TabsContent>
            </Tabs>

            {/* Espaço para o botão não ficar colado */}
            <div className="h-4" />
          </ScrollArea>

          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t bg-background">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? 'Salvar' : 'Criar Contato'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
