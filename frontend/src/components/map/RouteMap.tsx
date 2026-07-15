"use client";

import { useEffect, useRef } from "react";
import {
  AdvancedMarker,
  Map,
  useMap,
} from "@vis.gl/react-google-maps";
import { useTheme } from "next-themes";
import { Flag, CircleX, TriangleAlert, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { conditionMeta, severityMeta } from "@/lib/incidents/format";
import type { RawLatLngBounds } from "@/lib/geo";
import type { LngLat, RouteLineString } from "@/lib/mapbox/directions";
import type { Incident } from "@/types/incident";
import type { ViaGeoMarker } from "@/types/ecu911";
import type { MitAdverseEvent } from "@/lib/api/mit-eventos";

const QUITO_CENTER = { lat: -0.1807, lng: -78.4678 };
// DEMO_MAP_ID habilita AdvancedMarker; en producción crear uno en Google Cloud Console.
const MAP_ID = "DEMO_MAP_ID";

const VIA_ESTADO_META: Record<number, { color: string; icon: React.ElementType }> = {
  592: { color: '#f97316', icon: ShieldAlert  }, // Restricción — naranja
  594: { color: '#f59e0b', icon: TriangleAlert }, // Parcial — ámbar
  595: { color: '#dc2626', icon: CircleX       }, // Cerrada — rojo
};

/** Color por tipo_evento del histórico MIT/MTOP — mismas categorías que
 * `MitEventosPanel`, aquí en hex plano porque `google.maps.Polyline` no
 * acepta clases de Tailwind. */
export const MIT_TIPO_HEX: Record<string, string> = {
  'Deslizamiento/Derrumbe':             '#f59e0b',
  'Socavamiento/Socavón':               '#0ea5e9',
  'Caída de rocas':                     '#f97316',
  'Caída de árboles':                   '#10b981',
  'Pérdida de calzada':                 '#ef4444',
  'Hundimiento':                        '#f43f5e',
  'Falla geológica':                    '#8b5cf6',
  'Inundación/Nivel de agua':           '#3b82f6',
  'Trabajos programados/Mantenimiento': '#64748b',
  'Cierre por conflicto social':        '#d946ef',
  'Colapso de puente/alcantarilla':     '#dc2626',
};
const MIT_TIPO_HEX_DEFAULT = '#78716c'; // Otro

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
  /** Eventos históricos MIT/MTOP cuyo tramo geocodificado intersecta la ruta calculada. */
  mitSegments?: MitAdverseEvent[];
  /** Callback al hacer clic en un tramo MIT. */
  onSelectMitEvent?: (event: MitAdverseEvent) => void;
  /** ID del evento MIT actualmente seleccionado (para resaltar). */
  selectedMitEventId?: number | null;
  /** Se dispara cuando el usuario termina de mover el mapa (zoom/pan), con el
   * viewport visible actual — para enfocar el detalle mostrado en el resto de
   * la UI (gráfico, alertas) a esa zona, como el zoom de una línea de tiempo. */
  onViewportBoundsChanged?: (bounds: RawLatLngBounds) => void;
  /** Bounds a los que centrar el mapa cuando el foco se originó en OTRO lugar
   * (ej. el usuario arrastró el selector del gráfico) — `null`/`undefined` no
   * mueve el mapa. */
  focusBounds?: RawLatLngBounds | null;
}

// ─── Auxiliares internos ──────────────────────────────────────────────────────

function BoundsFitter({
  waypoints,
  selectedRoute,
  skipNextIdleRef,
}: {
  waypoints: (LngLat | null)[];
  selectedRoute: LngLat[];
  skipNextIdleRef: React.MutableRefObject<boolean>;
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

    // Este movimiento de cámara es programático, no del usuario — descarta el
    // próximo 'idle' para que `ViewportSync` no lo reporte como un cambio de
    // viewport manual (lo que corrompería/resetearía un foco de zoom-detalle
    // activo cada vez que se recalcula una ruta o cambian los waypoints).
    skipNextIdleRef.current = true;

    if (points.length === 1) {
      map.panTo(points[0]!);
      map.setZoom(14);
      return;
    }

    const bounds = new window.google.maps.LatLngBounds();
    points.forEach((p) => bounds.extend(p));
    map.fitBounds(bounds, 60);
  }, [map, waypoints, selectedRoute, skipNextIdleRef]);

  return null;
}

