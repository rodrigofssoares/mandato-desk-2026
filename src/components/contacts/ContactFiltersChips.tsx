import { X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ContactFilters, Tag } from '@/hooks/useContacts';
import type { Board } from '@/hooks/useBoards';
import type { BoardStage } from '@/hooks/useBoardStages';
import type { CampaignField } from '@/hooks/useCampaignFields';

interface ContactFiltersChipsProps {
  filters: ContactFilters;
  search: string;
  onChange: (filters: ContactFilters) => void;
  onSearchChange?: (value: string) => void;
  allTags?: Tag[];
  leaders?: { id: string; nome: string }[];
  boards?: Board[];
  stages?: BoardStage[];
  campaignFields?: CampaignField[];
}

interface Chip {
  key: string;
  label: string;
  onRemove: () => void;
}

const BIRTHDAY_LABELS: Record<string, string> = {
  today: 'Hoje',
  '7days': 'Próximos 7 dias',
  '30days': 'Próximos 30 dias',
  month: 'Este mês',
};

const LAST_CONTACT_LABELS: Record<string, string> = {
  today: 'Hoje',
  '7d': 'Últimos 7 dias',
  '30d': 'Últimos 30 dias',
  '30d+': 'Mais de 30 dias',
  '60d+': 'Mais de 60 dias',
  never: 'Nunca',
};

