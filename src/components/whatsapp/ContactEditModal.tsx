import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Pencil } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { contactSchema, type ContactFormData } from '@/lib/contactValidation';
import { useContact, useUpdateContact, useContactTags } from '@/hooks/useContacts';
import { CustomFieldsPanel } from '@/components/contacts/CustomFieldsPanel';

interface ContactEditModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string;
}

export function ContactEditModal({
  open,
  onOpenChange,
  contactId,
}: ContactEditModalProps) {
  const { data: contact, isLoading } = useContact(open ? contactId : undefined);
  const updateMutation = useUpdateContact();
  const { data: allTags = [] } = useContactTags();

  const form = useForm<ContactFormData>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      nome: '',
      nome_whatsapp: '',
      whatsapp: '',
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
      profissao: '',
      origem: '',
      observacoes: '',
      notas_assessor: '',
      em_canal_whatsapp: false,
      aceita_whatsapp: false,
      e_multiplicador: false,
      tag_ids: [],
    },
  });

  // Popula o form quando o modal abre e os dados chegam
  useEffect(() => {
    if (!open || !contact) return;
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
      ultimo_contato: contact.ultimo_contato ?? '',
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
      ranking_manual_override:
        (contact as { ranking_manual_override?: boolean }).ranking_manual_override ?? false,
      leader_id: contact.leader_id ?? '',
      profissao: (contact as { profissao?: string | null }).profissao ?? '',
      origem: contact.origem ?? '',
      observacoes: contact.observacoes ?? '',
      notas_assessor: (contact as { notas_assessor?: string | null }).notas_assessor ?? '',
      tag_ids: tagIds,
    });
  }, [open, contact, form]);

  const onSubmit = async (data: ContactFormData) => {
    try {
      await updateMutation.mutateAsync({ id: contactId, data });
      onOpenChange(false);
    } catch {
      // erro já exibido pelo onError do hook via toast
    }
  };

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
      <DialogContent className="max-w-lg w-[calc(100%-1rem)] max-h-[calc(100dvh-2rem)] p-0 gap-0 flex flex-col overflow-hidden">
        <DialogHeader className="px-5 py-4 border-b shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 grid place-items-center text-primary">
              <Pencil className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-sm">
                {contact ? `Editar: ${contact.nome}` : 'Editar contato'}
              </DialogTitle>
            </div>
          </div>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col flex-1 overflow-hidden"
          >
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* Nome */}
              <div>
                <Label htmlFor="em-nome">Nome *</Label>
                <Input
                  id="em-nome"
                  {...form.register('nome')}
                  placeholder="Nome completo"
                />
                {form.formState.errors.nome && (
                  <p className="text-xs text-destructive mt-1">
                    {form.formState.errors.nome.message}
                  </p>
                )}
              </div>

              {/* Telefones */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="em-whatsapp">WhatsApp</Label>
                  <Input
                    id="em-whatsapp"
                    {...form.register('whatsapp')}
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div>
                  <Label htmlFor="em-telefone">Telefone</Label>
                  <Input
                    id="em-telefone"
                    {...form.register('telefone')}
                    placeholder="(00) 0000-0000"
                  />
                </div>
              </div>

              {/* E-mail */}
              <div>
                <Label htmlFor="em-email">E-mail</Label>
                <Input
                  id="em-email"
                  type="email"
                  {...form.register('email')}
                  placeholder="email@exemplo.com"
                />
                {form.formState.errors.email && (
                  <p className="text-xs text-destructive mt-1">
                    {form.formState.errors.email.message}
                  </p>
                )}
              </div>

              {/* Profissão */}
              <div>
                <Label htmlFor="em-profissao">Profissão</Label>
                <Input
                  id="em-profissao"
                  {...form.register('profissao')}
                  placeholder="Ex: Professora, Comerciante..."
                />
              </div>

              {/* Origem */}
              <div>
                <Label htmlFor="em-origem">Origem</Label>
                <Input
                  id="em-origem"
                  {...form.register('origem')}
                  placeholder="Ex: Indicação, Evento..."
                />
              </div>

              {/* Observações */}
              <div>
                <Label htmlFor="em-obs">Observações</Label>
                <Textarea
                  id="em-obs"
                  {...form.register('observacoes')}
                  rows={3}
                  placeholder="Observações gerais..."
                />
              </div>

              {/* Etiquetas */}
              {allTags.length > 0 && (
                <div>
                  <Label className="mb-2 block">Etiquetas</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {allTags.map((tag) => {
                      const selected = selectedTagIds.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => toggleTag(tag.id)}
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors',
                            selected
                              ? 'border-primary/50 bg-primary/10 text-primary'
                              : 'border-border hover:border-muted-foreground/40',
                          )}
                          style={selected && tag.cor ? { color: tag.cor, borderColor: tag.cor + '55', background: tag.cor + '18' } : undefined}
                        >
                          {selected && (
                            <Checkbox
                              checked
                              className="h-3 w-3 pointer-events-none"
                            />
                          )}
                          {tag.nome}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Campos personalizados */}
              <div>
                <Label className="mb-2 block">Campos personalizados</Label>
                <CustomFieldsPanel contactId={contactId} />
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t bg-muted/30 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Salvar
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
