import { useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Crown,
  ClipboardList,
  Tags,
  MapPin,
  Upload,
  UserCog,
  Shield,
  Globe,
  Code,
  Webhook,
  Palette,
  LogOut,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { ROLE_LABELS, type Role } from '@/types/permissions';
import type { Secao } from '@/types/permissions';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  label: string;
  icon: LucideIcon;
  href: string;
  secao: Secao;
  alwaysVisible?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/', secao: 'dashboard', alwaysVisible: true },
  { label: 'Contatos', icon: Users, href: '/contacts', secao: 'contatos' },
  { label: 'Liderancas', icon: Crown, href: '/leaders', secao: 'liderancas' },
  { label: 'Demandas', icon: ClipboardList, href: '/demands', secao: 'demandas' },
  { label: 'Etiquetas', icon: Tags, href: '/tags', secao: 'etiquetas' },
  { label: 'Mapa', icon: MapPin, href: '/leads-map', secao: 'mapa' },
  { label: 'Importacao', icon: Upload, href: '/bulk-import', secao: 'importacao' },
  { label: 'Usuarios', icon: UserCog, href: '/users', secao: 'usuarios' },
  { label: 'Permissoes', icon: Shield, href: '/permissoes', secao: 'permissoes' },
  { label: 'Google', icon: Globe, href: '/google-integration', secao: 'google' },
  { label: 'API', icon: Code, href: '/api', secao: 'api' },
  { label: 'Webhooks', icon: Webhook, href: '/webhooks', secao: 'webhooks' },
  { label: 'Personalizacao', icon: Palette, href: '/branding', secao: 'personalizacao' },
];

const SECAO_TO_PERMISSION: Record<Secao, (can: ReturnType<typeof usePermissions>['can']) => boolean> = {
  dashboard: (can) => can.viewDashboard(),
  contatos: (can) => can.viewContacts(),
  liderancas: (can) => can.viewLeaders(),
  demandas: (can) => can.viewDemands(),
  etiquetas: (can) => can.viewTags(),
  mapa: (can) => can.viewMap(),
  importacao: (can) => can.importContacts(),
  usuarios: (can) => can.accessUsers(),
  permissoes: (can) => can.accessPermissions(),
  google: (can) => can.accessGoogle(),
  api: (can) => can.accessApi(),
  webhooks: (can) => can.accessWebhooks(),
  personalizacao: (can) => can.accessBranding(),
  relatorios: (can) => can.exportData(),
};

export function AppSidebar() {
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const { can } = usePermissions();

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.alwaysVisible) return true;
    const checkPermission = SECAO_TO_PERMISSION[item.secao];
    return checkPermission ? checkPermission(can) : false;
  });

  const roleLabel = profile?.role
    ? ROLE_LABELS[profile.role as Role] ?? profile.role
    : '';

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-1">
          <Shield className="h-5 w-5 text-primary" />
          <span className="text-lg font-bold tracking-tight group-data-[collapsible=icon]:hidden">
            Mandato Desk
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {visibleItems.map((item) => {
              const isActive =
                item.href === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.href);

              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                    <Link to={item.href}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex flex-col gap-2 px-2 py-1 group-data-[collapsible=icon]:items-center">
          <div className="flex flex-col gap-0.5 group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-medium truncate">
              {profile?.nome ?? 'Usuario'}
            </span>
            <span className="text-xs text-muted-foreground truncate">
              {profile?.email ?? ''}
            </span>
            {roleLabel && (
              <Badge variant="secondary" className="w-fit mt-1 text-[10px]">
                {roleLabel}
              </Badge>
            )}
          </div>
          <Separator className="group-data-[collapsible=icon]:hidden" />
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
            onClick={signOut}
          >
            <LogOut className="h-4 w-4" />
            <span className="group-data-[collapsible=icon]:hidden">Sair</span>
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
