"use client";

import dynamic from "next/dynamic";
import { APIProvider, useApiIsLoaded, useMapsLibrary } from "@vis.gl/react-google-maps";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  AlertTriangle,
  Bell,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleCheck,
  Crosshair,
  Flag,
  GripVertical,
  HelpCircle,
  Link2,
  LoaderCircle,
  Maximize2,
  Navigation,
  PanelLeft,
  Plus,
  Route as RouteIcon,
  Search,
  Timer,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { IncidentDetailDialog } from "@/components/incidents/IncidentDetailDialog";
import { IncidentSidebar } from "@/components/incidents/IncidentSidebar";
import { MapHelpDialog } from "@/components/map/MapHelpDialog";
import { RouteTimeline } from "@/components/map/RouteTimeline";
import { cn } from "@/lib/utils";
import { GOOGLE_MAPS_API_KEY } from "@/lib/config";
import { formatDistance, formatDuration } from "@/lib/incidents/format";
import {
  type LngLat,
  type RouteLineString,
} from "@/lib/mapbox/directions";
import { filterIncidentsByRoute } from "@/lib/mapbox/route-filter";
import { getRouteIncidents } from "@/services/routes.service";
import { getIncidents } from "@/services/incidents.service";
import {
  pointNearPolyline,
  subsampleRoute,
  kmPositionAlongRoute,
  kmRangeVisibleInBounds,
  boundsForKmRange,
  type RawLatLngBounds,
} from "@/lib/geo";
import { getMitEventos, type MitAdverseEvent } from "@/lib/api/mit-eventos";
import type { Incident } from "@/types/incident";
import type { Ecu911Response, ViaGeoMarker } from "@/types/ecu911";

// Mismo color por tipo_evento que `RouteMap` usa para dibujar el tramo — se
// duplica aquí (en vez de importar desde RouteMap.tsx, que se carga vía
// `dynamic(..., { ssr: false })`) para no forzar ese módulo a incluirse en el
// chunk estático de este archivo y romper su carga diferida.
const MIT_TIPO_HEX: Record<string, string> = {
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

const RouteMap = dynamic(() => import("@/components/map/RouteMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-muted/40 absolute inset-0">
      <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
    </div>
  ),
});


const MAX_WAYPOINTS = 8;

type PickingIndex = number | null;
type LayoutMode   = "full" | "panel";

interface RouteInfo {
  distanceMeters: number;
  durationSeconds: number;
}

// ─── Componente público (envuelve todo en APIProvider) ────────────────────────

export interface RouteCalculatedData {
  coords: LngLat[];
  incidents: Incident[];
  distanceMeters: number;
  durationSeconds: number;
}

interface RoutePlannerProps {
  /** Si se provee, reemplaza el mapa en el slot derecho (para paneles de análisis). */
  rightSlot?: React.ReactNode;
  /** Elemento que se superpone en la esquina del mapa (ej. FAB de reporte). */
  mapOverlay?: React.ReactNode;
  /** Callback con datos de la ruta calculada, o null si falló. */
  onRouteCalculated?: (data: RouteCalculatedData | null) => void;
  /** Incrementar para forzar recarga de incidentes (ej. después de crear uno nuevo). */
  incidentRefreshKey?: number;
  /** Activa un modo de selección en el mapa ajeno al planificador (ej. ubicación de un incidente). */
  externalPickActive?: boolean;
  /** Texto mostrado en el indicador flotante mientras `externalPickActive` está activo. */
  externalPickLabel?: string;
  /** Se dispara con las coordenadas del click cuando `externalPickActive` está activo. */
  onExternalPick?: (lngLat: LngLat) => void;
  /** Se dispara al cancelar el modo de selección externo. */
  onExternalPickCancel?: () => void;
}

export function RoutePlanner({ rightSlot, mapOverlay, onRouteCalculated, incidentRefreshKey, externalPickActive, externalPickLabel, onExternalPick, onExternalPickCancel }: RoutePlannerProps = {}) {
  // "geometry" habilita `google.maps.geometry.encoding.decodePath` — usada por
  // `MitEventSegment` en RouteMap.tsx para dibujar el trazado real de cada
  // tramo MIT (polyline pre-calculada por el backend) en vez de una línea
  // recta entre sus dos extremos geocodificados.
  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={["geocoding", "geometry"]}>
      <RoutePlannerContent
        rightSlot={rightSlot}
        mapOverlay={mapOverlay}
        onRouteCalculated={onRouteCalculated}
        incidentRefreshKey={incidentRefreshKey}
        externalPickActive={externalPickActive}
        externalPickLabel={externalPickLabel}
        onExternalPick={onExternalPick}
        onExternalPickCancel={onExternalPickCancel}
      />
    </APIProvider>
  );
}

// ─── Contenido real (dentro del contexto de Google Maps) ─────────────────────

