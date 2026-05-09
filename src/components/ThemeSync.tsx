import { useEffect } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/context/AuthContext';

/**
 * Sincroniza o tema atual com a preferência do usuário logado.
 *
 * - Se o profile carregado tem theme_preference definido e diferente do tema
 *   atual: aplica setTheme. Isso garante que o usuário vê seu tema preferido
 *   em qualquer dispositivo/sessão (a preferência vive no banco).
 * - Se o profile carregado tem theme_preference NULL: deixa o tema atual
 *   (que é o default ou o que estava no localStorage). Não força nada.
 *
 * Componente "headless" — não renderiza nada. Posicionar dentro do
 * AuthProvider e do ThemeProvider em App.tsx.
 */
export function ThemeSync() {
  const { profile } = useAuth();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const pref = profile?.theme_preference;
    if (pref && pref !== theme) {
      setTheme(pref);
    }
  }, [profile?.theme_preference, theme, setTheme]);

  return null;
}
