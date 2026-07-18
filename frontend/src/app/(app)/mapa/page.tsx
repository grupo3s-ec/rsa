'use client';

import { useCallback, useState } from 'react';
import { IncidentFab } from '@/components/incidents/IncidentFab';
import type { LngLat } from '@/lib/mapbox/directions';
import dynamic from 'next/dynamic';

const RoutePlanner = dynamic(
  () => import('@/components/routes/RoutePlanner').then(m => ({ default: m.RoutePlanner })),
  { ssr: false },
);

export default function MapaPage() {
  const [incidentRefreshKey, setIncidentRefreshKey] = useState(0);
  const [incidentPickActive, setIncidentPickActive] = useState(false);
  const [pickedIncidentCoords, setPickedIncidentCoords] = useState<LngLat | null>(null);

  const handleIncidentCreated = useCallback(() => {
    setIncidentRefreshKey((k) => k + 1);
  }, []);

  // El mapa siempre debe estar visible — antes había un tab "Ruta/Clima" que
  // lo reemplazaba por completo con un panel de clima aparte; ese contenido
  // ya vive en la pestaña "Altimetría · Clima" del panel derecho, así que el
  // swap era redundante y violaba "el mapa nunca se oculta".
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="min-h-0 flex-1">
        <RoutePlanner
          mapOverlay={(
            <IncidentFab
              onCreated={handleIncidentCreated}
              onRequestPickLocation={() => setIncidentPickActive(true)}
              pickActive={incidentPickActive}
              pickedCoords={pickedIncidentCoords}
              onPickedCoordsConsumed={() => setPickedIncidentCoords(null)}
            />
          )}
          incidentRefreshKey={incidentRefreshKey}
          externalPickActive={incidentPickActive}
          externalPickLabel="la ubicación del incidente"
          onExternalPick={(lngLat) => {
            setPickedIncidentCoords(lngLat);
            setIncidentPickActive(false);
          }}
          onExternalPickCancel={() => setIncidentPickActive(false)}
        />
      </div>
    </div>
  );
}