function RoutePlannerContent({
  rightSlot,
  mapOverlay,
  onRouteCalculated,
  incidentRefreshKey,
  externalPickActive = false,
  externalPickLabel = "el punto",
  onExternalPick,
  onExternalPickCancel,
}: {
  rightSlot?: React.ReactNode;
  mapOverlay?: React.ReactNode;
  onRouteCalculated?: (data: RouteCalculatedData | null) => void;
  incidentRefreshKey?: number;
  externalPickActive?: boolean;
  externalPickLabel?: string;
  onExternalPick?: (lngLat: LngLat) => void;
  onExternalPickCancel?: () => void;
}) {
  const geocodingLib = useMapsLibrary("geocoding");
  const placesLib    = useMapsLibrary("places");
  const apiIsLoaded  = useApiIsLoaded();

  const [directionsService, setDirectionsService] =
    useState<google.maps.DirectionsService | null>(null);
  const [geocoder, setGeocoder] =
    useState<google.maps.Geocoder | null>(null);
  const [autocompleteService, setAutocompleteService] =
    useState<google.maps.places.AutocompleteService | null>(null);

  // DirectionsService es parte del core de Maps JS — espera a que la API esté cargada
  useEffect(() => {
    if (!apiIsLoaded) return;
    setDirectionsService(new google.maps.DirectionsService());
  }, [apiIsLoaded]);
  useEffect(() => {
    if (geocodingLib) setGeocoder(new geocodingLib.Geocoder());
  }, [geocodingLib]);
  useEffect(() => {
    if (placesLib) setAutocompleteService(new placesLib.AutocompleteService());
  }, [placesLib]);

  const [waypoints, setWaypoints] = useState<(LngLat | null)[]>([null, null]);
  const [addresses, setAddresses] = useState<(string | null)[]>([null, null]);
  const [wpIds,     setWpIds]     = useState<string[]>(['wp-0', 'wp-1']);

  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  /** Todas las rutas calculadas (índice 0 = primera / seleccionada). */
  const [routes,           setRoutes]           = useState<LngLat[][]>([]);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0);
  const [routeInfo,        setRouteInfo]        = useState<RouteInfo | null>(null);
  /** distancia/duración de CADA ruta alternativa (mismo índice que `routes`) —
   * `routeInfo` refleja solo la ruta activa; `handleSelectRoute` lee de aquí
   * para no dejar `routeInfo` (y por lo tanto `routeKmScale`) pegado a la
   * ruta primaria al cambiar de alternativa. */
  const [routeInfos,       setRouteInfos]       = useState<(RouteInfo | null)[]>([]);

  // La ruta activa como RouteLineString (para filterIncidentsByRoute)
  const routeGeometry: RouteLineString | null = routes[selectedRouteIdx]
    ? { type: "LineString", coordinates: routes[selectedRouteIdx]! }
    : null;
  const [incidents,     setIncidents]     = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [detailOpen,    setDetailOpen]    = useState(false);
  const [loading,       setLoading]       = useState(false);

  /** Espejo local de lo que se envía por onRouteCalculated — evita depender de un
   * round-trip por el padre solo para alimentar el panel de Alertas/Altimetría/Clima. */
  const timelineRouteData: RouteCalculatedData | null = useMemo(() => {
    const coords = routes[selectedRouteIdx];
    if (!coords || coords.length === 0 || !routeInfo) return null;
    return {
      coords,
      incidents,
      distanceMeters: routeInfo.distanceMeters,
      durationSeconds: routeInfo.durationSeconds,
    };
  }, [routes, selectedRouteIdx, routeInfo, incidents]);

  // Carga inicial y recarga tras crear novedad (incidentRefreshKey incrementa)
  useEffect(() => {
    void (async () => {
      try {
        const { data } = await getIncidents();
        // Solo mostrar incidentes activos en el mapa
        setIncidents(data.filter((i) => i.status === 'open' || i.status === 'in_progress'));
      } catch { /* falla silenciosamente — el usuario puede calcular ruta para reintentar */ }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incidentRefreshKey]);
  const [error,         setError]         = useState<string | null>(null);
  const [pickingIndex,  setPickingIndex]  = useState<PickingIndex>(null);
  const [panelOpen,     setPanelOpen]     = useState(true);
  const [searched,      setSearched]      = useState(false);
  const [helpOpen,      setHelpOpen]      = useState(false);
  const [layoutMode,    setLayoutMode]    = useState<LayoutMode>("panel");
  const [plannerCollapsed, setPlannerCollapsed] = useState(false);

  // ─── ECU911 — vías con restricciones ────────────────────────────────────
  const [viaMarkers,       setViaMarkers]       = useState<ViaGeoMarker[]>([]);
  const [viaConflicts,     setViaConflicts]     = useState<ViaGeoMarker[]>([]);
  const [selectedVia,      setSelectedVia]      = useState<ViaGeoMarker | null>(null);
  const [conflictsOpen,    setConflictsOpen]    = useState(false);
  const geocodedRef = useRef(false);

  const conflictProvinces = useMemo(
    () => viaConflicts.map((m) => m.via.Provincia.descripcion),
    [viaConflicts],
  );

  // Geocodifica las vías ECU911 una sola vez cuando el geocoder está disponible
  useEffect(() => {
    if (!geocoder || geocodedRef.current) return;
    geocodedRef.current = true;

    void (async () => {
      try {
        const res = await fetch('/api/ecu911');
        if (!res.ok) return;
        const json = (await res.json()) as Ecu911Response;
        const vias = json.data ?? [];

        const results: ViaGeoMarker[] = [];
        // Geocodificar en lotes de 8 para no saturar la API
        const BATCH = 8;
        for (let i = 0; i < vias.length; i += BATCH) {
          const batch = vias.slice(i, i + BATCH);
          const settled = await Promise.allSettled(
            batch.map(async (via) => {
              // Tomar el primer segmento del nombre como referencia geográfica
              const namePart = via.descripcion.split(' - ')[0]?.trim() ?? via.descripcion;
              const geo = await geocoder.geocode({ address: `${namePart}, Ecuador`, region: 'ec' });
              const loc = geo.results[0]?.geometry?.location;
              if (!loc) return null;
              return { via, location: { lat: loc.lat(), lng: loc.lng() } } satisfies ViaGeoMarker;
            }),
          );
          for (const r of settled) {
            if (r.status === 'fulfilled' && r.value) results.push(r.value);
          }
        }
        setViaMarkers(results);
      } catch {
        // Si falla silenciosamente no bloquea el resto del planificador
      }
    })();
  }, [geocoder]);

  // Muestras de alta resolución de la ruta activa (km en escala Haversine,
  // sin corregir) — única fuente para las conversiones bounds↔km más abajo, y
  // (declarada aquí arriba) para los filtros de conflictos Vías/MIT que siguen.
  const routeSamples = useMemo(() => {
    const coords = routes[selectedRouteIdx];
    return coords && coords.length > 0 ? subsampleRoute(coords, 200) : [];
  }, [routes, selectedRouteIdx]);

  // Detectar conflictos con la ruta activa (umbral 25 km) — usa `routeSamples`
  // (200 puntos, ya submuestreados) en vez de los coords crudos de Directions
  // (pueden ser miles de puntos): con cientos de marcadores/eventos esto era
  // un escaneo O(marcadores × miles de puntos) que saturaba el hilo principal
  // justo después de pintar la ruta, dando la sensación de que tardaba en aparecer.
  useEffect(() => {
    if (routeSamples.length === 0 || viaMarkers.length === 0) {
      setViaConflicts([]);
      return;
    }
    const polyline = routeSamples.map((s) => ({ lat: s.point[1], lng: s.point[0] }));
    const conflicts = viaMarkers.filter((m) =>
      pointNearPolyline(m.location, polyline, 25),
    );
    setViaConflicts(conflicts);
    if (conflicts.length > 0) setConflictsOpen(true);
  }, [routeSamples, viaMarkers]);

  // ─── MIT/MTOP — histórico de eventos adversos (boletines mensuales) ────────
  const [mitEvents,        setMitEvents]        = useState<MitAdverseEvent[]>([]);
  const [mitConflicts,     setMitConflicts]     = useState<MitAdverseEvent[]>([]);
  const [selectedMit,      setSelectedMit]      = useState<MitAdverseEvent | null>(null);
  const [mitConflictsOpen, setMitConflictsOpen] = useState(false);
  const mitFetchedRef = useRef(false);

  // Provincia tal cual aparece en el boletín MTOP/MIT — una fuente de datos
  // distinta a ECU911, así que NO se reusa `conflictProvinces` (ECU911) para
  // acotar este panel: antes filtraba por la provincia equivocada.
  const mitConflictProvinces = useMemo(
    () => [...new Set(mitConflicts.map((e) => e.provincia))],
    [mitConflicts],
  );

  // Toggle mostrar/ocultar tipo de evento MIT — controla qué tramos se dibujan
  // en el mapa (el panel lateral tiene sus propios botones para esto, pero el
  // estado vive aquí porque el mapa recibe `mitSegments` desde este componente).
  const [hiddenMitTipos, setHiddenMitTipos] = useState<Set<string>>(new Set());
  const toggleMitTipo = useCallback((tipo: string) => {
    setHiddenMitTipos(prev => {
      const next = new Set(prev);
      if (next.has(tipo)) next.delete(tipo); else next.add(tipo);
      return next;
    });
  }, []);
  const mitSegmentsVisible = useMemo(
    () => hiddenMitTipos.size === 0 ? mitConflicts : mitConflicts.filter((e) => !hiddenMitTipos.has(e.tipo_evento)),
    [mitConflicts, hiddenMitTipos],
  );

  // Carga el histórico MIT una sola vez — ya viene geocodificado (aproximado)
  // desde el backend, a diferencia de ECU911 no requiere geocodificar aquí.
  useEffect(() => {
    if (mitFetchedRef.current) return;
    mitFetchedRef.current = true;

    const soloGeocodificados = (rows: MitAdverseEvent[]) => rows.filter((e) =>
      e.geocoding_status === 'ok'
      && e.inicio_lat !== null && e.inicio_lng !== null
      && e.fin_lat !== null && e.fin_lng !== null,
    );

    void (async () => {
      // Página 1 primero (para conocer last_page), el resto en paralelo — y
      // cada página que sí llega se agrega de inmediato: si una falla a
      // mitad de camino (timeout/500), las demás ya obtenidas no se pierden
      // (antes, cualquier falla descartaba TODO lo ya descargado porque solo
      // se llamaba setMitEvents una vez al final, con un array acumulado local).
      const MAX_PAGES = 100; // tope de seguridad — el histórico crece cada mes con nuevos boletines
      try {
        const primera = await getMitEventos({ page: 1 });
        setMitEvents((prev) => [...prev, ...soloGeocodificados(primera.data)]);

        const ultimaPagina = Math.min(primera.last_page, MAX_PAGES);
        if (ultimaPagina > 1) {
          const restantes = await Promise.allSettled(
            Array.from({ length: ultimaPagina - 1 }, (_, i) => getMitEventos({ page: i + 2 })),
          );
          for (const r of restantes) {
            if (r.status === 'fulfilled') {
              setMitEvents((prev) => [...prev, ...soloGeocodificados(r.value.data)]);
            }
          }
        }
      } catch {
        // La página 1 falló — no bloquea el resto del planificador.
      }
    })();
  }, []);

  // Detectar eventos MIT cuyo tramo geocodificado (inicio o fin) está cerca
  // de la ruta activa (mismo umbral de 25 km que ECU911) — usa `routeSamples`
  // por la misma razón que el efecto de Vías arriba: este efecto se re-ejecuta
  // en cada página que llega del histórico MIT, así que escanear miles de
  // puntos crudos en vez de 200 se multiplicaba por cada página cargada.
  useEffect(() => {
    if (routeSamples.length === 0 || mitEvents.length === 0) {
      setMitConflicts([]);
      return;
    }
    const polyline = routeSamples.map((s) => ({ lat: s.point[1], lng: s.point[0] }));
    const conflicts = mitEvents.filter((e) => {
      const inicio = { lat: e.inicio_lat!, lng: e.inicio_lng! };
      const fin = { lat: e.fin_lat!, lng: e.fin_lng! };
      return pointNearPolyline(inicio, polyline, 25) || pointNearPolyline(fin, polyline, 25);
    });
    setMitConflicts(conflicts);
    if (conflicts.length > 0) setMitConflictsOpen(true);
  }, [routeSamples, mitEvents]);

  // ─── Zoom-detalle: el viewport del mapa (o el selector del gráfico) enfoca
  // el detalle mostrado en el resto de la UI — como el zoom de una línea de
  // tiempo de edición de video. `focusedKmRange` (km "reales", ya escalados a
  // distancia de carretera) es la única fuente de verdad; `null` = vista
  // completa de la ruta. `focusDriverRef` evita que el mapa y el gráfico se
  // empujen el uno al otro en un loop cuando uno de los dos originó el cambio.
  const [focusedKmRange, setFocusedKmRangeState] = useState<[number, number] | null>(null);
  const focusDriverRef = useRef<'map' | 'chart' | null>(null);

  // Corrige el km acumulado por Haversine (línea recta) contra el km real de
  // la ruta (distancia de la API de rutas, siempre algo mayor). Multiplicar
  // por esto convierte "km de muestra" → "km reales" mostrados en la UI.
  const routeKmScale = useMemo(() => {
    const haversineTotal = routeSamples[routeSamples.length - 1]?.km ?? 0;
    const roadTotalKm = (routeInfo?.distanceMeters ?? 0) / 1000;
    // `roadTotalKm > 0` además de `haversineTotal > 0`: si falló Directions
    // (routeInfo es null) pero ya hay una ruta de respaldo con muestras,
    // roadTotalKm queda en 0 y sin este guard el factor de escala colapsaría
    // a 0 (no al 1 de respaldo), poniendo todo km calculado en 0.
    return haversineTotal > 0 && roadTotalKm > 0 ? roadTotalKm / haversineTotal : 1;
  }, [routeSamples, routeInfo]);

  const totalRouteKm = useMemo(
    () => (routeSamples[routeSamples.length - 1]?.km ?? 0) * routeKmScale,
    [routeSamples, routeKmScale],
  );

  // Vías/MIT en conflicto, con su posición en km reales a lo largo de la ruta
  // — para poder filtrarlos cuando el mapa/gráfico enfoca un tramo específico.
  const viaConflictsWithKm = useMemo(
    () => viaConflicts.map((m) => ({
      ...m,
      km: kmPositionAlongRoute(m.location, routeSamples, routeKmScale),
    })),
    [viaConflicts, routeSamples, routeKmScale],
  );
  const mitConflictsWithKm = useMemo(
    () => mitConflicts.map((e) => ({
      ...e,
      inicioKm: kmPositionAlongRoute({ lat: e.inicio_lat!, lng: e.inicio_lng! }, routeSamples, routeKmScale),
      finKm: kmPositionAlongRoute({ lat: e.fin_lat!, lng: e.fin_lng! }, routeSamples, routeKmScale),
    })),
    [mitConflicts, routeSamples, routeKmScale],
  );

  // Subconjunto de vías/MIT dentro del rango enfocado — cuando no hay foco,
  // se muestran todos (comportamiento de siempre).
  const viaConflictsVisible = useMemo(() => {
    if (!focusedKmRange) return viaConflictsWithKm;
    const [from, to] = focusedKmRange;
    return viaConflictsWithKm.filter((m) => m.km >= from && m.km <= to);
  }, [viaConflictsWithKm, focusedKmRange]);
  const mitConflictsVisible = useMemo(() => {
    if (!focusedKmRange) return mitConflictsWithKm;
    const [from, to] = focusedKmRange;
    // Overlap de intervalos ([inicioKm,finKm] vs [from,to]), no solo si algún
    // extremo cae adentro — un tramo largo que atraviesa el rango enfocado
    // por completo (inicioKm < from y finKm > to) antes se perdía porque
    // ningún extremo individual caía dentro de [from,to].
    return mitConflictsWithKm.filter((e) => {
      const start = Math.min(e.inicioKm, e.finKm);
      const end = Math.max(e.inicioKm, e.finKm);
      return end >= from && start <= to;
    });
  }, [mitConflictsWithKm, focusedKmRange]);

  // El mapa terminó de moverse: calcula qué rango de km quedó visible y
  // decide si eso cuenta como "enfocado" (menos del 85% de la ruta total
  // visible) o si el usuario se alejó a ver el overview completo.
  const handleViewportBoundsChanged = useCallback((bounds: RawLatLngBounds) => {
    focusDriverRef.current = 'map';
    if (routeSamples.length === 0) { setFocusedKmRangeState(null); return; }
    const visible = kmRangeVisibleInBounds(routeSamples, bounds);
    if (!visible) { setFocusedKmRangeState(null); return; }
    const [fromKm, toKm] = visible;
    const widthReal = (toKm - fromKm) * routeKmScale;
    const next: [number, number] | null =
      widthReal < totalRouteKm * 0.85 ? [fromKm * routeKmScale, toKm * routeKmScale] : null;
    // El mapa dispara un 'idle' por cada micro-ajuste de viewport aunque el
    // rango visible de la ruta apenas cambie — sin este chequeo, cada uno
    // fuerza un re-render (y re-animación) completo del gráfico/alertas.
    setFocusedKmRangeState(prev => {
      if (prev === next) return prev;
      if (prev && next && Math.abs(prev[0] - next[0]) < 0.05 && Math.abs(prev[1] - next[1]) < 0.05) return prev;
      return next;
    });
  }, [routeSamples, routeKmScale, totalRouteKm]);

  // El usuario arrastró el selector del gráfico — enfoca ese rango (en km
  // reales) directamente.
  const handleChartRangeChanged = useCallback((range: [number, number] | null) => {
    focusDriverRef.current = 'chart';
    setFocusedKmRangeState(range);
  }, []);

  // Bounds a los que el mapa debe centrarse — solo cuando el foco lo originó
  // el gráfico (si lo originó el mapa, este ya está ahí; moverlo de nuevo
  // sería redundante y arriesga el loop que `focusDriverRef` evita). Cuando el
  // gráfico LIMPIA el foco (ej. el botón "Ver toda la ruta"), `focusedKmRange`
  // pasa a `null` — el mapa debe volver a mostrar la ruta completa, no
  // quedarse quieto en el último tramo enfocado.
  const focusBoundsForMap = useMemo(() => {
    if (focusDriverRef.current !== 'chart' || routeSamples.length === 0) return null;
    if (!focusedKmRange) {
      const totalKm = routeSamples[routeSamples.length - 1]!.km;
      return boundsForKmRange(routeSamples, [0, totalKm]);
    }
    const [fromKmReal, toKmReal] = focusedKmRange;
    return boundsForKmRange(routeSamples, [fromKmReal / routeKmScale, toKmReal / routeKmScale]);
  }, [focusedKmRange, routeSamples, routeKmScale]);

  // Bounds geográficos del rango enfocado actual (sin importar qué lo originó)
  // — a diferencia de `focusBoundsForMap`, este SIEMPRE refleja el foco activo;
  // lo usa el tab MIT para su filtro "solo lo visible" sobre el histórico
  // completo (que no tiene noción de "km de la ruta", solo lat/lng).
  const focusedGeoBounds = useMemo(() => {
    if (!focusedKmRange || routeSamples.length === 0) return null;
    const [fromKmReal, toKmReal] = focusedKmRange;
    return boundsForKmRange(routeSamples, [fromKmReal / routeKmScale, toKmReal / routeKmScale]);
  }, [focusedKmRange, routeSamples, routeKmScale]);

  // ─── Modo de dirección (tabs) ────────────────────────────────────────────
  const [addressMode,       setAddressMode]       = useState<"url" | "buscar" | "coordenadas">("buscar");
  const [pasteRouteLinkRaw, setPasteRouteLinkRaw] = useState("");
  const [pasteOriginCoords, setPasteOriginCoords] = useState<{ lngLat: LngLat; address: string } | null>(null);
  const [pasteDestCoords,   setPasteDestCoords]   = useState<{ lngLat: LngLat; address: string } | null>(null);
  const [pasteViaCoords,    setPasteViaCoords]    = useState<Array<{ lngLat: LngLat; address: string }>>([]);

  const origin      = waypoints[0];
  const destination = waypoints[waypoints.length - 1];

  const canSearch =
    waypoints.every((w) => w !== null) && waypoints.length >= 2 && !loading;

  const criticalCount = useMemo(
    () => incidents.filter((i) => i.severity === "critical").length,
    [incidents],
  );

  const activePickMode = pickingIndex !== null || externalPickActive;

  // ─── Mutaciones de waypoints ──────────────────────────────────────────────

  function setWaypointAt(idx: number, lngLat: LngLat, address: string | null = null) {
    setWaypoints((prev) => { const n = [...prev]; n[idx] = lngLat; return n; });
    setAddresses((prev) => { const n = [...prev]; n[idx] = address; return n; });
  }

  function addWaypoint() {
    if (waypoints.length >= MAX_WAYPOINTS) return;
    const newId = `wp-${Date.now()}`;
    setWaypoints((prev) => { const n = [...prev]; n.splice(n.length - 1, 0, null); return n; });
    setAddresses((prev) => { const n = [...prev]; n.splice(n.length - 1, 0, null); return n; });
    setWpIds((prev)     => { const n = [...prev]; n.splice(n.length - 1, 0, newId); return n; });
  }

  function removeWaypoint(idx: number) {
    if (waypoints.length <= 2) return;
    setWaypoints((prev) => prev.filter((_, i) => i !== idx));
    setAddresses((prev) => prev.filter((_, i) => i !== idx));
    setWpIds((prev)     => prev.filter((_, i) => i !== idx));
    if (pickingIndex === idx) setPickingIndex(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = wpIds.indexOf(active.id as string);
    const newIdx = wpIds.indexOf(over.id  as string);
    if (oldIdx === -1 || newIdx === -1) return;

    const newWaypoints = arrayMove(waypoints, oldIdx, newIdx);
    const newAddresses = arrayMove(addresses, oldIdx, newIdx);
    setWaypoints(newWaypoints);
    setAddresses(newAddresses);
    setWpIds((prev) => arrayMove(prev, oldIdx, newIdx));
    if (pickingIndex !== null) setPickingIndex(null);

    if (searched) void handleSearchWith(newWaypoints);
  }

  function updateWaypointCoord(idx: number, axis: "lat" | "lng", rawValue: string) {
    if (rawValue.trim() === "") return;
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return;
    setWaypoints((prev) => {
      const n    = [...prev];
      const base = n[idx] ?? [0, 0];
      const ai   = axis === "lng" ? 0 : 1;
      if (base[ai] === value) return prev;
      n[idx] = axis === "lng" ? [value, base[1]] : [base[0], value];
      return n;
    });
    setAddresses((prev) => { const n = [...prev]; n[idx] = null; return n; });
  }

  // ─── Click en el mapa (picking o reporte) ────────────────────────────────

  const handleMapClick = useCallback(
    async (lngLat: LngLat) => {
      if (pickingIndex !== null) {
        const idx = pickingIndex;
        setWaypoints((prev) => { const n = [...prev]; n[idx] = lngLat; return n; });
        setPickingIndex(null);

        if (geocoder) {
          try {
            const res = await geocoder.geocode({
              location: { lat: lngLat[1], lng: lngLat[0] },
            });
            const addr = res.results[0]?.formatted_address ?? null;
            setAddresses((prev) => { const n = [...prev]; n[idx] = addr; return n; });
          } catch {
            // ignorar — las coordenadas ya están guardadas
          }
        }
        return;
      }

      if (externalPickActive) {
        onExternalPick?.(lngLat);
      }
    },
    [pickingIndex, geocoder, externalPickActive, onExternalPick],
  );

  const cancelPickMode = useCallback(() => {
    if (pickingIndex !== null) { setPickingIndex(null); return; }
    if (externalPickActive) onExternalPickCancel?.();
  }, [pickingIndex, externalPickActive, onExternalPickCancel]);

  // ─── Calcular ruta con Google Directions ─────────────────────────────────

  async function handleSearchWith(wps: (LngLat | null)[]): Promise<void> {
    const defined = wps.filter((w): w is LngLat => w !== null);
    if (defined.length < 2) return;

    setLoading(true);
    setError(null);
    setSearched(true);
    setPanelOpen(true);

    const first  = defined[0]!;
    const last   = defined[defined.length - 1]!;
    const middle = defined.slice(1, -1);

    const directionsPromise: Promise<google.maps.DirectionsResult> =
      directionsService
        ? directionsService.route({
            origin:      { lat: first[1], lng: first[0] },
            destination: { lat: last[1],  lng: last[0]  },
            waypoints: middle.map((wp) => ({
              location: { lat: wp[1], lng: wp[0] },
              stopover: true,
            })),
            travelMode: google.maps.TravelMode.DRIVING,
            provideRouteAlternatives: true,
            drivingOptions: {
              departureTime: new Date(),
              trafficModel: google.maps.TrafficModel.BEST_GUESS,
            },
          })
        : Promise.reject(new Error("Google Maps aún no está listo."));

    const [incidentsResult, directionsResult] = await Promise.allSettled([
      getRouteIncidents({
        origin_lat:      first[1],
        origin_lng:      first[0],
        destination_lat: last[1],
        destination_lng: last[0],
      }),
      directionsPromise,
    ]);

    let resolvedCoords: LngLat[] | null = null;
    let resolvedDist = 0;
    let resolvedDur  = 0;

    // Nueva ruta calculada — cualquier foco de zoom-detalle de la ruta
    // anterior queda sin sentido sobre esta geometría nueva.
    setFocusedKmRangeState(null);
    focusDriverRef.current = null;

    if (directionsResult.status === "fulfilled") {
      const allRoutes = directionsResult.value.routes;
      // Concatenamos step.path de cada leg para preservar el trayecto completo
      // con todas las paradas; overview_path es una simplificación que omite desvíos.
      const converted: LngLat[][] = allRoutes.map((r) => {
        const coords: LngLat[] = [];
        for (const leg of r.legs) {
          for (const step of leg.steps) {
            for (const pt of step.path) {
              coords.push([pt.lng(), pt.lat()]);
            }
          }
        }
        return coords.length > 0
          ? coords
          : r.overview_path.map((p): LngLat => [p.lng(), p.lat()]);
      });
      setRoutes(converted);
      setSelectedRouteIdx(0);
      setRouteInfos(allRoutes.map((r) => ({
        distanceMeters: r.legs.reduce((s, l) => s + (l.distance?.value ?? 0), 0),
        durationSeconds: r.legs.reduce((s, l) => s + (l.duration?.value ?? 0), 0),
      })));

      const primary = allRoutes[0];
      if (primary) {
        resolvedCoords = converted[0] ?? null;
        resolvedDist = primary.legs.reduce((s, l) => s + (l.distance?.value ?? 0), 0);
        resolvedDur  = primary.legs.reduce((s, l) => s + (l.duration?.value ?? 0), 0);
        setRouteInfo({ distanceMeters: resolvedDist, durationSeconds: resolvedDur });
      }
    } else {
      setRoutes([defined]);
      setSelectedRouteIdx(0);
      setRouteInfo(null);
      setRouteInfos([null]);
    }

    let callbackIncidents: Incident[] = [];
    if (incidentsResult.status === "fulfilled") {
      const raw      = incidentsResult.value.data;
      const filtered = resolvedCoords ? filterIncidentsByRoute(raw, resolvedCoords) : raw;
      callbackIncidents = filtered;
      setIncidents(filtered);
    } else {
      const reason: unknown = incidentsResult.reason;
      setError(
        reason instanceof Error
          ? reason.message
          : "No se pudieron cargar las alertas de la ruta.",
      );
      setIncidents([]);
    }

    if (resolvedCoords) {
      onRouteCalculated?.({
        coords: resolvedCoords,
        incidents: callbackIncidents,
        distanceMeters: resolvedDist,
        durationSeconds: resolvedDur,
      });
    } else {
      onRouteCalculated?.(null);
    }
    setLoading(false);
  }

  async function handleSearch(): Promise<void> {
    return handleSearchWith(waypoints);
  }

  function handleSelectRoute(idx: number) {
    setSelectedRouteIdx(idx);
    // Cada ruta alternativa tiene su propia distancia — sin esto, routeInfo
    // (y por lo tanto routeKmScale) se quedaba pegado a la ruta primaria.
    const info = routeInfos[idx];
    if (info) setRouteInfo(info);
    // Un foco de zoom-detalle de la ruta anterior no tiene sentido sobre la
    // geometría de esta otra ruta.
    setFocusedKmRangeState(null);
    focusDriverRef.current = null;
    // Re-filtrar incidentes con la nueva ruta seleccionada
    const coords = routes[idx];
    if (coords) {
      setIncidents((prev) => filterIncidentsByRoute(prev, coords));
    }
  }

  function handleSelectFromMap(incident: Incident) {
    setSelectedIncident(incident);
    setDetailOpen(true);
  }

  function handleSelectFromList(incident: Incident) {
    if (selectedIncident?.id === incident.id) { setDetailOpen(true); return; }
    setSelectedIncident(incident);
  }

  // ─── Modo URL ────────────────────────────────────────────────────────────

  async function handlePasteRouteLink(raw: string): Promise<void> {
    setPasteRouteLinkRaw(raw);
    if (!raw.trim()) {
      setPasteOriginCoords(null);
      setPasteDestCoords(null);
      setPasteViaCoords([]);
      return;
    }

    // URLs cortas (maps.app.goo.gl) necesitan expandirse server-side antes de parsear
    let resolved = raw.trim();
    if (resolved.includes('goo.gl')) {
      try {
        const res = await fetch(`/api/expand-url?url=${encodeURIComponent(resolved)}`);
        const data = (await res.json()) as { url?: string };
        if (data.url) resolved = data.url;
      } catch { /* si falla, intentamos con la URL original */ }
    }

    const route = extractRouteFromGoogleMapsUrl(resolved);
    if (route && geocoder) {
      // Primero se resuelven los waypoints que ya son coordenadas (instantáneo, sin
      // geocoding) para armar un sesgo geográfico — así, un waypoint de texto ambiguo
      // (misma calle/iglesia existe en varias ciudades) se geocodifica cerca del resto
      // de la ruta en vez de en cualquier ciudad de Ecuador que matchee el nombre.
      const coordRegex = /^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/;
      const knownPoints = route.waypoints
        .map((wp) => wp.match(coordRegex))
        .filter((m): m is RegExpMatchArray => m !== null)
        .map((m) => ({ lat: parseFloat(m[1]!), lng: parseFloat(m[2]!) }));

      let bias: google.maps.LatLngBounds | undefined;
      if (knownPoints.length > 0) {
        bias = new google.maps.LatLngBounds();
        knownPoints.forEach((p) => bias!.extend(p));
      }

      const allResults = await Promise.allSettled(
        route.waypoints.map((wp) => resolveLocationText(wp, geocoder, bias)),
      );
      const allCoords = allResults
        .map((r) => (r.status === "fulfilled" ? r.value : null))
        .filter((c): c is { lngLat: LngLat; address: string } => c !== null);
      if (allCoords.length >= 2) {
        setPasteOriginCoords(allCoords[0]!);
        setPasteDestCoords(allCoords[allCoords.length - 1]!);
        setPasteViaCoords(allCoords.slice(1, -1));
      }
      return;
    }

    // Si tiene @lat,lng (enlace de lugar), usarlo como origen
    const point = await resolveLocationText(resolved, geocoder);
    if (point) setPasteOriginCoords(point);
  }

  async function handleApplyPaste(): Promise<void> {
    if (!pasteOriginCoords || !pasteDestCoords) return;
    const all = [pasteOriginCoords, ...pasteViaCoords, pasteDestCoords];
    const newWps   = all.map((w) => w.lngLat);
    const newAddrs = all.map((w) => w.address);
    const newIds   = all.map((_, i) => `wp-p${i}`);
    setWaypoints(newWps);
    setAddresses(newAddrs);
    setWpIds(newIds);
    await handleSearchWith(newWps);
  }

  // ─── Atajos de teclado ────────────────────────────────────────────────────

  const kbHandlerRef = useRef<((e: KeyboardEvent) => void) | null>(null);
  kbHandlerRef.current = (event: KeyboardEvent) => {
    const target   = event.target as HTMLElement;
    const isTyping =
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable;
    if (isTyping) return;

    switch (event.key) {
      case "Enter":
        if (canSearch && !detailOpen && !helpOpen) {
          event.preventDefault();
          void handleSearch();
        }
        break;
      case "Escape":
        if (activePickMode) { event.preventDefault(); cancelPickMode(); }
        break;
      case "a": case "A":
        if (!detailOpen && !helpOpen) {
          event.preventDefault(); setPanelOpen((o) => !o);
        }
        break;
      case "?":
        event.preventDefault(); setHelpOpen((o) => !o);
        break;
      case "ArrowLeft":
        if (incidents.length > 0 && !detailOpen) {
          event.preventDefault();
          const idx  = incidents.findIndex((i) => i.id === selectedIncident?.id);
          setSelectedIncident(incidents[idx <= 0 ? incidents.length - 1 : idx - 1] ?? null);
        }
        break;
      case "ArrowRight":
        if (incidents.length > 0 && !detailOpen) {
          event.preventDefault();
          const idx  = incidents.findIndex((i) => i.id === selectedIncident?.id);
          setSelectedIncident(incidents[idx >= incidents.length - 1 ? 0 : idx + 1] ?? null);
        }
        break;
    }
  };

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) { kbHandlerRef.current?.(e); }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // ─── JSX compartido ──────────────────────────────────────────────────────

  const pickModeLabel = pickingIndex === 0
    ? "el punto de salida"
    : pickingIndex === waypoints.length - 1
      ? "el destino"
      : pickingIndex !== null
        ? `la parada ${pickingIndex}`
        : externalPickLabel;

  const pickModeIndicator = activePickMode ? (
    <div className="pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center">
      <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border/60 bg-background/85 px-4 py-2 text-sm shadow-lg backdrop-blur">
        <Crosshair className="size-4 text-primary" />
        <span>
          Toca el mapa para marcar{" "}
          <span className="font-semibold">{pickModeLabel}</span>
        </span>
        <button
          type="button"
          onClick={cancelPickMode}
          className="ml-1 rounded-full p-0.5 text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Cancelar"
        >
          <X className="size-3.5" />
        </button>
      </div>
    </div>
  ) : null;

  const legendPill = (
    <div className="pointer-events-none absolute bottom-6 left-1/2 z-10 -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-full border border-border/50 bg-background/70 px-4 py-1.5 text-[11px] text-muted-foreground shadow backdrop-blur">
        <span className="flex items-center gap-1">
          <kbd className="rounded border border-border/60 bg-muted px-1 font-mono text-[10px]">scroll</kbd>
          zoom
        </span>
        <span className="text-border/80">·</span>
        <span>arrastrar para mover</span>
        <span className="text-border/80">·</span>
        <span>
          <kbd className="rounded border border-border/60 bg-muted px-1 font-mono text-[10px]">?</kbd>{" "}
          ayuda
        </span>
      </div>
    </div>
  );

  // ─── Tabs de modo (se renderizan fuera del formulario, bajo el header) ───────

  const addressTabs = (
    <div className="flex border-b border-border/50">
      {(["buscar", "url", "coordenadas"] as const).map((tab) => {
        const labels   = { url: "URL", buscar: "Buscar", coordenadas: "Coords" } as const;
        const tabIcons = {
          url:          <Link2      className="size-3" />,
          buscar:       <Search     className="size-3" />,
          coordenadas:  <Crosshair  className="size-3" />,
        } as const;
        return (
          <button
            key={tab}
            type="button"
            onClick={() => setAddressMode(tab)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[11px] font-medium transition-colors",
              addressMode === tab
                ? "-mb-px border-b-2 border-[var(--brand-navy)] text-foreground dark:border-[var(--brand-cyan)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tabIcons[tab]}
            {labels[tab]}
          </button>
        );
      })}
    </div>
  );

  // ─── Formulario de planificación ──────────────────────────────────────────

  function renderPlannerForm(compact = false) {

    const isUrlMode   = addressMode === "url";
    const canPasteUrl = !!(pasteOriginCoords && pasteDestCoords) && !loading;
    const btnDisabled = isUrlMode ? !canPasteUrl : !canSearch;
    const btnAction   = isUrlMode ? handleApplyPaste : handleSearch;

    return (
      <div className={cn("space-y-3", compact && "text-sm")}>

        {/* ── Tab URL ── */}
        {addressMode === "url" && (
          <div className="space-y-2.5">
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Pega el enlace de una ruta de Google Maps y se detectan automáticamente el origen y destino.
            </p>
            <input
              type="text"
              value={pasteRouteLinkRaw}
              onChange={(e) => void handlePasteRouteLink(e.target.value)}
              placeholder="https://maps.google.com/maps/dir/…"
              className="w-full rounded-lg border border-transparent bg-muted/40 px-2.5 py-2 text-sm outline-none transition-[border,box-shadow] placeholder:text-muted-foreground/50 focus:border-ring focus:ring-2 focus:ring-ring/20"
            />
            {pasteOriginCoords && pasteDestCoords ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-50/60 p-2.5 dark:bg-emerald-950/30">
                <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                  <CircleCheck className="size-3.5" />
                  Ruta reconocida{pasteViaCoords.length > 0 ? ` · ${pasteViaCoords.length} parada${pasteViaCoords.length > 1 ? "s" : ""}` : ""}
                </p>
                <p className="truncate text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground/70">Origen:</span>{" "}
                  {pasteOriginCoords.address}
                </p>
                {pasteViaCoords.map((via, i) => (
                  <p key={i} className="truncate text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground/70">Parada {i + 1}:</span>{" "}
                    {via.address}
                  </p>
                ))}
                <p className="truncate text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground/70">Destino:</span>{" "}
                  {pasteDestCoords.address}
                </p>
              </div>
            ) : pasteRouteLinkRaw.trim().length > 10 ? (
              <p className="text-[11px] text-muted-foreground/70">
                No se pudo reconocer la ruta. Verifica que sea un enlace de Google Maps.
              </p>
            ) : null}
          </div>
        )}

        {/* ── Tab Buscar ── */}
        {addressMode === "buscar" && (
          <>
            <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={wpIds} strategy={verticalListSortingStrategy}>
                <div className="space-y-1">
                  {waypoints.map((_, idx) => {
                    const isFirst = idx === 0;
                    const isLast  = idx === waypoints.length - 1;
                    const label   = isFirst
                      ? "Punto de salida"
                      : isLast
                        ? "Destino"
                        : `Parada ${idx}`;
                    return (
                      <SortableWaypointRow
                        key={wpIds[idx]}
                        id={wpIds[idx]!}
                        idx={idx}
                        isFirst={isFirst}
                        isLast={isLast}
                        label={label}
                        address={addresses[idx] ?? null}
                        geocoder={geocoder}
                        autocomplete={autocompleteService}
                        isPicking={pickingIndex === idx}
                        onSelect={(lngLat, addr) => setWaypointAt(idx, lngLat, addr)}
                        onPickOnMap={() => setPickingIndex((p) => p === idx ? null : idx)}
                        onRemove={() => removeWaypoint(idx)}
                        waypointCount={waypoints.length}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
            {waypoints.length < MAX_WAYPOINTS && (
              <button
                type="button"
                onClick={addWaypoint}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              >
                <Plus className="size-3.5" />
                Añadir parada intermedia
              </button>
            )}
          </>
        )}

        {/* ── Tab Coordenadas ── */}
        {addressMode === "coordenadas" && (
          <div className="space-y-3">
            {waypoints.map((wp, idx) => {
              const isFirst = idx === 0;
              const isLast  = idx === waypoints.length - 1;
              const label   = isFirst ? "Punto de salida" : isLast ? "Destino" : `Parada ${idx}`;
              return (
                <div key={idx}>
                  <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">{label}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <CoordinateInput
                      id={`wp-${idx}-lat`}
                      label="Latitud"
                      value={wp ? wp[1] : 0}
                      onChange={(v) => updateWaypointCoord(idx, "lat", v)}
                    />
                    <CoordinateInput
                      id={`wp-${idx}-lng`}
                      label="Longitud"
                      value={wp ? wp[0] : 0}
                      onChange={(v) => updateWaypointCoord(idx, "lng", v)}
                    />
                  </div>
                </div>
              );
            })}
            {waypoints.length < MAX_WAYPOINTS && (
              <button
                type="button"
                onClick={addWaypoint}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              >
                <Plus className="size-3.5" />
                Añadir parada intermedia
              </button>
            )}
          </div>
        )}

        <Separator />

        <Button
          className="w-full"
          onClick={() => void btnAction()}
          disabled={btnDisabled}
        >
          {loading ? (
            <LoaderCircle data-icon="inline-start" className="animate-spin" />
          ) : (
            <Navigation data-icon="inline-start" />
          )}
          {loading ? "Calculando ruta…" : "Ver ruta y alertas"}
        </Button>

        {routeInfo || (searched && !loading) ? (
          <>
            <Separator className="my-1" />

            {routes.length > 1 ? (
              <div className="flex gap-1">
                {routes.map((_, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectRoute(idx)}
                    className={cn(
                      "flex flex-1 items-center justify-center gap-1 rounded-lg border py-1.5 text-xs font-medium transition-colors",
                      idx === selectedRouteIdx
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border/60 text-muted-foreground hover:bg-muted/60",
                    )}
                  >
                    <RouteIcon className="size-3" />
                    Ruta {idx + 1}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="flex items-center gap-4 text-sm">
              {routeInfo ? (
                <>
                  <span className="flex items-center gap-1.5 font-semibold">
                    <Timer className="size-4 text-primary" />
                    {formatDuration(routeInfo.durationSeconds)}
                  </span>
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <RouteIcon className="size-4" />
                    {formatDistance(routeInfo.distanceMeters)}
                  </span>
                </>
              ) : (
                <span className="text-xs text-muted-foreground">Trayecto referencial</span>
              )}
              <span className="ml-auto flex items-center gap-1.5 tabular-nums text-muted-foreground">
                <Bell className="size-4" />
                {incidents.length}
                {criticalCount > 0 ? (
                  <span
                    className="size-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]"
                    aria-label={`${criticalCount} alertas críticas`}
                  />
                ) : null}
              </span>
            </div>
          </>
        ) : null}

        {/* ── Conflictos con vías ECU911 ── */}
        {viaConflictsVisible.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-orange-500/40 bg-orange-50/60 dark:bg-orange-950/30">
            <button
              type="button"
              onClick={() => setConflictsOpen((o) => !o)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left"
            >
              <AlertTriangle className="size-4 shrink-0 text-orange-500" />
              <span className="flex-1 text-xs font-semibold text-orange-700 dark:text-orange-400">
                {viaConflictsVisible.length} vía{viaConflictsVisible.length !== 1 ? "s" : ""} con restricción
                {focusedKmRange ? ' en el tramo enfocado' : ' en la ruta'}
                {focusedKmRange && viaConflictsVisible.length !== viaConflicts.length
                  ? ` (${viaConflicts.length} en toda la ruta)` : ''}
              </span>
              {conflictsOpen ? (
                <ChevronUp className="size-3.5 text-orange-500" />
              ) : (
                <ChevronDown className="size-3.5 text-orange-500" />
              )}
            </button>
            {conflictsOpen ? (
              <ul className="max-h-48 divide-y divide-orange-500/10 overflow-y-auto border-t border-orange-500/20">
                {viaConflictsVisible.map((m) => {
                  const dotColor =
                    m.via.estado_actual_id === 595
                      ? "#dc2626"
                      : m.via.estado_actual_id === 592
                        ? "#f97316"
                        : "#f59e0b";
                  return (
                    <li
                      key={m.via.id}
                      className="flex cursor-pointer items-start gap-2 px-3 py-2 hover:bg-orange-50 dark:hover:bg-orange-950/50"
                      onClick={() => { setSelectedVia(m); setSelectedMit(null); }}
                    >
                      <span
                        className="mt-1.5 size-2 shrink-0 rotate-45"
                        style={{ backgroundColor: dotColor }}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-medium text-foreground">
                          {m.via.descripcion}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {m.via.EstadoActual.nombre} · {m.via.Provincia.descripcion}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        ) : null}

        {/* ── Eventos del histórico MIT/MTOP sobre la ruta ── */}
        {mitConflictsVisible.length > 0 ? (
          <div className="overflow-hidden rounded-lg border border-indigo-500/40 bg-indigo-50/60 dark:bg-indigo-950/30">
            <button
              type="button"
              onClick={() => setMitConflictsOpen((o) => !o)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left"
            >
              <AlertTriangle className="size-4 shrink-0 text-indigo-500" />
              <span className="flex-1 text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                {mitConflictsVisible.length} evento{mitConflictsVisible.length !== 1 ? "s" : ""} del histórico MIT
                {focusedKmRange ? ' en el tramo enfocado' : ' en la ruta'}
                {focusedKmRange && mitConflictsVisible.length !== mitConflicts.length
                  ? ` (${mitConflicts.length} en toda la ruta)` : ''}
              </span>
              {mitConflictsOpen ? (
                <ChevronUp className="size-3.5 text-indigo-500" />
              ) : (
                <ChevronDown className="size-3.5 text-indigo-500" />
              )}
            </button>
            {mitConflictsOpen ? (
              <ul className="max-h-48 divide-y divide-indigo-500/10 overflow-y-auto border-t border-indigo-500/20">
                {mitConflictsVisible.map((e) => (
                  <li
                    key={e.id}
                    className="flex cursor-pointer items-start gap-2 px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
                    onClick={() => { setSelectedMit(e); setSelectedVia(null); }}
                  >
                    <span
                      className="mt-1.5 size-2 shrink-0 rotate-45"
                      style={{ backgroundColor: MIT_TIPO_HEX[e.tipo_evento] ?? MIT_TIPO_HEX_DEFAULT }}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-medium text-foreground">{e.tramo}</p>
                      <p className="text-[10px] text-muted-foreground">{e.tipo_evento} · {e.provincia}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  // ─── Diálogos compartidos ─────────────────────────────────────────────────

  const sharedDialogs = (
    <>
      <IncidentDetailDialog
        incident={selectedIncident}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onStatusChanged={(updated) => {
          setIncidents((prev) => prev.map((i) => i.id === updated.id ? updated : i));
          setSelectedIncident((prev) => prev?.id === updated.id ? updated : prev);
        }}
      />
      <MapHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  );

  // ─── Modo panel ───────────────────────────────────────────────────────────

  if (layoutMode === "panel") {
    return (
      <div className="flex h-full w-full overflow-hidden">
        {plannerCollapsed ? (
          <button
            type="button"
            onClick={() => setPlannerCollapsed(false)}
            aria-label="Mostrar planificador"
            className="flex h-full w-10 shrink-0 flex-col items-center gap-2 border-r border-border/60 bg-background py-3 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronRight className="size-4" />
            <span className="[writing-mode:vertical-rl] text-[11px] font-medium tracking-wide">Planificador</span>
          </button>
        ) : (
          <aside className="flex w-1/3 min-w-[300px] max-w-[480px] shrink-0 flex-col border-r bg-background">
            <div className="flex items-center justify-between px-4 py-3">
              <p className="text-sm font-semibold text-foreground">Planificador</p>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" aria-label="Abrir guía" onClick={() => setHelpOpen(true)}>
                  <HelpCircle className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Modo pantalla completa" onClick={() => setLayoutMode("full")}>
                  <Maximize2 className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" aria-label="Ocultar planificador" onClick={() => setPlannerCollapsed(true)}>
                  <ChevronLeft className="size-4" />
                </Button>
              </div>
            </div>

            {addressTabs}

            <div className="overflow-y-auto p-4">
              {renderPlannerForm(true)}
            </div>
          </aside>
        )}

        <div className={cn("relative flex-1 overflow-hidden", !rightSlot && activePickMode && "cursor-crosshair")}>
          {rightSlot ?? (
            <>
              <RouteMap
                waypoints={waypoints}
                routes={routes}
                selectedRouteIdx={selectedRouteIdx}
                incidents={incidents}
                selectedIncidentId={selectedIncident?.id ?? null}
                onSelectIncident={handleSelectFromMap}
                onSelectRoute={handleSelectRoute}
                onMapClick={(lngLat) => { void handleMapClick(lngLat); }}
                viaMarkers={searched && routes.length > 0 ? viaConflicts : viaMarkers}
                onSelectVia={(m) => { setSelectedVia(m); setSelectedMit(null); }}
                selectedViaId={selectedVia?.via.id ?? null}
                mitSegments={mitSegmentsVisible}
                onSelectMitEvent={(e) => { setSelectedMit(e); setSelectedVia(null); }}
                selectedMitEventId={selectedMit?.id ?? null}
                onViewportBoundsChanged={handleViewportBoundsChanged}
                focusBounds={focusBoundsForMap}
              />
              {pickModeIndicator}
              {legendPill}
              {/* Popup de vía ECU911 seleccionada */}
              {selectedVia ? (
                <div className="absolute bottom-16 left-1/2 z-20 w-72 -translate-x-1/2 rounded-xl border border-border/60 bg-background/90 shadow-xl backdrop-blur">
                  <div className="flex items-start justify-between p-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold leading-snug text-foreground">
                        {selectedVia.via.descripcion}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {selectedVia.via.Provincia.descripcion} · {selectedVia.via.Canton.descripcion}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedVia(null)}
                      className="ml-2 shrink-0 rounded-md p-0.5 text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                  <div className="border-t border-border/40 px-3 py-2.5">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        selectedVia.via.estado_actual_id === 595
                          ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                          : selectedVia.via.estado_actual_id === 592
                            ? "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
                      )}
                    >
                      {selectedVia.via.EstadoActual.nombre}
                    </span>
                    {selectedVia.via.observaciones ? (
                      <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                        {selectedVia.via.observaciones}
                      </p>
                    ) : null}
                    {selectedVia.via.DetalleViaAlterna.length > 0 ? (
                      <div className="mt-2">
                        <p className="mb-1 text-[10px] font-semibold text-muted-foreground">
                          Vías alternas:
                        </p>
                        {selectedVia.via.DetalleViaAlterna.map((alt) => (
                          <p key={alt.id} className="text-[11px] text-foreground">
                            {alt.Via.descripcion}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {/* Popup de evento MIT/MTOP seleccionado */}
              {selectedMit ? (
                <MitConflictPopup event={selectedMit} onClose={() => setSelectedMit(null)} />
              ) : null}
            </>
          )}
          {mapOverlay}
        </div>

        <RouteTimeline
          routeData={timelineRouteData}
          onSelectIncident={handleSelectFromMap}
          selectedIncidentId={selectedIncident?.id ?? null}
          conflictProvinces={conflictProvinces}
          mitConflictProvinces={mitConflictProvinces}
          focusedKmRange={focusedKmRange}
          onFocusedKmRangeChange={handleChartRangeChanged}
          focusedGeoBounds={focusedGeoBounds}
          hiddenMitTipos={hiddenMitTipos}
          onToggleMitTipo={toggleMitTipo}
        />

        {sharedDialogs}
      </div>
    );
  }

  // ─── Modo pantalla completa ───────────────────────────────────────────────

  return (
    <div className="relative h-full w-full overflow-hidden bg-muted/30">
      <div className={cn("absolute inset-0", activePickMode && "cursor-crosshair")}>
        <RouteMap
          waypoints={waypoints}
          routes={routes}
          selectedRouteIdx={selectedRouteIdx}
          incidents={incidents}
          selectedIncidentId={selectedIncident?.id ?? null}
          onSelectIncident={handleSelectFromMap}
          onSelectRoute={handleSelectRoute}
          onMapClick={(lngLat) => { void handleMapClick(lngLat); }}
          viaMarkers={searched && routes.length > 0 ? viaConflicts : viaMarkers}
          onSelectVia={(m) => { setSelectedVia(m); setSelectedMit(null); }}
          selectedViaId={selectedVia?.via.id ?? null}
          mitSegments={mitSegmentsVisible}
          onSelectMitEvent={(e) => { setSelectedMit(e); setSelectedVia(null); }}
          selectedMitEventId={selectedMit?.id ?? null}
          onViewportBoundsChanged={handleViewportBoundsChanged}
          focusBounds={focusBoundsForMap}
        />
      </div>

      {pickModeIndicator}

      {/* RouteTimeline (con el pill "Ver toda la ruta") no se monta en modo
          pantalla completa — sin este control, un zoom-detalle activado aquí
          quedaría sin forma de limpiarse desde la UI. */}
      {focusedKmRange ? (
        <div className="pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center">
          <button
            type="button"
            onClick={() => handleChartRangeChanged(null)}
            className="pointer-events-auto flex items-center gap-1.5 rounded-full border border-primary/40 bg-background/90 px-3 py-1.5 text-xs font-medium text-primary shadow-lg backdrop-blur transition-colors hover:bg-primary/10"
          >
            <RouteIcon className="size-3.5" />
            km {focusedKmRange[0].toFixed(0)}–{focusedKmRange[1].toFixed(0)} enfocado · Ver toda la ruta
          </button>
        </div>
      ) : null}

      <aside className="absolute left-4 top-4 z-10 w-[min(calc(20rem-5px),calc(100vw-2rem))] rounded-2xl border border-border/60 bg-background/80 shadow-lg backdrop-blur">
        <div className="flex items-center justify-between px-4 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Planificador</p>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Cambiar a modo panel"
            onClick={() => setLayoutMode("panel")}
            className="size-7 rounded-lg text-muted-foreground hover:text-foreground"
          >
            <PanelLeft className="size-4" />
          </Button>
        </div>
        {addressTabs}
        <div className="p-4">{renderPlannerForm()}</div>
      </aside>

      <div className="absolute right-4 top-4 z-10 flex flex-col gap-2">
        <Button
          variant="outline"
          size="icon-lg"
          aria-label={panelOpen ? "Ocultar alertas" : "Mostrar alertas"}
          aria-expanded={panelOpen}
          onClick={() => setPanelOpen((o) => !o)}
          className="relative rounded-full border-border/60 bg-background/80 shadow-lg backdrop-blur"
        >
          {panelOpen ? <X /> : <Bell />}
          {!panelOpen && incidents.length > 0 ? (
            <span
              className={cn(
                "absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full text-[10px] font-semibold text-white",
                criticalCount > 0 ? "bg-red-500" : "bg-primary",
              )}
            >
              {incidents.length}
            </span>
          ) : null}
        </Button>

        <Button
          variant="outline"
          size="icon-lg"
          aria-label="Abrir guía de uso"
          onClick={() => setHelpOpen(true)}
          className="rounded-full border-border/60 bg-background/80 shadow-lg backdrop-blur"
        >
          <HelpCircle className="size-4" />
        </Button>
      </div>

      <div
        className={cn(
          "absolute bottom-4 right-4 top-[8.5rem] z-10 w-[min(20rem,calc(100vw-2rem))] transition-all duration-300 ease-out",
          panelOpen
            ? "translate-x-0 opacity-100"
            : "pointer-events-none translate-x-6 opacity-0",
        )}
      >
        <IncidentSidebar
          incidents={incidents}
          loading={loading}
          error={error}
          hasSearched={searched}
          selectedIncidentId={selectedIncident?.id ?? null}
          onSelectIncident={handleSelectFromList}
        />
      </div>

      {legendPill}

      {/* Popup de vía ECU911 seleccionada (modo pantalla completa) */}
      {selectedVia ? (
        <div className="absolute bottom-16 left-1/2 z-20 w-80 -translate-x-1/2 rounded-xl border border-border/60 bg-background/90 shadow-xl backdrop-blur">
          <div className="flex items-start justify-between p-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold leading-snug text-foreground">
                {selectedVia.via.descripcion}
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {selectedVia.via.Provincia.descripcion} · {selectedVia.via.Canton.descripcion}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedVia(null)}
              className="ml-2 shrink-0 rounded-md p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <div className="border-t border-border/40 px-3 py-2.5">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold",
                selectedVia.via.estado_actual_id === 595
                  ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"
                  : selectedVia.via.estado_actual_id === 592
                    ? "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400"
                    : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400",
              )}
            >
              {selectedVia.via.EstadoActual.nombre}
            </span>
            {selectedVia.via.observaciones ? (
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                {selectedVia.via.observaciones}
              </p>
            ) : null}
            {selectedVia.via.DetalleViaAlterna.length > 0 ? (
              <div className="mt-2">
                <p className="mb-1 text-[10px] font-semibold text-muted-foreground">Vías alternas:</p>
                {selectedVia.via.DetalleViaAlterna.map((alt) => (
                  <p key={alt.id} className="text-[11px] text-foreground">
                    {alt.Via.descripcion}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {/* Popup de evento MIT/MTOP seleccionado (modo pantalla completa) */}
      {selectedMit ? (
        <MitConflictPopup event={selectedMit} onClose={() => setSelectedMit(null)} />
      ) : null}

      {mapOverlay}
      {sharedDialogs}
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

/** Popup con el detalle completo de un evento del histórico MIT/MTOP
 * seleccionado en el mapa — mismos datos que la tabla fuente del boletín. */
function MitConflictPopup({ event, onClose }: { event: MitAdverseEvent; onClose: () => void }) {
  const color = MIT_TIPO_HEX[event.tipo_evento] ?? MIT_TIPO_HEX_DEFAULT;
  return (
    <div className="absolute bottom-16 left-1/2 z-20 w-80 -translate-x-1/2 rounded-xl border border-border/60 bg-background/90 shadow-xl backdrop-blur">
      <div className="flex items-start justify-between p-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold leading-snug text-foreground">{event.tramo}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{event.provincia}{event.ruta_codigo ? ` · ${event.ruta_codigo}` : ''}</p>
        </div>
        <button type="button" onClick={onClose} className="ml-2 shrink-0 rounded-md p-0.5 text-muted-foreground hover:text-foreground">
          <X className="size-3.5" />
        </button>
      </div>
      <div className="max-h-64 overflow-y-auto border-t border-border/40 px-3 py-2.5">
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
          style={{ backgroundColor: color }}
        >
          {event.tipo_evento}
        </span>
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{event.evento}</p>
        {event.acciones_realizadas ? (
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Acciones: </span>{event.acciones_realizadas}
          </p>
        ) : null}
        {event.observaciones ? (
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">
            <span className="font-medium text-foreground">Observaciones: </span>{event.observaciones}
          </p>
        ) : null}
        <div className="mt-2 rounded-lg border border-border/40 bg-background/60 p-2 text-[10px] text-muted-foreground">
          <span className="font-semibold text-foreground">{event.fuente_nombre}</span>
          <br />
          {event.fuente_boletin}
        </div>
      </div>
    </div>
  );
}

interface SortableWaypointRowProps {
  id: string;
  idx: number;
  isFirst: boolean;
  isLast: boolean;
  label: string;
  address: string | null;
  geocoder: google.maps.Geocoder | null;
  autocomplete: google.maps.places.AutocompleteService | null;
  isPicking: boolean;
  waypointCount: number;
  onSelect: (lngLat: LngLat, address: string) => void;
  onPickOnMap: () => void;
  onRemove: () => void;
}

function SortableWaypointRow({
  id, idx, isFirst, isLast, label, address, geocoder, autocomplete,
  isPicking, waypointCount, onSelect, onPickOnMap, onRemove,
}: SortableWaypointRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex:  isDragging ? 10 : undefined,
  };

  const canDrag = waypointCount > 2;

  return (
    <div ref={setNodeRef} style={style} className="flex items-stretch gap-2">
      {/* Grip + conector visual */}
      <div className="flex w-6 shrink-0 flex-col items-center">
        {canDrag ? (
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="flex size-6 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground/40 transition-colors hover:text-muted-foreground active:cursor-grabbing"
            aria-label="Arrastrar para reordenar"
          >
            <GripVertical className="size-3.5" />
          </button>
        ) : (
          <div className={cn("flex size-6 shrink-0 items-center justify-center", isLast && "mt-0.5")}>
            {isFirst ? (
              <span className="flex size-4 items-center justify-center rounded-full border-2 border-emerald-500">
                <span className="size-1.5 rounded-full bg-emerald-500" />
              </span>
            ) : isLast ? (
              <span className="flex size-6 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
                <Flag className="size-3" />
              </span>
            ) : null}
          </div>
        )}
        {!isLast && <div className="w-px flex-1 bg-border/50 my-0.5" />}
      </div>

      {/* Input */}
      <div className="flex min-w-0 flex-1 flex-col pb-1">
        <div className="flex items-center gap-1 py-0.5">
          <WaypointInput
            idx={idx}
            placeholder={label}
            address={address}
            geocoder={geocoder}
            autocomplete={autocomplete}
            isPicking={isPicking}
            onSelect={onSelect}
            onPickOnMap={onPickOnMap}
          />
          {!isFirst && !isLast && (
            <Button
              variant="ghost"
              size="xs"
              onClick={onRemove}
              className="shrink-0 text-muted-foreground hover:text-destructive"
              aria-label="Eliminar parada"
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

interface GeoSuggestion {
  address: string;
  placeId: string;
}

interface WaypointInputProps {
  idx: number;
  placeholder: string;
  address: string | null;
  geocoder: google.maps.Geocoder | null;
  autocomplete: google.maps.places.AutocompleteService | null;
  isPicking: boolean;
  onSelect: (lngLat: LngLat, address: string) => void;
  onPickOnMap: () => void;
}

let _cachedUserLocation: { lat: number; lng: number } | null = null;

function WaypointInput({
  placeholder,
  address,
  geocoder,
  autocomplete,
  isPicking,
  onSelect,
  onPickOnMap,
}: WaypointInputProps) {
  const [value,        setValue]        = useState(address ?? "");
  const [suggestions,  setSuggestions]  = useState<GeoSuggestion[]>([]);
  const [searching,    setSearching]    = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(_cachedUserLocation);
  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (_cachedUserLocation) { setUserLocation(_cachedUserLocation); return; }
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        _cachedUserLocation = loc;
        setUserLocation(loc);
      },
      () => { /* permiso denegado o no disponible */ },
      { maximumAge: 300_000, timeout: 5_000 },
    );
  }, []);

  // Sincronizar cuando la dirección cambia externamente (pick en mapa, URL, etc.)
  useEffect(() => {
    setValue(address ?? "");
    setSuggestions([]);
  }, [address]);

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSuggestions([]);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function handleChange(text: string) {
    setValue(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (!text.trim() || !autocomplete) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(() => {
      setSearching(true);
      void autocomplete
        .getPlacePredictions({
          input: text,
          componentRestrictions: { country: 'ec' },
          types: ['geocode', 'establishment'],
          ...(userLocation ? { location: new google.maps.LatLng(userLocation.lat, userLocation.lng), radius: 40_000 } : {}),
        })
        .then((res) => {
          setSuggestions(
            res.predictions.slice(0, 6).map((p) => ({
              address: p.description,
              placeId: p.place_id,
            })),
          );
        })
        .catch(() => setSuggestions([]))
        .finally(() => setSearching(false));
    }, 300);
  }

  function handleSuggestionClick(s: GeoSuggestion) {
    setValue(s.address);
    setSuggestions([]);
    if (!geocoder) return;
    void geocoder
      .geocode({ placeId: s.placeId })
      .then((res) => {
        const r = res.results[0];
        if (!r) return;
        const lngLat: LngLat = [r.geometry.location.lng(), r.geometry.location.lat()];
        onSelect(lngLat, s.address);
      })
      .catch(() => { /* falla silenciosamente */ });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") { setSuggestions([]); return; }
    if (e.key === "Enter" && suggestions.length > 0) {
      e.preventDefault();
      handleSuggestionClick(suggestions[0]!);
    }
  }

  return (
    <div ref={containerRef} className="relative flex min-w-0 flex-1 items-center gap-1">
      <div className="relative min-w-0 flex-1">
        <input
          type="text"
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full rounded-lg border border-transparent bg-muted/40 px-2.5 py-1.5 pr-7 text-sm outline-none transition-[border,box-shadow] placeholder:text-muted-foreground/60 focus:border-ring focus:ring-2 focus:ring-ring/20"
        />
        {searching && (
          <LoaderCircle className="pointer-events-none absolute right-2 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}

        {suggestions.length > 0 && (
          <ul className="absolute left-0 top-full z-50 mt-1 w-full overflow-hidden rounded-lg border border-border/60 bg-popover shadow-lg">
            {suggestions.map((s, i) => (
              <li key={i}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left text-xs text-foreground hover:bg-muted/60 focus:bg-muted/60 focus:outline-none"
                  onPointerDown={(e) => { e.preventDefault(); handleSuggestionClick(s); }}
                >
                  {s.address}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Button
        variant={isPicking ? "secondary" : "ghost"}
        size="xs"
        type="button"
        onClick={onPickOnMap}
        className={cn("shrink-0", isPicking && "text-primary")}
      >
        <Crosshair data-icon="inline-start" className="size-3.5" />
        {isPicking ? "Eligiendo…" : "Mapa"}
      </Button>
    </div>
  );
}

interface CoordinateInputProps {
  id: string;
  label: string;
  value: number;
  onChange: (value: string) => void;
}

function CoordinateInput({ id, label, value, onChange }: CoordinateInputProps) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-[11px] text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        step="0.0001"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 text-xs"
      />
    </div>
  );
}

// ─── Funciones auxiliares para resolución de ubicaciones ─────────────────────

async function resolveLocationText(
  text: string,
  geocoder: google.maps.Geocoder | null,
  /** Sesgo geográfico opcional (ej. bounds de los otros waypoints conocidos de la
   * misma ruta), para que direcciones de texto ambiguas (mismo nombre de calle o
   * iglesia en varias ciudades) resuelvan cerca del resto de la ruta y no en una
   * ciudad completamente distinta. */
  bias?: google.maps.LatLngBounds,
): Promise<{ lngLat: LngLat; address: string } | null> {
  const t = text.trim();
  if (!t) return null;

  // Coordenadas: lat, lng (con o sin espacio)
  const coordMatch = t.match(/^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]!);
    const lng = parseFloat(coordMatch[2]!);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lngLat: [lng, lat], address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
    }
  }

  // URL de Google Maps con @lat,lng en el path (enlace de lugar)
  try {
    const url = new URL(t);
    if (url.hostname.includes("google") || url.hostname.includes("goo.gl")) {
      const m = url.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
      if (m) {
        const lat = parseFloat(m[1]!);
        const lng = parseFloat(m[2]!);
        return { lngLat: [lng, lat], address: `${lat.toFixed(5)}, ${lng.toFixed(5)}` };
      }
    }
  } catch { /* no es una URL válida */ }

  // Geocodificar como dirección de texto
  if (geocoder) {
    try {
      const res = await geocoder.geocode({ address: t, region: "ec", bounds: bias });
      const loc  = res.results[0]?.geometry?.location;
      const addr = res.results[0]?.formatted_address ?? t;
      if (loc) return { lngLat: [loc.lng(), loc.lat()], address: addr };
    } catch { /* geocoding falló */ }
  }

  return null;
}

function extractRouteFromGoogleMapsUrl(text: string): { waypoints: string[] } | null {
  try {
    const url = new URL(text.trim());
    if (!url.hostname.includes("google")) return null;
    const m = url.pathname.match(/\/maps\/dir\/([^?#]+)/);
    if (!m) return null;
    const segments = m[1]!
      .split("/")
      .map((s) => decodeURIComponent(s.replace(/\+/g, " ")).trim())
      // Google a veces envuelve un waypoint ambiguo entre comillas simples/dobles
      // (ej. "'-2.88969,-78.98785'") — sin esto, el regex de coordenadas no matchea
      // por los caracteres extra y el waypoint se pierde silenciosamente.
      .map((s) => s.replace(/^['"]+|['"]+$/g, "").trim())
      .filter((s) => s && !s.startsWith("@") && !s.startsWith("data="));
    if (segments.length < 2) return null;
    return { waypoints: segments };
  } catch {
    return null;
  }
}
