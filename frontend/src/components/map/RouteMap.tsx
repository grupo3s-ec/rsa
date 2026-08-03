"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  AdvancedMarker,
  Map,
  useMap,
} from "@vis.gl/react-google-maps";
import { useTheme } from "next-themes";
import { Flag, CircleX, TriangleAlert, ShieldAlert, CarFront, Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import { conditionMeta, severityMeta } from "@/lib/incidents/format";
import { getExpiryState } from "@/lib/incidents/expiry";
import { nearestPointOnRoute, sliceRouteByKm } from "@/lib/geo";
import { maxImpactoHex } from "@/lib/risk-evaluation";
import type { RawLatLngBounds } from "@/lib/geo";
import type { LngLat, RouteLineString } from "@/lib/mapbox/directions";
import type { Incident } from "@/types/incident";
import type { ViaGeoMarker } from "@/types/ecu911";
import type { MitAdverseEvent } from "@/lib/api/mit-eventos";
import type { AntSiniestro } from "@/lib/api/ant-siniestros";
import type { RiskEvaluationKmPoint } from "@/lib/api/risk-evaluation";

// Color propio de la capa ANT — teal, para distinguirla de un vistazo de
// ECU911 (azul), MIT (violeta) y reportes creados (semáforo rojo/naranja/
// ámbar/verde).
const ANT_COLOR = '#0d9488';

const QUITO_CENTER = { lat: -0.1807, lng: -78.4678 };
// DEMO_MAP_ID habilita AdvancedMarker; en producción crear uno en Google Cloud Console.
const MAP_ID = "DEMO_MAP_ID";
// Referencia estable — un `[]` literal nuevo en cada render rompería la
// memoización de `snappedViaMarkers` y las dependencias del efecto de
// `MitEventSegment` cuando no hay ruta seleccionada.
const EMPTY_COORDS: LngLat[] = [];

// Paleta por FUENTE, no por severidad — así se distingue de un vistazo si un
// símbolo viene de ECU911, de MIT o de un reporte propio (severityMeta se
// reserva para los reportes creados en la plataforma). Todas las variantes
// de ECU911 quedan en la familia azul; las de MIT, en la familia violeta.
const VIA_ESTADO_META: Record<number, { color: string; icon: React.ElementType }> = {
  592: { color: '#60a5fa', icon: ShieldAlert  }, // Restricción — azul claro
  594: { color: '#2563eb', icon: TriangleAlert }, // Parcial — azul medio
  595: { color: '#1e3a8a', icon: CircleX       }, // Cerrada — azul oscuro
};

/** Color por tipo_evento del histórico MIT/MTOP — mismas categorías que
 * `MitEventosPanel`, aquí en hex plano porque `google.maps.Polyline` no
 * acepta clases de Tailwind. Toda la familia queda en tonos violeta para
 * identificar la fuente MIT de un vistazo; el tipo específico se distingue
 * por el ícono en los paneles de lista. */
export const MIT_TIPO_HEX: Record<string, string> = {
  'Deslizamiento/Derrumbe':             '#7c3aed',
  'Socavamiento/Socavón':               '#8b5cf6',
  'Caída de rocas':                     '#6d28d9',
  'Caída de árboles':                   '#a78bfa',
  'Pérdida de calzada':                 '#5b21b6',
  'Hundimiento':                        '#7e22ce',
  'Falla geológica':                    '#6d28d9',
  'Inundación/Nivel de agua':           '#9333ea',
  'Trabajos programados/Mantenimiento': '#a78bfa',
  'Cierre por conflicto social':        '#8b5cf6',
  'Colapso de puente/alcantarilla':     '#5b21b6',
};
const MIT_TIPO_HEX_DEFAULT = '#c4b5fd'; // Otro

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
  /** Siniestros de tránsito ANT cercanos a la ruta calculada (coordenadas exactas). */
  antSiniestros?: AntSiniestro[];
  /** Callback al hacer clic en un siniestro ANT. */
  onSelectAntSiniestro?: (siniestro: AntSiniestro) => void;
  /** ID del siniestro ANT actualmente seleccionado (para resaltar). */
  selectedAntId?: number | null;
  /** Puntos de la Evaluación de Riesgo por km cercanos a la ruta calculada. */
  riskEvaluationKms?: RiskEvaluationKmPoint[];
  /** Callback al hacer clic en un punto de Evaluación de Riesgo. */
  onSelectRiskKm?: (km: RiskEvaluationKmPoint) => void;
  /** ID del km de Evaluación de Riesgo actualmente seleccionado (para resaltar). */
  selectedRiskKmId?: number | null;
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

    // Un solo gesto de zoom con scroll dispara varios 'idle' seguidos (uno por
    // cada paso intermedio), y cada uno antes disparaba un re-render completo
    // del gráfico/alertas — se sentía como lag acumulado durante el zoom. Se
    // debounce-a 150ms para reportar solo el estado final del gesto.
    let debounceId: ReturnType<typeof setTimeout> | undefined;
    const listener = map.addListener('idle', () => {
      if (skipNextIdleRef.current) {
        skipNextIdleRef.current = false;
        return;
      }
      if (debounceId) clearTimeout(debounceId);
      debounceId = setTimeout(() => {
        const b = map.getBounds();
        if (!b) return;
        const ne = b.getNorthEast();
        const sw = b.getSouthWest();
        onViewportBoundsChangedRef.current?.({ north: ne.lat(), south: sw.lat(), east: ne.lng(), west: sw.lng() });
      }, 150);
    });

    return () => {
      if (debounceId) clearTimeout(debounceId);
      window.google.maps.event.removeListener(listener);
    };
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
  routeCoords,
}: {
  event: MitAdverseEvent;
  isSelected: boolean;
  onSelect?: () => void;
  /** Coordenadas de la ruta activa calculada — si están disponibles, el tramo
   * se ancla sobre ellas (ver comentario dentro del efecto) en vez de usar la
   * geocodificación aproximada del evento tal cual. */
  routeCoords: LngLat[];
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

    // `inicio`/`fin` del evento son aproximados — el boletín MIT solo da un
    // nombre de lugar, no una coordenada exacta, así que varios eventos
    // distintos cerca del mismo pueblo geocodifican al MISMO punto (ej. 18
    // eventos distintos "cerca de Macas"). Dibujar la ruta calculada aparte
    // entre esos 2 puntos aproximados (o la línea recta) produce un efecto de
    // "punto de fuga": muchas líneas saliendo del mismo lugar hacia destinos
    // distintos. En vez de eso, si ya hay una ruta activa calculada, ANCLAMOS
    // inicio/fin sobre el punto más cercano de esa ruta real y dibujamos el
    // tramo REAL de la vía entre esos 2 anclajes — siempre coincide con la
    // curva real de la carretera, y no depende de que el geocoding haya sido preciso.
    let path: google.maps.LatLng[] | { lat: number; lng: number }[] | null = null;
    if (routeCoords.length > 0) {
      const snapInicio = nearestPointOnRoute({ lat: event.inicio_lat, lng: event.inicio_lng }, routeCoords);
      const snapFin    = nearestPointOnRoute({ lat: event.fin_lat,    lng: event.fin_lng    }, routeCoords);
      if (snapInicio && snapFin) {
        path = sliceRouteByKm(routeCoords, snapInicio.km, snapFin.km).map(([lng, lat]) => ({ lat, lng }));
      }
    }
    // Sin ruta activa (o sin poder anclar): trazado real por carretera
    // calculado una vez en el backend vía `mit:route` si está disponible, o
    // la línea recta entre los extremos geocodificados como último recurso.
    // `ruta_polyline` es un JSON con la polyline codificada de CADA tramo
    // (`step`) por separado (no la `overview_polyline`, que Google simplifica
    // para mapas de escala pequeña) — se decodifica y concatena cada una.
    if (!path && event.ruta_polyline) {
      try {
        const steps = JSON.parse(event.ruta_polyline) as string[];
        path = steps.flatMap((step) => window.google.maps.geometry.encoding.decodePath(step));
      } catch {
        // Formato viejo/corrupto (ej. una fila calculada antes de pasar a
        // JSON de steps) — cae de vuelta a la línea recta en vez de romper
        // el render de este tramo.
      }
    }
    if (!path) {
      path = [
        { lat: event.inicio_lat, lng: event.inicio_lng },
        { lat: event.fin_lat, lng: event.fin_lng },
      ];
    }
    const color = MIT_TIPO_HEX[event.tipo_evento] ?? MIT_TIPO_HEX_DEFAULT;

    const line = new window.google.maps.Polyline({
      map,
      path,
      geodesic: true,
      strokeOpacity: 0,
      strokeWeight: isSelected ? 5 : 3,
      // Por ENCIMA de las polilíneas de ruta (alterna=0, seleccionada
      // casing=1/línea=2) — antes iba por debajo para no competir por el clic
      // con la ruta, pero eso hacía que la ruta tapara visualmente el tramo
      // MIT en cualquier punto donde se cruzan. Prioriza verse (información
      // histórica) sobre la prioridad de clic en el cruce exacto.
      zIndex: isSelected ? 4 : 3,
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
  }, [map, event, isSelected, routeCoords]);

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
  antSiniestros = [],
  onSelectAntSiniestro,
  selectedAntId,
  riskEvaluationKms = [],
  onSelectRiskKm,
  selectedRiskKmId,
  onViewportBoundsChanged,
  focusBounds,
}: RouteMapProps) {
  const selected = routes[selectedRouteIdx] ?? EMPTY_COORDS;
  // Posición anclada de cada vía sobre la ruta activa — memoizado para no
  // reescanear los miles de puntos de `selected` en cada render de RouteMap
  // (ej. al cambiar `selectedViaId` para resaltar una vía), solo cuando
  // realmente cambian los marcadores o la ruta.
  const snappedViaMarkers = useMemo(
    () => viaMarkers.map((m) => ({
      marker: m,
      position: selected.length > 0 ? nearestPointOnRoute(m.location, selected) : null,
    })),
    [viaMarkers, selected],
  );
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
          routeCoords={selected}
        />
      ))}

      {/* Siniestros de tránsito ANT — a diferencia de ECU911/MIT, la BDD trae
          coordenadas exactas por siniestro, no hay que anclarlas a la ruta. */}
      {antSiniestros.map((s) => {
        const isSelected = selectedAntId === s.id;
        return (
          <AdvancedMarker
            key={s.id}
            position={{ lat: s.lat, lng: s.lng }}
            onClick={() => onSelectAntSiniestro?.(s)}
            title={`${s.tipo_siniestro ?? 'Siniestro'} — ${s.direccion ?? s.canton ?? ''}`}
          >
            <div className={cn('flex size-6 items-center justify-center rounded-full border-2 border-white text-white shadow-lg transition-transform hover:scale-110', isSelected && 'scale-125')}
              style={{ backgroundColor: ANT_COLOR }}>
              <CarFront className="size-3.5" />
            </div>
          </AdvancedMarker>
        );
      })}

      {/* Evaluación de Riesgo por km — coordenadas exactas del levantamiento
          en campo; el color es el impacto más alto entre las condiciones de
          ese km (mismo semáforo que las severidades de incidentes). */}
      {riskEvaluationKms.map((km) => {
        const isSelected = selectedRiskKmId === km.id;
        const color = maxImpactoHex(km.conditions);
        return (
          <AdvancedMarker
            key={km.id}
            position={{ lat: km.lat, lng: km.lng }}
            onClick={() => onSelectRiskKm?.(km)}
            title={`${km.km_label} — ${km.conditions.length} condición${km.conditions.length !== 1 ? 'es' : ''}`}
          >
            <div className={cn('flex size-6 items-center justify-center rounded-full border-2 border-white text-white shadow-lg transition-transform hover:scale-110', isSelected && 'scale-125')}
              style={{ backgroundColor: color }}>
              <Camera className="size-3.5" />
            </div>
          </AdvancedMarker>
        );
      })}

      {/* Vías ECU911 con restricciones — la descripción del ECU911 solo trae
          un nombre de lugar, no coordenadas exactas, así que la geocodificación
          (hecha río arriba en RoutePlanner) puede caer un poco lejos de la vía
          real. Si hay una ruta activa calculada, anclamos el pin al punto más
          cercano de esa ruta en vez de dejarlo en su coordenada cruda — mismo
          criterio que los tramos MIT, ver `MitEventSegment`. */}
      {snappedViaMarkers.map(({ marker: m, position: snapped }) => {
        const meta = VIA_ESTADO_META[m.via.estado_actual_id] ?? { color: '#6b7280', icon: TriangleAlert };
        const Icon = meta.icon;
        const isSelected = selectedViaId === m.via.id;
        const position = snapped ? { lat: snapped.point[1], lng: snapped.point[0] } : m.location;
        return (
          <AdvancedMarker
            key={m.via.id}
            position={position}
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
        const needsFollowUp = getExpiryState(incident.expires_at, incident.status) === 'expired';

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
              {needsFollowUp && (
                <span
                  aria-hidden
                  title="Necesita seguimiento"
                  className="absolute -right-0.5 -top-0.5 flex size-3 items-center justify-center rounded-full border border-white bg-red-500"
                />
              )}
            </button>
          </AdvancedMarker>
        );
      })}
    </Map>
  );
}
