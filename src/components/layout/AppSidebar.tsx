import { Fragment } from 'react';
import { useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Crown,
  ClipboardList,
  KanbanSquare,
  CheckSquare,
  MapPin,
  Upload,
  ClipboardCheck,
  Settings,
  LogOut,
  User,
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
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useBranding } from '@/hooks/useBranding';
import { ROLE_LABELS, type Role } from '@/types/permissions';
import type { Secao } from '@/types/permissions';
import type { LucideIcon } from 'lucide-react';

interface NavItem {
  label: string;
  icon: LucideIcon;
  href: string;
  secao: Secao;
  alwaysVisible?: boolean;
  /** Renderiza um separador visual ANTES deste item (quando visível e não for o primeiro). */
  dividerBefore?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/', secao: 'dashboard', alwaysVisible: true },
  { label: 'Contatos', icon: Users, href: '/contacts', secao: 'contatos' },
  { label: 'Articuladores', icon: Crown, href: '/leaders', secao: 'liderancas' },
  { label: 'Board', icon: KanbanSquare, href: '/board', secao: 'board', alwaysVisible: true },
  { label: 'Tarefas', icon: CheckSquare, href: '/tarefas', secao: 'tarefas', alwaysVisible: true },
  { label: 'Demandas', icon: ClipboardList, href: '/demands', secao: 'demandas' },
  { label: 'Mapa', icon: MapPin, href: '/leads-map', secao: 'mapa' },
  { label: 'Importação', icon: Upload, href: '/bulk-import', secao: 'importacao' },
  { label: 'Campos de Campanha', icon: ClipboardCheck, href: '/campos-campanha', secao: 'campanha' },
  { label: 'Configurações', icon: Settings, href: '/settings', secao: 'configuracoes', alwaysVisible: true, dividerBefore: true },
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
  campanha: (can) => can.viewCampaignFields(),
  // Novas seções introduzidas no merge — RBAC formal chega na issue 99.
  // Até lá os itens ficam sempre visíveis via `alwaysVisible: true`.
  board: () => true,
  tarefas: () => true,
  configuracoes: () => true,
};

export function AppSidebar() {
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const { can } = usePermissions();
  const { data: branding } = useBranding();

  const visibleItems = NAV_ITEMS.filter((item) => {
    if (item.alwaysVisible) return true;
    const checkPermission = SECAO_TO_PERMISSION[item.secao];
    return checkPermission ? checkPermission(can) : false;
  });

  const roleLabel = profile?.role
    ? ROLE_LABELS[profile.role as Role] ?? profile.role
    : '';

  const hasPoliticianPhoto = branding?.politician_photo_url;
  const politicianName = branding?.politician_name;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex flex-col items-center gap-1.5 px-2 py-3 group-data-[collapsible=icon]:py-2">
          {/* Avatar do político ou ícone padrão */}
          {hasPoliticianPhoto ? (
            <div className="w-10 h-10 rounded-full border-2 border-primary/30 overflow-hidden flex-shrink-0 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:h-8">
              <img
                src={branding.politician_photo_url!}
                alt={politicianName || 'Político'}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="w-10 h-10 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center flex-shrink-0 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:h-8">
              <User className="h-5 w-5 text-primary group-data-[collapsible=icon]:h-4 group-data-[collapsible=icon]:w-4" />
            </div>
          )}

          {/* Nome do político + "Mandato Desk" */}
          <div className="text-center group-data-[collapsible=icon]:hidden">
            {politicianName && (
              <p className="text-sm font-semibold leading-tight truncate max-w-[160px]">
                {politicianName}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground font-medium">
              Mandato Desk
            </p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            {visibleItems.map((item, index) => {
              const isActive =
                item.href === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.href);

              const showDivider = item.dividerBefore && index > 0;

              return (
                <Fragment key={item.href}>
                  {showDivider && <SidebarSeparator className="my-1" />}
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={isActive} tooltip={item.label}>
                      <Link to={item.href}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </Fragment>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <div className="flex flex-col gap-2 px-2 py-1 group-data-[collapsible=icon]:items-center">
          <div className="flex flex-col gap-0.5 group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-medium truncate">
              {profile?.nome ?? 'Usuário'}
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
