import { Loader2, ListChecks } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
  useCampaignFields,
  useContactCampaignValues,
  useToggleContactCampaignValue,
} from '@/hooks/useCampaignFields';

interface CampaignFieldsListProps {
  /** id do contato em edição — se undefined, estamos criando */
  contactId?: string;
  /** valores locais (apenas em modo criação) */
  pendingValues?: Record<string, boolean>;
  /** callback de alteração (apenas em modo criação) */
  onPendingChange?: (next: Record<string, boolean>) => void;
}

/**
 * Renderiza a lista de campos customizados de campanha como checkboxes.
 *
 * - Em modo edição (contactId definido): busca valores do banco e persiste
 *   cada toggle imediatamente via useToggleContactCampaignValue.
 * - Em modo criação (contactId undefined): usa pendingValues/onPendingChange
 *   (estado controlado pelo parent). O parent grava tudo após criar o contato.
 */
export function CampaignFieldsList({
  contactId,
  pendingValues,
  onPendingChange,
}: CampaignFieldsListProps) {
  const { data: fields = [], isLoading: isLoadingFields } = useCampaignFields();
  const { data: dbValues = {}, isLoading: isLoadingValues } =
    useContactCampaignValues(contactId);
  const toggleValue = useToggleContactCampaignValue();

  const isEditing = !!contactId;
  const isLoading = isLoadingFields || (isEditing && isLoadingValues);

  const values = isEditing ? dbValues : (pendingValues ?? {});

  const handleToggle = (fieldId: string, next: boolean) => {
    if (isEditing) {
      toggleValue.mutate({ contactId: contactId!, fieldId, valor: next });
    } else if (onPendingChange) {
      const updated = { ...(pendingValues ?? {}) };
      if (next) updated[fieldId] = true;
      else delete updated[fieldId];
      onPendingChange(updated);
    }
  };

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <div className="w-7 h-7 rounded-md bg-purple-500/10 flex items-center justify-center">
          <ListChecks className="h-3.5 w-3.5 text-purple-400" />
        </div>
        <span className="text-xs font-semibold text-muted-foreground">
          Campos de Campanha
        </span>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : fields.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          Nenhum campo de campanha criado.{' '}
          <span className="text-muted-foreground/70">
            Um administrador pode adicionar campos em Configurações → Campos de Campanha.
          </span>
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {fields.map((field) => {
            const checked = !!values[field.id];
            return (
              <label
                key={field.id}
                htmlFor={`cf-${field.id}`}
                className={cn(
                  'flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors',
                  checked
                    ? 'border-purple-500/50 bg-purple-500/5'
                    : 'border-border hover:border-muted-foreground/30',
                )}
              >
                <Checkbox
                  id={`cf-${field.id}`}
                  checked={checked}
                  onCheckedChange={(v) => handleToggle(field.id, !!v)}
                  disabled={isEditing && toggleValue.isPending}
                />
                <span className="text-xs leading-tight break-words">{field.label}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
