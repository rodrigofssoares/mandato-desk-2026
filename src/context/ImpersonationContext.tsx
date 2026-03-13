import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';

interface ImpersonationContextType {
  impersonatedRole: string | null;
  startImpersonation: (role: string) => void;
  stopImpersonation: () => void;
  activeRole: string;
  isImpersonating: boolean;
}

const ImpersonationContext = createContext<ImpersonationContextType | undefined>(undefined);

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [impersonatedRole, setImpersonatedRole] = useState<string | null>(null);

  const startImpersonation = useCallback((role: string) => {
    if (profile?.role !== 'admin') {
      console.warn('Apenas administradores podem personificar outro papel.');
      return;
    }
    setImpersonatedRole(role);
  }, [profile?.role]);

  const stopImpersonation = useCallback(() => {
    setImpersonatedRole(null);
  }, []);

  const activeRole = impersonatedRole ?? profile?.role ?? '';
  const isImpersonating = impersonatedRole !== null;

  return (
    <ImpersonationContext.Provider
      value={{
        impersonatedRole,
        startImpersonation,
        stopImpersonation,
        activeRole,
        isImpersonating,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation() {
  const context = useContext(ImpersonationContext);
  if (context === undefined) {
    throw new Error('useImpersonation deve ser usado dentro de um ImpersonationProvider');
  }
  return context;
}
