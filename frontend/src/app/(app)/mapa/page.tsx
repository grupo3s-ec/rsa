'use client';

import { useCallback, useState } from 'react';
import { Map, Flame, Route, BarChart2, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IncidentFab } from '@/components/incidents/IncidentFab';
import { RouteTimeline } from '@/components/map/RouteTimeline';
import { CalorPanel } from '@/components/analysis/CalorPanel';
import { ViaEstadoPanel } from '@/components/analysis/ViaEstadoPanel';
import { AntStatsPanel } from '@/components/analysis/AntStatsPanel';
import { EvaluacionRiesgoPanel } from '@/components/analysis/EvaluacionRiesgoPanel';
import type { RouteCalculatedData } from '@/components/routes/RoutePlanner';
import dynamic from 'next/dynamic';

const RoutePlanner = dynamic(
  () => import('@/components/routes/RoutePlanner').then(m => ({ default: m.RoutePlanner })),
  { ssr: false },
);

type Tab = 'ruta' | 'calor' | 'vias' | 'ant' | 'riesgo';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'ruta',   label: 'Ruta',   icon: Map         },
  { id: 'calor',  label: 'Calor',  icon: Flame       },
  { id: 'vias',   label: 'Vías',   icon: Route       },
  { id: 'ant',    label: 'ANT',    icon: BarChart2   },
  { id: 'riesgo', label: 'Riesgo', icon: ShieldCheck },
];

export default function MapaPage() {
  const [activeTab,          setActiveTab]          = useState<Tab>('ruta');
  const [routeData,          setRouteData]          = useState<RouteCalculatedData | null>(null);
  const [conflictProvinces,  setConflictProvinces]  = useState<string[] | null>(null);
  const [incidentRefreshKey, setIncidentRefreshKey] = useState(0);

  const handleRouteCalculated = useCallback((data: RouteCalculatedData | null) => {
    setRouteData(data);
    if (!data) setConflictProvinces(null);
  }, []);

  const handleViaConflicts = useCallback((provinces: string[]) => {
    setConflictProvinces(provinces);
  }, []);

  const handleIncidentCreated = useCallback(() => {
    setIncidentRefreshKey((k) => k + 1);
  }, []);

  const RIGHT_SLOTS: Partial<Record<Tab, React.ReactNode>> = {
    calor:  <CalorPanel filterProvinces={routeData ? conflictProvinces : null} />,
    vias:   <ViaEstadoPanel />,
    ant:    <AntStatsPanel />,
    riesgo: <EvaluacionRiesgoPanel />,
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

      {/* Contenido: planner izquierda (50%) + mapa o panel derecha (50%) */}
      <div className="min-h-0 flex-1">
        <RoutePlanner
          rightSlot={RIGHT_SLOTS[activeTab]}
          mapOverlay={activeTab === 'ruta' ? <IncidentFab onCreated={handleIncidentCreated} /> : undefined}
          onRouteCalculated={handleRouteCalculated}
          onViaConflictsChanged={handleViaConflicts}
          incidentRefreshKey={incidentRefreshKey}
        />
      </div>

      {/* Timeline de ruta */}
      <RouteTimeline routeData={routeData} />
    </div>
  );
}
