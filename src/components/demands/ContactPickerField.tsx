// ContactPickerField.tsx — RAQ-MAND-EM085
// Seletor de contato com busca por nome, CPF ou telefone (busca fixa no topo via
// CommandInput). Quando um contato é selecionado, exibe o ContactMiniCard
// (Variante A) com ações rápidas. Substitui o antigo <Select> de 500 contatos
// sem busca usado na DemandDialog.

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Loader2, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { ContactMiniCard, type MiniCardContact } from './ContactMiniCard';

interface RawContact {
  id: string;
  nome: string | null;
  telefone: string | null;
  whatsapp: string | null;
  cpf: string | null;
  contact_tags: { tags: { id: string; nome: string; cor: string | null } | null }[] | null;
}

function toMiniCard(c: RawContact): MiniCardContact {
  return {
    id: c.id,
    nome: c.nome,
    telefone: c.telefone,
    whatsapp: c.whatsapp,
    tags: (c.contact_tags ?? [])
      .map((ct) => ct.tags)
      .filter((t): t is NonNullable<typeof t> => !!t),
  };
}

const CONTACT_SELECT =
  'id, nome, telefone, whatsapp, cpf, contact_tags(tags(id, nome, cor))';

// Remove caracteres que quebrariam a sintaxe do filtro .or() do PostgREST
// e limita o comprimento (evita ILIKE com payload gigante).
function sanitizeTerm(raw: string): string {
  return raw.replace(/[,()]/g, ' ').trim().slice(0, 100);
}

interface ContactPickerFieldProps {
  value: string | null;
  onChange: (contactId: string | null) => void;
  /** Quando true, exibe só o card e não permite trocar/remover (fluxo WhatsApp). */
  locked?: boolean;
}

export function ContactPickerField({ value, onChange, locked = false }: ContactPickerFieldProps) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const id = setTimeout(() => setDebounced(term), 250);
    return () => clearTimeout(id);
  }, [term]);

  // Resultados da busca (server-side por nome/CPF/telefone/WhatsApp).
  const { data: results = [], isFetching } = useQuery<RawContact[]>({
    queryKey: ['demand-contact-picker', debounced],
    queryFn: async () => {
      let q = supabase.from('contacts').select(CONTACT_SELECT).is('merged_into', null);

      const safe = sanitizeTerm(debounced);
      if (safe) {
        const digits = safe.replace(/\D/g, '');
        const ors = [`nome.ilike.%${safe}%`];
        for (const field of ['cpf', 'telefone', 'whatsapp']) {
          ors.push(`${field}.ilike.%${safe}%`);
          if (digits && digits !== safe) ors.push(`${field}.ilike.%${digits}%`);
        }
        q = q.or(ors.join(','));
      }

      const { data, error } = await q.order('nome').limit(safe ? 40 : 25);
      if (error) throw error;
      return (data ?? []) as unknown as RawContact[];
    },
    enabled: open,
  });

  // Contato atualmente selecionado (carregado por id para sobreviver a remontagens).
  const { data: selected } = useQuery<RawContact | null>({
    queryKey: ['demand-contact-selected', value],
    queryFn: async () => {
      if (!value) return null;
      const { data, error } = await supabase
        .from('contacts')
        .select(CONTACT_SELECT)
        .eq('id', value)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as RawContact) ?? null;
    },
    enabled: !!value,
  });

  const selectedCard = useMemo(
    () => (selected ? toMiniCard(selected) : null),
    [selected],
  );

  // ── Estado: contato selecionado → mostra o card ───────────────────────────
  if (value && selectedCard) {
    return (
      <ContactMiniCard
        contact={selectedCard}
        action={
          locked ? undefined : (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground"
              title="Remover contato"
              onClick={() => onChange(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          )
        }
      />
    );
  }

  // No fluxo WhatsApp o contato vem travado; se ainda não carregou, placeholder.
  if (locked) {
    return (
      <div className="rounded-lg border bg-muted/20 px-3 py-2.5 text-xs text-muted-foreground flex items-center gap-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando contato...
      </div>
    );
  }

  // ── Estado: sem contato → trigger de busca ────────────────────────────────
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="w-full justify-start font-normal text-muted-foreground"
        >
          <Search className="h-4 w-4 mr-2 shrink-0" />
          Buscar contato por nome, CPF ou telefone…
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Nome, CPF ou telefone…"
            value={term}
            onValueChange={setTerm}
          />
          <CommandList>
            <CommandEmpty className="py-6 text-center text-xs text-muted-foreground">
              {isFetching ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Buscando...
                </span>
              ) : (
                'Nenhum contato encontrado'
              )}
            </CommandEmpty>
            {results.length > 0 && (
              <CommandGroup>
                {results.map((c) => {
                  const phone = c.whatsapp ?? c.telefone ?? null;
                  return (
                    <CommandItem
                      key={c.id}
                      value={c.id}
                      onSelect={() => {
                        onChange(c.id);
                        setOpen(false);
                        setTerm('');
                      }}
                      className="flex flex-col items-start gap-0.5 py-2"
                    >
                      <span className="text-sm font-medium truncate w-full">
                        {c.nome?.trim() || 'Sem nome'}
                      </span>
                      <span className="text-[11px] text-muted-foreground truncate w-full">
                        {[phone, c.cpf ? `CPF ${c.cpf}` : null].filter(Boolean).join(' · ') || '—'}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
