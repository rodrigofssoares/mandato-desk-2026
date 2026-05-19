import { useState, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  User,
  ExternalLink,
  UserPlus,
  Pencil,
  Loader2,
  Check,
  X,
  MapPin,
  Cake,
  CalendarPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useContact, useUpdateContact, useCreateContact } from '@/hooks/useContacts';
import { supabase } from '@/integrations/supabase/client';
import { phoneComparisonKey } from '@/lib/normalization';
import { formatPhone, isNonRealPhone } from '@/lib/zapi-format';
import { useZapiChats } from '@/hooks/useZapiChats';
import type { ContactFormData } from '@/lib/contactValidation';
import { ContactEditModal } from './ContactEditModal';
import { ContactFunnelSection } from './ContactFunnelSection';
import { ContactTasksSection } from './ContactTasksSection';
import { ChatNotesSection } from './ChatNotesSection';
import { ChatTagsSection } from './ChatTagsSection';
import { ContactOptinSection } from './ContactOptinSection';
import { DemandLinkSection } from './DemandLinkSection';
import { EventInviteDialog } from './EventInviteDialog';
import { AISummarySection } from './AISummarySection';
import { AIInsightsSection } from './AIInsightsSection';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useAccountFeatures } from '@/hooks/useAccountFeatures';
import { format, getMonth, getDate, differenceInDays, parseISO, addYears, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// ─── tipos ───────────────────────────────────────────────────────────────────

type ChatItem = NonNullable<ReturnType<typeof useZapiChats>['data']>[number];

export interface ContactPanelProps {
  chat: ChatItem;
  refetchChats: () => void;
}

// ─── helpers ─────────────────────────────────────────────────────────────────

async function findDuplicateByPhone(
  phone: string,
): Promise<{ id: string; nome: string } | null> {
  const key = phoneComparisonKey(phone);
  if (!key) return null;

  const { data, error } = await supabase
    .from('contacts')
    .select('id, nome, telefone, whatsapp')
    .is('merged_into', null)
    .or('telefone.not.is.null,whatsapp.not.is.null');

  if (error || !data) return null;

  for (const c of data) {
    const tk = phoneComparisonKey((c as { telefone?: string | null }).telefone ?? null);
    const wk = phoneComparisonKey((c as { whatsapp?: string | null }).whatsapp ?? null);
    if ((tk && tk === key) || (wk && wk === key)) {
      return { id: c.id, nome: (c as { nome: string }).nome };
    }
  }
  return null;
}

// ─── InlineField ─────────────────────────────────────────────────────────────

type InputType = 'text' | 'email' | 'tel' | 'textarea';

interface InlineFieldProps {
  label: string;
  value: string | null | undefined;
  onSave: (newValue: string) => Promise<void>;
  type?: InputType;
  placeholder?: string;
  disabled?: boolean;
}

function InlineField({
  label,
  value,
  onSave,
  type = 'text',
  placeholder = '',
  disabled = false,
}: InlineFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  const startEdit = () => {
    if (disabled) return;
    setDraft(value ?? '');
    setEditing(true);
    // foca no próximo tick para o elemento ser montado
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const cancel = () => {
    setEditing(false);
    setDraft('');
  };

  const commit = useCallback(async () => {
    const trimmed = draft.trim();
    const original = (value ?? '').trim();
    if (trimmed === original) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(trimmed);
      setEditing(false);
    } catch {
      // erro já mostrado pelo hook
    } finally {
      setSaving(false);
    }
  }, [draft, value, onSave]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && type !== 'textarea') {
      e.preventDefault();
      void commit();
    }
    if (e.key === 'Escape') cancel();
  };

  if (editing) {
    return (
      <div className="space-y-1">
        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        <div className="flex items-start gap-1">
          {type === 'textarea' ? (
            <Textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => void commit()}
              rows={3}
              className="text-xs resize-none flex-1"
              disabled={saving}
            />
          ) : (
            <Input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type={type}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={() => void commit()}
              className="text-xs h-7 flex-1"
              disabled={saving}
              placeholder={placeholder}
            />
          )}
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground mt-1 shrink-0" />
          ) : (
            <>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                onClick={() => void commit()}
              >
                <Check className="h-3.5 w-3.5 text-green-600" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                onClick={cancel}
              >
                <X className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="group space-y-0.5">
      <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={startEdit}
        className="flex items-center gap-1.5 w-full text-left text-xs hover:text-foreground transition-colors min-h-[24px]"
      >
        <span className="flex-1 break-all">
          {value ?? <span className="text-muted-foreground/60 italic">—</span>}
        </span>
        {!disabled && (
          <Pencil className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </button>
    </div>
  );
}

// ─── ContactPanel ─────────────────────────────────────────────────────────────

// ── Helpers de aniversário ───────────────────────────────────────────────────

function isBirthdayToday(dataNascimento: string): boolean {
  const today = new Date();
  const bday = parseISO(dataNascimento);
  return getMonth(bday) === getMonth(today) && getDate(bday) === getDate(today);
}

function daysUntilBirthday(dataNascimento: string): number {
  const today = startOfDay(new Date());
  const bday = parseISO(dataNascimento);
  let next = new Date(today.getFullYear(), getMonth(bday), getDate(bday));
  if (next < today) next = addYears(next, 1);
  return differenceInDays(next, today);
}

export function ContactPanel({ chat, refetchChats }: ContactPanelProps) {
  const navigate = useNavigate();
  const updateContact = useUpdateContact();
  const createContact = useCreateContact();
  const { user } = useAuth();
  const { can } = usePermissions();
  const canEditWpp = can.editWhatsapp();
  const { isEnabled: isFeatureEnabled, config: accountConfig } = useAccountFeatures(chat.account_id ?? null);

  // Quando chat.contact_id existe, buscamos o contato para ter dados atualizados
  const { data: contactData, isLoading: isContactLoading } = useContact(chat.contact_id ?? undefined);

  const [duplicado, setDuplicado] = useState<{ id: string; nome: string } | null>(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  // T71 (Fase 6 Onda B): dialog de convite a evento
  const [eventInviteOpen, setEventInviteOpen] = useState(false);

  // ── helper para salvar campo inline ───────────────────────────────────────
  const saveField = useCallback(
    async (field: keyof ContactFormData, newValue: string) => {
      if (!chat.contact_id || !contactData) return;

      // Monta o payload completo usando os dados atuais do contato
      const tagIds =
        contactData.contact_tags?.map((ct) => ct.tag_id) ?? [];

      const current: ContactFormData = {
        nome: contactData.nome ?? '',
        nome_whatsapp: contactData.nome_whatsapp ?? '',
        whatsapp: contactData.whatsapp ?? '',
        em_canal_whatsapp: contactData.em_canal_whatsapp ?? false,
        aceita_whatsapp: contactData.aceita_whatsapp ?? false,
        e_multiplicador: contactData.e_multiplicador ?? false,
        email: contactData.email ?? '',
        telefone: contactData.telefone ?? '',
        genero: (contactData.genero as ContactFormData['genero']) ?? null,
        data_nascimento: contactData.data_nascimento ?? '',
        ultimo_contato: contactData.ultimo_contato ?? '',
        logradouro: contactData.logradouro ?? '',
        numero: contactData.numero ?? '',
        complemento: contactData.complemento ?? '',
        bairro: contactData.bairro ?? '',
        cidade: contactData.cidade ?? '',
        estado: contactData.estado ?? '',
        cep: contactData.cep ?? '',
        instagram: contactData.instagram ?? '',
        twitter: contactData.twitter ?? '',
        tiktok: contactData.tiktok ?? '',
        youtube: contactData.youtube ?? '',
        declarou_voto: contactData.declarou_voto ?? false,
        ranking: contactData.ranking ?? null,
        ranking_manual_override:
          (contactData as { ranking_manual_override?: boolean }).ranking_manual_override ?? false,
        leader_id: contactData.leader_id ?? '',
        profissao: contactData.profissao ?? '',
        origem: contactData.origem ?? '',
        observacoes: contactData.observacoes ?? '',
        notas_assessor: (contactData as { notas_assessor?: string | null }).notas_assessor ?? '',
        tag_ids: tagIds,
      };

      const updated: ContactFormData = { ...current, [field]: newValue };

      await updateContact.mutateAsync({ id: chat.contact_id, data: updated });
    },
    [chat.contact_id, contactData, updateContact],
  );

  // ── Adicionar no CRM ──────────────────────────────────────────────────────
  async function handleAdicionarNoCRM() {
    setIsCheckingDuplicate(true);
    try {
      const dup = await findDuplicateByPhone(chat.phone);
      if (dup) {
        setDuplicado(dup);
        return;
      }
    } catch {
      toast.error('Não foi possível verificar duplicatas. Tente novamente.');
      return;
    } finally {
      setIsCheckingDuplicate(false);
    }

    createContact.mutate(
      {
        nome: chat.contact_name ?? chat.whatsapp_name ?? formatPhone(chat.phone),
        whatsapp: chat.phone,
        tag_ids: [],
      },
      {
        onSuccess: () => {
          refetchChats();
          // Não navega mais — o painel passa a ter contact_id e entra em modo editável
        },
      },
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  const display =
    contactData?.nome ??
    chat.contact_name ??
    chat.whatsapp_name ??
    null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b bg-muted/30 shrink-0 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">Detalhes do contato</p>
        {chat.contact_id && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1.5"
            onClick={() => setEditModalOpen(true)}
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar contato
          </Button>
        )}
      </div>

      <div className="p-4 space-y-4 flex-1 overflow-auto">
        {/* Avatar + nome */}
        <div className="flex flex-col items-center text-center">
          <div className="h-16 w-16 rounded-full bg-primary/15 flex items-center justify-center mb-2">
            <User className="h-7 w-7 text-primary" />
          </div>
          <p className="font-medium text-sm">
            {display ?? (
              <span className="italic text-muted-foreground">Sem cadastro</span>
            )}
          </p>
          {!isNonRealPhone(chat.phone) && (
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatPhone(chat.phone)}
            </p>
          )}
        </div>

        <Separator />

        {/* CTA: ver no CRM ou adicionar */}
        {chat.contact_id && isContactLoading ? (
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground py-1">
            <Loader2 className="h-4 w-4 animate-spin" />
            Carregando...
          </div>
        ) : chat.contact_id ? (
          <Button asChild variant="outline" size="sm" className="w-full">
            <Link to={`/contacts?contact=${chat.contact_id}`}>
              <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
              Ver no CRM
            </Link>
          </Button>
        ) : (
          <Button
            variant="default"
            size="sm"
            className="w-full"
            onClick={() => void handleAdicionarNoCRM()}
            disabled={isCheckingDuplicate || createContact.isPending}
          >
            <UserPlus className="h-3.5 w-3.5 mr-1.5" />
            {isCheckingDuplicate || createContact.isPending
              ? 'Adicionando...'
              : 'Adicionar no CRM'}
          </Button>
        )}

        <Separator />

        {/* Campos editáveis inline — só quando há contact_id */}
        {chat.contact_id && contactData ? (
          <div className="space-y-3">
            <InlineField
              label="Nome"
              value={contactData.nome}
              onSave={(v) => saveField('nome', v)}
              disabled={updateContact.isPending}
            />
            <InlineField
              label="Telefone"
              value={contactData.telefone}
              onSave={(v) => saveField('telefone', v)}
              type="tel"
              placeholder="(00) 0000-0000"
              disabled={updateContact.isPending}
            />
            <InlineField
              label="WhatsApp"
              value={contactData.whatsapp}
              onSave={(v) => saveField('whatsapp', v)}
              type="tel"
              placeholder="(00) 00000-0000"
              disabled={updateContact.isPending}
            />
            <InlineField
              label="E-mail"
              value={contactData.email}
              onSave={(v) => saveField('email', v)}
              type="email"
              placeholder="email@exemplo.com"
              disabled={updateContact.isPending}
            />
            <InlineField
              label="Profissão"
              value={contactData.profissao ?? null}
              onSave={(v) => saveField('profissao', v)}
              placeholder="Ex: Professor"
              disabled={updateContact.isPending}
            />
            <InlineField
              label="Origem"
              value={contactData.origem}
              onSave={(v) => saveField('origem', v)}
              placeholder="Ex: Indicação, Evento..."
              disabled={updateContact.isPending}
            />
            <InlineField
              label="Observações"
              value={contactData.observacoes}
              onSave={(v) => saveField('observacoes', v)}
              type="textarea"
              placeholder="Observações gerais..."
              disabled={updateContact.isPending}
            />
          </div>
        ) : (
          /* Somente-leitura quando sem contact_id */
          <div className="text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Não lidas</span>
              <span className="font-medium">{chat.unread_count}</span>
            </div>
            {chat.last_message_at && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Última atividade</span>
                <span className="font-medium">
                  {new Date(chat.last_message_at).toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            )}
          </div>
        )}

        {/* T09 — Funil */}
        {chat.contact_id && (
          <>
            <Separator />
            <ContactFunnelSection contactId={chat.contact_id} />
          </>
        )}

        {/* T10 + T11 — Tarefas */}
        {chat.contact_id && (
          <>
            <Separator />
            <ContactTasksSection contactId={chat.contact_id} />
          </>
        )}

        {/* T67 (Fase 6) — Bairro e zona eleitoral */}
        {chat.contact_id && contactData && (
          <>
            <Separator />
            <div className="space-y-3">
              <InlineField
                label="Bairro"
                value={contactData.bairro ?? null}
                onSave={(v) => saveField('bairro', v)}
                placeholder="Ex: Centro"
                disabled={updateContact.isPending}
              />
              <InlineField
                label="Zona eleitoral"
                value={contactData.zona_eleitoral ?? null}
                onSave={async (v) => {
                  if (!chat.contact_id) return;
                  const { error } = await supabase
                    .from('contacts')
                    .update({ zona_eleitoral: v || null })
                    .eq('id', chat.contact_id);
                  if (error) throw error;
                  toast.success('Salvo');
                }}
                placeholder="Ex: Zona 01"
                disabled={updateContact.isPending}
              />
              {contactData.bairro && (
                <button
                  type="button"
                  onClick={() => navigate(`/mapa?bairro=${encodeURIComponent(contactData.bairro!)}`)}
                  className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  Ver no mapa
                </button>
              )}
            </div>
          </>
        )}

        {/* T68 (Fase 6) — Aniversário */}
        {chat.contact_id && contactData?.data_nascimento && (() => {
          const daysLeft = daysUntilBirthday(contactData.data_nascimento);
          const isToday = isBirthdayToday(contactData.data_nascimento);
          const isSoon = daysLeft <= 7;
          if (!isSoon && !isToday) return null;
          const bday = parseISO(contactData.data_nascimento);

          return (
            <>
              <Separator />
              <div className="space-y-2">
                <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                  Aniversário
                </p>
                <div className="rounded-lg border bg-muted/20 px-3 py-2.5 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Cake className="h-3.5 w-3.5 text-pink-500 shrink-0" />
                    <span className="text-xs">
                      {format(bday, "dd 'de' MMMM", { locale: ptBR })}
                      {isToday ? (
                        <span className="ml-1.5 font-semibold text-pink-600">— Hoje!</span>
                      ) : (
                        <span className="ml-1.5 text-muted-foreground">
                          — em {daysLeft} dia{daysLeft !== 1 ? 's' : ''}
                        </span>
                      )}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="w-full text-xs bg-pink-50 hover:bg-pink-100 text-pink-700 border border-pink-200 rounded-md px-2 py-1.5 flex items-center justify-center gap-1.5 transition-colors"
                    onClick={() => {
                      const msg = `Parabéns, ${contactData.nome ?? 'eleitor'}! O gabinete deseja um feliz aniversário! 🎂`;
                      // Dispara evento customizado para pré-preencher o composer
                      window.dispatchEvent(new CustomEvent('whatsapp:prefill-message', {
                        detail: { chatId: chat.id, message: msg },
                      }));
                    }}
                  >
                    <Cake className="h-3.5 w-3.5 shrink-0" />
                    Enviar parabéns
                  </button>
                </div>
              </div>
            </>
          );
        })()}

        {/* T71 (Fase 6 Onda B) — Convite a evento (C20) */}
        {chat.contact_id && contactData && isFeatureEnabled('c20') && (
          <>
            <Separator />
            <div className="space-y-2">
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                Eventos
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-1.5"
                onClick={() => setEventInviteOpen(true)}
              >
                <CalendarPlus className="h-3.5 w-3.5" />
                Convidar para evento
              </Button>
            </div>
          </>
        )}

        {/* T62 (Fase 6) — Demanda vinculada */}
        {chat.contact_id && isFeatureEnabled('c18') && (
          <>
            <Separator />
            <DemandLinkSection
              chatId={chat.id}
              accountId={chat.account_id ?? null}
              contactId={chat.contact_id}
              demandId={chat.demand_id ?? null}
            />
          </>
        )}

        {/* T80 (Fase 7 Onda A) — Análise de IA: resumo + assunto + sentimento (C33/C35/C36) */}
        {(isFeatureEnabled('c33') || isFeatureEnabled('c35') || isFeatureEnabled('c36')) && (
          <>
            <Separator />
            <AISummarySection
              chat={chat}
              config={accountConfig}
            />
          </>
        )}

        {/* T86 (Fase 7 Onda A) — Próxima ação sugerida por IA (C37) */}
        {chat.contact_id && chat.account_id && isFeatureEnabled('c37') && (
          <>
            <Separator />
            <AIInsightsSection
              contactId={chat.contact_id}
              accountId={chat.account_id}
              config={accountConfig}
              aiNextAction={(contactData as (typeof contactData & { ai_next_action?: string | null }) | undefined)?.ai_next_action ?? null}
              aiNextActionAt={(contactData as (typeof contactData & { ai_next_action_at?: string | null }) | undefined)?.ai_next_action_at ?? null}
            />
          </>
        )}

        {/* T59 (Fase 6) — Consentimento LGPD */}
        {chat.contact_id && contactData && (
          <>
            <Separator />
            <ContactOptinSection
              contactId={chat.contact_id}
              optinWhatsapp={contactData.optin_whatsapp ?? false}
              optinData={contactData.optin_data ?? null}
              optinOrigem={contactData.optin_origem ?? null}
            />
          </>
        )}

        {/* T45 — Etiquetas da conversa */}
        <Separator />
        <ChatTagsSection chatId={chat.id} canEdit={canEditWpp} />

        {/* T23 — Notas internas */}
        <Separator />
        <ChatNotesSection chatId={chat.id} currentUserId={user?.id ?? null} />
      </div>

      {/* Modal de edição completa (T08) */}
      {chat.contact_id && (
        <ContactEditModal
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          contactId={chat.contact_id}
        />
      )}

      {/* T71 (Fase 6 Onda B): dialog de convite a evento (C20) */}
      {chat.contact_id && chat.account_id && (
        <EventInviteDialog
          open={eventInviteOpen}
          onOpenChange={setEventInviteOpen}
          accountId={chat.account_id}
          contactId={chat.contact_id}
          contactName={contactData?.nome ?? chat.contact_name ?? chat.whatsapp_name ?? ''}
          phone={chat.phone}
        />
      )}

      {/* Alerta de duplicata */}
      <AlertDialog open={!!duplicado} onOpenChange={(open) => !open && setDuplicado(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Contato já cadastrado</AlertDialogTitle>
            <AlertDialogDescription>
              Já existe um contato com este número:{' '}
              <strong>{duplicado?.nome ?? 'desconhecido'}</strong>. Deseja abrir o
              contato existente?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDuplicado(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (duplicado) {
                  navigate(`/contacts?contact=${duplicado.id}`);
                  setDuplicado(null);
                }
              }}
            >
              Abrir existente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
