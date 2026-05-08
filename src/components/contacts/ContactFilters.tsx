import { useState, useRef, useEffect, useMemo } from 'react';
import {
  Filter,
  Users,
  MapPin,
  Shield,
  MessageSquare,
  Sparkles,
  Calendar,
  Megaphone,
  ChevronDown,
  Search,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  useContactTags,
  useLeaders,
  type ContactFilters as Filters,
  type CustomFieldFilterValue,
} from '@/hooks/useContacts';
import { useBoards } from '@/hooks/useBoards';
import { useBoardStages } from '@/hooks/useBoardStages';
import { useCampaignFields } from '@/hooks/useCampaignFields';
import { useCustomFields } from '@/hooks/useCustomFields';
import { CustomFieldFilterInput } from './CustomFieldFilterInput';
import { ContactFiltersChips } from './ContactFiltersChips';

// ─── Estados brasileiros ─────────────────────────────────────────────────────

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

// ─── Funções de contagem por segmento ────────────────────────────────────────

function countPessoais(f: Filters): number {
  return [
    f.tags && f.tags.length > 0,
    f.is_favorite === true,
    !!f.birthday_filter,
    // Range de aniversário conta como 1, mesmo se from + to ambos preenchidos (seleção coordenada)
    !!(f.birthday_from || f.birthday_to),
    !!f.has_phone,
    !!f.has_email,
  ].filter(Boolean).length;
}

function countLocalizacao(f: Filters): number {
  return [f.cidade, f.estado, f.origem].filter(Boolean).length;
}

function countEngajamento(f: Filters): number {
  return [
    f.declarou_voto !== undefined && f.declarou_voto !== null,
    f.aceita_whatsapp !== undefined && f.aceita_whatsapp !== null,
    f.em_canal_whatsapp !== undefined && f.em_canal_whatsapp !== null,
    f.e_multiplicador !== undefined && f.e_multiplicador !== null,
    // Ranking conta como 1 (range coordenado)
    typeof f.ranking_min === 'number' || typeof f.ranking_max === 'number',
    f.leader_id,
  ].filter(Boolean).length;
}

function countAtendimento(f: Filters): number {
  return [
    f.has_demand,
    f.last_contact_filter,
    // Range customizado conta como 1 (seleção coordenada)
    f.last_contact_from || f.last_contact_to,
  ].filter(Boolean).length;
}

function countFunil(f: Filters): number {
  // stage_id é dependente de board_id — conta como 1 seleção coordenada
  if (f.no_funnel) return 1;
  if (f.board_id) return 1;
  return 0;
}

function countCampanha(f: Filters): number {
  return f.campaign_field_ids && f.campaign_field_ids.length > 0
    ? f.campaign_field_ids.length
    : 0;
}

function countPersonalizados(f: Filters): number {
  return Object.values(f.custom_fields ?? {}).filter(Boolean).length;
}

function countDatas(f: Filters): number {
  return [f.date_from, f.date_to].filter(Boolean).length;
}

function totalActiveCount(f: Filters): number {
  return (
    countPessoais(f) +
    countLocalizacao(f) +
    countEngajamento(f) +
    countAtendimento(f) +
    countFunil(f) +
    countCampanha(f) +
    countPersonalizados(f) +
    countDatas(f)
  );
}

// ─── Subcomponente: card de segmento ─────────────────────────────────────────

interface SegmentCardProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  count: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function SegmentCard({ icon, title, subtitle, count, defaultOpen = false, children }: SegmentCardProps) {
  const [manualOpen, setManualOpen] = useState(defaultOpen);
  const hasActive = count > 0;
  // Cards com filtros ativos ficam sempre expandidos — usuário não "perde" filtros aplicados
  const open = manualOpen || hasActive;

