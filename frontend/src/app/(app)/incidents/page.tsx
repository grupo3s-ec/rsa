'use client';

/**
 * /incidents vive en el mismo shell que /mapa — el mapa jamás debe
 * desaparecer de la pantalla, así que esta ruta ya no es un feed fullscreen
 * aparte: es el mismo `RoutePlanner`, con el panel de Incidentes abierto en
 * vez del planificador (ver `initialSidebarView`).
 */

import { useCallback, useState } from 'react';
import { IncidentFab } from '@/components/incidents/IncidentFab';
import type { LngLat } from '@/lib/mapbox/directions';
import dynamic from 'next/dynamic';

const RoutePlanner = dynamic(
  () => import('@/components/routes/RoutePlanner').then(m => ({ default: m.RoutePlanner })),
  { ssr: false },
);

export default function IncidentsPage() {
  const [incidentRefreshKey, setIncidentRefreshKey] = useState(0);
  const [incidentPickActive, setIncidentPickActive] = useState(false);
  const [pickedIncidentCoords, setPickedIncidentCoords] = useState<LngLat | null>(null);

  const handleIncidentCreated = useCallback(() => {
    setIncidentRefreshKey((k) => k + 1);
  }, []);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="min-h-0 flex-1">
        <RoutePlanner
          initialSidebarView="incidentes"
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
