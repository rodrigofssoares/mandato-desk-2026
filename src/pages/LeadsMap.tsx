import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, MapPin, MapPinOff, Clock, Navigation } from 'lucide-react';
import { useMapContacts, useMapStats, useGeocodeContacts } from '@/hooks/useMapData';
import type { MapFilters as MapFiltersType } from '@/hooks/useMapData';
import { LeafletMap } from '@/components/map/LeafletMap';
import { MapFilters } from '@/components/map/MapFilters';
import { GeocodeProgress } from '@/components/map/GeocodeProgress';
import { getContactDisplayName } from '@/lib/contactDisplay';

type ViewMode = 'standard' | 'temporal';

export default function LeadsMap() {
  const [filters, setFilters] = useState<MapFiltersType>({});
  const [viewMode, setViewMode] = useState<ViewMode>('standard');
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const { data: contacts = [], isLoading } = useMapContacts(filters);
  const { data: stats } = useMapStats();
  const geocode = useGeocodeContacts();

  const handleGeocode = () => {
    geocode.mutate();
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Mapa de Leads</h1>
        <Button
          onClick={handleGeocode}
          disabled={geocode.isPending || geocode.progress.status === 'running'}
        >
          {geocode.progress.status === 'running' ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Navigation className="h-4 w-4 mr-2" />
          )}
          Geocodificar
        </Button>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <MapPin className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <MapPin className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">{stats.withCoords}</p>
                <p className="text-xs text-muted-foreground">Mapeados</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <MapPinOff className="h-5 w-5 text-red-500" />
              <div>
                <p className="text-2xl font-bold">{stats.withoutCoords}</p>
                <p className="text-xs text-muted-foreground">Não Mapeados</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Clock className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">{stats.pendingGeocode}</p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Geocode progress */}
      <GeocodeProgress progress={geocode.progress} onCancel={geocode.cancel} />

      {/* Filters + View mode */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <MapFilters filters={filters} onFiltersChange={setFilters} />
        <div className="flex gap-1 border rounded-lg p-1">
          <Button
            variant={viewMode === 'standard' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('standard')}
          >
            Padrão
          </Button>
          <Button
            variant={viewMode === 'temporal' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('temporal')}
          >
            Temporal
          </Button>
        </div>
      </div>

      {/* Temporal legend */}
      {viewMode === 'temporal' && (
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-green-500" /> Ate 30 dias
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-yellow-500" /> Ate 90 dias
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full bg-red-500" /> Mais de 90 dias
          </span>
        </div>
      )}

      {/* Map */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <LeafletMap
          contacts={contacts}
          viewMode={viewMode}
          highlightedId={highlightedId}
          onHover={setHighlightedId}
        />
      )}

      {/* Contact list below map */}
      {contacts.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">
            Contatos no mapa ({contacts.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-64 overflow-y-auto">
            {contacts.map((contact) => (
              <div
                key={contact.id}
                className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                  highlightedId === contact.id ? 'bg-accent border-primary' : 'hover:bg-accent/50'
                }`}
                onMouseEnter={() => setHighlightedId(contact.id)}
                onMouseLeave={() => setHighlightedId(null)}
              >
                <p className="font-medium text-sm truncate">{getContactDisplayName(contact)}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {[contact.bairro, contact.cidade].filter(Boolean).join(', ') || 'Sem endereco'}
                </p>
                {contact.contact_tags && contact.contact_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {contact.contact_tags.slice(0, 3).map((ct) => (
                      <Badge key={ct.tag_id} variant="secondary" className="text-[10px] px-1 py-0">
                        {ct.tags.nome}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
