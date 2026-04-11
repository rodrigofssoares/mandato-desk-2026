import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Phone, Mail, MessageCircle, ExternalLink, Trash2, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTarefas } from '@/hooks/useTarefas';
import type { BoardItemWithContact } from '@/hooks/useBoardItems';

interface BoardCardDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: BoardItemWithContact | null;
  stageName: string;
  onRemove: () => void;
  removing?: boolean;
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

export function BoardCardDetailSheet({
  open,
  onOpenChange,
  item,
  stageName,
  onRemove,
  removing,
}: BoardCardDetailSheetProps) {
  const contactId = item?.contact?.id ?? null;
  const { data: tarefas = [], isLoading: tarefasLoading } = useTarefas({
    contact_id: contactId ?? undefined,
    concluida: false,
  });

  if (!item) return null;
  const contact = item.contact;
  const stale = daysSince(item.moved_at);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{contact?.nome ?? '(sem nome)'}</SheetTitle>
          <SheetDescription>
            Estágio atual: <span className="font-medium">{stageName}</span> · há {stale}{' '}
            dia{stale !== 1 ? 's' : ''}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {stale >= 5 && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3">
              <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <p className="text-xs text-destructive">
                Este contato está parado há {stale} dias neste estágio. Considere mover ou
                adicionar uma tarefa.
              </p>
            </div>
          )}

          {contact && (
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase text-muted-foreground">Contato</h3>
              <div className="space-y-1.5">
                {contact.whatsapp && (
                  <a
                    href={`https://wa.me/${contact.whatsapp.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm hover:underline"
                  >
                    <MessageCircle className="h-4 w-4 text-emerald-600" />
                    {contact.whatsapp}
                  </a>
                )}
                {contact.telefone && (
                  <a
                    href={`tel:${contact.telefone}`}
                    className="flex items-center gap-2 text-sm hover:underline"
                  >
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    {contact.telefone}
                  </a>
                )}
                {contact.email && (
                  <a
                    href={`mailto:${contact.email}`}
                    className="flex items-center gap-2 text-sm hover:underline"
                  >
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {contact.email}
                  </a>
                )}
              </div>
            </div>
          )}

          <Separator />

          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground">
              Tarefas pendentes
            </h3>
            {tarefasLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : tarefas.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma tarefa pendente.</p>
            ) : (
              <ul className="space-y-1.5">
                {tarefas.map((tarefa) => (
                  <li key={tarefa.id} className="text-sm flex items-start gap-2">
                    <Badge variant="outline" className="text-[10px] uppercase">
                      {tarefa.tipo}
                    </Badge>
                    <span className="flex-1">{tarefa.titulo}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Separator />

          <div className="flex flex-col gap-2">
            {contactId && (
              <Button asChild variant="outline">
                <Link to={`/contacts?contact=${contactId}`}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Abrir contato completo
                </Link>
              </Button>
            )}
            <Button
              variant="destructive"
              onClick={onRemove}
              disabled={removing}
            >
              {removing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              <Trash2 className="h-4 w-4 mr-2" />
              Remover do board
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
