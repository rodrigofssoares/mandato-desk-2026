import { useMutation } from '@tanstack/react-query';
import { useTheme } from 'next-themes';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth, type ThemePreference } from '@/context/AuthContext';

/**
 * Atualiza a preferência de tema do usuário no profile e aplica localmente
 * via next-themes. Use isso (não setTheme direto) sempre que a troca de tema
 * for iniciada por uma ação do usuário — assim a preferência segue ele em
 * outros dispositivos/sessões.
 *
 * Em modo "convidado" (sem user logado) só aplica localmente — o setTheme
 * persiste em localStorage via next-themes.
 */
export function useUpdateThemePreference() {
  const { user, refreshProfile } = useAuth();
  const { setTheme } = useTheme();

  const mutation = useMutation({
    mutationFn: async (theme: ThemePreference) => {
      if (!user?.id) return; // sem login, só persiste local
      const { error } = await supabase
        .from('profiles')
        .update({ theme_preference: theme })
        .eq('id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      // Atualiza o profile no AuthContext (não bloqueante).
      void refreshProfile();
    },
    onError: (error) => {
      console.error('Erro ao salvar preferência de tema:', error);
      toast.error('Não foi possível salvar a preferência de tema. A mudança vale só pra esta sessão.');
    },
  });

  // Aplica imediatamente no UI; persiste no banco em paralelo.
  const apply = (theme: ThemePreference) => {
    setTheme(theme);
    mutation.mutate(theme);
  };

  return { apply, isPending: mutation.isPending };
}
