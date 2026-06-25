'use client';

import { useState } from 'react';
import { Map, Mountain, Flame, CloudRain } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IncidentFab } from '@/components/incidents/IncidentFab';
import { RouteTimeline } from '@/components/map/RouteTimeline';
import { AltimetriaPanel } from '@/components/analysis/AltimetriaPanel';
import { CalorPanel } from '@/components/analysis/CalorPanel';
import { ClimaPanel } from '@/components/analysis/ClimaPanel';

// RoutePlanner se carga en cliente (usa Google Maps)
import dynamic from 'next/dynamic';
const RoutePlanner = dynamic(
  () => import('@/components/routes/RoutePlanner').then(m => ({ default: m.RoutePlanner })),
  { ssr: false },
);

type Tab = 'ruta' | 'altimetria' | 'calor' | 'clima';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'ruta',       label: 'Ruta',        icon: Map        },
  { id: 'altimetria', label: 'Altimetría',  icon: Mountain   },
  { id: 'calor',      label: 'Calor',       icon: Flame      },
  { id: 'clima',      label: 'Clima',       icon: CloudRain  },
];

export default function MapaPage() {
  const [activeTab, setActiveTab] = useState<Tab>('ruta');

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Barra de tabs ──────────────────────────────────────────── */}
      <div className="flex h-11 shrink-0 items-center gap-1 border-b border-border/60 bg-background/80 px-4 backdrop-blur">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
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

      {/* ── Contenido principal ────────────────────────────────────── */}
      <div className="relative min-h-0 flex-1">
        {/*
          El RoutePlanner se mantiene SIEMPRE montado (pero oculto en otros tabs)
          para preservar el estado de la ruta al cambiar de pestaña.
        */}
        <div className={cn('absolute inset-0', activeTab !== 'ruta' && 'pointer-events-none invisible')}>
          <RoutePlanner />
        </div>

        {activeTab === 'altimetria' && (
          <div className="absolute inset-0 overflow-auto">
            <AltimetriaPanel />
          </div>
        )}
        {activeTab === 'calor' && (
          <div className="absolute inset-0 overflow-auto">
            <CalorPanel />
          </div>
        )}
        {activeTab === 'clima' && (
          <div className="absolute inset-0 overflow-auto">
            <ClimaPanel />
          </div>
        )}
      </div>

      {/* ── Timeline de ruta (siempre visible) ────────────────────── */}
      <RouteTimeline />

      {/* FAB para reportar incidentes */}
      {activeTab === 'ruta' && <IncidentFab />}
    </div>
  );
}
