import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface BrandingSettings {
  id: string;
  mandate_name: string;
  primary_color: string;
  politician_name: string;
  politician_photo_url: string | null;
  created_at?: string;
  updated_at?: string;
}

const DEFAULT_BRANDING: Omit<BrandingSettings, 'id'> = {
  mandate_name: 'Meu Mandato',
  primary_color: '#0B63D1',
  politician_name: '',
  politician_photo_url: null,
};

export function useBranding() {
  return useQuery<BrandingSettings>({
    queryKey: ['branding'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branding_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        return { id: '', ...DEFAULT_BRANDING } as BrandingSettings;
      }

      return data as BrandingSettings;
    },
  });
}

export function useUpdateBranding() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      mandate_name?: string;
      primary_color?: string;
      politician_name?: string;
      politician_photo_url?: string | null;
    }) => {
      const { data: existing } = await supabase
        .from('branding_settings')
        .select('id')
        .limit(1)
        .maybeSingle();

      if (existing) {
        const { data, error } = await supabase
          .from('branding_settings')
          .update({ ...input, updated_at: new Date().toISOString() })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('branding_settings')
          .insert({
            mandate_name: input.mandate_name ?? DEFAULT_BRANDING.mandate_name,
            primary_color: input.primary_color ?? DEFAULT_BRANDING.primary_color,
            politician_name: input.politician_name ?? '',
            politician_photo_url: input.politician_photo_url ?? null,
          })
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branding'] });
      toast.success('Personalização salva com sucesso');
    },
    onError: (error: Error) => {
      toast.error(`Erro ao salvar personalização: ${error.message}`);
    },
  });
}

export function useUploadPoliticianPhoto() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `politician-photo-${Date.now()}.${fileExt}`;
      const filePath = `branding/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('branding')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('branding')
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    },
    onError: (error: Error) => {
      toast.error(`Erro ao enviar foto: ${error.message}`);
    },
  });
}
