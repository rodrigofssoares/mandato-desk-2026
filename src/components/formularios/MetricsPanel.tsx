// EM054 — Aba Métricas do editor de formulários
import { Users, MousePointerClick, Percent, CalendarClock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useFormularioMetrics } from '@/hooks/useFormularios';
import { pctStr, formatarDataLonga, formatarDiaSerie } from './formularioUtils';
import type { Formulario } from '@/types/formularios';

interface MetricsPanelProps {
  formulario: Formulario;
}

interface KpiCardProps {
  icon: React.ReactNode;
  label: string;
  valor: string;
  sub?: string;
}

function KpiCard({ icon, label, valor, sub }: KpiCardProps) {
  return (
    <div className="bg-card border rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-2">
        {icon}
        {label}
      </div>
      <strong className="block text-3xl font-bold font-mono text-foreground leading-tight">
        {valor}
      </strong>
      {sub && <span className="text-xs text-emerald-600 font-medium mt-1 block">{sub}</span>}
    </div>
  );
}

export function MetricsPanel({ formulario }: MetricsPanelProps) {
  const { data: metrics, isLoading, error } = useFormularioMetrics(formulario.id);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-52 w-full rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="m-6 p-4 rounded-lg border border-destructive/30 bg-destructive/5 text-sm text-destructive">
        Erro ao carregar métricas: {(error as Error).message}
      </div>
    );
  }

  if (!metrics) return null;

  const maxCount = Math.max(...metrics.serie_diaria.map((d) => d.count), 1);

  return (
    <div className="p-6 space-y-6 overflow-y-auto">
      <div>
        <h2 className="text-lg font-semibold mb-1">
          Métricas — {formulario.titulo}
        </h2>
        <p className="text-sm text-muted-foreground">Dados em tempo real do formulário.</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          icon={<Users className="h-3.5 w-3.5 text-primary" />}
          label="Preenchimentos"
          valor={metrics.total_respostas.toLocaleString('pt-BR')}
        />
        <KpiCard
          icon={<MousePointerClick className="h-3.5 w-3.5 text-primary" />}
          label="Visitas"
          valor={metrics.total_visitas.toLocaleString('pt-BR')}
        />
        <KpiCard
          icon={<Percent className="h-3.5 w-3.5 text-primary" />}
          label="Conversão"
          valor={pctStr(metrics.taxa_conversao)}
        />
        <KpiCard
          icon={<CalendarClock className="h-3.5 w-3.5 text-primary" />}
          label="Encerra em"
          valor={formulario.encerra_em ? (() => {
            const diff = new Date(formulario.encerra_em).getTime() - Date.now();
            if (diff <= 0) return 'Encerrado';
            const dias = Math.floor(diff / 86400000);
            const horas = Math.floor((diff % 86400000) / 3600000);
            return dias > 0 ? `${dias}d ${horas}h` : `${horas}h`;
          })() : '—'}
          sub={formulario.encerra_em ? formatarDataLonga(formulario.encerra_em) : undefined}
        />
      </div>

      {/* Gráfico de barras — últimos 7 dias */}
      <div className="bg-card border rounded-xl p-5 shadow-sm">
        <h3 className="text-sm font-semibold mb-4">Preenchimentos por dia (últimos 7 dias)</h3>

        {metrics.serie_diaria.every((d) => d.count === 0) ? (
          <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
            Nenhum preenchimento neste período.
          </div>
        ) : (
          <div className="flex items-end gap-2 h-44 pt-2" role="img" aria-label="Gráfico de preenchimentos por dia">
            {metrics.serie_diaria.map((d) => {
              const pct = maxCount > 0 ? (d.count / maxCount) * 100 : 0;
              return (
                <div key={d.dia} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {d.count > 0 ? d.count : ''}
                  </span>
                  <div
                    className="w-full bg-primary rounded-t-md transition-all duration-500"
                    style={{ height: `${Math.max(pct, d.count > 0 ? 4 : 0)}%` }}
                    aria-label={`${d.count} preenchimento(s) em ${d.dia}`}
                  />
                  <span className="text-[10px] text-muted-foreground">
                    {formatarDiaSerie(d.dia)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
