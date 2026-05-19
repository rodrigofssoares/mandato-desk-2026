import { useMemo } from 'react';
import { Users, ShieldCheck } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn } from '@/lib/utils';
import type { ZapiChat } from '@/hooks/useZapiChats';
import type { UserProfile } from '@/hooks/useUsers';

// ─── Constante sentinela ──────────────────────────────────────────────────────

/**
 * Valor sentinela usado para filtrar conversas sem atendente atribuído.
 * Exportado para que ConversasTabContent use a mesma constante no useMemo de filtro.
 */
export const UNASSIGNED_FILTER = '__unassigned__';

// ─── helpers ─────────────────────────────────────────────────────────────────

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface AtendenteStat {
  id: string | null;
  nome: string;
  abertas: number;
  em_atendimento: number;
  aguardando: number;
  naoLidas: number;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface SupervisorPanelProps {
  /** Todos os chats da conta (não filtrados — para métricas globais). */
  chats: ZapiChat[];
  /** Lista de atendentes ativos. */
  users: UserProfile[];
  /** UID do atendente atualmente filtrado (null = todos). */
  filterByAssignee: string | null;
  /** Callback ao clicar em atendente para filtrar. */
  onFilterByAssignee: (uid: string | null) => void;
}

// ─── SupervisorPanel ──────────────────────────────────────────────────────────

/**
 * Painel de supervisor (T30 / C30).
 *
 * Exibido apenas quando:
 *   - activeRole === 'admin'
 *   - isFeatureEnabled(conta, 'c30') === true
 *
 * Mostra métricas por atendente calculadas client-side sobre os chats carregados
 * (sem nova query ao banco). Clicar em um atendente aplica filtro na lista.
 */
export function SupervisorPanel({
  chats,
  users,
  filterByAssignee,
  onFilterByAssignee,
}: SupervisorPanelProps) {
  // Filtra apenas conversas ativas (não arquivadas) para as métricas
  const activeChats = useMemo(
    () => chats.filter((c) => !c.archived),
    [chats],
  );

  const stats = useMemo((): AtendenteStat[] => {
    const byUser = new Map<string | null, AtendenteStat>();

    // Inicializa entrada para cada atendente ativo
    for (const u of users) {
      byUser.set(u.id, {
        id: u.id,
        nome: u.nome,
        abertas: 0,
        em_atendimento: 0,
        aguardando: 0,
        naoLidas: 0,
      });
    }
    // Entrada especial para não-atribuídas
    byUser.set(null, {
      id: null,
      nome: 'Não atribuídas',
      abertas: 0,
      em_atendimento: 0,
      aguardando: 0,
      naoLidas: 0,
    });

    for (const chat of activeChats) {
      const key = chat.assigned_to ?? null;
      // Se o atendente não está mais na lista (ex: desativado), agrupa em "não atribuídas"
      const stat = byUser.get(key) ?? byUser.get(null)!;

      if (chat.status === 'aberta') stat.abertas++;
      else if (chat.status === 'em_atendimento') stat.em_atendimento++;
      else if (chat.status === 'aguardando') stat.aguardando++;

      stat.naoLidas += chat.unread_count ?? 0;
    }

    // Ordena: atendentes com conversas primeiro, depois por nome
    return [...byUser.values()].sort((a, b) => {
      const totalA = a.abertas + a.em_atendimento + a.aguardando;
      const totalB = b.abertas + b.em_atendimento + b.aguardando;
      if (totalA !== totalB) return totalB - totalA;
      if (a.id === null) return 1; // "Não atribuídas" sempre no final
      if (b.id === null) return -1;
      return a.nome.localeCompare(b.nome, 'pt-BR');
    });
  }, [activeChats, users]);

  return (
    <Accordion type="single" collapsible defaultValue="">
      <AccordionItem value="supervisor" className="border-b-0">
        <AccordionTrigger className="px-3 py-2 text-xs font-medium hover:no-underline">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span className="uppercase tracking-wide">Supervisor</span>
            {filterByAssignee !== null && (
              <Badge variant="secondary" className="text-[9px] h-4 px-1 ml-1">
                filtrado
              </Badge>
            )}
          </div>
        </AccordionTrigger>
        <AccordionContent className="pb-2 px-0">
          {/* Botão "Todos" para limpar filtro */}
          {filterByAssignee !== null && (
            <button
              type="button"
              onClick={() => onFilterByAssignee(null)}
              className="w-full text-left px-3 py-1.5 text-[11px] text-primary hover:bg-accent/50 transition-colors font-medium"
            >
              ← Ver todas as conversas
            </button>
          )}

          {/* Cabeçalho da tabela */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-1 px-3 py-1 text-[10px] text-muted-foreground uppercase tracking-wide">
            <span>Atendente</span>
            <span className="text-center w-8">Ab.</span>
            <span className="text-center w-8">Atd.</span>
            <span className="text-center w-8">Ag.</span>
          </div>

          {/* Linhas por atendente */}
          {stats.map((stat) => {
            // Para a linha "Não atribuídas" (stat.id === null), usamos o sentinela
            // UNASSIGNED_FILTER em vez de null para distinguir "filtro ativo = não-atribuídas"
            // de "sem filtro ativo" (null).
            const statFilterKey = stat.id ?? UNASSIGNED_FILTER;
            const isFiltered = filterByAssignee === statFilterKey;
            const total = stat.abertas + stat.em_atendimento + stat.aguardando;

            return (
              <button
                key={stat.id ?? UNASSIGNED_FILTER}
                type="button"
                onClick={() =>
                  onFilterByAssignee(isFiltered ? null : statFilterKey)
                }
                className={cn(
                  'w-full grid grid-cols-[1fr_auto_auto_auto] gap-1 items-center px-3 py-1.5',
                  'text-left text-xs transition-colors hover:bg-accent/50',
                  isFiltered && 'bg-accent',
                  stat.id === null && 'text-muted-foreground',
                )}
              >
                {/* Nome + avatar */}
                <div className="flex items-center gap-1.5 min-w-0">
                  {stat.id ? (
                    <Avatar className="h-5 w-5 shrink-0">
                      <AvatarFallback className="text-[9px] bg-primary/10 text-primary">
                        {initials(stat.nome)}
                      </AvatarFallback>
                    </Avatar>
                  ) : (
                    <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className="truncate text-[11px]">{stat.nome}</span>
                  {stat.naoLidas > 0 && (
                    <Badge className="h-4 min-w-4 px-1 text-[9px] shrink-0">
                      {stat.naoLidas}
                    </Badge>
                  )}
                </div>

                {/* Contadores */}
                <span
                  className={cn(
                    'w-8 text-center text-[11px] font-medium',
                    stat.abertas > 0 ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {total === 0 ? '—' : stat.abertas}
                </span>
                <span
                  className={cn(
                    'w-8 text-center text-[11px] font-medium',
                    stat.em_atendimento > 0 ? 'text-blue-600' : 'text-muted-foreground',
                  )}
                >
                  {total === 0 ? '—' : stat.em_atendimento}
                </span>
                <span
                  className={cn(
                    'w-8 text-center text-[11px] font-medium',
                    stat.aguardando > 0 ? 'text-amber-600' : 'text-muted-foreground',
                  )}
                >
                  {total === 0 ? '—' : stat.aguardando}
                </span>
              </button>
            );
          })}
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
