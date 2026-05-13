import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import {
  Loader2,
  User,
  UserPlus,
  CheckSquare,
  Tag,
  Clock,
  Wand2,
  KanbanSquare,
  Megaphone,
  MapPin,
  Globe2,
  FileText,
} from 'lucide-react';
import { CampaignFieldsList } from '@/components/contacts/CampaignFieldsList';
import { RankingBadge } from '@/components/contacts/RankingBadge';
import { useCampaignFields } from '@/hooks/useCampaignFields';
import { CustomFieldsPanel } from '@/components/contacts/CustomFieldsPanel';
import {
  ContactTarefasPanel,
  ContactTarefasPendenteBadge,
} from '@/components/contacts/ContactTarefasPanel';
import { ContactBoardsPanel } from '@/components/contacts/ContactBoardsPanel';
import { useSetContactCampaignValues, useContactCampaignValues } from '@/hooks/useCampaignFields';
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

// Form em branco — usado tanto na inicializacao quanto no reset ao abrir em
// modo "criar". Importante: no RHF, `form.reset({...x})` substitui os
// defaultValues internos por x, entao `form.reset()` sem args volta pra x —
// e nao pros valores vazios. Por isso passamos este objeto explicitamente
// no reset do modo "criar", garantindo limpeza real entre aberturas.
const EMPTY_CONTACT_FORM: ContactFormData = {
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
  ranking: null,
  ranking_manual_override: false,
  leader_id: '',
  origem: '',
  observacoes: '',
  notas_assessor: '',
  tag_ids: [],
};

// Iniciais p/ o avatar do header (até 2 letras).
function getInitials(name: string | null | undefined): string {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '??';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || (first.toUpperCase() || '?');
}

// Estilo unificado dos itens da sidebar vertical de tabs.
const VTAB_CLASS = cn(
  'justify-start gap-2.5 px-3 py-2 h-auto min-h-9 w-full rounded-lg',
  'text-sm font-medium text-muted-foreground whitespace-nowrap',
  'data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm data-[state=active]:font-semibold',
  'hover:text-foreground hover:bg-background/60 transition-colors',
  'shrink-0 sm:shrink',
);

