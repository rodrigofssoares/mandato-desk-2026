import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import type { GeocodeProgress as GeocodeProgressType } from '@/hooks/useMapData';

interface GeocodeProgressProps {
  progress: GeocodeProgressType;
  onCancel: () => void;
}

export function GeocodeProgress({ progress, onCancel }: GeocodeProgressProps) {
  if (progress.status === 'idle') return null;

  const percentage = progress.total > 0 ? Math.round((progress.processed / progress.total) * 100) : 0;

  const statusText = {
    running: 'Geocodificando...',
    done: 'Concluido',
    cancelled: 'Cancelado',
    idle: '',
  }[progress.status];

  return (
    <div className="space-y-2 p-4 border rounded-lg bg-card">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{statusText}</span>
        <span className="text-sm text-muted-foreground">
          {progress.processed}/{progress.total}
        </span>
      </div>
      <Progress value={percentage} />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Sucesso: {progress.success} | Falhas: {progress.failed}
        </span>
        {progress.status === 'running' && (
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
        )}
      </div>
    </div>
  );
}
