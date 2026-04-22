import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useRef, useState } from 'react';

// ---------- Types ----------

export interface MapContact {
  id: string;
  nome: string;
  instagram?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  lat: number;
  lng: number;
  pin_color?: string | null;
  declarou_voto?: boolean;
  created_at: string;
  contact_tags?: { tag_id: string; tags: { id: string; nome: string; cor: string | null } }[];
}

export interface MapFilters {
  tags?: string[];
  bairro?: string;
  declarou_voto?: boolean | null;
  date_from?: string;
  date_to?: string;
}

// ---------- useMapContacts ----------

export function useMapContacts(filters: MapFilters = {}) {
  return useQuery<MapContact[]>({
    queryKey: ['map-contacts', filters],
    queryFn: async () => {
      // Tag filter (OR) via embed !inner — filtra no server-side sem estourar
      // URL com lista de contact_ids.
      const usingTagFilter = filters.tags && filters.tags.length > 0;
      const selectClause = usingTagFilter
        ? 'id, nome, instagram, whatsapp, email, bairro, cidade, estado, cep, logradouro, numero, lat, lng, pin_color, declarou_voto, created_at, contact_tags!inner(tag_id)'
        : 'id, nome, instagram, whatsapp, email, bairro, cidade, estado, cep, logradouro, numero, lat, lng, pin_color, declarou_voto, created_at, contact_tags(tag_id, tags(id, nome, cor))';

      let query = supabase
        .from('contacts')
        .select(selectClause)
        .not('lat', 'is', null)
        .not('lng', 'is', null);

      if (usingTagFilter) {
        query = query.in('contact_tags.tag_id', filters.tags as string[]);
      }

      // Bairro filter
      if (filters.bairro && filters.bairro.trim()) {
        query = query.ilike('bairro', `%${filters.bairro.trim()}%`);
      }

      // Declarou voto
      if (filters.declarou_voto === true) {
        query = query.eq('declarou_voto', true);
      } else if (filters.declarou_voto === false) {
        query = query.eq('declarou_voto', false);
      }

      // Date range
      if (filters.date_from) {
        query = query.gte('created_at', filters.date_from);
      }
      if (filters.date_to) {
        query = query.lte('created_at', `${filters.date_to}T23:59:59`);
      }

      const { data, error } = await query;
      if (error) throw error;

      let rows = (data ?? []) as unknown as MapContact[];

      // Hidrata tags completas (nome/cor) quando o filtro reduziu o embed.
      if (usingTagFilter && rows.length > 0) {
        const ids = rows.map((r) => r.id);
        const { data: tagRows, error: tagError } = await supabase
          .from('contact_tags')
          .select('contact_id, tag_id, tags(id, nome, cor)')
          .in('contact_id', ids);
        if (tagError) throw tagError;

        const byContact = new Map<string, MapContact['contact_tags']>();
        (tagRows ?? []).forEach((r: any) => {
          const arr = byContact.get(r.contact_id) ?? [];
          arr!.push({ tag_id: r.tag_id, tags: r.tags });
          byContact.set(r.contact_id, arr);
        });
        rows = rows.map((r) => ({ ...r, contact_tags: byContact.get(r.id) ?? [] }));
      }

      return rows;
    },
  });
}

// ---------- useMapStats ----------

export function useMapStats() {
  return useQuery({
    queryKey: ['map-stats'],
    queryFn: async () => {
      const { count: total } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true });

      const { count: withCoords } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .not('lat', 'is', null)
        .not('lng', 'is', null);

      const { count: withCep } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .not('cep', 'is', null)
        .neq('cep', '')
        .or('lat.is.null,lng.is.null');

      const withoutCoords = (total ?? 0) - (withCoords ?? 0);

      return {
        total: total ?? 0,
        withCoords: withCoords ?? 0,
        withoutCoords,
        pendingGeocode: withCep ?? 0,
      };
    },
  });
}

// ---------- useGeocodeContacts ----------

export interface GeocodeProgress {
  total: number;
  processed: number;
  success: number;
  failed: number;
  status: 'idle' | 'running' | 'done' | 'cancelled';
}

export function useGeocodeContacts() {
  const queryClient = useQueryClient();
  const cancelledRef = useRef(false);
  const [progress, setProgress] = useState<GeocodeProgress>({
    total: 0,
    processed: 0,
    success: 0,
    failed: 0,
    status: 'idle',
  });

  const cancel = () => {
    cancelledRef.current = true;
  };

  const mutation = useMutation({
    mutationFn: async () => {
      cancelledRef.current = false;

      // Get contacts with CEP but no coordinates
      const { data: contacts, error } = await supabase
        .from('contacts')
        .select('id, cep')
        .not('cep', 'is', null)
        .neq('cep', '')
        .or('lat.is.null,lng.is.null');

      if (error) throw error;
      if (!contacts || contacts.length === 0) {
        toast.info('Nenhum contato pendente de geocodificação');
        return;
      }

      setProgress({ total: contacts.length, processed: 0, success: 0, failed: 0, status: 'running' });

      let success = 0;
      let failed = 0;

      for (let i = 0; i < contacts.length; i++) {
        if (cancelledRef.current) {
          setProgress((p) => ({ ...p, status: 'cancelled' }));
          break;
        }

        const contact = contacts[i];
        const cep = contact.cep!.replace(/\D/g, '');

        try {
          // Check cache first
          const { data: cached } = await supabase
            .from('cep_coordinates')
            .select('lat, lng')
            .eq('cep', cep)
            .maybeSingle();

          let lat: number | null = null;
          let lng: number | null = null;

          if (cached) {
            lat = cached.lat;
            lng = cached.lng;
          } else {
            // Fetch from BrasilAPI
            const response = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`);
            if (response.ok) {
              const data = await response.json();
              if (data.location?.coordinates?.longitude && data.location?.coordinates?.latitude) {
                lng = Number(data.location.coordinates.longitude);
                lat = Number(data.location.coordinates.latitude);

                // Cache the result
                await supabase
                  .from('cep_coordinates')
                  .upsert({ cep, lat, lng }, { onConflict: 'cep' });
              }
            }
            // Rate limit: wait 100ms between API calls
            await new Promise((r) => setTimeout(r, 100));
          }

          if (lat !== null && lng !== null) {
            await supabase
              .from('contacts')
              .update({ lat, lng })
              .eq('id', contact.id);
            success++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }

        setProgress({ total: contacts.length, processed: i + 1, success, failed, status: 'running' });
      }

      if (!cancelledRef.current) {
        setProgress((p) => ({ ...p, status: 'done' }));
      }

      queryClient.invalidateQueries({ queryKey: ['map-contacts'] });
      queryClient.invalidateQueries({ queryKey: ['map-stats'] });

      toast.success(`Geocodificação concluída: ${success} sucesso, ${failed} falhas`);
    },
  });

  return { ...mutation, progress, cancel };
}