export function ContactDialog({ open, onOpenChange, contact }: ContactDialogProps) {
  const isEditing = !!contact;
  const createMutation = useCreateContact();
  const updateMutation = useUpdateContact();
  const setCampaignValues = useSetContactCampaignValues();
  const { data: allTags = [] } = useContactTags();
  const { data: leaders = [] } = useLeaders();
  const { data: campaignFields = [] } = useCampaignFields();
  // Em modo edição, busca os valores do banco para o preview do ranking
  const { data: dbCampaignValues = {} } = useContactCampaignValues(contact?.id);

  // Valores pendentes dos campos de campanha (apenas em modo criação)
  const [pendingCampaignValues, setPendingCampaignValues] = useState<Record<string, boolean>>({});

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: EMPTY_CONTACT_FORM,
  });

  useEffect(() => {
    // Só (re)popula o form quando o dialog abre. Sem isso, o estado do form
    // persiste entre aberturas (RHF mantém valores até reset explícito) e o
    // último contato preenchido/visualizado vaza pra abertura seguinte.
    if (!open) return;
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
        ranking: contact.ranking ?? null,
        ranking_manual_override: (contact as { ranking_manual_override?: boolean }).ranking_manual_override ?? false,
        leader_id: contact.leader_id ?? '',
        origem: contact.origem ?? '',
        observacoes: contact.observacoes ?? '',
        notas_assessor: contact.notas_assessor ?? '',
        tag_ids: tagIds,
      });
    } else {
      // Passa EMPTY_CONTACT_FORM explicitamente: reset() sem args voltaria
      // pros ultimos defaultValues internos (que viraram os do contato editado
      // apos um reset com valores anterior) — exatamente o bug deste fix.
      form.reset(EMPTY_CONTACT_FORM);
    }
  }, [open, contact, form]);

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

  // Campos observados para o preview otimista do ranking. Usamos watch por
  // nome (não por array posicional) pra evitar mapeamento frágil — adicionar
  // um campo no meio do array deslocava o índice silenciosamente.
  const rankingPreview = {
    declarou_voto:     form.watch('declarou_voto') ?? false,
    e_multiplicador:   form.watch('e_multiplicador') ?? false,
    aceita_whatsapp:   form.watch('aceita_whatsapp') ?? false,
    em_canal_whatsapp: form.watch('em_canal_whatsapp') ?? false,
    whatsapp:          form.watch('whatsapp') ?? null,
    leader_id:         form.watch('leader_id') ?? null,
    email:             form.watch('email') ?? null,
    data_nascimento:   form.watch('data_nascimento') ?? null,
    telefone:          form.watch('telefone') ?? null,
    bairro:            form.watch('bairro') ?? null,
    cidade:            form.watch('cidade') ?? null,
    cep:               form.watch('cep') ?? null,
    estado:            form.watch('estado') ?? null,
    logradouro:        form.watch('logradouro') ?? null,
    instagram:         form.watch('instagram') ?? null,
    twitter:           form.watch('twitter') ?? null,
    tiktok:            form.watch('tiktok') ?? null,
    youtube:           form.watch('youtube') ?? null,
  };

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
      <DialogContent className="max-w-4xl w-[calc(100%-1rem)] max-h-[calc(100dvh-1rem)] p-0 gap-0 flex flex-col overflow-hidden bg-card">
        {/* Header — avatar + nome (editar) ou ícone + título (novo) */}
        <DialogHeader className="px-5 py-4 border-b border-border space-y-0">
          <div className="flex items-start gap-3">
            {isEditing && contact ? (
              <>
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary/70 grid place-items-center text-primary-foreground font-semibold text-sm shrink-0">
                  {getInitials(contact.nome)}
                </div>
                <div className="flex-1 min-w-0">
                  <DialogTitle className="text-base leading-tight truncate">{contact.nome || 'Editar Contato'}</DialogTitle>
                  <p className="text-xs text-muted-foreground mt-1 truncate">
                    Editar contato
                    {contact.updated_at && (
                      <> · Atualizado {format(new Date(contact.updated_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</>
                    )}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="w-11 h-11 rounded-xl bg-primary/10 grid place-items-center text-primary shrink-0">
                  <UserPlus className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <DialogTitle className="text-base leading-tight">Novo Contato</DialogTitle>
                  <p className="text-xs text-muted-foreground mt-1">Preencha os dados básicos pra começar</p>
                </div>
              </>
            )}
          </div>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit, (errors) => {
          // Sem este handler, falhas de validacao de campos sem <FormMessage>
          // visivel (whatsapp, telefone, cep, ranking, leader_id, tag_ids etc.)
          // bloqueiam o submit em silencio. Loga + toasta pra dar feedback.
          console.error('[ContactDialog] form invalid:', errors);
          const fields = Object.keys(errors).join(', ');
          toast.error(`Campos invalidos: ${fields}. Veja o console pra detalhes.`);
        })} className="flex flex-col flex-1 overflow-hidden">
          <Tabs defaultValue="pessoais" orientation="vertical" className="flex flex-col sm:flex-row flex-1 overflow-hidden">

            {/* Sidebar vertical (≥sm) ou linha horizontal com scroll (mobile) */}
            <TabsList className="h-auto sm:w-52 shrink-0 flex flex-row sm:flex-col gap-0.5 p-2 sm:p-3 bg-muted/40 border-b sm:border-b-0 sm:border-r border-border justify-start items-stretch rounded-none overflow-x-auto sm:overflow-visible">
              <TabsTrigger value="pessoais" className={VTAB_CLASS}>
                <User className="h-4 w-4 shrink-0" />
                <span>Pessoais</span>
              </TabsTrigger>
              <TabsTrigger value="personalizados" className={VTAB_CLASS}>
                <Wand2 className="h-4 w-4 shrink-0" />
                <span>Personalizados</span>
              </TabsTrigger>
              <TabsTrigger value="tarefas" className={VTAB_CLASS}>
                <CheckSquare className="h-4 w-4 shrink-0" />
                <span>Tarefas</span>
                {contact?.id && <ContactTarefasPendenteBadge contactId={contact.id} />}
              </TabsTrigger>
              <TabsTrigger value="boards" className={VTAB_CLASS}>
                <KanbanSquare className="h-4 w-4 shrink-0" />
                <span>Funis</span>
              </TabsTrigger>
              <TabsTrigger value="campanha" className={VTAB_CLASS}>
                <Megaphone className="h-4 w-4 shrink-0" />
                <span>Campanha</span>
              </TabsTrigger>
              <TabsTrigger value="etiquetas" className={VTAB_CLASS}>
                <Tag className="h-4 w-4 shrink-0" />
                <span>Etiquetas</span>
              </TabsTrigger>
              <TabsTrigger value="endereco" className={VTAB_CLASS}>
                <MapPin className="h-4 w-4 shrink-0" />
                <span>Endereço</span>
              </TabsTrigger>
              <TabsTrigger value="redes" className={VTAB_CLASS}>
                <Globe2 className="h-4 w-4 shrink-0" />
                <span>Redes</span>
              </TabsTrigger>
              <TabsTrigger value="obs" className={VTAB_CLASS}>
                <FileText className="h-4 w-4 shrink-0" />
                <span>Observações</span>
              </TabsTrigger>
            </TabsList>

            {/* Coluna de conteúdo, com scroll vertical interno */}
            <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">

              {/* --- Dados Pessoais --- */}
              <TabsContent value="pessoais" className="space-y-4 mt-0 outline-none">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
                    <User className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dados Básicos</span>
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

                {/* Auditoria (apenas edição) */}
                {isEditing && contact?.updated_at && (
                  <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-center gap-2 text-xs text-muted-foreground mt-4">
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

              {/* --- Personalizados --- */}
              <TabsContent value="personalizados" className="space-y-4 mt-0 outline-none">
                <CustomFieldsPanel contactId={contact?.id} />
              </TabsContent>

              {/* --- Tarefas --- */}
              <TabsContent value="tarefas" className="space-y-4 mt-0 outline-none">
                <ContactTarefasPanel contactId={contact?.id} />
              </TabsContent>

              {/* --- Funis --- */}
              <TabsContent value="boards" className="space-y-4 mt-0 outline-none">
                <ContactBoardsPanel contactId={contact?.id} />
              </TabsContent>

              {/* --- Campanha --- */}
              <TabsContent value="campanha" className="space-y-4 mt-0 outline-none">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
                    <CheckSquare className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status e Classificação</span>
                </div>

                {/* Checkboxes lado a lado */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <label
                    htmlFor="aceita_whatsapp"
                    className={cn(
                      'flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors',
                      form.watch('aceita_whatsapp')
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-border hover:border-muted-foreground/30',
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
                      'flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors',
                      form.watch('em_canal_whatsapp')
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-border hover:border-muted-foreground/30',
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
                      'flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors',
                      form.watch('declarou_voto')
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-border hover:border-muted-foreground/30',
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
                      'flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors',
                      form.watch('e_multiplicador')
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-border hover:border-muted-foreground/30',
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

                {/* Ranking */}
                <div>
                  <RankingBadge
                    contact={rankingPreview}
                    campaignValues={isEditing ? dbCampaignValues : pendingCampaignValues}
                    totalCampaignFields={campaignFields.length}
                    manualValue={form.watch('ranking')}
                    manualOverride={form.watch('ranking_manual_override') ?? false}
                    onSelectManual={(value) => {
                      form.setValue('ranking', value, { shouldDirty: true });
                      form.setValue('ranking_manual_override', true, { shouldDirty: true });
                    }}
                    onClearOverride={() => {
                      form.setValue('ranking_manual_override', false, { shouldDirty: true });
                      form.setValue('ranking', null, { shouldDirty: true });
                    }}
                  />
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

                {/* Campos customizados de campanha */}
                <CampaignFieldsList
                  contactId={contact?.id}
                  pendingValues={pendingCampaignValues}
                  onPendingChange={setPendingCampaignValues}
                />
              </TabsContent>

              {/* --- Etiquetas --- */}
              <TabsContent value="etiquetas" className="space-y-3 mt-0 outline-none">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center">
                    <Tag className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Etiquetas</span>
                </div>
                {allTags.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhuma etiqueta cadastrada</p>
                )}
                <div className="grid grid-cols-2 gap-2">
                  {allTags.map((tag) => (
                    <label
                      key={tag.id}
                      className={cn(
                        'flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors',
                        selectedTagIds.includes(tag.id)
                          ? 'border-primary/50 bg-primary/5'
                          : 'border-border hover:border-muted-foreground/30',
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
              </TabsContent>

              {/* --- Endereço --- */}
              <TabsContent value="endereco" className="space-y-4 mt-0 outline-none">
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
              <TabsContent value="redes" className="space-y-4 mt-0 outline-none">
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

              {/* --- Observações --- */}
              <TabsContent value="obs" className="space-y-4 mt-0 outline-none">
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
            </div>
          </Tabs>

          {/* Footer fixo */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3 px-5 py-3 border-t border-border bg-muted/30">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting} className="w-full sm:w-auto">
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? 'Salvar alterações' : 'Criar Contato'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