function IncidentPanner({
  incidents,
  selectedIncidentId,
  skipNextIdleRef,
}: {
  incidents: Incident[];
  selectedIncidentId: number | null;
  skipNextIdleRef: React.MutableRefObject<boolean>;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || selectedIncidentId === null) return;
    const sel = incidents.find((i) => i.id === selectedIncidentId);
    if (sel) {
      // Igual que en `BoundsFitter`: este pan lo origina la selección de un
      // incidente, no el usuario arrastrando el mapa — no debe reportarse
      // como un cambio de viewport manual ni pisar el foco de zoom-detalle activo.
      skipNextIdleRef.current = true;
      map.panTo({ lat: sel.latitude, lng: sel.longitude });
    }
  }, [map, incidents, selectedIncidentId, skipNextIdleRef]);

  return null;
}

/** Reporta el viewport visible del mapa hacia arriba (para enfocar el detalle
 * del resto de la UI), y reacciona a `focusBounds` cuando el foco vino de
 * otro control (el selector del gráfico) haciendo `fitBounds` — con una
 * bandera compartida (`skipNextIdleRef`, ver `RouteMap`) que descarta el
 * próximo 'idle' disparado por ese mismo movimiento programático, o por el de
 * `BoundsFitter`/`IncidentPanner`, para no reportarlo de vuelta como si el
 * usuario hubiera movido el mapa (evita un loop mapa→gráfico→mapa→...). */
