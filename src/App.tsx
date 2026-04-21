import { type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ThemeProvider } from 'next-themes';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ImpersonationProvider } from '@/context/ImpersonationContext';
import { AuthHandler } from '@/components/auth/AuthHandler';
import { Loader2 } from 'lucide-react';
import { setActivityLogQueryClient } from '@/lib/activityLog';

// Pages
import Auth from '@/pages/Auth';
import ResetPassword from '@/pages/ResetPassword';
import NotFound from '@/pages/NotFound';
import Dashboard from '@/pages/Dashboard';
import Demands from '@/pages/Demands';
import Tags from '@/pages/Tags';
import Leaders from '@/pages/Leaders';
import Contacts from '@/pages/Contacts';
import LeadsMap from '@/pages/LeadsMap';
import BulkImport from '@/pages/BulkImport';
import CamposCampanha from '@/pages/CamposCampanha';
import Settings from '@/pages/Settings';
import Board from '@/pages/Board';
import Tarefas from '@/pages/Tarefas';

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Erro ao carregar dados: ${message}`);
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

// Registra queryClient para o activityLog poder invalidar o cache do dashboard
setActivityLogQueryClient(queryClient);

import { AppLayout } from '@/components/layout/AppLayout';

// Rota protegida — verifica autenticação e status de aprovação
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, profile, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/auth" replace />;
  }

  if (profile && profile.status_aprovacao === 'PENDENTE') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
        <h1 className="text-2xl font-bold mb-2">Acesso pendente</h1>
        <p className="text-muted-foreground">
          Aguardando aprovação do administrador. Você será notificado quando seu acesso for liberado.
        </p>
      </div>
    );
  }

  if (profile && profile.status_aprovacao === 'INATIVO') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 text-center">
        <h1 className="text-2xl font-bold mb-2">Conta desativada</h1>
        <p className="text-muted-foreground">
          Sua conta foi desativada. Entre em contato com o administrador.
        </p>
      </div>
    );
  }

  return <AppLayout>{children}</AppLayout>;
}

function AppRoutes() {
  return (
    <>
      <AuthHandler />
      <Routes>
        {/* Rotas públicas */}
        <Route path="/auth" element={<Auth />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Rotas protegidas */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/contacts"
          element={
            <ProtectedRoute>
              <Contacts />
            </ProtectedRoute>
          }
        />
        <Route
          path="/leaders"
          element={
            <ProtectedRoute>
              <Leaders />
            </ProtectedRoute>
          }
        />
        <Route
          path="/demands"
          element={
            <ProtectedRoute>
              <Demands />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tags"
          element={
            <ProtectedRoute>
              <Tags />
            </ProtectedRoute>
          }
        />
        <Route
          path="/leads-map"
          element={
            <ProtectedRoute>
              <LeadsMap />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bulk-import"
          element={
            <ProtectedRoute>
              <BulkImport />
            </ProtectedRoute>
          }
        />
        {/* Legacy redirects → /settings (issue 51 merge-nossocrm).
            /tags fica como exceção: a aba Geral ainda não absorveu Etiquetas. */}
        <Route path="/users" element={<Navigate to="/settings?tab=equipe" replace />} />
        <Route path="/permissoes" element={<Navigate to="/settings?tab=permissoes" replace />} />
        <Route
          path="/google-integration"
          element={<Navigate to="/settings?tab=integracoes&sub=google" replace />}
        />
        <Route
          path="/api"
          element={<Navigate to="/settings?tab=integracoes&sub=api" replace />}
        />
        <Route
          path="/webhooks"
          element={<Navigate to="/settings?tab=integracoes&sub=webhooks" replace />}
        />
        <Route
          path="/branding"
          element={<Navigate to="/settings?tab=personalizacao" replace />}
        />
        <Route
          path="/campos-campanha"
          element={
            <ProtectedRoute>
              <CamposCampanha />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute>
              <Settings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/board"
          element={
            <ProtectedRoute>
              <Board />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tarefas"
          element={
            <ProtectedRoute>
              <Tarefas />
            </ProtectedRoute>
          }
        />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="navy"
        themes={['navy', 'midnight', 'obsidian']}
      >
        <BrowserRouter>
          <AuthProvider>
            <ImpersonationProvider>
              <TooltipProvider>
                <Toaster richColors position="top-right" />
                <AppRoutes />
              </TooltipProvider>
            </ImpersonationProvider>
          </AuthProvider>
        </BrowserRouter>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
