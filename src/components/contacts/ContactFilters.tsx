import { useState, useRef } from 'react';
import { ChevronDown, ChevronUp, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { useContactTags, useLeaders, type ContactFilters as Filters, type CustomFieldFilterValue } from '@/hooks/useContacts';
import { useBoards } from '@/hooks/useBoards';
import { useBoardStages } from '@/hooks/useBoardStages';
import { useCampaignFields } from '@/hooks/useCampaignFields';
import { useCustomFields } from '@/hooks/useCustomFields';
import { CustomFieldFilterInput } from './CustomFieldFilterInput';

// Estados brasileiros para o select de estado
const ESTADOS_BR = [
  { value: 'AC', label: 'AC — Acre' },
  { value: 'AL', label: 'AL — Alagoas' },
  { value: 'AP', label: 'AP — Amapá' },
  { value: 'AM', label: 'AM — Amazonas' },
  { value: 'BA', label: 'BA — Bahia' },
  { value: 'CE', label: 'CE — Ceará' },
  { value: 'DF', label: 'DF — Distrito Federal' },
  { value: 'ES', label: 'ES — Espírito Santo' },
  { value: 'GO', label: 'GO — Goiás' },
  { value: 'MA', label: 'MA — Maranhão' },
  { value: 'MT', label: 'MT — Mato Grosso' },
  { value: 'MS', label: 'MS — Mato Grosso do Sul' },
  { value: 'MG', label: 'MG — Minas Gerais' },
  { value: 'PA', label: 'PA — Pará' },
  { value: 'PB', label: 'PB — Paraíba' },
  { value: 'PR', label: 'PR — Paraná' },
  { value: 'PE', label: 'PE — Pernambuco' },
  { value: 'PI', label: 'PI — Piauí' },
  { value: 'RJ', label: 'RJ — Rio de Janeiro' },
  { value: 'RN', label: 'RN — Rio Grande do Norte' },
  { value: 'RS', label: 'RS — Rio Grande do Sul' },
  { value: 'RO', label: 'RO — Rondônia' },
  { value: 'RR', label: 'RR — Roraima' },
  { value: 'SC', label: 'SC — Santa Catarina' },
  { value: 'SP', label: 'SP — São Paulo' },
  { value: 'SE', label: 'SE — Sergipe' },
  { value: 'TO', label: 'TO — Tocantins' },
];

interface ContactFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

export function ContactFilters({ filters, onChange }: ContactFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: allTags = [] } = useContactTags();
  const { data: leaders = [] } = useLeaders();
  const { data: campaignFields = [] } = useCampaignFields();
  const { data: customFields = [] } = useCustomFields({ filtravel: true });
  const { data: boards = [] } = useBoards('contact');
  const { data: stages = [] } = useBoardStages(filters.board_id ?? null);

  // Refs para debounce dos inputs de texto livre
  const cidadeDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origemDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Estado local para controlar valor dos inputs enquanto o debounce não dispara
  const [cidadeLocal, setCidadeLocal] = useState(filters.cidade ?? '');
  const [origemLocal, setOrigemLocal] = useState(filters.origem ?? '');

  const customFieldsCount = Object.values(filters.custom_fields ?? {}).filter(Boolean).length;

  // Conta filtros ativos (excluindo page, per_page, sort_by, search)
  const activeCount = [
    filters.tags && filters.tags.length > 0,
    filters.is_favorite === true,
    filters.declarou_voto !== undefined && filters.declarou_voto !== null,
    filters.birthday_filter,
    filters.last_contact_filter,
    filters.leader_id,
    filters.campaign_field_ids && filters.campaign_field_ids.length > 0,
    filters.date_from,
    filters.date_to,
    filters.cidade,
    filters.estado,
    filters.origem,
    filters.has_phone,
    filters.has_email,
    filters.has_demand,
    filters.board_id,
    filters.no_funnel,
  ].filter(Boolean).length + customFieldsCount;

  const update = (partial: Partial<Filters>) => {
    onChange({ ...filters, ...partial, page: 1 });
  };

  const clearAll = () => {
    setCidadeLocal('');
    setOrigemLocal('');
    onChange({
      search: filters.search,
      sort_by: filters.sort_by,
      page: 1,
      per_page: filters.per_page,
    });
  };

  const handleCidadeChange = (value: string) => {
    setCidadeLocal(value);
    if (cidadeDebounce.current) clearTimeout(cidadeDebounce.current);
    cidadeDebounce.current = setTimeout(() => {
      update({ cidade: value.trim() || undefined });
    }, 300);
  };

  const handleOrigemChange = (value: string) => {
    setOrigemLocal(value);
    if (origemDebounce.current) clearTimeout(origemDebounce.current);
    origemDebounce.current = setTimeout(() => {
      update({ origem: value.trim() || undefined });
    }, 300);
  };

  const toggleTag = (tagId: string) => {
    const current = filters.tags ?? [];
    if (current.includes(tagId)) {
      update({ tags: current.filter((id) => id !== tagId) });
    } else {
      update({ tags: [...current, tagId] });
    }
  };

  const toggleCampaignField = (fieldId: string) => {
    const current = filters.campaign_field_ids ?? [];
    if (current.includes(fieldId)) {
      update({ campaign_field_ids: current.filter((id) => id !== fieldId) });
    } else {
      update({ campaign_field_ids: [...current, fieldId] });
    }
  };

  const setCustomFieldFilter = (campoId: string, value: CustomFieldFilterValue | undefined) => {
    const current = { ...(filters.custom_fields ?? {}) };
    if (value === undefined) {
      delete current[campoId];
    } else {
      current[campoId] = value;
    }
    update({ custom_fields: Object.keys(current).length > 0 ? current : undefined });
  };

  // Agrupa tags por grupo
  const tagsByCategory: Record<string, typeof allTags> = {};
  allTags.forEach((tag) => {
    const cat = tag.group_label || 'Sem categoria';
    if (!tagsByCategory[cat]) tagsByCategory[cat] = [];
    tagsByCategory[cat].push(tag);
  });

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex items-center gap-2">
        <CollapsibleTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            Filtros
            {activeCount > 0 && (
              <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                {activeCount}
              </Badge>
            )}
            {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </CollapsibleTrigger>

        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearAll} className="text-xs text-muted-foreground gap-1">
            <X className="h-3 w-3" />
            Limpar filtros
          </Button>
        )}
      </div>

      <CollapsibleContent className="mt-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 p-4 border rounded-lg bg-muted/30">
          {/* Tags */}
          <div className="col-span-full">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">Etiquetas</Label>
            <div className="border rounded-md p-3 mt-1 max-h-32 overflow-y-auto">
              {Object.entries(tagsByCategory).map(([cat, catTags]) => (
                <div key={cat} className="mb-2 last:mb-0">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">{cat}</p>
                  <div className="flex flex-wrap gap-2">
                    {catTags.map((tag) => (
                      <label key={tag.id} className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <Checkbox
                          checked={(filters.tags ?? []).includes(tag.id)}
                          onCheckedChange={() => toggleTag(tag.id)}
                        />
                        <span style={tag.cor ? { color: tag.cor } : undefined}>{tag.nome}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
              {allTags.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhuma etiqueta cadastrada</p>
              )}
            </div>
          </div>

          {/* Favoritos */}
          <div className="flex items-center gap-2">
            <Switch
              checked={filters.is_favorite === true}
              onCheckedChange={(checked) => update({ is_favorite: checked || undefined })}
            />
            <Label className="text-sm">Apenas favoritos</Label>
          </div>

          {/* Declarou Voto */}
          <div>
            <Label className="text-xs">Declarou voto</Label>
            <Select
              value={filters.declarou_voto === true ? 'sim' : filters.declarou_voto === false ? 'nao' : 'todos'}
              onValueChange={(v) =>
                update({
                  declarou_voto: v === 'sim' ? true : v === 'nao' ? false : null,
                })
              }
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="sim">Sim</SelectItem>
                <SelectItem value="nao">Não</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Aniversário */}
          <div>
            <Label className="text-xs">Aniversário</Label>
            <Select
              value={filters.birthday_filter ?? 'todos'}
              onValueChange={(v) =>
                update({ birthday_filter: v === 'todos' ? null : (v as Filters['birthday_filter']) })
              }
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="7days">Próximos 7 dias</SelectItem>
                <SelectItem value="30days">Próximos 30 dias</SelectItem>
                <SelectItem value="month">Este mês</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Último contato */}
          <div>
            <Label className="text-xs">Último contato</Label>
            <Select
              value={filters.last_contact_filter ?? 'todos'}
              onValueChange={(v) =>
                update({ last_contact_filter: v === 'todos' ? null : (v as Filters['last_contact_filter']) })
              }
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="today">Hoje</SelectItem>
                <SelectItem value="7d">Últimos 7 dias</SelectItem>
                <SelectItem value="30d">Últimos 30 dias</SelectItem>
                <SelectItem value="30d+">Mais de 30 dias</SelectItem>
                <SelectItem value="60d+">Mais de 60 dias</SelectItem>
                <SelectItem value="never">Nunca</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Liderança */}
          <div>
            <Label className="text-xs">Liderança</Label>
            <Select
              value={filters.leader_id ?? 'todos'}
              onValueChange={(v) => update({ leader_id: v === 'todos' ? undefined : v })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                {leaders.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Localização — Cidade e Estado */}
          <div>
            <Label className="text-xs">Cidade</Label>
            <Input
              className="mt-1"
              placeholder="ex: Belo Horizonte"
              value={cidadeLocal}
              onChange={(e) => handleCidadeChange(e.target.value)}
            />
          </div>

          <div>
            <Label className="text-xs">Estado</Label>
            <Select
              value={filters.estado ?? 'todos'}
              onValueChange={(v) => update({ estado: v === 'todos' ? undefined : v })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {ESTADOS_BR.map((uf) => (
                  <SelectItem key={uf.value} value={uf.value}>{uf.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Origem */}
          <div>
            <Label className="text-xs">Origem</Label>
            <Input
              className="mt-1"
              placeholder="ex: evento, indicação"
              value={origemLocal}
              onChange={(e) => handleOrigemChange(e.target.value)}
            />
          </div>

          {/* Completude do cadastro — Telefone e E-mail */}
          <div>
            <Label className="text-xs">Telefone</Label>
            <Select
              value={filters.has_phone ?? 'todos'}
              onValueChange={(v) =>
                update({ has_phone: v === 'todos' ? undefined : (v as Filters['has_phone']) })
              }
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="com">Com telefone</SelectItem>
                <SelectItem value="sem">Sem telefone</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">E-mail</Label>
            <Select
              value={filters.has_email ?? 'todos'}
              onValueChange={(v) =>
                update({ has_email: v === 'todos' ? undefined : (v as Filters['has_email']) })
              }
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="com">Com e-mail</SelectItem>
                <SelectItem value="sem">Sem e-mail</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Funil e Etapa */}
          <div>
            <Label className="text-xs">Funil</Label>
            <Select
              value={filters.board_id ?? 'todos'}
              onValueChange={(v) => {
                if (v === 'todos') {
                  update({ board_id: undefined, stage_id: undefined, no_funnel: undefined });
                } else {
                  update({ board_id: v, stage_id: undefined, no_funnel: undefined });
                }
              }}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os funis</SelectItem>
                {boards.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Etapa — só aparece quando um funil está selecionado */}
          {filters.board_id && (
            <div>
              <Label className="text-xs">Etapa</Label>
              <Select
                value={filters.stage_id ?? 'todos'}
                onValueChange={(v) =>
                  update({ stage_id: v === 'todos' ? undefined : v })
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Todas as etapas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todas as etapas</SelectItem>
                  {stages.length === 0 ? (
                    <SelectItem value="__vazio" disabled>Nenhuma etapa neste funil</SelectItem>
                  ) : (
                    stages.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Fora de qualquer funil — exclusivo com board_id */}
          <div className="flex items-center gap-2">
            <Switch
              checked={filters.no_funnel === true}
              onCheckedChange={(checked) => {
                if (checked) {
                  update({ no_funnel: true, board_id: undefined, stage_id: undefined });
                } else {
                  update({ no_funnel: undefined });
                }
              }}
            />
            <Label className="text-sm">Fora de qualquer funil</Label>
          </div>

          {/* Atendimento — Demandas */}
          <div>
            <Label className="text-xs">Demandas</Label>
            <Select
              value={filters.has_demand ?? 'todos'}
              onValueChange={(v) =>
                update({ has_demand: v === 'todos' ? undefined : (v as Filters['has_demand']) })
              }
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="com">Com demanda</SelectItem>
                <SelectItem value="sem">Sem demanda</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Campos de Campanha */}
          {campaignFields.length > 0 && (
            <div className="col-span-full">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">
                Campos de Campanha
              </Label>
              <div className="border rounded-md p-3 mt-1 flex flex-wrap gap-2">
                {campaignFields.map((field) => (
                  <label
                    key={field.id}
                    className="flex items-center gap-1.5 text-xs cursor-pointer"
                  >
                    <Checkbox
                      checked={(filters.campaign_field_ids ?? []).includes(field.id)}
                      onCheckedChange={() => toggleCampaignField(field.id)}
                    />
                    <span>{field.label}</span>
                  </label>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Contatos precisam ter TODOS os campos marcados
              </p>
            </div>
          )}

          {/* Campos Personalizados (dinâmico — só filtráveis) */}
          {customFields.length > 0 && (
            <div className="col-span-full">
              <Label className="text-xs font-semibold uppercase text-muted-foreground">
                Campos Personalizados
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 border rounded-md p-3 mt-1">
                {customFields.map((campo) => (
                  <CustomFieldFilterInput
                    key={campo.id}
                    campo={campo}
                    value={filters.custom_fields?.[campo.id]}
                    onChange={(v) => setCustomFieldFilter(campo.id, v)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Data criação range */}
          <div>
            <Label className="text-xs">Criado a partir de</Label>
            <Input
              type="date"
              className="mt-1"
              value={filters.date_from ?? ''}
              onChange={(e) => update({ date_from: e.target.value || undefined })}
            />
          </div>
          <div>
            <Label className="text-xs">Criado até</Label>
            <Input
              type="date"
              className="mt-1"
              value={filters.date_to ?? ''}
              onChange={(e) => update({ date_to: e.target.value || undefined })}
            />
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
