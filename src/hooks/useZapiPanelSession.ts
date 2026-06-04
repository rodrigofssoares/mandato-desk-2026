// Hook: useZapiPanelSession
//
// Gerencia o estado de desbloqueio de uma conta Z-API para visualização
// de conversas. A sessão é EM MEMÓRIA (module-level Map) — reload força
// nova validação de senha. Admin sempre desbloqueado (bypass de cadeado).
//
// Por que module-level e não sessionStorage:
//   - Spec EM078 exige que reload re-tranca: sessionStorage sobrevive a
//     abas abertas mas não a fechar e abrir — ambíguo. Module-level garante
//     que qualquer reload/navegação limpa o estado sem persistência.
//   - Conteúdo sensível (conversas) não deve sobreviver a reload sem nova autenticação.
//
// Fluxo:
//   1. Admin → isUnlocked sempre true, sem chamada à EF.
//   2. Não-admin → isUnlocked depende da presença de entrada válida em sessionMap.
//   3. unlock(password) → chama zapi-validate-panel-password; sucesso atualiza map.
//   4. lock() → remove entrada do map.
//
// Reference: RAQ-MAND-EM078 — T3 (hook frontend)

import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useImpersonation } from '@/context/ImpersonationContext';

// ─── Estado module-level (sobrevive a re-renders, não a reload) ──────────────

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

/** Mapa de account_id → timestamp de expiração (ms desde epoch). */
const sessionMap = new Map<string, number>();

/** Verifica se há sessão válida (não expirada) para uma conta. */
function isSessionValid(accountId: string): boolean {
  const expiresAt = sessionMap.get(accountId);
  if (!expiresAt) return false;
  return Date.now() < expiresAt;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface ZapiPanelSessionState {
  /** true se a conta está desbloqueada para este usuário na sessão atual. */
  isUnlocked: boolean;
  /** true durante a chamada à EF de validação. */
  loading: boolean;
  /** Mensagem de erro da última tentativa de unlock (null se nenhuma). */
  error: string | null;
  /** Segundos restantes de lockout por rate-limit (0 se não há lockout). */
  rateLimitRetryAfter: number;
  /** Tenta desbloquear a conta com a senha fornecida. */
  unlock: (password: string) => Promise<boolean>;
  /** Tranca manualmente (remove sessão em memória). */
  lock: () => void;
}

export function useZapiPanelSession(accountId: string | null): ZapiPanelSessionState {
  const { activeRole } = useImpersonation();
  const isAdmin = activeRole === 'admin';

  // Admin nunca precisa validar — bypass direto
  const [unlocked, setUnlocked] = useState<boolean>(() => {
    if (isAdmin) return true;
    if (!accountId) return false;
    return isSessionValid(accountId);
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimitRetryAfter, setRateLimitRetryAfter] = useState(0);

  const unlock = useCallback(async (password: string): Promise<boolean> => {
    if (isAdmin) return true;
    if (!accountId) return false;

    setLoading(true);
    setError(null);
    setRateLimitRetryAfter(0);

    try {
      // Obtém o token JWT do usuário atual para autorizar a chamada
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        setError('Sessão expirada. Faça login novamente.');
        return false;
      }

      const response = await fetch(
        `${SUPABASE_URL}/functions/v1/zapi-validate-panel-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ account_id: accountId, password }),
        },
      );

      const data = await response.json().catch(() => ({}));

      if (response.status === 429) {
        // Rate-limit
        const retryAfter = data.retry_after_seconds ?? 60;
        setRateLimitRetryAfter(retryAfter);
        setError(
          `Muitas tentativas incorretas. Aguarde ${Math.ceil(retryAfter / 60)} minuto${retryAfter > 60 ? 's' : ''}.`,
        );
        return false;
      }

      if (!response.ok || !data.ok) {
        setError(data.error ?? 'Senha incorreta. Tente novamente.');
        return false;
      }

      // Sucesso — armazena expiração em memória
      const expiresAt = data.expires_at
        ? new Date(data.expires_at as string).getTime()
        : Date.now() + 8 * 60 * 60 * 1000;

      sessionMap.set(accountId, expiresAt);
      setUnlocked(true);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao validar senha';
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, [accountId, isAdmin]);

  const lock = useCallback(() => {
    if (!accountId) return;
    sessionMap.delete(accountId);
    setUnlocked(false);
    setError(null);
    setRateLimitRetryAfter(0);
  }, [accountId]);

  // Admin → sempre desbloqueado
  if (isAdmin) {
    return {
      isUnlocked: true,
      loading: false,
      error: null,
      rateLimitRetryAfter: 0,
      unlock: async () => true,
      lock: () => {},
    };
  }

  return {
    isUnlocked: unlocked,
    loading,
    error,
    rateLimitRetryAfter,
    unlock,
    lock,
  };
}
