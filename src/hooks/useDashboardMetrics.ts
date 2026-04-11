import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  startOfDay,
  endOfDay,
  startOfMonth,
  endOfMonth,
  subDays,
  subMonths,
} from 'date-fns';

// ============================================================================
// Tipos
// ============================================================================

export type DashboardPeriod = 'hoje' | '7d' | '30d' | 'mes';

export interface StatWithDelta {
  current: number;
  previous: number;
  /** Variação percentual em relação ao período anterior (null se previous=0). */
  deltaPct: number | null;
}

export interface SaudeBase {
  ativos: number;
  inativos: number;
  perdidos: number;
  total: number;
}

export interface FunilStage {
  stage_id: string;
  nome: string;
  cor: string | null;
  count: number;
}

export type AlertType =
  | 'contato_parado'
  | 'tarefa_vencida'
  | 'aniversariante_sem_tarefa';

export interface Alert {
  id: string;
  type: AlertType;
  title: string;
  subtitle: string;
  /** Link interno (contato, tarefa, etc). */
  href?: string;
}

export interface DashboardMetrics {
  baseTotal: StatWithDelta;
  novosNoPeriodo: StatWithDelta;
  votoDeclarado: StatWithDelta & { taxa: number };
  multiplicadores: StatWithDelta;
  saudeBase: SaudeBase;
  funilStages: FunilStage[];
  alertas: Alert[];
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Retorna os ranges ISO do período atual e do anterior (para comparação delta).
 * - hoje: hoje vs. ontem
 * - 7d: últimos 7d vs. 7 dias anteriores
 * - 30d: últimos 30d vs. 30 dias anteriores
 * - mes: mês corrente vs. mês anterior
 */
function getPeriodRanges(period: DashboardPeriod) {
  const now = new Date();

  if (period === 'hoje') {
    const currStart = startOfDay(now);
    const currEnd = endOfDay(now);
    const prevStart = startOfDay(subDays(now, 1));
    const prevEnd = endOfDay(subDays(now, 1));
    return {
      current: { start: currStart.toISOString(), end: currEnd.toISOString() },
      previous: { start: prevStart.toISOString(), end: prevEnd.toISOString() },
    };
  }

  if (period === '7d') {
    const currStart = startOfDay(subDays(now, 6));
    const currEnd = endOfDay(now);
    const prevStart = startOfDay(subDays(now, 13));
    const prevEnd = endOfDay(subDays(now, 7));
    return {
      current: { start: currStart.toISOString(), end: currEnd.toISOString() },
      previous: { start: prevStart.toISOString(), end: prevEnd.toISOString() },
    };
  }

  if (period === '30d') {
    const currStart = startOfDay(subDays(now, 29));
    const currEnd = endOfDay(now);
    const prevStart = startOfDay(subDays(now, 59));
    const prevEnd = endOfDay(subDays(now, 30));
    return {
      current: { start: currStart.toISOString(), end: currEnd.toISOString() },
      previous: { start: prevStart.toISOString(), end: prevEnd.toISOString() },
    };
  }

  // mes
  const currStart = startOfMonth(now);
  const currEnd = endOfMonth(now);
  const prevStart = startOfMonth(subMonths(now, 1));
  const prevEnd = endOfMonth(subMonths(now, 1));
  return {
    current: { start: currStart.toISOString(), end: currEnd.toISOString() },
    previous: { start: prevStart.toISOString(), end: prevEnd.toISOString() },
  };
}

function calcDelta(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

async function countContacts(filter: (q: any) => any): Promise<number> {
  let q = supabase
    .from('contacts')
    .select('*', { count: 'exact', head: true })
    .is('merged_into', null);
  q = filter(q);
  const { count, error } = await q;
  if (error) throw error;
  return count ?? 0;
}

// ============================================================================
// Hook principal
// ============================================================================

/**
 * Calcula todas as métricas exibidas no Dashboard com comparação de período.
 * @param period Janela temporal do dashboard
 * @param boardId Board (funil) usado pelo card BoardFunnelCard e alerta "parado 5+ dias"
 */
export function useDashboardMetrics(
  period: DashboardPeriod,
  boardId?: string | null
) {
  return useQuery<DashboardMetrics>({
    queryKey: ['dashboard', 'metrics', period, boardId ?? null],
    queryFn: async () => {
      const ranges = getPeriodRanges(period);

      // ── Base total (snapshot agora vs. snapshot fim do período anterior) ──
      // "Previous" = quantos contatos existiam no fim do período anterior (created_at <= prevEnd).
      const [baseTotalCurrent, baseTotalPrevious] = await Promise.all([
        countContacts((q) => q),
        countContacts((q) => q.lte('created_at', ranges.previous.end)),
      ]);

      // ── Novos no período vs. período anterior ──
      const [novosCurrent, novosPrevious] = await Promise.all([
        countContacts((q) =>
          q.gte('created_at', ranges.current.start).lte('created_at', ranges.current.end)
        ),
        countContacts((q) =>
          q.gte('created_at', ranges.previous.start).lte('created_at', ranges.previous.end)
        ),
      ]);

      // ── Voto declarado (snapshot atual vs. snapshot anterior) ──
      const [votoCurrent, votoPrevious] = await Promise.all([
        countContacts((q) => q.eq('declarou_voto', true)),
        countContacts((q) =>
          q.eq('declarou_voto', true).lte('updated_at', ranges.previous.end)
        ),
      ]);
      const votoTaxa = baseTotalCurrent > 0 ? (votoCurrent / baseTotalCurrent) * 100 : 0;

      // ── Multiplicadores ──
      const [multCurrent, multPrevious] = await Promise.all([
        countContacts((q) => q.eq('e_multiplicador', true)),
        countContacts((q) =>
          q.eq('e_multiplicador', true).lte('updated_at', ranges.previous.end)
        ),
      ]);

      // ── Saúde da base: ativos / inativos / perdidos por data do último contato ──
      // Regra simples: ativo = atualizado nos últimos 30d, inativo = 30–90d, perdido = 90d+.
      const now = new Date();
      const cutoff30 = subDays(now, 30).toISOString();
      const cutoff90 = subDays(now, 90).toISOString();

      const [ativos, inativos, perdidos] = await Promise.all([
        countContacts((q) => q.gte('updated_at', cutoff30)),
        countContacts((q) => q.lt('updated_at', cutoff30).gte('updated_at', cutoff90)),
        countContacts((q) => q.lt('updated_at', cutoff90)),
      ]);
      const saudeTotal = ativos + inativos + perdidos;

      // ── Funil do board selecionado ──
      let funilStages: FunilStage[] = [];
      if (boardId) {
        const { data: stagesData, error: stagesErr } = await supabase
          .from('board_stages')
          .select('id, nome, cor, ordem')
          .eq('board_id', boardId)
          .order('ordem', { ascending: true });
        if (stagesErr) throw stagesErr;

        const { data: itemsData, error: itemsErr } = await supabase
          .from('board_items')
          .select('stage_id')
          .eq('board_id', boardId);
        if (itemsErr) throw itemsErr;

        const counts: Record<string, number> = {};
        for (const row of itemsData ?? []) {
          counts[row.stage_id] = (counts[row.stage_id] ?? 0) + 1;
        }
        funilStages = (stagesData ?? []).map((s) => ({
          stage_id: s.id,
          nome: s.nome,
          cor: s.cor,
          count: counts[s.id] ?? 0,
        }));
      }

      // ── Alertas ──
      const alertas: Alert[] = [];

      // 1. Contatos parados 5+ dias no board ativo
      if (boardId) {
        const cutoff5 = subDays(now, 5).toISOString();
        const { data: parados, error: paradosErr } = await supabase
          .from('board_items')
          .select('id, moved_at, contact:contacts(id, nome)')
          .eq('board_id', boardId)
          .lte('moved_at', cutoff5)
          .limit(50);
        if (paradosErr) throw paradosErr;

        for (const raw of (parados ?? []) as unknown as Array<{
          id: string;
          moved_at: string;
          contact: { id: string; nome: string } | { id: string; nome: string }[] | null;
        }>) {
          const contactNode = Array.isArray(raw.contact) ? raw.contact[0] : raw.contact;
          if (!contactNode) continue;
          const dias = Math.floor(
            (now.getTime() - new Date(raw.moved_at).getTime()) / (1000 * 60 * 60 * 24)
          );
          alertas.push({
            id: `parado-${raw.id}`,
            type: 'contato_parado',
            title: contactNode.nome,
            subtitle: `Parado há ${dias} dia${dias === 1 ? '' : 's'} no funil`,
            href: `/board?board=${boardId}`,
          });
        }
      }

      // 2. Tarefas vencidas (data_agendada < hoje AND concluida = false)
      const { data: vencidas, error: vencidasErr } = await supabase
        .from('tarefas')
        .select('id, titulo, data_agendada')
        .eq('concluida', false)
        .lt('data_agendada', startOfDay(now).toISOString())
        .order('data_agendada', { ascending: true })
        .limit(50);
      if (vencidasErr) throw vencidasErr;

      for (const t of vencidas ?? []) {
        const dias = t.data_agendada
          ? Math.floor(
              (now.getTime() - new Date(t.data_agendada).getTime()) / (1000 * 60 * 60 * 24)
            )
          : 0;
        alertas.push({
          id: `vencida-${t.id}`,
          type: 'tarefa_vencida',
          title: t.titulo,
          subtitle: `Atrasada há ${dias} dia${dias === 1 ? '' : 's'}`,
          href: `/tarefas`,
        });
      }

      // 3. Aniversariantes hoje sem tarefa de parabéns
      const todayMonth = now.getMonth() + 1; // 1-12
      const todayDay = now.getDate();
      const mmdd = `${todayMonth.toString().padStart(2, '0')}-${todayDay
        .toString()
        .padStart(2, '0')}`;
      // Supabase PG: precisamos buscar todos com data_nascimento e filtrar local
      const { data: aniversariantes, error: aniErr } = await supabase
        .from('contacts')
        .select('id, nome, data_nascimento')
        .is('merged_into', null)
        .not('data_nascimento', 'is', null);
      if (aniErr) throw aniErr;

      const aniversariantesHoje = (aniversariantes ?? []).filter((c) => {
        if (!c.data_nascimento) return false;
        // data_nascimento é "YYYY-MM-DD"
        return c.data_nascimento.slice(5) === mmdd;
      });

      if (aniversariantesHoje.length > 0) {
        const ids = aniversariantesHoje.map((c) => c.id);
        const { data: tarefasHoje, error: tHojeErr } = await supabase
          .from('tarefas')
          .select('contact_id')
          .in('contact_id', ids)
          .gte('data_agendada', startOfDay(now).toISOString())
          .lte('data_agendada', endOfDay(now).toISOString());
        if (tHojeErr) throw tHojeErr;

        const comTarefa = new Set((tarefasHoje ?? []).map((t) => t.contact_id));
        for (const c of aniversariantesHoje) {
          if (!comTarefa.has(c.id)) {
            alertas.push({
              id: `ani-${c.id}`,
              type: 'aniversariante_sem_tarefa',
              title: c.nome,
              subtitle: 'Aniversário hoje — sem tarefa agendada',
              href: `/contacts?contact=${c.id}`,
            });
          }
        }
      }

      return {
        baseTotal: {
          current: baseTotalCurrent,
          previous: baseTotalPrevious,
          deltaPct: calcDelta(baseTotalCurrent, baseTotalPrevious),
        },
        novosNoPeriodo: {
          current: novosCurrent,
          previous: novosPrevious,
          deltaPct: calcDelta(novosCurrent, novosPrevious),
        },
        votoDeclarado: {
          current: votoCurrent,
          previous: votoPrevious,
          deltaPct: calcDelta(votoCurrent, votoPrevious),
          taxa: votoTaxa,
        },
        multiplicadores: {
          current: multCurrent,
          previous: multPrevious,
          deltaPct: calcDelta(multCurrent, multPrevious),
        },
        saudeBase: {
          ativos,
          inativos,
          perdidos,
          total: saudeTotal,
        },
        funilStages,
        alertas,
      };
    },
  });
}
