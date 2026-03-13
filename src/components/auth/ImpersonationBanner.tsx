import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useImpersonation } from '@/context/ImpersonationContext';
import { ROLE_LABELS, type Role } from '@/types/permissions';

export function ImpersonationBanner() {
  const { activeRole, stopImpersonation } = useImpersonation();

  const roleLabel = ROLE_LABELS[activeRole as Role] ?? activeRole;

  return (
    <div className="flex items-center justify-between gap-2 bg-amber-100 px-4 py-2 text-amber-900 dark:bg-amber-900/30 dark:text-amber-200">
      <span className="text-sm font-medium">
        Visualizando como: <strong>{roleLabel}</strong>
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 gap-1 text-amber-900 hover:bg-amber-200 hover:text-amber-950 dark:text-amber-200 dark:hover:bg-amber-800"
        onClick={stopImpersonation}
      >
        <X className="h-3.5 w-3.5" />
        Parar
      </Button>
    </div>
  );
}
