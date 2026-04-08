import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, Mail, MapPin, Users, Pencil, Trash2 } from 'lucide-react';
import type { Leader } from '@/hooks/useLeaders';

interface LeaderCardProps {
  leader: Leader;
  onEdit: () => void;
  onDelete: () => void;
  canEdit: boolean;
  canDelete: boolean;
}

const typeLabels: Record<string, string> = {
  assessor_parlamentar: 'Assessor Parlamentar',
  lider_regional: 'Lider Regional',
  coordenador_area: 'Coordenador de Area',
  mobilizador: 'Mobilizador',
  multiplicador: 'Multiplicador',
  outro: 'Outro',
};

export function LeaderCard({ leader, onEdit, onDelete, canEdit, canDelete }: LeaderCardProps) {
  const votePercentage =
    leader.contact_count > 0
      ? Math.round((leader.declared_vote_count / leader.contact_count) * 100)
      : 0;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-base truncate">{leader.nome}</h3>
            <Badge variant="secondary" className="mt-1 text-xs">
              {typeLabels[leader.leadership_type] ?? leader.leadership_type}
            </Badge>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <div
              className={`w-2.5 h-2.5 rounded-full ${
                leader.active ? 'bg-green-500' : 'bg-gray-400'
              }`}
              title={leader.active ? 'Ativo' : 'Inativo'}
            />
          </div>
        </div>

        {(leader.region || leader.city) && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {[leader.region, leader.city].filter(Boolean).join(', ')}
            </span>
          </div>
        )}

        {leader.whatsapp && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            <span>{leader.whatsapp}</span>
          </div>
        )}

        {leader.email && (
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{leader.email}</span>
          </div>
        )}

        <div className="flex items-center gap-3 text-sm pt-1 border-t">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>{leader.contact_count} contatos</span>
          </div>
          {leader.contact_count > 0 && (
            <span className="text-muted-foreground">
              {votePercentage}% declararam voto
            </span>
          )}
        </div>

        {(canEdit || canDelete) && (
          <div className="flex gap-2 pt-1">
            {canEdit && (
              <Button variant="outline" size="sm" onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5 mr-1" />
                Editar
              </Button>
            )}
            {canDelete && (
              <Button variant="outline" size="sm" onClick={onDelete} className="text-destructive hover:text-destructive">
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                Excluir
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
