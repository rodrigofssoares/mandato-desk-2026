import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Loader2, Check, ChevronsUpDown, X } from 'lucide-react';
import { format } from 'date-fns';
import {
  useCreateTarefa,
  useUpdateTarefa,
  type Tarefa,
  type TarefaTipo,
} from '@/hooks/useTarefas';
import { useContact, useContacts } from '@/hooks/useContacts';
import { useLeaders } from '@/hooks/useLeaders';
import { useDemands } from '@/hooks/useDemands';
import { useUsers } from '@/hooks/useUsers';
import { TIPO_LABELS } from './TarefaIcon';

const TIPOS: TarefaTipo[] = ['LIGACAO', 'REUNIAO', 'VISITA', 'WHATSAPP', 'EMAIL', 'TAREFA'];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tarefa?: Tarefa | null;
  /** Pre-seleciona um contato (usado pela aba Tarefas dentro do ContactDialog futuramente) */
  defaultContactId?: string | null;
}

type VinculoTipo = 'nenhum' | 'contato' | 'articulador' | 'demanda';

function toDatetimeLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

function fromDatetimeLocal(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export function TarefaFormDialog({ open, onOpenChange, tarefa, defaultContactId }: Props) {
  const isEdit = !!tarefa;

  const [titulo, setTitulo] = useState('');
  const [descricao, setDescricao] = useState('');
  const [tipo, setTipo] = useState<TarefaTipo>('TAREFA');
  const [dataAgendada, setDataAgendada] = useState('');
  const [responsavelId, setResponsavelId] = useState<string>('');
  const [vinculoTipo, setVinculoTipo] = useState<VinculoTipo>('nenhum');
  const [contactId, setContactId] = useState<string | null>(null);
  const [leaderId, setLeaderId] = useState<string | null>(null);
  const [demandId, setDemandId] = useState<string | null>(null);

  const createTarefa = useCreateTarefa();
  const updateTarefa = useUpdateTarefa();
  const isSaving = createTarefa.isPending || updateTarefa.isPending;

  const { data: users = [] } = useUsers();

  // Reset on open
  useEffect(() => {
    if (!open) return;
    if (tarefa) {
      setTitulo(tarefa.titulo);
      setDescricao(tarefa.descricao ?? '');
      setTipo(tarefa.tipo);
      setDataAgendada(toDatetimeLocal(tarefa.data_agendada));
      setResponsavelId(tarefa.responsavel_id ?? '');
      setContactId(tarefa.contact_id);
      setLeaderId(tarefa.leader_id);
      setDemandId(tarefa.demand_id);
      if (tarefa.contact_id) setVinculoTipo('contato');
      else if (tarefa.leader_id) setVinculoTipo('articulador');
      else if (tarefa.demand_id) setVinculoTipo('demanda');
      else setVinculoTipo('nenhum');
    } else {
      setTitulo('');
      setDescricao('');
      setTipo('TAREFA');
      setDataAgendada('');
      setResponsavelId('');
      setContactId(defaultContactId ?? null);
      setLeaderId(null);
      setDemandId(null);
      setVinculoTipo(defaultContactId ? 'contato' : 'nenhum');
    }
  }, [open, tarefa, defaultContactId]);

  const handleVinculoTipoChange = (next: VinculoTipo) => {
    setVinculoTipo(next);
    if (next !== 'contato') setContactId(null);
    if (next !== 'articulador') setLeaderId(null);
    if (next !== 'demanda') setDemandId(null);
  };

  const handleSave = async () => {
    const tituloTrimmed = titulo.trim();
    if (!tituloTrimmed) return;

    const payload = {
      titulo: tituloTrimmed,
      descricao: descricao.trim() || null,
      tipo,
      data_agendada: fromDatetimeLocal(dataAgendada),
      responsavel_id: responsavelId || null,
      contact_id: vinculoTipo === 'contato' ? contactId : null,
      leader_id: vinculoTipo === 'articulador' ? leaderId : null,
      demand_id: vinculoTipo === 'demanda' ? demandId : null,
    };

    try {
      if (isEdit && tarefa) {
        await updateTarefa.mutateAsync({ id: tarefa.id, patch: payload });
      } else {
        await createTarefa.mutateAsync(payload);
      }
      onOpenChange(false);
    } catch {
      // toast já no hook
    }
  };

  const podeSalvar = !!titulo.trim() && !isSaving;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Editar tarefa' : 'Nova tarefa'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Atualize os dados da tarefa.'
              : 'Crie uma nova tarefa e, opcionalmente, vincule a um contato, articulador ou demanda.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="tarefa-titulo">Título *</Label>
            <Input
              id="tarefa-titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex: Ligar para Maria sobre a reunião"
              disabled={isSaving}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="tarefa-tipo">Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as TarefaTipo)} disabled={isSaving}>
                <SelectTrigger id="tarefa-tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {TIPO_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tarefa-data">Data e hora</Label>
              <Input
                id="tarefa-data"
                type="datetime-local"
                value={dataAgendada}
                onChange={(e) => setDataAgendada(e.target.value)}
                disabled={isSaving}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tarefa-responsavel">Responsável</Label>
            <Select
              value={responsavelId || '__me__'}
              onValueChange={(v) => setResponsavelId(v === '__me__' ? '' : v)}
              disabled={isSaving}
            >
              <SelectTrigger id="tarefa-responsavel">
                <SelectValue placeholder="Selecionar responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__me__">Eu (atual)</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Vínculo</Label>
            <div className="flex flex-wrap gap-2">
              {(['nenhum', 'contato', 'articulador', 'demanda'] as VinculoTipo[]).map((v) => (
                <Button
                  key={v}
                  type="button"
                  size="sm"
                  variant={vinculoTipo === v ? 'default' : 'outline'}
                  onClick={() => handleVinculoTipoChange(v)}
                  disabled={isSaving}
                  className="capitalize"
                >
                  {v === 'nenhum' ? 'Sem vínculo' : v}
                </Button>
              ))}
            </div>

            {vinculoTipo === 'contato' && (
              <ContatoCombobox value={contactId} onChange={setContactId} disabled={isSaving} />
            )}
            {vinculoTipo === 'articulador' && (
              <ArticuladorCombobox value={leaderId} onChange={setLeaderId} disabled={isSaving} />
            )}
            {vinculoTipo === 'demanda' && (
              <DemandaCombobox value={demandId} onChange={setDemandId} disabled={isSaving} />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tarefa-descricao">Descrição</Label>
            <Textarea
              id="tarefa-descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Detalhes opcionais"
              rows={3}
              disabled={isSaving}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={!podeSalvar}>
            {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEdit ? 'Salvar alterações' : 'Criar tarefa'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Comboboxes (search-as-you-type via hook)
// ============================================================================

interface ComboboxProps {
  value: string | null;
  onChange: (id: string | null) => void;
  disabled?: boolean;
}

function ContatoCombobox({ value, onChange, disabled }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { data } = useContacts({ search, per_page: 20 });
  const contatos = data?.data ?? [];

  // Carrega o contato selecionado por ID (mostra nome mesmo fora da busca atual)
  const { data: selectedContact } = useContact(value ?? undefined);
  const selected = useMemo(() => {
    if (!value) return null;
    return contatos.find((c) => c.id === value) ?? selectedContact ?? null;
  }, [value, contatos, selectedContact]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-full justify-between mt-2"
          disabled={disabled}
        >
          <span className="truncate">{selected ? selected.nome : 'Buscar contato…'}</span>
          {value ? (
            <X
              className="h-4 w-4 opacity-60 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
            />
          ) : (
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Digite o nome..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>Nenhum contato encontrado.</CommandEmpty>
            <CommandGroup>
              {contatos.map((c) => (
                <CommandItem
                  key={c.id}
                  value={c.id}
                  onSelect={() => {
                    onChange(c.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={`mr-2 h-4 w-4 ${value === c.id ? 'opacity-100' : 'opacity-0'}`}
                  />
                  {c.nome}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function ArticuladorCombobox({ value, onChange, disabled }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const { data: leaders = [] } = useLeaders({ search });
  const selected = leaders.find((l) => l.id === value) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-full justify-between mt-2"
          disabled={disabled}
        >
          <span className="truncate">{selected ? selected.nome : 'Buscar articulador…'}</span>
          {value ? (
            <X
              className="h-4 w-4 opacity-60 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
            />
          ) : (
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Digite o nome..."
            value={search}
            onValueChange={setSearch}
          />
          <CommandList>
            <CommandEmpty>Nenhum articulador encontrado.</CommandEmpty>
            <CommandGroup>
              {leaders.map((l) => (
                <CommandItem
                  key={l.id}
                  value={l.id}
                  onSelect={() => {
                    onChange(l.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={`mr-2 h-4 w-4 ${value === l.id ? 'opacity-100' : 'opacity-0'}`}
                  />
                  {l.nome}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function DemandaCombobox({ value, onChange, disabled }: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const { data: demandas = [] } = useDemands();
  const selected = demandas.find((d) => d.id === value) ?? null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="w-full justify-between mt-2"
          disabled={disabled}
        >
          <span className="truncate">{selected ? selected.title : 'Buscar demanda…'}</span>
          {value ? (
            <X
              className="h-4 w-4 opacity-60 hover:opacity-100"
              onClick={(e) => {
                e.stopPropagation();
                onChange(null);
              }}
            />
          ) : (
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder="Digite o título..." />
          <CommandList>
            <CommandEmpty>Nenhuma demanda encontrada.</CommandEmpty>
            <CommandGroup>
              {demandas.map((d) => (
                <CommandItem
                  key={d.id}
                  value={d.title}
                  onSelect={() => {
                    onChange(d.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={`mr-2 h-4 w-4 ${value === d.id ? 'opacity-100' : 'opacity-0'}`}
                  />
                  {d.title}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
