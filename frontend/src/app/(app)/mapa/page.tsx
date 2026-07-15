'use client';

import { useCallback, useState } from 'react';
import { Map, CloudRain } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IncidentFab } from '@/components/incidents/IncidentFab';
import { ClimaPanel } from '@/components/analysis/ClimaPanel';
import type { RouteCalculatedData } from '@/components/routes/RoutePlanner';
import type { LngLat } from '@/lib/mapbox/directions';
import dynamic from 'next/dynamic';

const RoutePlanner = dynamic(
  () => import('@/components/routes/RoutePlanner').then(m => ({ default: m.RoutePlanner })),
  { ssr: false },
);

type Tab = 'ruta' | 'clima';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'ruta',   label: 'Ruta',  icon: Map       },
  { id: 'clima',  label: 'Clima', icon: CloudRain },
];

export default function MapaPage() {
  const [activeTab,          setActiveTab]          = useState<Tab>('ruta');
  const [routeData,          setRouteData]          = useState<RouteCalculatedData | null>(null);
  const [incidentRefreshKey, setIncidentRefreshKey] = useState(0);
  const [incidentPickActive, setIncidentPickActive] = useState(false);
  const [pickedIncidentCoords, setPickedIncidentCoords] = useState<LngLat | null>(null);

  const handleRouteCalculated = useCallback((data: RouteCalculatedData | null) => {
    setRouteData(data);
  }, []);

  const handleIncidentCreated = useCallback(() => {
    setIncidentRefreshKey((k) => k + 1);
  }, []);

  const RIGHT_SLOTS: Partial<Record<Tab, React.ReactNode>> = {
    clima: <ClimaPanel routeData={routeData} />,
  };

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex h-11 shrink-0 items-center gap-1 border-b border-border/60 bg-background/80 px-4 backdrop-blur overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              activeTab === id
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Contenido: planificador | mapa | alertas·altimetría·clima·cierres·vías·ANT·riesgo — cada aside colapsable a 1/3 */}
      <div className="min-h-0 flex-1">
        <RoutePlanner
          rightSlot={RIGHT_SLOTS[activeTab]}
          mapOverlay={activeTab === 'ruta' ? (
            <IncidentFab
              onCreated={handleIncidentCreated}
              onRequestPickLocation={() => setIncidentPickActive(true)}
              pickActive={incidentPickActive}
              pickedCoords={pickedIncidentCoords}
              onPickedCoordsConsumed={() => setPickedIncidentCoords(null)}
            />
          ) : undefined}
          onRouteCalculated={handleRouteCalculated}
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
