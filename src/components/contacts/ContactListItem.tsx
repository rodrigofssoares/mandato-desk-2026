import { Star, Pencil, Trash2, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import type { Contact } from '@/hooks/useContacts';
import { useToggleFavorite } from '@/hooks/useContacts';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface ContactListItemProps {
  contact: Contact;
  onEdit: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
  onClick: (contact: Contact) => void;
}

export function ContactListItem({ contact, onEdit, onDelete, onClick }: ContactListItemProps) {
  const { can } = usePermissions();
  const toggleFav = useToggleFavorite();

  const tags = contact.contact_tags?.map((ct) => ct.tags).filter(Boolean) ?? [];

  return (
    <div
      className="group flex items-center gap-4 px-4 py-3 border-b hover:bg-muted/50 cursor-pointer transition-colors"
      onClick={() => onClick(contact)}
    >
      {/* Favorite */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={(e) => {
          e.stopPropagation();
          toggleFav.mutate({ id: contact.id, is_favorite: !contact.is_favorite });
        }}
      >
        <Star
          className={cn(
            'h-4 w-4',
            contact.is_favorite ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
          )}
        />
      </Button>

      {/* Nome + WhatsApp mobile */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-sm truncate">{contact.nome}</span>
          {contact.declarou_voto && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />
              </TooltipTrigger>
              <TooltipContent>Declarou voto</TooltipContent>
            </Tooltip>
          )}
        </div>
        {/* Mobile-only inline info */}
        <div className="md:hidden text-xs text-muted-foreground truncate mt-0.5">
          {contact.whatsapp || contact.email || '—'}
        </div>
      </div>

      {/* WhatsApp (md+) */}
      <span className="text-sm text-muted-foreground w-36 truncate hidden md:block">
        {contact.whatsapp || '—'}
      </span>

      {/* Email */}
      <span className="text-sm text-muted-foreground w-48 truncate hidden lg:block">
        {contact.email || '—'}
      </span>

      {/* Tags */}
      <div className="hidden xl:flex items-center gap-1 w-48">
        {tags.slice(0, 3).map((tag) => {
          const label = tag.nome.length > 12 ? tag.nome.slice(0, 11) + '…' : tag.nome;
          return (
            <Tooltip key={tag.id}>
              <TooltipTrigger asChild>
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 whitespace-nowrap"
                  style={tag.cor ? { backgroundColor: tag.cor + '20', color: tag.cor, borderColor: tag.cor + '40' } : undefined}
                >
                  {label}
                </Badge>
              </TooltipTrigger>
              <TooltipContent>{tag.nome}</TooltipContent>
            </Tooltip>
          );
        })}
        {tags.length > 3 && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 whitespace-nowrap">
            +{tags.length - 3}
          </Badge>
        )}
      </div>

      {/* Data criação */}
      <span className="text-xs text-muted-foreground w-24 text-right hidden sm:block">
        {format(new Date(contact.created_at), 'dd/MM/yyyy')}
      </span>

      {/* Atualização */}
      <div className="hidden 2xl:flex flex-col w-44 text-right text-[10px] text-muted-foreground leading-tight">
        {contact.updated_at && (
          <span className="truncate">
            Atualizado {format(new Date(contact.updated_at), "dd/MM 'às' HH:mm")}
          </span>
        )}
        <span className="truncate">por {contact.atualizado_por ?? 'Automação'}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {can.editContact() && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(contact);
            }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
        {can.deleteContact() && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(contact);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