export function ContactFiltersChips({
  filters,
  search,
  onChange,
  onSearchChange,
  allTags = [],
  leaders = [],
  boards = [],
  stages = [],
  campaignFields = [],
}: ContactFiltersChipsProps) {
  const chips: Chip[] = [];

  // Busca textual
  if (search && search.trim()) {
    chips.push({
      key: 'search',
      label: `Busca: "${search.trim()}"`,
      onRemove: () => {
        onChange({ ...filters, search: undefined });
        onSearchChange?.('');
      },
    });
  }

  // Etiquetas — cada tag gera um chip separado
  if (filters.tags && filters.tags.length > 0) {
    filters.tags.forEach((tagId) => {
      const tag = allTags.find((t) => t.id === tagId);
      const nome = tag?.nome ?? tagId;
      chips.push({
        key: `tag-${tagId}`,
        label: `Etiqueta: ${nome}`,
        onRemove: () => {
          const novasTags = (filters.tags ?? []).filter((id) => id !== tagId);
          onChange({ ...filters, tags: novasTags.length > 0 ? novasTags : undefined });
        },
      });
    });
  }

  // Favoritos
  if (filters.is_favorite === true) {
    chips.push({
      key: 'is_favorite',
      label: 'Contatos favoritos',
      onRemove: () => onChange({ ...filters, is_favorite: undefined }),
    });
  }

  // Declarou voto
  if (filters.declarou_voto !== undefined && filters.declarou_voto !== null) {
    chips.push({
      key: 'declarou_voto',
      label: `Declarou voto: ${filters.declarou_voto ? 'Sim' : 'Não'}`,
      onRemove: () => onChange({ ...filters, declarou_voto: null }),
    });
  }

  // Aniversário
  if (filters.birthday_filter) {
    chips.push({
      key: 'birthday_filter',
      label: `Aniversário: ${BIRTHDAY_LABELS[filters.birthday_filter] ?? filters.birthday_filter}`,
      onRemove: () => onChange({ ...filters, birthday_filter: null }),
    });
  }

  // Data de Aniversário (range MM-DD) — chip único cobrindo from/to
  if (filters.birthday_from || filters.birthday_to) {
    const formatMmDd = (mmdd: string | undefined) => {
      if (!mmdd) return '';
      const m = mmdd.match(/^(\d{2})-(\d{2})$/);
      return m ? `${m[2]}/${m[1]}` : mmdd;
    };
    const from = formatMmDd(filters.birthday_from);
    const to = formatMmDd(filters.birthday_to);
    let label = 'Data de aniversário: ';
    if (from && to) label += `${from} → ${to}`;
    else if (from) label += `a partir de ${from}`;
    else label += `até ${to}`;
    chips.push({
      key: 'birthday_range',
      label,
      onRemove: () =>
        onChange({ ...filters, birthday_from: undefined, birthday_to: undefined }),
    });
  }

  // Último contato
  if (filters.last_contact_filter) {
    chips.push({
      key: 'last_contact_filter',
      label: `Último contato: ${LAST_CONTACT_LABELS[filters.last_contact_filter] ?? filters.last_contact_filter}`,
      onRemove: () => onChange({ ...filters, last_contact_filter: null }),
    });
  }

  // Liderança
  if (filters.leader_id) {
    const leader = leaders.find((l) => l.id === filters.leader_id);
    const nome = leader?.nome ?? filters.leader_id;
    chips.push({
      key: 'leader_id',
      label: `Liderança: ${nome}`,
      onRemove: () => onChange({ ...filters, leader_id: undefined }),
    });
  }

  // Campos de campanha — cada campo gera um chip separado
  if (filters.campaign_field_ids && filters.campaign_field_ids.length > 0) {
    filters.campaign_field_ids.forEach((fieldId) => {
      const field = campaignFields.find((f) => f.id === fieldId);
      const nome = field?.label ?? fieldId;
      chips.push({
        key: `campaign-${fieldId}`,
        label: `Campanha: ${nome}`,
        onRemove: () => {
          const novos = (filters.campaign_field_ids ?? []).filter((id) => id !== fieldId);
          onChange({ ...filters, campaign_field_ids: novos.length > 0 ? novos : undefined });
        },
      });
    });
  }

  // Data criação — de
  if (filters.date_from) {
    chips.push({
      key: 'date_from',
      label: `Criado a partir de: ${filters.date_from}`,
      onRemove: () => onChange({ ...filters, date_from: undefined }),
    });
  }

  // Data criação — até
  if (filters.date_to) {
    chips.push({
      key: 'date_to',
      label: `Criado até: ${filters.date_to}`,
      onRemove: () => onChange({ ...filters, date_to: undefined }),
    });
  }

  // Cidade
  if (filters.cidade) {
    chips.push({
      key: 'cidade',
      label: `Cidade: ${filters.cidade}`,
      onRemove: () => onChange({ ...filters, cidade: undefined }),
    });
  }

  // Estado
  if (filters.estado) {
    chips.push({
      key: 'estado',
      label: `Estado: ${filters.estado}`,
      onRemove: () => onChange({ ...filters, estado: undefined }),
    });
  }

  // Origem
  if (filters.origem) {
    chips.push({
      key: 'origem',
      label: `Origem: ${filters.origem}`,
      onRemove: () => onChange({ ...filters, origem: undefined }),
    });
  }

  // Telefone
  if (filters.has_phone) {
    chips.push({
      key: 'has_phone',
      label: `Telefone: ${filters.has_phone === 'com' ? 'Com telefone' : 'Sem telefone'}`,
      onRemove: () => onChange({ ...filters, has_phone: undefined }),
    });
  }

  // E-mail
  if (filters.has_email) {
    chips.push({
      key: 'has_email',
      label: `E-mail: ${filters.has_email === 'com' ? 'Com e-mail' : 'Sem e-mail'}`,
      onRemove: () => onChange({ ...filters, has_email: undefined }),
    });
  }

  // Demanda
  if (filters.has_demand) {
    chips.push({
      key: 'has_demand',
      label: `Demanda: ${filters.has_demand === 'com' ? 'Com demanda' : 'Sem demanda'}`,
      onRemove: () => onChange({ ...filters, has_demand: undefined }),
    });
  }

  // Funil (board_id)
  if (filters.board_id) {
    const board = boards.find((b) => b.id === filters.board_id);
    const nome = board?.nome ?? filters.board_id;
    chips.push({
      key: 'board_id',
      label: `Funil: ${nome}`,
      onRemove: () => onChange({ ...filters, board_id: undefined, stage_id: undefined }),
    });
  }

  // Etapa (stage_id) — só aparece se board_id estiver ativo
  if (filters.stage_id && filters.board_id) {
    const stage = stages.find((s) => s.id === filters.stage_id);
    const nome = stage?.nome ?? filters.stage_id;
    chips.push({
      key: 'stage_id',
      label: `Etapa: ${nome}`,
      onRemove: () => onChange({ ...filters, stage_id: undefined }),
    });
  }

  // Fora de qualquer funil
  if (filters.no_funnel) {
    chips.push({
      key: 'no_funnel',
      label: 'Fora de funis',
      onRemove: () => onChange({ ...filters, no_funnel: undefined }),
    });
  }

  // Sem chips ativos — não renderiza nada
  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5 py-1">
      {chips.map((chip) => (
        <Badge
          key={chip.key}
          variant="secondary"
          className="flex items-center gap-1 pr-1 text-xs font-normal"
        >
          <span>{chip.label}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-4 w-4 p-0 hover:bg-transparent text-muted-foreground hover:text-foreground"
            onClick={chip.onRemove}
            aria-label={`Remover filtro: ${chip.label}`}
          >
            <X className="h-3 w-3" />
          </Button>
        </Badge>
      ))}
    </div>
  );
}
