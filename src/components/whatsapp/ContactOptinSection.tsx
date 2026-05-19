// ContactOptinSection.tsx
// Seção "Consentimento LGPD" exibida no ContactPanel (T59 / Fase 6 Onda A).
// Permite registrar/revogar o consentimento do eleitor para receber mensagens
// WhatsApp em massa (opt-in para broadcast C17).

import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ShieldCheck, ShieldOff, Loader2 } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ContactOptinSectionProps {
  contactId: string;
  optinWhatsapp: boolean;
  optinData: string | null;
  optinOrigem: string | null;
}

const ORIGEM_LABELS: Record<string, string> = {
  manual:     'Registrado manualmente',
  formulario: 'Via formulário',
  mensagem:   'Via mensagem',
};

export function ContactOptinSection({
  contactId,
  optinWhatsapp,
  optinData,
  optinOrigem,
}: ContactOptinSectionProps) {
  // Estado local para rollback otimista
  const [localOptin, setLocalOptin] = useState(optinWhatsapp);
  const [isPending, setIsPending] = useState(false);
  const queryClient = useQueryClient();

  const handleToggle = async (checked: boolean) => {
    // Otimista: atualiza UI imediatamente
    setLocalOptin(checked);
    setIsPending(true);

    try {
      // CRÍTICA-1: usa RPC SECURITY DEFINER em vez de UPDATE direto.
      // O trigger trg_contacts_bloquear_optin bloqueia qualquer UPDATE direto
      // nessas colunas — apenas registrar_optin_whatsapp() é autorizado.
      const { error: rpcErr } = await supabase.rpc('registrar_optin_whatsapp', {
        p_contact_id: contactId,
        p_valor: checked,
        p_origem: 'manual',
      });

      if (rpcErr) throw rpcErr;

      // Invalida queries do contato para que optin_data apareça atualizado
      // sem precisar de refresh manual (a RPC atualiza optin_data no banco).
      await queryClient.invalidateQueries({ queryKey: ['contact', contactId] });
      await queryClient.invalidateQueries({ queryKey: ['contacts'] });

      toast.success('Consentimento atualizado');
    } catch (err) {
      // Rollback otimista em caso de erro
      setLocalOptin(!checked);
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error(`Erro ao atualizar consentimento: ${msg}`);
    } finally {
      setIsPending(false);
    }
  };

  const originLabel = optinOrigem ? (ORIGEM_LABELS[optinOrigem] ?? optinOrigem) : null;

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
        Consentimento LGPD
      </p>

      <div className="rounded-lg border bg-muted/20 px-3 py-2.5 space-y-2">
        {/* Toggle de opt-in */}
        <div className="flex items-center justify-between gap-2">
          <Label
            htmlFor={`optin-${contactId}`}
            className="text-xs font-medium cursor-pointer flex items-center gap-1.5"
          >
            {localOptin ? (
              <ShieldCheck className="h-3.5 w-3.5 text-green-600 shrink-0" />
            ) : (
              <ShieldOff className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            )}
            Autoriza mensagens em massa
          </Label>
          <div className="flex items-center gap-2">
            {isPending && (
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            )}
            <Switch
              id={`optin-${contactId}`}
              checked={localOptin}
              onCheckedChange={(checked) => void handleToggle(checked)}
              disabled={isPending}
              aria-label="Consentimento WhatsApp"
            />
          </div>
        </div>

        {/* Status atual */}
        {localOptin ? (
          <div className="space-y-1">
            <Badge
              variant="secondary"
              className="text-[10px] bg-green-100 text-green-700 border-green-200 hover:bg-green-100"
            >
              Autorizado
            </Badge>
            {optinData && (
              <p className="text-[11px] text-muted-foreground">
                {format(new Date(optinData), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            )}
            {originLabel && (
              <p className="text-[11px] text-muted-foreground italic">{originLabel}</p>
            )}
          </div>
        ) : (
          <Badge
            variant="secondary"
            className="text-[10px]"
          >
            Não autorizado
          </Badge>
        )}
      </div>
    </div>
  );
}
