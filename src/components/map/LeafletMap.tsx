import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import type { LatLngBoundsExpression } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { MapContact } from '@/hooks/useMapData';

interface LeafletMapProps {
  contacts: MapContact[];
  viewMode: 'standard' | 'temporal';
  highlightedId?: string | null;
  onHover?: (id: string | null) => void;
}

function getTemporalColor(createdAt: string): string {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
  if (days <= 30) return '#22c55e'; // green
  if (days <= 90) return '#eab308'; // yellow
  return '#ef4444'; // red
}

function FitBounds({ contacts }: { contacts: MapContact[] }) {
  const map = useMap();

  useEffect(() => {
    if (contacts.length === 0) return;

    const bounds: LatLngBoundsExpression = contacts.map((c) => [c.lat, c.lng] as [number, number]);
    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
  }, [contacts, map]);

  return null;
}

export function LeafletMap({ contacts, viewMode, highlightedId, onHover }: LeafletMapProps) {
  const isDarkMode = useMemo(() => {
    return document.documentElement.classList.contains('dark');
  }, []);

  const tileUrl = isDarkMode
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

  const tileAttribution = isDarkMode
    ? '&copy; <a href="https://carto.com/">CARTO</a>'
    : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

  return (
    <MapContainer
      center={[-15.77, -47.92]}
      zoom={4}
      className="h-[500px] w-full rounded-lg border"
      style={{ zIndex: 0 }}
    >
      <TileLayer url={tileUrl} attribution={tileAttribution} />
      <FitBounds contacts={contacts} />

      {contacts.map((contact) => {
        const color =
          viewMode === 'temporal'
            ? getTemporalColor(contact.created_at)
            : contact.pin_color ?? '#3b82f6';

        const isHighlighted = highlightedId === contact.id;

        return (
          <CircleMarker
            key={contact.id}
            center={[contact.lat, contact.lng]}
            radius={isHighlighted ? 10 : 6}
            pathOptions={{
              color: isHighlighted ? '#000' : color,
              fillColor: color,
              fillOpacity: 0.8,
              weight: isHighlighted ? 3 : 1,
            }}
            eventHandlers={{
              mouseover: () => onHover?.(contact.id),
              mouseout: () => onHover?.(null),
            }}
          >
            <Popup>
              <div className="space-y-1 text-sm">
                <p className="font-semibold">{contact.nome}</p>
                {contact.whatsapp && <p>WhatsApp: {contact.whatsapp}</p>}
                {(contact.logradouro || contact.bairro) && (
                  <p>
                    {[contact.logradouro, contact.numero, contact.bairro, contact.cidade]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                )}
                {contact.contact_tags && contact.contact_tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {contact.contact_tags.map((ct) => (
                      <span
                        key={ct.tag_id}
                        className="inline-block px-1.5 py-0.5 rounded text-[10px] text-white"
                        style={{ backgroundColor: ct.tags.cor ?? '#6b7280' }}
                      >
                        {ct.tags.nome}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
