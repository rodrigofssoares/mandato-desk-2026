import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  startOfDay,
  subDays,
  startOfMonth,
  endOfMonth,
  subMonths,
  format,
  getMonth,
  getDate,
  addDays,
} from 'date-fns';

// ── Contact Stats ──────────────────────────────────────────
export function useContactStats() {
  return useQuery({
    queryKey: ['dashboard', 'contactStats'],
    queryFn: async () => {
      const { count: total, error: e1 } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .is('merged_into', null);
      if (e1) throw e1;

      const { count: voteDeclared, error: e2 } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .is('merged_into', null)
        .eq('declarou_voto', true);
      if (e2) throw e2;

      const { count: favorites, error: e3 } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .is('merged_into', null)
        .eq('is_favorite', true);
      if (e3) throw e3;

      const { count: withAddress, error: e4 } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .is('merged_into', null)
        .not('address', 'is', null);
      if (e4) throw e4;

      return {
        total: total ?? 0,
        voteDeclared: voteDeclared ?? 0,
        favorites: favorites ?? 0,
        withAddress: withAddress ?? 0,
      };
    },
  });
}

// ── Growth Metrics ─────────────────────────────────────────
export function useGrowthMetrics() {
  return useQuery({
    queryKey: ['dashboard', 'growthMetrics'],
    queryFn: async () => {
      const now = new Date();
      const todayStart = startOfDay(now).toISOString();
      const yesterdayStart = startOfDay(subDays(now, 1)).toISOString();
      const last7Start = startOfDay(subDays(now, 6)).toISOString();
      const thisMonthStart = startOfMonth(now).toISOString();
      const lastMonthStart = startOfMonth(subMonths(now, 1)).toISOString();
      const lastMonthEnd = endOfMonth(subMonths(now, 1)).toISOString();

      const countSince = async (gte: string, lt?: string) => {
        let q = supabase
          .from('contacts')
          .select('*', { count: 'exact', head: true })
          .is('merged_into', null)
          .gte('created_at', gte);
        if (lt) q = q.lt('created_at', lt);
        const { count, error } = await q;
        if (error) throw error;
        return count ?? 0;
      };

      const [today, yesterday, last7, thisMonth, lastMonth] = await Promise.all([
        countSince(todayStart),
        countSince(yesterdayStart, todayStart),
        countSince(last7Start),
        countSince(thisMonthStart),
        countSince(lastMonthStart, lastMonthEnd),
      ]);

      return { today, yesterday, last7, thisMonth, lastMonth };
    },
  });
}

