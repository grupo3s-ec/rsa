'use client';

import { useCallback, useState } from 'react';
import { IncidentFab } from '@/components/incidents/IncidentFab';
import type { LngLat } from '@/lib/mapbox/directions';
import type { Incident } from '@/types/incident';
import dynamic from 'next/dynamic';

const RoutePlanner = dynamic(
  () => import('@/components/routes/RoutePlanner').then(m => ({ default: m.RoutePlanner })),
  { ssr: false },
);

export default function MapaPage() {
  const [incidentRefreshKey, setIncidentRefreshKey] = useState(0);
  const [incidentPickActive, setIncidentPickActive] = useState(false);
  const [pickedIncidentCoords, setPickedIncidentCoords] = useState<LngLat | null>(null);
  // Ubicación elegida hasta ahora en el formulario de "Reportar incidente"
  // (o null) — se muestra como pin en el mapa mientras el Sheet sigue abierto.
  const [draftIncidentCoords, setDraftIncidentCoords] = useState<LngLat | null>(null);
  // El incidente recién reportado — RoutePlanner abre el panel de Incidentes
  // y lo muestra apenas cambia esta referencia (ver `focusIncidentToken`).
  const [justCreatedIncident, setJustCreatedIncident] = useState<Incident | null>(null);

  const handleIncidentCreated = useCallback((incident: Incident) => {
    setIncidentRefreshKey((k) => k + 1);
    setJustCreatedIncident(incident);
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
              onCoordsChange={setDraftIncidentCoords}
            />
          )}
          incidentRefreshKey={incidentRefreshKey}
          focusIncident={justCreatedIncident}
          onFocusIncidentConsumed={() => setJustCreatedIncident(null)}
          pendingIncidentCoords={draftIncidentCoords}
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
