import { useState } from 'react';
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
import { useContactTags, useLeaders, type ContactFilters as Filters } from '@/hooks/useContacts';
import { useCampaignFields } from '@/hooks/useCampaignFields';

interface ContactFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

export function ContactFilters({ filters, onChange }: ContactFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: allTags = [] } = useContactTags();
  const { data: leaders = [] } = useLeaders();
  const { data: campaignFields = [] } = useCampaignFields();

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
  ].filter(Boolean).length;

  const update = (partial: Partial<Filters>) => {
    onChange({ ...filters, ...partial, page: 1 });
  };

  const clearAll = () => {
    onChange({
      search: filters.search,
      sort_by: filters.sort_by,
      page: 1,
      per_page: filters.per_page,
    });
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
