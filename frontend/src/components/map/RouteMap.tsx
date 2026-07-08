"use client";

import { useEffect } from "react";
import {
  AdvancedMarker,
  Map,
  useMap,
} from "@vis.gl/react-google-maps";
import { useTheme } from "next-themes";
import { Flag, CircleX, TriangleAlert, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { severityMeta, typeMeta } from "@/lib/incidents/format";
import type { LngLat, RouteLineString } from "@/lib/mapbox/directions";
import type { Incident } from "@/types/incident";
import type { ViaGeoMarker } from "@/types/ecu911";

const QUITO_CENTER = { lat: -0.1807, lng: -78.4678 };
// DEMO_MAP_ID habilita AdvancedMarker; en producción crear uno en Google Cloud Console.
const MAP_ID = "DEMO_MAP_ID";

const VIA_ESTADO_META: Record<number, { color: string; icon: React.ElementType }> = {
  592: { color: '#f97316', icon: ShieldAlert  }, // Restricción — naranja
  594: { color: '#f59e0b', icon: TriangleAlert }, // Parcial — ámbar
  595: { color: '#dc2626', icon: CircleX       }, // Cerrada — rojo
};

interface RouteMapProps {
  waypoints: (LngLat | null)[];
  /** Todas las rutas alternativas calculadas. */
  routes: LngLat[][];
  /** Índice de la ruta actualmente seleccionada. */
  selectedRouteIdx: number;
  incidents: Incident[];
  selectedIncidentId: number | null;
  onSelectIncident: (incident: Incident) => void;
  onSelectRoute: (idx: number) => void;
  onMapClick?: (lngLat: LngLat) => void;
  /** Marcadores de vías con restricciones ECU911. */
  viaMarkers?: ViaGeoMarker[];
  /** Callback al hacer clic en un marcador de vía. */
  onSelectVia?: (marker: ViaGeoMarker) => void;
  /** ID de la vía actualmente seleccionada (para resaltar). */
  selectedViaId?: string | null;
}

// ─── Auxiliares internos ──────────────────────────────────────────────────────

function BoundsFitter({
  waypoints,
  selectedRoute,
}: {
  waypoints: (LngLat | null)[];
  selectedRoute: LngLat[];
}) {
  const map = useMap();

  useEffect(() => {
    if (!map) return;

    const points: google.maps.LatLngLiteral[] = [];
    for (const wp of waypoints) {
      if (wp) points.push({ lat: wp[1], lng: wp[0] });
    }
    for (const [lng, lat] of selectedRoute) {
      points.push({ lat, lng });
    }

    if (points.length === 0) return;

    if (points.length === 1) {
      map.panTo(points[0]!);
      map.setZoom(14);
      return;
    }

    const bounds = new window.google.maps.LatLngBounds();
    points.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, 90);
  }, [map, waypoints, selectedRoute]);

  return null;
}

function IncidentPanner({
  incidents,
  selectedIncidentId,
}: {
  incidents: Incident[];
  selectedIncidentId: number | null;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || selectedIncidentId === null) return;
    const sel = incidents.find((i) => i.id === selectedIncidentId);
    if (sel) map.panTo({ lat: sel.latitude, lng: sel.longitude });
  }, [map, incidents, selectedIncidentId]);

  return null;
}

/**
 * Renderiza una ruta como polilínea en el mapa.
 * Si `isSelected` es false, se muestra atenuada y es clickeable para seleccionarla.
 */