function ViewportSync({
  onViewportBoundsChanged,
  focusBounds,
  skipNextIdleRef,
}: {
  onViewportBoundsChanged?: (bounds: RawLatLngBounds) => void;
  focusBounds?: RawLatLngBounds | null;
  skipNextIdleRef: React.MutableRefObject<boolean>;
}) {
  const map = useMap();
  const onViewportBoundsChangedRef = useRef(onViewportBoundsChanged);
  useEffect(() => {
    onViewportBoundsChangedRef.current = onViewportBoundsChanged;
  }, [onViewportBoundsChanged]);

  useEffect(() => {
    if (!map) return;

    const listener = map.addListener('idle', () => {
      if (skipNextIdleRef.current) {
        skipNextIdleRef.current = false;
        return;
      }
      const b = map.getBounds();
      if (!b) return;
      const ne = b.getNorthEast();
      const sw = b.getSouthWest();
      onViewportBoundsChangedRef.current?.({ north: ne.lat(), south: sw.lat(), east: ne.lng(), west: sw.lng() });
    });

    return () => window.google.maps.event.removeListener(listener);
  }, [map, skipNextIdleRef]);

  useEffect(() => {
    if (!map || !focusBounds) return;
    skipNextIdleRef.current = true;
    map.fitBounds(
      new window.google.maps.LatLngBounds(
        { lat: focusBounds.south, lng: focusBounds.west },
        { lat: focusBounds.north, lng: focusBounds.east },
      ),
      40,
    );
  }, [map, focusBounds, skipNextIdleRef]);

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

/** Dibuja un tramo del histórico MIT/MTOP (línea punteada, coloreada por
 * tipo_evento) entre los dos extremos geocodificados del evento. */
function MitEventSegment({
  event,
  isSelected,
  onSelect,
}: {
  event: MitAdverseEvent;
  isSelected: boolean;
  onSelect?: () => void;
}) {
  const map = useMap();

  // El listener llama siempre a la versión más reciente de onSelect vía ref,
  // así el efecto de abajo no necesita "onSelect" en sus dependencias — sin
  // esto, cada RouteMap se re-renderiza con una nueva identidad de función
  // (los onSelectMitEvent={(e) => ...} en RoutePlanner son closures inline) y
  // el Polyline + su listener se destruían y recreaban en cada render ajeno
  // (ej. seleccionar una vía ECU911), con parpadeo visible en cada tramo MIT.
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    if (!map) return;
    if (event.inicio_lat === null || event.inicio_lng === null || event.fin_lat === null || event.fin_lng === null) {
      return;
    }

    // Trazado real por carretera (calculado una vez en el backend vía
    // `mit:route` y cacheado en `ruta_polyline`) si ya está disponible; si no
    // (tramo aún no procesado, o sin ruta conocida entre esos dos puntos),
    // cae de vuelta a la línea recta entre los extremos geocodificados.
    const path = event.ruta_polyline
      ? window.google.maps.geometry.encoding.decodePath(event.ruta_polyline)
      : [
          { lat: event.inicio_lat, lng: event.inicio_lng },
          { lat: event.fin_lat, lng: event.fin_lng },
        ];
    const color = MIT_TIPO_HEX[event.tipo_evento] ?? MIT_TIPO_HEX_DEFAULT;

    const line = new window.google.maps.Polyline({
      map,
      path,
      geodesic: true,
      strokeOpacity: 0,
      strokeWeight: isSelected ? 5 : 3,
      // Por debajo de TODAS las polilíneas de ruta (alterna=0, seleccionada
      // casing=1/línea=2) — un tramo MIT es información histórica secundaria,
      // no debe competir por el clic con la selección de ruta cuando se cruzan
      // visualmente (la ruta alterna también es clickable en ese mismo punto).
      zIndex: isSelected ? -1 : -2,
      clickable: true,
      icons: [{
        icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, strokeColor: color, scale: isSelected ? 4 : 3 },
        offset: '0',
        repeat: '16px',
      }],
    });

    const listener = line.addListener('click', () => onSelectRef.current?.());

    return () => {
      window.google.maps.event.removeListener(listener);
      line.setMap(null);
    };
  }, [map, event, isSelected]);

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
  mitSegments = [],
  onSelectMitEvent,
  selectedMitEventId,
  onViewportBoundsChanged,
  focusBounds,
}: RouteMapProps) {
  const selected = routes[selectedRouteIdx] ?? [];
  const { resolvedTheme } = useTheme();
  const colorScheme = resolvedTheme === "dark" ? "DARK" : "LIGHT";
  // Compartida entre `BoundsFitter`, `IncidentPanner` y `ViewportSync` — CUALQUIERA
  // de los tres puede mover la cámara programáticamente, y todos deben avisarle a
  // `ViewportSync` que descarte el próximo 'idle' resultante (si cada uno tuviera
  // su propia bandera, los movimientos de los otros dos se malinterpretarían como
  // paneos del usuario y corromperían/resetearían el foco de zoom-detalle activo).
  const skipNextIdleRef = useRef(false);

  return (
    <Map
      mapId={MAP_ID}
      defaultCenter={QUITO_CENTER}
      defaultZoom={13}
      gestureHandling="greedy"
      disableDefaultUI={false}
      colorScheme={colorScheme}
      onClick={(e) => {
        if (!e.detail.latLng) return;
        onMapClick?.([e.detail.latLng.lng, e.detail.latLng.lat]);
      }}
      style={{ width: "100%", height: "100%" }}
    >
      <BoundsFitter waypoints={waypoints} selectedRoute={selected} skipNextIdleRef={skipNextIdleRef} />
      <IncidentPanner incidents={incidents} selectedIncidentId={selectedIncidentId} skipNextIdleRef={skipNextIdleRef} />
      <ViewportSync onViewportBoundsChanged={onViewportBoundsChanged} focusBounds={focusBounds} skipNextIdleRef={skipNextIdleRef} />

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

      {/* Tramos del histórico MIT/MTOP que intersectan la ruta calculada */}
      {mitSegments.map((event) => (
        <MitEventSegment
          key={event.id}
          event={event}
          isSelected={selectedMitEventId === event.id}
          onSelect={() => onSelectMitEvent?.(event)}
        />
      ))}

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
        const TypeIcon = conditionMeta[incident.condition ?? 'fisica'].icon;
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
