import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, User, CheckSquare, Tag, Clock } from 'lucide-react';
import { CampaignFieldsList } from '@/components/contacts/CampaignFieldsList';
import { CustomFieldsPanel } from '@/components/contacts/CustomFieldsPanel';
import { useSetContactCampaignValues } from '@/hooks/useCampaignFields';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
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

const RANKING_VALUES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function ContactDialog({ open, onOpenChange, contact }: ContactDialogProps) {
  const isEditing = !!contact;
  const createMutation = useCreateContact();
  const updateMutation = useUpdateContact();
  const setCampaignValues = useSetContactCampaignValues();
  const { data: allTags = [] } = useContactTags();
  const { data: leaders = [] } = useLeaders();

  // Valores pendentes dos campos de campanha (apenas em modo criação)
  const [pendingCampaignValues, setPendingCampaignValues] = useState<Record<string, boolean>>({});

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      nome: '',
      nome_whatsapp: '',
      whatsapp: '',
      em_canal_whatsapp: false,
      aceita_whatsapp: false,
      e_multiplicador: false,
      email: '',
      telefone: '',
      genero: null,
      data_nascimento: '',
      ultimo_contato: '',
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
    // Reset dos valores pendentes ao abrir/fechar ou trocar de contato
    setPendingCampaignValues({});
    if (contact) {
      const tagIds = contact.contact_tags?.map((ct) => ct.tag_id) ?? [];
      form.reset({
        nome: contact.nome ?? '',
        nome_whatsapp: contact.nome_whatsapp ?? '',
        whatsapp: contact.whatsapp ?? '',
        em_canal_whatsapp: contact.em_canal_whatsapp ?? false,
        aceita_whatsapp: contact.aceita_whatsapp ?? false,
        e_multiplicador: contact.e_multiplicador ?? false,
        email: contact.email ?? '',
        telefone: contact.telefone ?? '',
        genero: (contact.genero as ContactFormData['genero']) ?? null,
        data_nascimento: contact.data_nascimento ?? '',
        ultimo_contato: contact.ultimo_contato
          ? format(new Date(contact.ultimo_contato), "yyyy-MM-dd'T'HH:mm")
          : '',
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
    // Converte "yyyy-MM-ddTHH:mm" (datetime-local) para ISO UTC antes de enviar
    const payload: ContactFormData = {
      ...data,
      ultimo_contato: data.ultimo_contato
        ? new Date(data.ultimo_contato).toISOString()
        : '',
    };

    if (isEditing && contact) {
      await updateMutation.mutateAsync({ id: contact.id, data: payload });
    } else {
      const created = await createMutation.mutateAsync(payload);
      // Grava os campos de campanha marcados durante a criação
      if (created?.id && Object.values(pendingCampaignValues).some(Boolean)) {
        await setCampaignValues.mutateAsync({
          contactId: created.id,
          values: pendingCampaignValues,
        });
      }
    }
    onOpenChange(false);
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const selectedTagIds = form.watch('tag_ids') ?? [];
  const currentRanking = form.watch('ranking') ?? 0;

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
      <DialogContent className="max-w-2xl w-[calc(100%-1rem)] max-h-[calc(100dvh-1rem)] p-0 gap-0 flex flex-col">
        <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-6 pb-2">
          <DialogTitle>{isEditing ? 'Editar Contato' : 'Novo Contato'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 overflow-hidden">
          <div className="flex-1 overflow-y-auto px-4 sm:px-6">
            <Tabs defaultValue="pessoais" className="w-full">
              <TabsList className="w-full mb-4 h-auto flex-wrap gap-1 p-1">
                <TabsTrigger value="pessoais" className="flex-1 min-w-[72px] text-xs">Pessoais</TabsTrigger>
                <TabsTrigger value="personalizados" className="flex-1 min-w-[72px] text-xs">Personalizados</TabsTrigger>
                <TabsTrigger value="campanha" className="flex-1 min-w-[72px] text-xs">Campanha</TabsTrigger>
                <TabsTrigger value="etiquetas" className="flex-1 min-w-[72px] text-xs">Etiquetas</TabsTrigger>
                <TabsTrigger value="endereco" className="flex-1 min-w-[72px] text-xs">Endereço</TabsTrigger>
                <TabsTrigger value="redes" className="flex-1 min-w-[72px] text-xs">Redes</TabsTrigger>
                <TabsTrigger value="obs" className="flex-1 min-w-[72px] text-xs">Obs</TabsTrigger>
              </TabsList>

              {/* --- Dados Pessoais --- */}
              <TabsContent value="pessoais" className="space-y-4 mt-0">

                {/* Card: Dados Básicos */}
                <div className="rounded-lg border bg-card p-4 space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 rounded-md bg-blue-500/10 flex items-center justify-center">
                      <User className="h-3.5 w-3.5 text-blue-400" />
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground">Dados Básicos</span>
                  </div>

                  <div>
                    <Label htmlFor="nome">Nome *</Label>
                    <Input id="nome" {...form.register('nome')} placeholder="Nome completo" />
                    {form.formState.errors.nome && (
                      <p className="text-xs text-destructive mt-1">{form.formState.errors.nome.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="nome_whatsapp">Nome no WhatsApp</Label>
                    <Input id="nome_whatsapp" {...form.register('nome_whatsapp')} placeholder="Nome exibido no WhatsApp" />
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
                      <Label htmlFor="data_nascimento">Data de Nascimento</Label>
                      <Input id="data_nascimento" type="date" {...form.register('data_nascimento')} />
                    </div>
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
                  </div>

                  <div>
                    <Label htmlFor="ultimo_contato">Último Contato</Label>
                    <Input
                      id="ultimo_contato"
                      type="datetime-local"
                      {...form.register('ultimo_contato')}
                    />
                  </div>
                </div>

                {/* Card: Auditoria (apenas edição) */}
                {isEditing && contact?.updated_at && (
                  <div className="rounded-lg border bg-muted/30 p-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      Última atualização em{' '}
                      <strong className="text-foreground">
                        {format(new Date(contact.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                      </strong>
                      {' '}por{' '}
                      <strong className="text-foreground">
                        {contact.atualizado_por ?? 'Automação'}
                      </strong>
                    </span>
                  </div>
                )}

              </TabsContent>

              {/* --- Personalizados (campos custom configurados em Settings) --- */}
              <TabsContent value="personalizados" className="space-y-4 mt-0">
                <CustomFieldsPanel contactId={contact?.id} />
              </TabsContent>

              {/* --- Campanha --- */}
              <TabsContent value="campanha" className="space-y-4 mt-0">

                {/* Card: Status e Classificação */}
                <div className="rounded-lg border bg-card p-4 space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 rounded-md bg-green-500/10 flex items-center justify-center">
                      <CheckSquare className="h-3.5 w-3.5 text-green-400" />
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground">Status e Classificação</span>
                  </div>

                  {/* Checkboxes lado a lado */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <label
                      htmlFor="aceita_whatsapp"
                      className={cn(
                        "flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors",
                        form.watch('aceita_whatsapp')
                          ? "border-green-500/50 bg-green-500/5"
                          : "border-border hover:border-muted-foreground/30"
                      )}
                    >
                      <Checkbox
                        id="aceita_whatsapp"
                        checked={form.watch('aceita_whatsapp')}
                        onCheckedChange={(checked) => form.setValue('aceita_whatsapp', !!checked, { shouldDirty: true })}
                      />
                      <span className="text-xs leading-tight break-words">Aceita WhatsApp</span>
                    </label>

                    <label
                      htmlFor="em_canal_whatsapp"
                      className={cn(
                        "flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors",
                        form.watch('em_canal_whatsapp')
                          ? "border-green-500/50 bg-green-500/5"
                          : "border-border hover:border-muted-foreground/30"
                      )}
                    >
                      <Checkbox
                        id="em_canal_whatsapp"
                        checked={form.watch('em_canal_whatsapp')}
                        onCheckedChange={(checked) => form.setValue('em_canal_whatsapp', !!checked, { shouldDirty: true })}
                      />
                      <span className="text-xs leading-tight break-words">Canal do WhatsApp</span>
                    </label>

                    <label
                      htmlFor="declarou_voto"
                      className={cn(
                        "flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors",
                        form.watch('declarou_voto')
                          ? "border-green-500/50 bg-green-500/5"
                          : "border-border hover:border-muted-foreground/30"
                      )}
                    >
                      <Checkbox
                        id="declarou_voto"
                        checked={form.watch('declarou_voto')}
                        onCheckedChange={(checked) => form.setValue('declarou_voto', !!checked, { shouldDirty: true })}
                      />
                      <span className="text-xs leading-tight break-words">Declarou voto</span>
                    </label>

                    <label
                      htmlFor="e_multiplicador"
                      className={cn(
                        "flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors",
                        form.watch('e_multiplicador')
                          ? "border-green-500/50 bg-green-500/5"
                          : "border-border hover:border-muted-foreground/30"
                      )}
                    >
                      <Checkbox
                        id="e_multiplicador"
                        checked={form.watch('e_multiplicador')}
                        onCheckedChange={(checked) => form.setValue('e_multiplicador', !!checked, { shouldDirty: true })}
                      />
                      <span className="text-xs leading-tight break-words">Multiplicador</span>
                    </label>
                  </div>

                  {/* Ranking com botões */}
                  <div>
                    <Label>Ranking</Label>
                    <div className="grid grid-cols-6 sm:grid-cols-11 gap-1.5 mt-2">
                      {RANKING_VALUES.map((val) => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => form.setValue('ranking', val, { shouldDirty: true })}
                          className={cn(
                            "h-9 w-full rounded-md text-xs font-semibold border transition-colors",
                            currentRanking === val
                              ? "bg-primary text-primary-foreground border-primary"
                              : "bg-background border-border text-muted-foreground hover:border-muted-foreground/50 hover:text-foreground"
                          )}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Articulador vinculado */}
                  <div>
                    <Label htmlFor="leader_id">Articulador vinculado</Label>
                    <Select
                      value={form.watch('leader_id') || '__none__'}
                      onValueChange={(v) => form.setValue('leader_id', v === '__none__' ? '' : v, { shouldDirty: true })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione uma liderança" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Nenhuma</SelectItem>
                        {leaders.map((l) => (
                          <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Campos customizados de campanha */}
                <CampaignFieldsList
                  contactId={contact?.id}
                  pendingValues={pendingCampaignValues}
                  onPendingChange={setPendingCampaignValues}
                />

              </TabsContent>

              {/* --- Etiquetas --- */}
              <TabsContent value="etiquetas" className="space-y-4 mt-0">
                <div className="rounded-lg border bg-card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 rounded-md bg-orange-500/10 flex items-center justify-center">
                      <Tag className="h-3.5 w-3.5 text-orange-400" />
                    </div>
                    <span className="text-xs font-semibold text-muted-foreground">Etiquetas</span>
                  </div>
                  {allTags.length === 0 && (
                    <p className="text-xs text-muted-foreground">Nenhuma etiqueta cadastrada</p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    {allTags.map((tag) => (
                      <label
                        key={tag.id}
                        className={cn(
                          "flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors",
                          selectedTagIds.includes(tag.id)
                            ? "border-green-500/50 bg-green-500/5"
                            : "border-border hover:border-muted-foreground/30"
                        )}
                      >
                        <Checkbox
                          checked={selectedTagIds.includes(tag.id)}
                          onCheckedChange={() => toggleTag(tag.id)}
                        />
                        <span
                          className="text-xs truncate"
                          style={tag.cor ? { color: tag.cor } : undefined}
                        >
                          {tag.nome}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </TabsContent>

              {/* --- Endereço --- */}
              <TabsContent value="endereco" className="space-y-4 mt-0">
                <div className="rounded-lg border bg-card p-4 space-y-4">
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
                </div>
              </TabsContent>

              {/* --- Redes Sociais --- */}
              <TabsContent value="redes" className="space-y-4 mt-0">
                <div className="rounded-lg border bg-card p-4 space-y-4">
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
                </div>
              </TabsContent>

              {/* --- Observações --- */}
              <TabsContent value="obs" className="space-y-4 mt-0">
                <div className="rounded-lg border bg-card p-4 space-y-4">
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
                </div>
              </TabsContent>
            </Tabs>

            {/* Espaço para o botão não ficar colado */}
            <div className="h-4" />
          </div>

          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3 px-4 sm:px-6 py-4 border-t bg-background">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? 'Salvar' : 'Criar Contato'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
