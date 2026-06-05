// ContactMiniCard.tsx — RAQ-MAND-EM085
// Card compacto (Variante A aprovada) que exibe o contato vinculado a uma demanda:
// avatar com iniciais, nome, telefone, etiquetas e ações rápidas
// (Falar no WhatsApp + Ver no CRM). Usado tanto no seletor da aba Demandas
// quanto no fluxo de "Nova demanda" dentro do WhatsApp.

import { Link, useNavigate } from 'react-router-dom';
import { MessageCircle, ExternalLink } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface MiniCardContact {
  id: string;
  nome: string | null;
  telefone: string | null;
  whatsapp: string | null;
  tags: { id: string; nome: string; cor: string | null }[];
}

interface ContactMiniCardProps {
  contact: MiniCardContact;
  /** Conteúdo opcional renderizado no canto (ex.: botão "Trocar"/"Remover"). */
  action?: React.ReactNode;
  className?: string;
}

function initialsOf(name: string): string {
  return name
    .replace(/^@/, '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

export function ContactMiniCard({ contact, action, className }: ContactMiniCardProps) {
  const navigate = useNavigate();
  const displayName = contact.nome?.trim() || 'Sem nome';
  const phone = contact.whatsapp ?? contact.telefone ?? null;
  const waDigits = phone ? phone.replace(/\D/g, '') : '';

  const handleWhatsapp = () => {
    if (!waDigits) return;
    navigate(`/integracoes/whatsapp?tab=conversas&chat=${waDigits}`);
  };

  return (
    <div className={cn('rounded-lg border bg-card p-3', className)}>
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 shrink-0 rounded-full bg-primary/15 text-primary flex items-center justify-center text-sm font-semibold">
          {initialsOf(displayName)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm leading-tight truncate">{displayName}</p>
          <p className="text-xs text-muted-foreground truncate">
            {phone ?? <span className="italic">sem telefone</span>}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50"
            title="Falar no WhatsApp"
            onClick={handleWhatsapp}
            disabled={!waDigits}
          >
            <MessageCircle className="h-4 w-4" />
          </Button>
          <Button
            asChild
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-primary hover:bg-primary/10"
            title="Ver no CRM"
          >
            <Link to={`/contacts?contact=${contact.id}`} onClick={(e) => e.stopPropagation()}>
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
          {action}
        </div>
      </div>

      {contact.tags.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {contact.tags.map((t) => (
            <Badge
              key={t.id}
              variant="outline"
              className="text-[10px] px-1.5 py-0"
              style={{ borderColor: t.cor ?? '#6B7280', color: t.cor ?? '#6B7280' }}
            >
              {t.nome}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
