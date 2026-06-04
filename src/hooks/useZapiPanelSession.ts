// Hook: useZapiPanelSession
//
// Gerencia o estado de desbloqueio de uma conta Z-API para visualização
// de conversas. A sessão é EM MEMÓRIA (module-level Map) — reload força
// nova validação de senha.
//
// Fluxo EM080:
//   1. isPrivileged (admin|proprietario) + !requirePasswordForPrivileged → bypass (sempre desbloqueado).
//   2. isPrivileged + requirePasswordForPrivileged → fluxo normal de senha.
//   3. Não-privilegiado → sempre precisa de senha (sem bypass).
//   4. unlock(password) → chama zapi-validate-panel-password; sucesso atualiza map.
//   5. lock() → remove entrada do map.
//
// Por que module-level e não sessionStorage:
//   - Spec EM078 exige que reload re-tranca: sessionStorage sobrevive a
//     abas abertas mas não a fechar e abrir — ambíguo. Module-level garante
//     que qualquer reload/navegação limpa o estado sem persistência.
//   - Conteúdo sensível (conversas) não deve sobreviver a reload sem nova autenticação.
//
// Reference: RAQ-MAND-EM078 — T3 (hook frontend); RAQ-MAND-EM080 — T6 (bypass privilegiado)

import { useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useImpersonation } from '@/context/ImpersonationContext';
import { useZapiPanelSettings } from '@/hooks/useZapiPanelSettings';

// ─── Estado module-level (sobrevive a re-renders, não a reload) ──────────────

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

/** Mapa de (account_id + '::' + activeRole) → timestamp de expiração (ms desde epoch).
 *
 * A chave composta garante que trocar de role via impersonation re-tranca a sessão —
 * o admin que desbloqueou como 'admin' não herda o unlock ao simular 'estagiario'.
 * Fix P-02/F-02 (Security/Pentest EM080): sessionMap infiel sob impersonation.
 */
const sessionMap = new Map<string, number>();

/** Verifica se há sessão válida (não expirada) para uma conta + role específica. */
function isSessionValid(sessionKey: string): boolean {
  const expiresAt = sessionMap.get(sessionKey);
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
  // EM080: proprietario também é privilegiado
  const isPrivileged = activeRole === 'admin' || activeRole === 'proprietario';

  // EM080: lê toggle global — DEVE ser chamado incondicionalmente (regra dos hooks)
  const { data: panelSettings } = useZapiPanelSettings();
  const requirePasswordForPrivileged = panelSettings?.requirePasswordForPrivileged ?? false;

  // Privilegiado sem exigência de senha → bypass direto
  const bypass = isPrivileged && !requirePasswordForPrivileged;

  // Fix P-02/F-02: chave composta por conta + role — troca de role via impersonation
  // invalida grants em memória adquiridos na role anterior.
  const sessionKey = accountId ? `${accountId}::${activeRole}` : null;

  const [unlocked, setUnlocked] = useState<boolean>(() => {
    if (bypass) return true;
    if (!sessionKey) return false;
    return isSessionValid(sessionKey);
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimitRetryAfter, setRateLimitRetryAfter] = useState(0);

  const unlock = useCallback(async (password: string): Promise<boolean> => {
    if (bypass) return true;
    if (!accountId || !sessionKey) return false;

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
        const minutes = Math.ceil(retryAfter / 60);
        setError(
          `Muitas tentativas incorretas. Aguarde ${minutes} minuto${minutes > 1 ? 's' : ''}.`,
        );
        return false;
      }

      if (!response.ok || !data.ok) {
        setError(data.error ?? 'Senha incorreta. Tente novamente.');
        return false;
      }

      // Sucesso — armazena expiração em memória pela chave composta (conta + role)
      const expiresAt = data.expires_at
        ? new Date(data.expires_at as string).getTime()
        : Date.now() + 8 * 60 * 60 * 1000;

      sessionMap.set(sessionKey, expiresAt);
      setUnlocked(true);
      return true;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro ao validar senha';
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, [accountId, sessionKey, bypass]);

  const lock = useCallback(() => {
    if (!sessionKey) return;
    sessionMap.delete(sessionKey);
    setUnlocked(false);
    setError(null);
    setRateLimitRetryAfter(0);
  }, [sessionKey]);

  // EM080 F02: re-sincroniza o estado de desbloqueio quando o bypass deixa de valer
  // (ex: admin liga o toggle "exigir senha" enquanto um privilegiado está na página)
  // ou quando a conta/role muda. Sem isso, `unlocked` ficaria preso em true (stale do
  // init) e o usuário veria lista vazia (RLS bloqueia) sem o lock screen aparecer.
  useEffect(() => {
    if (!bypass) {
      setUnlocked(sessionKey ? isSessionValid(sessionKey) : false);
    }
  }, [bypass, sessionKey]);

  // Privilegiado sem exigência de senha → bypass direto (sempre desbloqueado)
  if (bypass) {
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
