import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Filter, X } from 'lucide-react';
import { useTags } from '@/hooks/useTags';
import type { MapFilters as MapFiltersType } from '@/hooks/useMapData';

interface MapFiltersProps {
  filters: MapFiltersType;
  onFiltersChange: (filters: MapFiltersType) => void;
}

export function MapFilters({ filters, onFiltersChange }: MapFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { data: tags = [] } = useTags();

  const activeCount = [
    filters.tags && filters.tags.length > 0,
    filters.bairro,
    filters.declarou_voto !== undefined && filters.declarou_voto !== null,
    filters.date_from || filters.date_to,
  ].filter(Boolean).length;

  const toggleTag = (tagId: string) => {
    const current = filters.tags ?? [];
    const next = current.includes(tagId)
      ? current.filter((t) => t !== tagId)
      : [...current, tagId];
    onFiltersChange({ ...filters, tags: next.length > 0 ? next : undefined });
  };

  const clearFilters = () => {
    onFiltersChange({});
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Button
          variant={isOpen ? 'default' : 'outline'}
          size="sm"
          onClick={() => setIsOpen(!isOpen)}
        >
          <Filter className="h-4 w-4 mr-2" />
          Filtros
          {activeCount > 0 && (
            <Badge variant="secondary" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
              {activeCount}
            </Badge>
          )}
        </Button>
        {activeCount > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      {isOpen && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 border rounded-lg bg-card">
          {/* Tags */}
          <div className="space-y-2">
            <Label>Etiquetas</Label>
            <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
              {tags.map((tag) => (
                <Badge
                  key={tag.id}
                  variant={filters.tags?.includes(tag.id) ? 'default' : 'outline'}
                  className="cursor-pointer text-xs"
                  onClick={() => toggleTag(tag.id)}
                  style={
                    filters.tags?.includes(tag.id)
                      ? { backgroundColor: tag.color, borderColor: tag.color }
                      : {}
                  }
                >
                  {tag.name}
                </Badge>
              ))}
            </div>
          </div>

          {/* Bairro */}
          <div className="space-y-2">
            <Label>Bairro</Label>
            <Input
              placeholder="Buscar bairro..."
              value={filters.bairro ?? ''}
              onChange={(e) =>
                onFiltersChange({ ...filters, bairro: e.target.value || undefined })
              }
            />
          </div>

          {/* Declarou voto */}
          <div className="space-y-2">
            <Label>Declarou Voto</Label>
            <Select
              value={
                filters.declarou_voto === true
                  ? 'yes'
                  : filters.declarou_voto === false
                    ? 'no'
                    : 'all'
              }
              onValueChange={(v) =>
                onFiltersChange({
                  ...filters,
                  declarou_voto: v === 'yes' ? true : v === 'no' ? false : undefined,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="yes">Sim</SelectItem>
                <SelectItem value="no">Nao</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date range */}
          <div className="space-y-2">
            <Label>Periodo</Label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={filters.date_from ?? ''}
                onChange={(e) =>
                  onFiltersChange({ ...filters, date_from: e.target.value || undefined })
                }
              />
              <Input
                type="date"
                value={filters.date_to ?? ''}
                onChange={(e) =>
                  onFiltersChange({ ...filters, date_to: e.target.value || undefined })
                }
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
