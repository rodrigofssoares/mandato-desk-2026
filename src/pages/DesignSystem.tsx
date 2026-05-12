import {
  Activity,
  AlertTriangle,
  Bell,
  CheckCircle2,
  Crown,
  Inbox,
  Info,
  Palette,
  Plus,
  Search,
  Sparkles,
  Users,
  XCircle,
} from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import {
  PageHeader,
  PanelHeader,
  IconBubble,
  SectionEyebrow,
  StatusChip,
  EmptyState,
  ColorPicker,
  type IconBubbleVariant,
  type StatusChipVariant,
} from '@/components/ui-system';
import { usePermissions } from '@/hooks/usePermissions';

/**
 * /design-system — catálogo visual dos primitivos do app.
 * Auto-documentação: rode `npm run dev` e acesse /design-system pra ver
 * todos os primitives disponíveis com exemplo de uso.
 *
 * Gateado por `can.accessDesignSystem()` (secao `design_system`, migration 050)
 * — por padrão só admin e proprietário enxergam o catálogo.
 */
export default function DesignSystem() {
  const [demoColor, setDemoColor] = useState('#7B1E2E');
  const { can, isLoading: isPermLoading } = usePermissions();

  if (isPermLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!can.accessDesignSystem()) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Você não tem permissão para acessar o Design System.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-10 max-w-6xl">
      <PageHeader
        eyebrow="Foundation"
        title="Design System"
        description="Catálogo dos primitivos visuais do Mandato Desk. Use estes blocos pra construir telas novas sem reinventar padrões."
        icon={Palette}
        iconVariant="accent"
        actions={
          <StatusChip variant="success" tone="solid">
            v1.0
          </StatusChip>
        }
      />

      {/* === Tokens semânticos === */}
      <Section
        eyebrow="Tokens"
        title="Cores semânticas"
        description="4 tons universais com 4 variantes cada. Use sempre via tokens, nunca via cores Tailwind diretas."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {SEMANTIC_TOKENS.map((t) => (
            <Card key={t.name} className="overflow-hidden">
              <div className={`h-16 ${t.solidBg}`} />
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-display font-semibold capitalize">{t.name}</h4>
                  <code className="text-[0.65rem] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    --{t.name}
                  </code>
                </div>
                <div className="space-y-1.5">
                  <SwatchRow label={`bg-${t.name}`} className={t.solidBg} />
                  <SwatchRow label={`bg-${t.name}-soft`} className={t.softBg} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </Section>

      {/* === Tokens do tema === */}
      <Section
        eyebrow="Tokens"
        title="Cores do tema"
        description="Mudam quando o usuário troca entre Burgundy e Navy. Use pra primary actions e accents."
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <ThemeSwatch name="primary" className="bg-primary" />
          <ThemeSwatch name="accent" className="bg-accent" />
          <ThemeSwatch name="foreground" className="bg-foreground" />
          <ThemeSwatch name="muted" className="bg-muted border border-border" />
          <ThemeSwatch name="background" className="bg-background border border-border" />
          <ThemeSwatch name="card" className="bg-card border border-border" />
          <ThemeSwatch name="border" className="bg-border" />
          <ThemeSwatch name="ring" className="bg-ring" />
        </div>
      </Section>

      {/* === IconBubble === */}
      <Section
        eyebrow="Primitivo"
        title="IconBubble"
        description="Bubble arredondado com ícone — 3 tamanhos × 7 variantes semânticas."
        codeSample={`<IconBubble icon={Activity} variant="success" size="md" />`}
      >
        <div className="space-y-5">
          <div>
            <SectionEyebrow tone="muted" className="mb-3">
              Tamanhos
            </SectionEyebrow>
            <div className="flex items-end gap-4">
              <div className="text-center">
                <IconBubble icon={Activity} size="sm" />
                <p className="text-xs text-muted-foreground mt-2">sm</p>
              </div>
              <div className="text-center">
                <IconBubble icon={Activity} size="md" />
                <p className="text-xs text-muted-foreground mt-2">md (default)</p>
              </div>
              <div className="text-center">
                <IconBubble icon={Activity} size="lg" />
                <p className="text-xs text-muted-foreground mt-2">lg</p>
              </div>
            </div>
          </div>
          <div>
            <SectionEyebrow tone="muted" className="mb-3">
              Variantes
            </SectionEyebrow>
            <div className="flex items-end gap-4 flex-wrap">
              {ICON_VARIANTS.map(({ variant, icon }) => (
                <div key={variant} className="text-center">
                  <IconBubble icon={icon} variant={variant} size="md" />
                  <p className="text-xs text-muted-foreground mt-2">{variant}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* === SectionEyebrow === */}
      <Section
        eyebrow="Primitivo"
        title="SectionEyebrow"
        description="Texto pequeno em uppercase com tracking — usado acima de títulos pra contexto."
        codeSample={`<SectionEyebrow tone="accent">Visão geral · Maio 2026</SectionEyebrow>`}
      >
        <div className="space-y-3">
          {(['accent', 'primary', 'muted', 'success', 'warning', 'info', 'danger'] as const).map(
            (tone) => (
              <div key={tone}>
                <SectionEyebrow tone={tone}>tone={`"${tone}"`}</SectionEyebrow>
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                  text-{tone === 'muted' ? 'muted-foreground' : tone}
                </p>
              </div>
            ),
          )}
        </div>
      </Section>

      {/* === StatusChip === */}
      <Section
        eyebrow="Primitivo"
        title="StatusChip"
        description="Chip semântico — 8 variantes × 2 tones × 2 tamanhos."
        codeSample={`<StatusChip variant="success" tone="soft">Ativo</StatusChip>`}
      >
        <div className="space-y-5">
          <div>
            <SectionEyebrow tone="muted" className="mb-3">
              Tone soft (default)
            </SectionEyebrow>
            <div className="flex items-center gap-2 flex-wrap">
              {(
                [
                  'primary',
                  'accent',
                  'success',
                  'warning',
                  'info',
                  'danger',
                  'neutral',
                  'outline',
                ] as StatusChipVariant[]
              ).map((variant) => (
                <StatusChip key={variant} variant={variant}>
                  {variant}
                </StatusChip>
              ))}
            </div>
          </div>
          <div>
            <SectionEyebrow tone="muted" className="mb-3">
              Tone solid
            </SectionEyebrow>
            <div className="flex items-center gap-2 flex-wrap">
              {(
                ['primary', 'accent', 'success', 'warning', 'info', 'danger'] as StatusChipVariant[]
              ).map((variant) => (
                <StatusChip key={variant} variant={variant} tone="solid">
                  {variant}
                </StatusChip>
              ))}
            </div>
          </div>
          <div>
            <SectionEyebrow tone="muted" className="mb-3">
              Com ícone + tamanhos
            </SectionEyebrow>
            <div className="flex items-center gap-2 flex-wrap">
              <StatusChip variant="success" icon={<CheckCircle2 className="h-3 w-3" />}>
                Aprovado
              </StatusChip>
              <StatusChip
                variant="warning"
                size="md"
                icon={<AlertTriangle className="h-3.5 w-3.5" />}
              >
                Pendente
              </StatusChip>
              <StatusChip
                variant="danger"
                tone="solid"
                size="md"
                icon={<XCircle className="h-3.5 w-3.5" />}
              >
                Bloqueado
              </StatusChip>
            </div>
          </div>
        </div>
      </Section>

      {/* === EmptyState === */}
      <Section
        eyebrow="Primitivo"
        title="EmptyState"
        description="Estado vazio padronizado — ícone + título + descrição + CTA opcional."
        codeSample={`<EmptyState
  icon={Inbox}
  title="Nenhuma demanda registrada"
  description="As demandas dos seus contatos aparecerão aqui."
  action={<Button onClick={...}>Nova demanda</Button>}
/>`}
      >
        <Card>
          <EmptyState
            icon={Inbox}
            title="Nenhum item encontrado"
            description="Tente ajustar os filtros ou comece adicionando o primeiro."
            action={
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar item
              </Button>
            }
          />
        </Card>
      </Section>

      {/* === PageHeader === */}
      <Section
        eyebrow="Primitivo"
        title="PageHeader"
        description="Cabeçalho padronizado pro topo de cada página. Já em uso nas 14 páginas principais."
        codeSample={`<PageHeader
  eyebrow="Operação"
  title="Contatos"
  description="Gerencie sua base eleitoral."
  icon={Users}
  iconVariant="primary"
  actions={<Button>Novo Contato</Button>}
/>`}
      >
        <Card>
          <CardContent className="p-6">
            <PageHeader
              eyebrow="Operação"
              title="Contatos"
              description="Gerencie e segmente sua base eleitoral."
              icon={Users}
              iconVariant="primary"
              actions={
                <>
                  <StatusChip variant="primary" size="md">
                    6.379
                  </StatusChip>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Contato
                  </Button>
                </>
              }
            >
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Buscar contatos..." className="pl-9" />
              </div>
            </PageHeader>
          </CardContent>
        </Card>
      </Section>

      {/* === ColorPicker === */}
      <Section
        eyebrow="Primitivo"
        title="ColorPicker"
        description="Seletor de cor com paleta sugerida do design system + roda de cores nativa pra qualquer hex. Em uso em Etiquetas, estágios de funil e qualquer campo de cor do app."
        codeSample={`<ColorPicker
  label="Cor da etiqueta"
  value={color}
  onChange={setColor}
  // presets={STAGE_HEX_PRESETS}  // opcional — paleta customizada
  // allowCustom={false}          // opcional — desabilita roda nativa
/>`}
      >
        <Card>
          <CardContent className="p-6 space-y-6">
            <ColorPicker
              label="Escolha uma cor"
              value={demoColor}
              onChange={setDemoColor}
            />
            <div className="flex items-center gap-3 pt-4 border-t border-border">
              <span className="text-xs text-muted-foreground">Preview:</span>
              <div
                className="w-10 h-10 rounded-full border-2 border-border"
                style={{ backgroundColor: demoColor }}
              />
              <code className="text-xs font-mono text-muted-foreground bg-muted px-2 py-1 rounded">
                {demoColor}
              </code>
              <span
                className="ml-auto inline-flex items-center px-3 py-1 rounded-full text-xs font-medium"
                style={{ backgroundColor: demoColor + '20', color: demoColor }}
              >
                Aplicado em chip
              </span>
            </div>
          </CardContent>
        </Card>
      </Section>

      {/* === PanelHeader === */}
      <Section
        eyebrow="Primitivo"
        title="PanelHeader"
        description="Versão card-internal do PageHeader. Use em Cards aninhados (painéis dentro de Settings, sub-cards em listagens). Por baixo é um <CardHeader>."
        codeSample={`<Card>
  <PanelHeader
    title="Lista de Funis"
    description="Funis ativos no projeto"
    icon={KanbanSquare}
    iconVariant="primary"
    actions={<Button>Novo</Button>}
  />
  <CardContent>...</CardContent>
</Card>`}
      >
        <Card>
          <PanelHeader
            title="Campos Personalizados"
            description="Adicione campos extras pra classificar seus contatos com informações específicas do seu mandato."
            icon={Sparkles}
            iconVariant="accent"
            actions={
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Novo
              </Button>
            }
          />
          <CardContent>
            <p className="text-sm text-muted-foreground">Conteúdo do painel aqui…</p>
          </CardContent>
        </Card>
      </Section>

      {/* === Tipografia === */}
      <Section
        eyebrow="Foundation"
        title="Tipografia"
        description="Hierarquia tipográfica padronizada via classes utilitárias."
      >
        <Card>
          <CardContent className="p-6 space-y-4">
            <div>
              <h1 className="font-display font-bold text-3xl text-foreground">
                Display H1 — Visão Geral
              </h1>
              <code className="text-xs text-muted-foreground mt-1 block">
                font-display font-bold text-3xl
              </code>
            </div>
            <div>
              <h2 className="font-display font-bold text-2xl text-foreground">
                Display H2 — Seção Principal
              </h2>
              <code className="text-xs text-muted-foreground mt-1 block">
                font-display font-bold text-2xl
              </code>
            </div>
            <div>
              <h3 className="font-display font-semibold text-base text-foreground">
                Display H3 — Card / Widget Title
              </h3>
              <code className="text-xs text-muted-foreground mt-1 block">
                font-display font-semibold text-base
              </code>
            </div>
            <div>
              <p className="text-sm text-foreground">
                Body — Texto padrão usado em descrições, parágrafos, conteúdo de cards.
              </p>
              <code className="text-xs text-muted-foreground mt-1 block">text-sm</code>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Caption — texto secundário, hints, metadados.
              </p>
              <code className="text-xs text-muted-foreground mt-1 block">
                text-xs text-muted-foreground
              </code>
            </div>
            <div>
              <SectionEyebrow>Eyebrow — Categorias / Contextos</SectionEyebrow>
              <code className="text-xs text-muted-foreground mt-1 block">
                {'<SectionEyebrow>'}
              </code>
            </div>
          </CardContent>
        </Card>
      </Section>

      <div className="pt-8 border-t border-border text-center text-xs text-muted-foreground">
        Mandato Desk Design System ·{' '}
        <code className="bg-muted px-1.5 py-0.5 rounded">
          {'import { ... } from "@/components/ui-system"'}
        </code>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Helpers internos                                                      */
/* ────────────────────────────────────────────────────────────────────── */

interface SectionProps {
  eyebrow: string;
  title: string;
  description?: string;
  codeSample?: string;
  children: React.ReactNode;
}

function Section({ eyebrow, title, description, codeSample, children }: SectionProps) {
  return (
    <section className="space-y-4">
      <div>
        <SectionEyebrow className="mb-1">{eyebrow}</SectionEyebrow>
        <h2 className="font-display font-bold text-xl text-foreground">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{description}</p>
        )}
      </div>
      {codeSample && (
        <pre className="text-[0.7rem] font-mono bg-muted text-muted-foreground p-3 rounded-lg overflow-x-auto border border-border">
          <code>{codeSample}</code>
        </pre>
      )}
      <div>{children}</div>
    </section>
  );
}

function SwatchRow({ label, className }: { label: string; className: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className={`h-5 w-5 rounded ${className} border border-border/50 shrink-0`} />
      <code className="font-mono text-muted-foreground">{label}</code>
    </div>
  );
}

function ThemeSwatch({ name, className }: { name: string; className: string }) {
  return (
    <div>
      <div className={`h-16 rounded-lg ${className}`} />
      <p className="text-xs font-medium mt-2">{name}</p>
      <code className="text-[0.65rem] text-muted-foreground font-mono">--{name}</code>
    </div>
  );
}

const SEMANTIC_TOKENS = [
  { name: 'success', solidBg: 'bg-success', softBg: 'bg-success-soft' },
  { name: 'warning', solidBg: 'bg-warning', softBg: 'bg-warning-soft' },
  { name: 'info', solidBg: 'bg-info', softBg: 'bg-info-soft' },
  { name: 'danger', solidBg: 'bg-danger', softBg: 'bg-danger-soft' },
];

const ICON_VARIANTS: Array<{ variant: IconBubbleVariant; icon: typeof Activity }> = [
  { variant: 'primary', icon: Sparkles },
  { variant: 'accent', icon: Crown },
  { variant: 'success', icon: CheckCircle2 },
  { variant: 'warning', icon: AlertTriangle },
  { variant: 'info', icon: Info },
  { variant: 'danger', icon: XCircle },
  { variant: 'neutral', icon: Bell },
];

