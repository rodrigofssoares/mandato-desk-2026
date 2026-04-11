import { Star, Pencil, Trash2, Check, Phone, Mail, Calendar, Clock } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import type { Contact } from '@/hooks/useContacts';
import { useToggleFavorite } from '@/hooks/useContacts';
import { usePermissions } from '@/hooks/usePermissions';
import { cn } from '@/lib/utils';

interface ContactCardProps {
  contact: Contact;
  onEdit: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
  onClick: (contact: Contact) => void;
}

export function ContactCard({ contact, onEdit, onDelete, onClick }: ContactCardProps) {
  const { can } = usePermissions();
  const toggleFav = useToggleFavorite();

  const initials = contact.nome
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  const tags = contact.contact_tags?.map((ct) => ct.tags).filter(Boolean) ?? [];

  return (
    <Card
      className="group cursor-pointer hover:shadow-md transition-shadow relative"
      onClick={() => onClick(contact)}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm truncate">{contact.nome}</h3>
              {contact.declarou_voto && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent>Declarou voto</TooltipContent>
                </Tooltip>
              )}
            </div>

            {contact.whatsapp && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <Phone className="h-3 w-3" />
                {contact.whatsapp}
              </p>
            )}
            {contact.email && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5 truncate">
                <Mail className="h-3 w-3 shrink-0" />
                <span className="truncate">{contact.email}</span>
              </p>
            )}

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {tags.slice(0, 4).map((tag) => (
                  <Badge
                    key={tag.id}
                    variant="secondary"
                    className="text-[10px] px-1.5 py-0"
                    style={tag.cor ? { backgroundColor: tag.cor + '20', color: tag.cor, borderColor: tag.cor + '40' } : undefined}
                  >
                    {tag.nome}
                  </Badge>
                ))}
                {tags.length > 4 && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    +{tags.length - 4}
                  </Badge>
                )}
              </div>
            )}

            {(contact.ultimo_contato || contact.updated_at) && (
              <div className="mt-2 pt-2 border-t border-border/50 space-y-0.5">
                {contact.ultimo_contato && (
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3 shrink-0" />
                    Último contato: {format(new Date(contact.ultimo_contato), 'dd/MM/yyyy', { locale: ptBR })}
                  </p>
                )}
                {contact.updated_at && (
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      Atualizado {format(new Date(contact.updated_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                      {' '}por {contact.atualizado_por ?? 'Automação'}
                    </span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
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

            <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
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
        </div>
      </CardContent>
    </Card>
  );
}
