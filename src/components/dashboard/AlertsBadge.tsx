import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AlertsBadgeProps {
  count: number;
  onClick: () => void;
}

export function AlertsBadge({ count, onClick }: AlertsBadgeProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className="relative h-9 gap-2"
      aria-label={`Ver ${count} alerta${count === 1 ? '' : 's'}`}
    >
      <Bell className="h-4 w-4" />
      <span className="hidden sm:inline">Alertas</span>
      {count > 0 && (
        <span className="ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-bold text-white">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Button>
  );
}