// ── Growth Chart Data (last 30 days) ───────────────────────
export function useGrowthChartData() {
  return useQuery({
    queryKey: ['dashboard', 'growthChart'],
    queryFn: async () => {
      const now = new Date();
      const start = startOfDay(subDays(now, 29));

      const { data, error } = await supabase
        .from('contacts')
        .select('created_at')
        .is('merged_into', null)
        .gte('created_at', start.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Build a map of date → count
      const countMap: Record<string, number> = {};
      for (let i = 0; i < 30; i++) {
        const d = format(addDays(start, i), 'yyyy-MM-dd');
        countMap[d] = 0;
      }

      (data ?? []).forEach((row) => {
        const d = format(new Date(row.created_at), 'yyyy-MM-dd');
        if (d in countMap) countMap[d]++;
      });

      return Object.entries(countMap).map(([date, count]) => ({
        date,
        label: format(new Date(date), 'dd/MM'),
        count,
      }));
    },
  });
}

// ── Tag Distribution ───────────────────────────────────────
export function useTagDistribution() {
  return useQuery({
    queryKey: ['dashboard', 'tagDistribution'],
    queryFn: async () => {
      // Fetch all contact_tags with their tag info
      const { data: contactTags, error: e1 } = await supabase
        .from('contact_tags')
        .select('tag_id');
      if (e1) throw e1;

      const { data: tags, error: e2 } = await supabase
        .from('tags')
        .select('id, name, color');
      if (e2) throw e2;

      // Count contacts per tag
      const tagCountMap: Record<string, number> = {};
      (contactTags ?? []).forEach((ct) => {
        tagCountMap[ct.tag_id] = (tagCountMap[ct.tag_id] ?? 0) + 1;
      });

      const tagMap = new Map((tags ?? []).map((t) => [t.id, t]));

      const result = Object.entries(tagCountMap)
        .map(([tagId, count]) => {
          const tag = tagMap.get(tagId);
          return tag ? { name: tag.name, color: tag.color, count } : null;
        })
        .filter(Boolean)
        .sort((a, b) => b!.count - a!.count)
        .slice(0, 8) as { name: string; color: string; count: number }[];

      return result;
    },
  });
}

// ── Vote Stats ─────────────────────────────────────────────
export function useVoteStats() {
  return useQuery({
    queryKey: ['dashboard', 'voteStats'],
    queryFn: async () => {
      const { count: total, error: e1 } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .is('merged_into', null);
      if (e1) throw e1;

      const { count: declared, error: e2 } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .is('merged_into', null)
        .eq('declarou_voto', true);
      if (e2) throw e2;

      const t = total ?? 0;
      const d = declared ?? 0;
      return { declared: d, notDeclared: t - d, total: t };
    },
  });
}

// ── Birthdays ──────────────────────────────────────────────
export function useBirthdays() {
  return useQuery({
    queryKey: ['dashboard', 'birthdays'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, name, birth_date')
        .is('merged_into', null)
        .not('birth_date', 'is', null);

      if (error) throw error;

      const now = new Date();
      const todayMonth = getMonth(now);
      const todayDay = getDate(now);

      type BirthdayContact = {
        id: string;
        name: string;
        birthDate: string;
        displayDate: string;
        age: number | null;
      };

      const today: BirthdayContact[] = [];
      const next7: BirthdayContact[] = [];

      (data ?? []).forEach((c) => {
        if (!c.birth_date) return;
        const bd = new Date(c.birth_date + 'T00:00:00');
        const bMonth = getMonth(bd);
        const bDay = getDate(bd);
        const bYear = bd.getFullYear();

        const displayDate = format(bd, 'dd/MM');
        const age = bYear > 1900 ? now.getFullYear() - bYear : null;

        // Check if birthday is today
        if (bMonth === todayMonth && bDay === todayDay) {
          today.push({ id: c.id, name: c.name, birthDate: c.birth_date, displayDate, age });
          return;
        }

        // Check next 7 days
        for (let i = 1; i <= 7; i++) {
          const futureDate = addDays(now, i);
          if (bMonth === getMonth(futureDate) && bDay === getDate(futureDate)) {
            next7.push({ id: c.id, name: c.name, birthDate: c.birth_date, displayDate, age });
            return;
          }
        }
      });

      return { today, next7 };
    },
  });
}

// ── Recent Activities ──────────────────────────────────────
export function useRecentActivities(
  page: number,
  filters: { activityType?: string; responsibleId?: string }
) {
  return useQuery({
    queryKey: ['dashboard', 'activities', page, filters],
    queryFn: async () => {
      const pageSize = 10;
      let query = supabase
        .from('activities')
        .select('*, profiles:responsible_id(name)')
        .order('created_at', { ascending: false })
        .range(0, (page + 1) * pageSize - 1);

      if (filters.activityType) {
        query = query.eq('type', filters.activityType);
      }
      if (filters.responsibleId) {
        query = query.eq('responsible_id', filters.responsibleId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data ?? []).map((a: any) => ({
        id: a.id,
        type: a.type as string,
        entityType: a.entity_type as string,
        entityName: a.entity_name as string | null,
        description: a.description as string | null,
        responsibleName: a.profiles?.name ?? 'Sistema',
        createdAt: a.created_at as string,
      }));
    },
  });
}

// ── Profiles List (for filter dropdowns) ───────────────────
export function useProfilesList() {
  return useQuery({
    queryKey: ['dashboard', 'profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });
}
