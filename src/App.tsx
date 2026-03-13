import { type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ImpersonationProvider } from '@/context/ImpersonationContext';
import { AuthHandler } from '@/components/auth/AuthHandler';
import { Loader2 } from 'lucide-react';

// Pages
import Auth from '@/pages/Auth';
import ResetPassword from '@/pages/ResetPassword';
import NotFound from '@/pages/NotFound';
import Dashboard from '@/pages/Dashboard';
import Demands from '@/pages/Demands';
import Tags from '@/pages/Tags';
import Leaders from '@/pages/Leaders';
import Contacts from '@/pages/Contacts';
import Users from '@/pages/Users';
import Permissoes from '@/pages/Permissoes';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
    },
  },
});

import { AppLayout } from '@/components/layout/AppLayout';

// Placeholder genérico para páginas em construção
function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="text-muted-foreground mt-2">Em construção</p>
    </div>
  );
}

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
              <PlaceholderPage title="Mapa de Leads" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bulk-import"
          element={
            <ProtectedRoute>
              <PlaceholderPage title="Importação em Massa" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute>
              <Users />
            </ProtectedRoute>
          }
        />
        <Route
          path="/permissoes"
          element={
            <ProtectedRoute>
              <Permissoes />
            </ProtectedRoute>
          }
        />
        <Route
          path="/google-integration"
          element={
            <ProtectedRoute>
              <PlaceholderPage title="Integração Google" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/api"
          element={
            <ProtectedRoute>
              <PlaceholderPage title="API" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/webhooks"
          element={
            <ProtectedRoute>
              <PlaceholderPage title="Webhooks" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/branding"
          element={
            <ProtectedRoute>
              <PlaceholderPage title="Branding" />
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
    </QueryClientProvider>
  );
}
