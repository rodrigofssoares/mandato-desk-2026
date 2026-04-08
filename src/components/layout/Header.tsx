import { useLocation } from 'react-router-dom';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { useImpersonation } from '@/context/ImpersonationContext';
import { ImpersonationBanner } from '@/components/auth/ImpersonationBanner';

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/contacts': 'Contatos',
  '/leaders': 'Articuladores',
  '/demands': 'Demandas',
  '/tags': 'Etiquetas',
  '/leads-map': 'Mapa de Leads',
  '/bulk-import': 'Importacao',
  '/users': 'Usuarios',
  '/permissoes': 'Permissoes',
  '/google-integration': 'Google Contacts',
  '/api': 'API',
  '/webhooks': 'Webhooks',
  '/branding': 'Personalizacao',
};

export function Header() {
  const location = useLocation();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'midnight' || resolvedTheme === 'obsidian';
  const { isImpersonating } = useImpersonation();

  const currentPageTitle =
    PAGE_TITLES[location.pathname] ??
    Object.entries(PAGE_TITLES).find(([path]) =>
      path !== '/' && location.pathname.startsWith(path)
    )?.[1] ??
    'Pagina';

  return (
    <>
      {isImpersonating && <ImpersonationBanner />}
      <header className="flex h-14 items-center gap-3 border-b bg-background px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="h-5" />
        <nav className="flex items-center gap-1 text-sm">
          <span className="text-muted-foreground">Mandato Desk</span>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium">{currentPageTitle}</span>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              const order = ['navy', 'midnight', 'obsidian'];
              const current = order.indexOf(theme ?? 'navy');
              setTheme(order[(current + 1) % order.length]);
            }}
            aria-label="Alternar tema"
            title={`Tema: ${theme ?? 'navy'}`}
          >
            {isDark ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )}
          </Button>
        </div>
      </header>
    </>
  );
}
