'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { LngLat } from '@/lib/mapbox/directions';
import type { Incident } from '@/types/incident';

interface RouteInfo {
  distanceMeters: number;
  durationSeconds: number;
}

interface PasteCoords {
  lngLat: LngLat;
  address: string;
}

export interface RoutePlannerSession {
  waypoints: (LngLat | null)[];
  addresses: (string | null)[];
  wpIds: string[];
  routes: LngLat[][];
  selectedRouteIdx: number;
  routeInfo: RouteInfo | null;
  routeInfos: (RouteInfo | null)[];
  incidents: Incident[];
  searched: boolean;
  addressMode: 'url' | 'buscar' | 'coordenadas';
  pasteRouteLinkRaw: string;
  pasteOriginCoords: PasteCoords | null;
  pasteDestCoords: PasteCoords | null;
  pasteViaCoords: PasteCoords[];
}

const EMPTY_SESSION: RoutePlannerSession = {
  waypoints: [null, null],
  addresses: [null, null],
  wpIds: ['wp-0', 'wp-1'],
  routes: [],
  selectedRouteIdx: 0,
  routeInfo: null,
  routeInfos: [],
  incidents: [],
  searched: false,
  addressMode: 'buscar',
  pasteRouteLinkRaw: '',
  pasteOriginCoords: null,
  pasteDestCoords: null,
  pasteViaCoords: [],
};

interface RoutePlannerSessionContextValue {
  session: RoutePlannerSession;
  updateSession: (patch: Partial<RoutePlannerSession>) => void;
}

const RoutePlannerSessionContext = createContext<RoutePlannerSessionContextValue | null>(null);

/** Vive en `(app)/layout.tsx`, que no se desmonta al navegar entre pantallas —
 * a diferencia de `RoutePlanner`, que se remonta en cada visita a `/mapa` y
 * perdería todo su estado local si no se espejara aquí. */
export function RoutePlannerSessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<RoutePlannerSession>(EMPTY_SESSION);

  const updateSession = useCallback((patch: Partial<RoutePlannerSession>) => {
    setSession((prev) => ({ ...prev, ...patch }));
  }, []);

  const value = useMemo(() => ({ session, updateSession }), [session, updateSession]);

  return (
    <RoutePlannerSessionContext.Provider value={value}>
      {children}
    </RoutePlannerSessionContext.Provider>
  );
}

export function useRoutePlannerSession(): RoutePlannerSessionContextValue {
  const ctx = useContext(RoutePlannerSessionContext);
  if (!ctx) throw new Error('useRoutePlannerSession debe usarse dentro de RoutePlannerSessionProvider');
  return ctx;
}