function RoutePolyline({
  coordinates,
  isSelected,
  onSelect,
}: {
  coordinates: LngLat[];
  isSelected: boolean;
  onSelect?: () => void;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || coordinates.length === 0) return;

    const path = coordinates.map(([lng, lat]) => ({ lat, lng }));

    if (isSelected) {
      // Casing oscuro debajo + línea azul encima
      const casing = new window.google.maps.Polyline({
        map,
        path,
        geodesic: true,
        strokeColor: "#1e3a8a",
        strokeOpacity: 0.5,
        strokeWeight: 10,
        zIndex: 1,
      });
      const line = new window.google.maps.Polyline({
        map,
        path,
        geodesic: true,
        strokeColor: "#2563eb",
        strokeOpacity: 1,
        strokeWeight: 6,
        zIndex: 2,
      });
      return () => {
        casing.setMap(null);
        line.setMap(null);
      };
    }

    // Ruta alternativa: gris-azulado, más fina, clickeable
    const alt = new window.google.maps.Polyline({
      map,
      path,
      geodesic: true,
      strokeColor: "#94a3b8",
      strokeOpacity: 0.7,
      strokeWeight: 5,
      zIndex: 0,
      clickable: true,
    });

    if (onSelect) {
      const listener = alt.addListener("click", onSelect);
      return () => {
        window.google.maps.event.removeListener(listener);
        alt.setMap(null);
      };
    }

    return () => alt.setMap(null);
  }, [map, coordinates, isSelected, onSelect]);

  return null;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function RouteMap({
  waypoints,
  routes,
  selectedRouteIdx,
  incidents,
  selectedIncidentId,
  onSelectIncident,
  onSelectRoute,
  onMapClick,
  viaMarkers = [],
  onSelectVia,
  selectedViaId,
}: RouteMapProps) {
  const selected = routes[selectedRouteIdx] ?? [];
  const { resolvedTheme } = useTheme();
  const colorScheme = resolvedTheme === "dark" ? "DARK" : "LIGHT";

  return (
    <Map
      mapId={MAP_ID}
      defaultCenter={QUITO_CENTER}
      defaultZoom={11}
      gestureHandling="greedy"
      disableDefaultUI={false}
      colorScheme={colorScheme}
      onClick={(e) => {
        if (!e.detail.latLng) return;
        onMapClick?.([e.detail.latLng.lng, e.detail.latLng.lat]);
      }}
      style={{ width: "100%", height: "100%" }}
    >
      <BoundsFitter waypoints={waypoints} selectedRoute={selected} />
      <IncidentPanner incidents={incidents} selectedIncidentId={selectedIncidentId} />

      {/* Rutas alternativas primero (debajo) */}
      {routes.map((coords, idx) =>
        idx !== selectedRouteIdx ? (
          <RoutePolyline
            key={idx}
            coordinates={coords}
            isSelected={false}
            onSelect={() => onSelectRoute(idx)}
          />
        ) : null,
      )}

      {/* Ruta seleccionada encima */}
      {selected.length > 0 ? (
        <RoutePolyline
          key={`selected-${selectedRouteIdx}`}
          coordinates={selected}
          isSelected
        />
      ) : null}

      {/* Waypoints */}
      {waypoints.map((wp, idx) => {
        if (!wp) return null;
        const isFirst = idx === 0;
        const isLast  = idx === waypoints.length - 1;
        return (
          <AdvancedMarker key={idx} position={{ lat: wp[1], lng: wp[0] }}>
            {isFirst ? (
              <span className="flex size-5 items-center justify-center rounded-full border-2 border-white bg-emerald-500 shadow-md">
                <span className="size-1.5 rounded-full bg-white" />
              </span>
            ) : isLast ? (
              <span className="flex size-8 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-white shadow-lg">
                <Flag className="size-3.5" />
              </span>
            ) : (
              <span className="flex size-6 items-center justify-center rounded-full border-2 border-white bg-primary text-[10px] font-bold text-white shadow-md">
                {idx}
              </span>
            )}
          </AdvancedMarker>
        );
      })}

      {/* Vías ECU911 con restricciones */}
      {viaMarkers.map((m) => {
        const meta = VIA_ESTADO_META[m.via.estado_actual_id] ?? { color: '#6b7280', icon: TriangleAlert };
        const Icon = meta.icon;
        const isSelected = selectedViaId === m.via.id;
        return (
          <AdvancedMarker
            key={m.via.id}
            position={m.location}
            onClick={() => onSelectVia?.(m)}
            title={`${m.via.descripcion} — ${m.via.EstadoActual.nombre}`}
          >
            <div className={cn('flex flex-col items-center cursor-pointer transition-transform hover:scale-110', isSelected && 'scale-115')}>
              <div
                className="flex size-8 items-center justify-center rounded-full border-2 border-white text-white shadow-lg"
                style={{ backgroundColor: meta.color }}
              >
                <Icon className="size-4" />
              </div>
              {/* tallo del pin */}
              <div className="h-2 w-0.5 rounded-b-full" style={{ backgroundColor: meta.color }} />
            </div>
          </AdvancedMarker>
        );
      })}

      {/* Incidentes */}
      {incidents.map((incident) => {
        const TypeIcon = typeMeta[incident.type].icon;
        const severity = severityMeta[incident.severity];
        const isSelected = selectedIncidentId === incident.id;
        const isCritical = incident.severity === "critical";

        return (
          <AdvancedMarker
            key={incident.id}
            position={{ lat: incident.latitude, lng: incident.longitude }}
            onClick={() => onSelectIncident(incident)}
          >
            <button
              type="button"
              aria-label={incident.title}
              className={cn(
                "relative flex size-8 cursor-pointer items-center justify-center rounded-full border-2 border-white text-white shadow-lg transition-transform duration-200 hover:scale-115 focus-visible:scale-115 focus-visible:outline-none",
                isSelected && "scale-120 ring-2 ring-white/80",
              )}
              style={{ backgroundColor: severity.hex }}
            >
              {isCritical ? (
                <span
                  aria-hidden
                  className="rsa-marker-pulse absolute inset-0 rounded-full"
                  style={{ backgroundColor: severity.hex }}
                />
              ) : null}
              <TypeIcon className="relative size-4" />
            </button>
          </AdvancedMarker>
        );
      })}
    </Map>
  );
}