  return (
    <Collapsible open={open} onOpenChange={setManualOpen}>
      <div
        className={[
          'rounded-[10px] border bg-white overflow-hidden transition-all duration-150',
          hasActive
            ? 'border-primary shadow-[0_0_0_1px_rgba(33,72,183,0.18)]'
            : 'border-border',
        ].join(' ')}
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className={[
              'w-full flex items-center justify-between gap-3 px-3.5 py-3 text-left transition-colors duration-150',
              hasActive
                ? 'bg-gradient-to-r from-primary/[0.07] to-transparent hover:from-primary/10'
                : 'hover:bg-muted/60',
            ].join(' ')}
            aria-expanded={open}
            aria-label={`${open ? 'Recolher' : 'Expandir'} segmento ${title}`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={[
                  'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors duration-150',
                  hasActive ? 'bg-primary text-white' : 'bg-muted text-muted-foreground',
                ].join(' ')}
              >
                {icon}
              </div>
              <div>
                <div className="font-semibold text-sm text-foreground">{title}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</div>
              </div>
            </div>

            <div className="flex items-center gap-2 text-muted-foreground">
              {hasActive && (
                <Badge className="bg-primary text-white text-[11px] font-bold px-[7px] py-0.5 rounded-full min-w-[22px] text-center">
                  {count}
                </Badge>
              )}
              <ChevronDown
                className={[
                  'h-4 w-4 transition-transform duration-200',
                  open ? 'rotate-180' : '',
                ].join(' ')}
              />
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-3.5 pb-3.5 pt-1 border-t border-dashed border-border">
            {children}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// ─── Props do componente principal ───────────────────────────────────────────

interface ContactFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function ContactFilters({ filters, onChange }: ContactFiltersProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { data: allTags = [] } = useContactTags();
  const { data: leaders = [] } = useLeaders();
  const { data: campaignFields = [] } = useCampaignFields();
  const { data: customFields = [] } = useCustomFields({ filtravel: true });
  const { data: boards = [] } = useBoards('contact');
  const { data: stages = [] } = useBoardStages(filters.board_id ?? null);

  // Inputs de texto com debounce
  const cidadeDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origemDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cidadeLocal, setCidadeLocal] = useState(filters.cidade ?? '');
  const [origemLocal, setOrigemLocal] = useState(filters.origem ?? '');

  // Busca local de etiquetas dentro do drawer (não persiste — só filtra a lista visual)
  const [tagSearch, setTagSearch] = useState('');

  useEffect(() => { setCidadeLocal(filters.cidade ?? ''); }, [filters.cidade]);
  useEffect(() => { setOrigemLocal(filters.origem ?? ''); }, [filters.origem]);

  useEffect(() => {
    return () => {
      if (cidadeDebounce.current) clearTimeout(cidadeDebounce.current);
      if (origemDebounce.current) clearTimeout(origemDebounce.current);
    };
  }, []);

  const activeCount = totalActiveCount(filters);

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

  // Agrupa tags por categoria, filtrando pela busca local (case-insensitive, sem acentos)
  const tagsByCategory = useMemo(() => {
    const norm = (s: string) =>
      s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    const query = norm(tagSearch.trim());
    const filtered = query
      ? allTags.filter(
          (tag) => norm(tag.nome).includes(query) || norm(tag.group_label || '').includes(query)
        )
      : allTags;
    return filtered.reduce<Record<string, typeof allTags>>((acc, tag) => {
      const cat = tag.group_label || 'Sem categoria';
      (acc[cat] ??= []).push(tag);
      return acc;
    }, {});
  }, [allTags, tagSearch]);

  const tagsMatchCount = Object.values(tagsByCategory).reduce((n, arr) => n + arr.length, 0);

  // Contagens por segmento
  const cPessoais = countPessoais(filters);
  const cLocalizacao = countLocalizacao(filters);
  const cEngajamento = countEngajamento(filters);
  const cAtendimento = countAtendimento(filters);
  const cFunil = countFunil(filters);
  const cCampanha = countCampanha(filters);
  const cPersonalizados = countPersonalizados(filters);
  const cDatas = countDatas(filters);

  return (
    <>
      {/* Botão gatilho — fica na toolbar da página */}
      <Button
        variant={activeCount > 0 ? 'default' : 'outline'}
        size="sm"
        onClick={() => setDrawerOpen(true)}
        className="gap-2 shrink-0"
        aria-label="Abrir painel de filtros"
      >
        <Filter className="h-3.5 w-3.5" />
        Filtros
        {activeCount > 0 && (
          <Badge className="bg-white text-primary text-[11px] font-bold px-[7px] py-0.5 rounded-full min-w-[20px] text-center ml-0.5">
            {activeCount}
          </Badge>
        )}
      </Button>

      {/* Drawer (Sheet off-canvas lado direito) */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        {/* [&>button]:hidden suprime o SheetPrimitive.Close nativo do shadcn (ver components/ui/sheet.tsx),
            substituído pelo botão de fechar customizado abaixo. Frágil se o shadcn mudar a estrutura interna. */}
        <SheetContent
          side="right"
          className="p-0 flex flex-col w-full sm:max-w-[480px] [&>button]:hidden"
        >
          {/* Título acessível (obrigatório pelo Radix) */}
          <SheetTitle className="sr-only">Filtros de contatos</SheetTitle>

          {/* ── Header ── */}
          <div className="flex items-center justify-between px-5 py-[18px] border-b bg-gradient-to-b from-muted/60 to-white flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <Filter className="h-[18px] w-[18px] text-foreground" />
              <span className="text-base font-bold text-foreground font-[Space_Grotesk,Inter,sans-serif]">
                Filtros
              </span>
              {activeCount > 0 && (
                <Badge className="bg-primary text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                  {activeCount}
                </Badge>
              )}
            </div>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:bg-background hover:border hover:border-border transition-all duration-150"
              aria-label="Fechar painel de filtros"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* ── Sticky bar de chips aplicados (dentro do drawer) ── */}
          {activeCount > 0 && (
            <div className="px-5 py-3.5 bg-primary/[0.07] border-b border-primary/20 flex-shrink-0">
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-[11px] uppercase tracking-[0.06em] font-bold text-primary">
                  Aplicados
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAll}
                  className="ml-auto h-auto py-1 px-2 text-[12px] font-semibold text-primary hover:bg-primary/10"
                >
                  Limpar
                </Button>
              </div>
              <ContactFiltersChips
                filters={filters}
                search=""
                onChange={(novosFiltros) => onChange({ ...novosFiltros, page: 1 })}
                allTags={allTags}
                leaders={leaders}
                boards={boards}
                stages={stages}
                campaignFields={campaignFields}
              />
            </div>
          )}

          {/* ── Body com cards expansíveis ── */}
          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-2.5">

            {/* 1. PESSOAIS */}
            <SegmentCard
              icon={<Users className="h-4 w-4" />}
              title="Pessoais"
              subtitle="Etiquetas, favoritos, aniversário, telefone, e-mail"
              count={cPessoais}
              defaultOpen={cPessoais > 0}
            >
              {/* Etiquetas */}
              <div className="mt-2.5">
                <Label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-muted-foreground">
                  Etiquetas
                </Label>

                {allTags.length > 0 && (
                  <div className="relative mt-1.5">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                    <Input
                      type="text"
                      placeholder="Buscar etiqueta..."
                      value={tagSearch}
                      onChange={(e) => setTagSearch(e.target.value)}
                      className="h-8 pl-8 pr-8 text-sm"
                      aria-label="Buscar etiqueta pelo nome"
                    />
                    {tagSearch && (
                      <button
                        type="button"
                        onClick={() => setTagSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center"
                        aria-label="Limpar busca de etiqueta"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                )}

                <div className="mt-1.5 max-h-36 overflow-y-auto border rounded-md p-2.5 bg-background">
                  {allTags.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Nenhuma etiqueta cadastrada</p>
                  ) : tagsMatchCount === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Nenhuma etiqueta encontrada para "{tagSearch}"
                    </p>
                  ) : (
                    Object.entries(tagsByCategory).map(([cat, catTags]) => (
                      <div key={cat} className="mb-2 last:mb-0">
                        <p className="text-[10px] font-semibold uppercase text-muted-foreground mb-1">{cat}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {catTags.map((tag) => {
                            const active = (filters.tags ?? []).includes(tag.id);
                            return (
                              <button
                                key={tag.id}
                                type="button"
                                onClick={() => toggleTag(tag.id)}
                                className={[
                                  'inline-flex items-center gap-1.5 border rounded-full px-3 py-1 text-xs cursor-pointer transition-all duration-150 select-none',
                                  active
                                    ? 'border-primary bg-primary/[0.07] text-primary font-semibold'
                                    : 'border-border bg-white text-foreground hover:border-primary/50',
                                ].join(' ')}
                                aria-pressed={active}
                              >
                                {tag.cor && (
                                  <span
                                    className="w-2 h-2 rounded-full flex-shrink-0"
                                    style={{ background: tag.cor }}
                                  />
                                )}
                                {tag.nome}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Contatos favoritos */}
              <div className="flex items-center gap-2 mt-3">
                <Switch
                  checked={filters.is_favorite === true}
                  onCheckedChange={(checked) => update({ is_favorite: checked || undefined })}
                  id="switch-favoritos"
                />
                <Label htmlFor="switch-favoritos" className="text-sm cursor-pointer">
                  Contatos favoritos
                </Label>
              </div>

              {/* Aniversário (presets relativos) */}
              <div className="mt-3">
                <Label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-muted-foreground">
                  Aniversário
                </Label>
                <Select
                  value={filters.birthday_filter ?? 'todos'}
                  onValueChange={(v) =>
                    update({ birthday_filter: v === 'todos' ? null : (v as Filters['birthday_filter']) })
                  }
                >
                  <SelectTrigger className="mt-1 h-[34px] text-sm">
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

              {/* Data de Aniversário (range livre por dia/mês — ano ignorado) */}
              <div className="mt-3">
                <Label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-muted-foreground">
                  Data de Aniversário
                </Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div>
                    <Input
                      type="date"
                      className="h-[34px] text-sm"
                      value={filters.birthday_from ? `2000-${filters.birthday_from}` : ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) return update({ birthday_from: undefined });
                        const mmdd = v.slice(5); // "YYYY-MM-DD" → "MM-DD"
                        update({ birthday_from: mmdd });
                      }}
                      aria-label="Data de aniversário — início do intervalo"
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">De</p>
                  </div>
                  <div>
                    <Input
                      type="date"
                      className="h-[34px] text-sm"
                      value={filters.birthday_to ? `2000-${filters.birthday_to}` : ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) return update({ birthday_to: undefined });
                        const mmdd = v.slice(5);
                        update({ birthday_to: mmdd });
                      }}
                      aria-label="Data de aniversário — fim do intervalo"
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">Até</p>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Apenas dia e mês são considerados (o ano é ignorado). Pode ser combinado com o filtro de Aniversário acima.
                </p>
              </div>

              {/* Telefone + E-mail (incorporados de Cadastro) */}
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <Label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-muted-foreground">
                    Telefone
                  </Label>
                  <Select
                    value={filters.has_phone ?? 'todos'}
                    onValueChange={(v) =>
                      update({ has_phone: v === 'todos' ? undefined : (v as Filters['has_phone']) })
                    }
                  >
                    <SelectTrigger className="mt-1 h-[34px] text-sm">
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
                  <Label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-muted-foreground">
                    E-mail
                  </Label>
                  <Select
                    value={filters.has_email ?? 'todos'}
                    onValueChange={(v) =>
                      update({ has_email: v === 'todos' ? undefined : (v as Filters['has_email']) })
                    }
                  >
                    <SelectTrigger className="mt-1 h-[34px] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="com">Com e-mail</SelectItem>
                      <SelectItem value="sem">Sem e-mail</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </SegmentCard>

            {/* 2. ENGAJAMENTO POLÍTICO */}
            <SegmentCard
              icon={<Shield className="h-4 w-4" />}
              title="Engajamento Político"
              subtitle="WhatsApp, voto, multiplicador, ranking, liderança"
              count={cEngajamento}
              defaultOpen={cEngajamento > 0}
            >
              <div className="grid grid-cols-2 gap-3 mt-2.5">
                {/* Aceita WhatsApp */}
                <div>
                  <Label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-muted-foreground">
                    Aceita WhatsApp
                  </Label>
                  <Select
                    value={
                      filters.aceita_whatsapp === true
                        ? 'sim'
                        : filters.aceita_whatsapp === false
                        ? 'nao'
                        : 'todos'
                    }
                    onValueChange={(v) =>
                      update({
                        aceita_whatsapp: v === 'sim' ? true : v === 'nao' ? false : null,
                      })
                    }
                  >
                    <SelectTrigger className="mt-1 h-[34px] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="sim">Sim</SelectItem>
                      <SelectItem value="nao">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Canal do WhatsApp */}
                <div>
                  <Label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-muted-foreground">
                    Canal do WhatsApp
                  </Label>
                  <Select
                    value={
                      filters.em_canal_whatsapp === true
                        ? 'sim'
                        : filters.em_canal_whatsapp === false
                        ? 'nao'
                        : 'todos'
                    }
                    onValueChange={(v) =>
                      update({
                        em_canal_whatsapp: v === 'sim' ? true : v === 'nao' ? false : null,
                      })
                    }
                  >
                    <SelectTrigger className="mt-1 h-[34px] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="sim">No canal</SelectItem>
                      <SelectItem value="nao">Fora do canal</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Declarou voto */}
                <div>
                  <Label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-muted-foreground">
                    Declarou voto
                  </Label>
                  <Select
                    value={
                      filters.declarou_voto === true
                        ? 'sim'
                        : filters.declarou_voto === false
                        ? 'nao'
                        : 'todos'
                    }
                    onValueChange={(v) =>
                      update({
                        declarou_voto: v === 'sim' ? true : v === 'nao' ? false : null,
                      })
                    }
                  >
                    <SelectTrigger className="mt-1 h-[34px] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="sim">Sim</SelectItem>
                      <SelectItem value="nao">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Multiplicador */}
                <div>
                  <Label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-muted-foreground">
                    Multiplicador
                  </Label>
                  <Select
                    value={
                      filters.e_multiplicador === true
                        ? 'sim'
                        : filters.e_multiplicador === false
                        ? 'nao'
                        : 'todos'
                    }
                    onValueChange={(v) =>
                      update({
                        e_multiplicador: v === 'sim' ? true : v === 'nao' ? false : null,
                      })
                    }
                  >
                    <SelectTrigger className="mt-1 h-[34px] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="sim">Sim</SelectItem>
                      <SelectItem value="nao">Não</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Ranking (range 0-10) */}
              <div className="mt-3">
                <Label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-muted-foreground">
                  Ranking
                </Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div>
                    <Select
                      value={typeof filters.ranking_min === 'number' ? String(filters.ranking_min) : 'todos'}
                      onValueChange={(v) =>
                        update({ ranking_min: v === 'todos' ? undefined : Number(v) })
                      }
                    >
                      <SelectTrigger className="h-[34px] text-sm">
                        <SelectValue placeholder="Mín" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">— Mín —</SelectItem>
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Mínimo</p>
                  </div>
                  <div>
                    <Select
                      value={typeof filters.ranking_max === 'number' ? String(filters.ranking_max) : 'todos'}
                      onValueChange={(v) =>
                        update({ ranking_max: v === 'todos' ? undefined : Number(v) })
                      }
                    >
                      <SelectTrigger className="h-[34px] text-sm">
                        <SelectValue placeholder="Máx" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">— Máx —</SelectItem>
                        {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                          <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Máximo</p>
                  </div>
                </div>
              </div>

              {/* Liderança */}
              <div className="mt-3">
                <Label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-muted-foreground">
                  Liderança
                </Label>
                <Select
                  value={filters.leader_id ?? 'todos'}
                  onValueChange={(v) => update({ leader_id: v === 'todos' ? undefined : v })}
                >
                  <SelectTrigger className="mt-1 h-[34px] text-sm">
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
            </SegmentCard>

            {/* 3. CAMPANHA — renderiza apenas se houver campos */}
            {campaignFields.length > 0 && (
              <SegmentCard
                icon={<Megaphone className="h-4 w-4" />}
                title="Campanha"
                subtitle="Listas e mobilizações"
                count={cCampanha}
                defaultOpen={cCampanha > 0}
              >
                <div className="mt-2.5">
                  <Label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-muted-foreground">
                    Campos de campanha
                  </Label>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {campaignFields.map((field) => {
                      const active = (filters.campaign_field_ids ?? []).includes(field.id);
                      return (
                        <button
                          key={field.id}
                          type="button"
                          onClick={() => toggleCampaignField(field.id)}
                          className={[
                            'inline-flex items-center border rounded-full px-3 py-1 text-xs cursor-pointer transition-all duration-150 select-none',
                            active
                              ? 'border-primary bg-primary/[0.07] text-primary font-semibold'
                              : 'border-border bg-white text-foreground hover:border-primary/50',
                          ].join(' ')}
                          aria-pressed={active}
                        >
                          {field.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">
                    Contatos precisam ter <strong>todos</strong> os campos marcados.
                  </p>
                </div>
              </SegmentCard>
            )}

            {/* 4. ATENDIMENTO */}
            <SegmentCard
              icon={<MessageSquare className="h-4 w-4" />}
              title="Atendimento"
              subtitle="Demandas, último contato"
              count={cAtendimento}
              defaultOpen={cAtendimento > 0}
            >
              <div className="grid grid-cols-2 gap-3 mt-2.5">
                <div>
                  <Label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-muted-foreground">
                    Demandas
                  </Label>
                  <Select
                    value={filters.has_demand ?? 'todos'}
                    onValueChange={(v) =>
                      update({ has_demand: v === 'todos' ? undefined : (v as Filters['has_demand']) })
                    }
                  >
                    <SelectTrigger className="mt-1 h-[34px] text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="com">Com demanda</SelectItem>
                      <SelectItem value="sem">Sem demanda</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-muted-foreground">
                    Último contato
                  </Label>
                  <Select
                    value={filters.last_contact_filter ?? 'todos'}
                    onValueChange={(v) =>
                      update({
                        last_contact_filter: v === 'todos' ? null : (v as Filters['last_contact_filter']),
                      })
                    }
                  >
                    <SelectTrigger className="mt-1 h-[34px] text-sm">
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
              </div>

              {/* Período customizado de último contato (range livre) */}
              <div className="mt-3">
                <Label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-muted-foreground">
                  Período de último contato
                </Label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div>
                    <Input
                      type="date"
                      className="h-[34px] text-sm"
                      value={filters.last_contact_from ?? ''}
                      onChange={(e) =>
                        update({ last_contact_from: e.target.value || undefined })
                      }
                      aria-label="Último contato — início do intervalo"
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">De</p>
                  </div>
                  <div>
                    <Input
                      type="date"
                      className="h-[34px] text-sm"
                      value={filters.last_contact_to ?? ''}
                      onChange={(e) =>
                        update({ last_contact_to: e.target.value || undefined })
                      }
                      aria-label="Último contato — fim do intervalo"
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">Até</p>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1.5">
                  Pode ser combinado com os atalhos acima (filtros aplicados em conjunto).
                </p>
              </div>
            </SegmentCard>

            {/* 5. FUNIL */}
            <SegmentCard
              icon={<Filter className="h-4 w-4" />}
              title="Funil"
              subtitle="Pipelines e etapas"
              count={cFunil}
              defaultOpen={cFunil > 0}
            >
              <div className="flex flex-col gap-3 mt-2.5">
                <div>
                  <Label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-muted-foreground">
                    Funil
                  </Label>
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
                    <SelectTrigger className="mt-1 h-[34px] text-sm">
                      <SelectValue placeholder="Todos os funis" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os funis</SelectItem>
                      {boards.map((b) => (
                        <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {filters.board_id && (
                  <div>
                    <Label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-muted-foreground">
                      Etapa
                    </Label>
                    <Select
                      value={filters.stage_id ?? 'todos'}
                      onValueChange={(v) =>
                        update({ stage_id: v === 'todos' ? undefined : v })
                      }
                    >
                      <SelectTrigger className="mt-1 h-[34px] text-sm">
                        <SelectValue placeholder="Todas as etapas" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todas as etapas</SelectItem>
                        {stages.length === 0 ? (
                          <SelectItem value="__vazio" disabled>
                            Nenhuma etapa neste funil
                          </SelectItem>
                        ) : (
                          stages.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}

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
                    id="switch-no-funnel"
                  />
                  <Label htmlFor="switch-no-funnel" className="text-sm cursor-pointer">
                    Fora de qualquer funil
                  </Label>
                </div>
              </div>
            </SegmentCard>

            {/* 6. PERSONALIZADOS — renderiza apenas se houver campos filtráveis */}
            {customFields.length > 0 && (
              <SegmentCard
                icon={<Sparkles className="h-4 w-4" />}
                title="Personalizados"
                subtitle="Campos definidos por você"
                count={cPersonalizados}
                defaultOpen={cPersonalizados > 0}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2.5">
                  {customFields.map((campo) => (
                    <CustomFieldFilterInput
                      key={campo.id}
                      campo={campo}
                      value={filters.custom_fields?.[campo.id]}
                      onChange={(v) => setCustomFieldFilter(campo.id, v)}
                    />
                  ))}
                </div>
              </SegmentCard>
            )}

            {/* 7. DATAS */}
            <SegmentCard
              icon={<Calendar className="h-4 w-4" />}
              title="Datas"
              subtitle="Período de cadastro"
              count={cDatas}
              defaultOpen={cDatas > 0}
            >
              <div className="grid grid-cols-2 gap-3 mt-2.5">
                <div>
                  <Label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-muted-foreground">
                    Criado a partir de
                  </Label>
                  <Input
                    type="date"
                    className="mt-1 h-[34px]"
                    value={filters.date_from ?? ''}
                    onChange={(e) => update({ date_from: e.target.value || undefined })}
                  />
                </div>
                <div>
                  <Label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-muted-foreground">
                    Criado até
                  </Label>
                  <Input
                    type="date"
                    className="mt-1 h-[34px]"
                    value={filters.date_to ?? ''}
                    onChange={(e) => update({ date_to: e.target.value || undefined })}
                  />
                </div>
              </div>
            </SegmentCard>
            {/* 8. LOCALIZAÇÃO */}
            <SegmentCard
              icon={<MapPin className="h-4 w-4" />}
              title="Localização"
              subtitle="Cidade, estado, origem"
              count={cLocalizacao}
              defaultOpen={cLocalizacao > 0}
            >
              <div className="mt-2.5 flex flex-col gap-3">
                <div>
                  <Label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-muted-foreground">
                    Cidade
                  </Label>
                  <Input
                    className="mt-1 h-[34px]"
                    placeholder="Ex: Belo Horizonte"
                    maxLength={100}
                    value={cidadeLocal}
                    onChange={(e) => handleCidadeChange(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-muted-foreground">
                      Estado
                    </Label>
                    <Select
                      value={filters.estado ?? 'todos'}
                      onValueChange={(v) => update({ estado: v === 'todos' ? undefined : v })}
                    >
                      <SelectTrigger className="mt-1 h-[34px] text-sm">
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

                  <div>
                    <Label className="text-[11px] uppercase tracking-[0.06em] font-semibold text-muted-foreground">
                      Origem
                    </Label>
                    <Input
                      className="mt-1 h-[34px]"
                      placeholder="Ex: evento"
                      maxLength={100}
                      value={origemLocal}
                      onChange={(e) => handleOrigemChange(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </SegmentCard>

                      </div>

          {/* ── Footer fixo ── */}
          <div className="flex gap-2 px-5 py-3.5 border-t bg-background flex-shrink-0 shadow-[0_-2px_8px_rgba(15,23,42,0.04)]">
            <Button
              variant="ghost"
              className="flex-1"
              onClick={clearAll}
            >
              Limpar tudo
            </Button>
            <Button
              className="flex-1"
              onClick={() => setDrawerOpen(false)}
            >
              Aplicar
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
