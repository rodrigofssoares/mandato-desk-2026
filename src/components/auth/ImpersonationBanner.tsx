import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useImpersonation } from '@/context/ImpersonationContext';
import { ROLE_LABELS, type Role } from '@/types/permissions';

export function ImpersonationBanner() {
  const { activeRole, stopImpersonation } = useImpersonation();

  const roleLabel = ROLE_LABELS[activeRole as Role] ?? activeRole;

  return (
    <div className="flex items-center justify-between gap-2 bg-warning-soft px-4 py-2 text-warning-soft-foreground">
      <span className="text-sm font-medium">
        Visualizando como: <strong>{roleLabel}</strong>
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1 text-warning-soft-foreground hover:bg-warning/20 hover:text-warning-soft-foreground"
        onClick={stopImpersonation}
      >
        <X className="h-3.5 w-3.5" />
        Parar
      </Button>
    </div>
  );
}
