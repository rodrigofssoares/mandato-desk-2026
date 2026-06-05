// DemandLinkSection.tsx
// Seção "Demanda vinculada" exibida no ContactPanel (T62 / Fase 6 Onda A).
// Permite vincular/desvincular uma demanda a uma conversa WhatsApp.
// O protocolo gerado (MAND-XXXXXX) é exibido e copiável.

import { useState } from 'react';
import { Link2, Link2Off, Copy, Check, Loader2, Plus } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useDemands } from '@/hooks/useDemands';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { zapiChatKeys } from '@/hooks/useZapiChats';
import { usePermissions } from '@/hooks/usePermissions';
import { DemandDialog } from '@/components/demands/DemandDialog';

interface DemandLinkSectionProps {
  chatId: string;
  accountId: string | null;
  contactId: string | null;
  demandId: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  open:        'Aberta',
  in_progress: 'Em andamento',
  resolved:    'Resolvida',
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  open:        'bg-blue-100 text-blue-700 border-blue-200',
  in_progress: 'bg-amber-100 text-amber-700 border-amber-200',
  resolved:    'bg-green-100 text-green-700 border-green-200',
};

export function DemandLinkSection({
  chatId,
  accountId,
  contactId,
  demandId,
}: DemandLinkSectionProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [newDemandOpen, setNewDemandOpen] = useState(false);
  const queryClient = useQueryClient();
  const { can } = usePermissions();

  // Busca demandas do contato atual
  const { data: demands = [], isLoading: demandsLoading } = useDemands(
    contactId ? { contact_id: contactId } : undefined,
  );

  // Demanda vinculada atualmente
  const linkedDemand = demandId ? demands.find((d) => d.id === demandId) : null;

  const updateDemandLink = async (newDemandId: string | null) => {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke('zapi-chat-update', {
        body: {
          chat_id: chatId,
          patch: { demand_id: newDemandId },
        },
      });

      if (error) {
        const ctx = (error as { context?: Response }).context;
        let detail = error.message ?? 'Erro ao atualizar';
        if (ctx && typeof ctx.text === 'function') {
          try {
            const raw = await ctx.text();
            const parsed = JSON.parse(raw);
            if (parsed?.error) detail = parsed.error;
          } catch { /* sem body */ }
        }
        throw new Error(detail);
      }

      // Invalida o cache de chats para refletir o demand_id atualizado
      if (accountId) {
        queryClient.invalidateQueries({ queryKey: zapiChatKeys.byAccount(accountId) });
      }

      toast.success(newDemandId ? 'Demanda vinculada' : 'Demanda desvinculada');
    } catch (err) {
      toast.error(`Erro: ${err instanceof Error ? err.message : 'falha ao vincular'}`);
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  const handleCopyProtocol = async (protocol: string) => {
    try {
      await navigator.clipboard.writeText(protocol);
      setCopied(true);
      toast.success('Protocolo copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Não foi possível copiar');
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
        Demanda vinculada
      </p>

      {linkedDemand ? (
        /* Estado: demanda vinculada */
        <div className="rounded-lg border bg-muted/20 px-3 py-2.5 space-y-2">
          <p className="text-xs font-medium truncate">{linkedDemand.title}</p>

          <div className="flex items-center gap-1.5 flex-wrap">
            {linkedDemand.protocolo && (
              <button
                type="button"
                onClick={() => void handleCopyProtocol(linkedDemand.protocolo!)}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[11px] font-mono font-semibold hover:bg-primary/20 transition-colors"
                title="Clique para copiar o protocolo"
              >
                {copied ? (
                  <Check className="h-3 w-3 shrink-0" />
                ) : (
                  <Copy className="h-3 w-3 shrink-0" />
                )}
                {linkedDemand.protocolo}
              </button>
            )}
            <Badge
              variant="secondary"
              className={`text-[10px] ${STATUS_BADGE_CLASS[linkedDemand.status] ?? ''}`}
            >
              {STATUS_LABELS[linkedDemand.status] ?? linkedDemand.status}
            </Badge>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 text-[11px] text-muted-foreground px-1.5 gap-1"
            onClick={() => void updateDemandLink(null)}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Link2Off className="h-3 w-3" />
            )}
            Desvincular
          </Button>
        </div>
      ) : (
        /* Estado: sem demanda vinculada */
        <div className="space-y-1.5">
        {can.createDemand() && (
          <Button
            type="button"
            variant="default"
            size="sm"
            className="w-full h-8 text-xs gap-1.5"
            disabled={loading || !contactId}
            onClick={() => setNewDemandOpen(true)}
          >
            <Plus className="h-3.5 w-3.5" />
            Nova demanda
          </Button>
        )}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs gap-1.5"
              disabled={loading || !contactId}
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Link2 className="h-3.5 w-3.5" />
              )}
              Vincular demanda
            </Button>
          </PopoverTrigger>

          <PopoverContent
            className="w-72 p-0"
            align="start"
            side="left"
          >
            <Command>
              <CommandInput
                placeholder="Buscar demanda..."
                className="h-9 text-xs"
              />
              <CommandList>
                <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">
                  {demandsLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Carregando...
                    </span>
                  ) : (
                    'Nenhuma demanda encontrada'
                  )}
                </CommandEmpty>

                {demands.length > 0 && (
                  <CommandGroup>
                    {demands.map((demand) => (
                      <CommandItem
                        key={demand.id}
                        value={demand.title}
                        onSelect={() => void updateDemandLink(demand.id)}
                        className="flex flex-col items-start gap-0.5 py-2"
                      >
                        <span className="text-xs font-medium truncate w-full">
                          {demand.title}
                        </span>
                        <div className="flex items-center gap-1">
                          {demand.protocolo && (
                            <span className="text-[10px] font-mono text-primary/70">
                              {demand.protocolo}
                            </span>
                          )}
                          <Badge
                            variant="secondary"
                            className={`text-[9px] h-4 px-1 ${STATUS_BADGE_CLASS[demand.status] ?? ''}`}
                          >
                            {STATUS_LABELS[demand.status] ?? demand.status}
                          </Badge>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                )}
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        </div>
      )}

      {!contactId && (
        <p className="text-[11px] text-muted-foreground italic">
          Adicione o contato ao CRM para vincular demandas
        </p>
      )}

      {/* RAQ-MAND-EM085: criar nova demanda já vinculada a este contato.
          Quando criada e ainda não houver demanda no chat, vincula automaticamente. */}
      {contactId && (
        <DemandDialog
          open={newDemandOpen}
          onOpenChange={setNewDemandOpen}
          lockedContactId={contactId}
          onCreated={(d) => {
            if (!demandId) void updateDemandLink(d.id);
          }}
        />
      )}
    </div>
  );
}
