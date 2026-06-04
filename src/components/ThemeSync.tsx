import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { useAuth, type ThemePreference } from '@/context/AuthContext';

/**
 * Sincroniza o tema atual com a preferência do usuário logado.
 *
 * - Quando a preferência do profile MUDA (login, ou troca feita em outro
 *   dispositivo/sessão): aplica setTheme. Isso garante que o usuário vê seu
 *   tema preferido em qualquer lugar (a preferência vive no banco).
 * - Se a preferência é NULL: deixa o tema atual (default ou o do localStorage).
 *
 * RAQ-MAND-EM084: antes este efeito reagia a QUALQUER mudança de `theme` e
 * comparava contra `profile.theme_preference`. Quando o usuário trocava a cor
 * pelo diamante, o `setTheme` otimista mudava `theme` ANTES do profile ser
 * atualizado no banco/refetch — o efeito então via a preferência defasada e
 * REVERTIA o tema, causando o "piscar/recarregar". A correção: só agir quando a
 * própria preferência do profile transiciona para um valor novo (rastreado via
 * ref), nunca lutando contra a mudança local em andamento.
 *
 * Componente "headless" — não renderiza nada. Posicionar dentro do
 * AuthProvider e do ThemeProvider em App.tsx.
 */
export function ThemeSync() {
  const { profile } = useAuth();
  const { theme, setTheme } = useTheme();
  // Última preferência do profile que já aplicamos. Evita reagir à troca
  // otimista local (que só mexe em `theme`, não na preferência do profile).
  const lastAppliedPref = useRef<ThemePreference | null | undefined>(undefined);

  useEffect(() => {
    const pref = profile?.theme_preference;
    if (pref && pref !== lastAppliedPref.current) {
      lastAppliedPref.current = pref;
      if (pref !== theme) setTheme(pref);
    }
  }, [profile?.theme_preference, theme, setTheme]);

  return null;
}
