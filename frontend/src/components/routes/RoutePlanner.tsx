"use client";

import dynamic from "next/dynamic";
import { APIProvider, useMapsLibrary } from "@vis.gl/react-google-maps";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  ChevronRight,
  Crosshair,
  Flag,
  HelpCircle,
  LoaderCircle,
  Maximize2,
  Navigation,
  PanelLeft,
  Plus,
  Route as RouteIcon,
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
import { cn } from "@/lib/utils";
import { GOOGLE_MAPS_API_KEY } from "@/lib/config";
import { formatDistance, formatDuration } from "@/lib/incidents/format";
import {
  type LngLat,
  type RouteLineString,
} from "@/lib/mapbox/directions";
import { filterIncidentsByRoute } from "@/lib/mapbox/route-filter";
import { getRouteIncidents } from "@/services/routes.service";
import type { Incident } from "@/types/incident";

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

interface RoutePlannerProps {
  /** Si se provee, reemplaza el mapa en el slot derecho (para paneles de análisis). */
  rightSlot?: React.ReactNode;
  /** Elemento que se superpone en la esquina del mapa (ej. FAB de reporte). */
  mapOverlay?: React.ReactNode;
}

export function RoutePlanner({ rightSlot, mapOverlay }: RoutePlannerProps = {}) {
  return (
    <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={["places", "routes", "geocoding"]}>
      <RoutePlannerContent rightSlot={rightSlot} mapOverlay={mapOverlay} />
    </APIProvider>
  );
}

// ─── Contenido real (dentro del contexto de Google Maps) ─────────────────────

function RoutePlannerContent({ rightSlot, mapOverlay }: { rightSlot?: React.ReactNode; mapOverlay?: React.ReactNode }) {
  const routesLib    = useMapsLibrary("routes");
  const placesLib    = useMapsLibrary("places");
  const geocodingLib = useMapsLibrary("geocoding");

  const [directionsService, setDirectionsService] =
    useState<google.maps.DirectionsService | null>(null);
  const [geocoder, setGeocoder] =
    useState<google.maps.Geocoder | null>(null);

  useEffect(() => {
    if (routesLib)    setDirectionsService(new routesLib.DirectionsService());
  }, [routesLib]);
  useEffect(() => {
    if (geocodingLib) setGeocoder(new geocodingLib.Geocoder());
  }, [geocodingLib]);

  const [waypoints, setWaypoints] = useState<(LngLat | null)[]>([null, null]);
  const [addresses, setAddresses] = useState<(string | null)[]>([null, null]);

  /** Todas las rutas calculadas (índice 0 = primera / seleccionada). */
  const [routes,           setRoutes]           = useState<LngLat[][]>([]);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0);
  const [routeInfo,        setRouteInfo]        = useState<RouteInfo | null>(null);

  // La ruta activa como RouteLineString (para filterIncidentsByRoute)
  const routeGeometry: RouteLineString | null = routes[selectedRouteIdx]
    ? { type: "LineString", coordinates: routes[selectedRouteIdx]! }
    : null;
  const [incidents,     setIncidents]     = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [detailOpen,    setDetailOpen]    = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [pickingIndex,  setPickingIndex]  = useState<PickingIndex>(null);
  const [panelOpen,     setPanelOpen]     = useState(true);
  const [searched,      setSearched]      = useState(false);
  const [helpOpen,      setHelpOpen]      = useState(false);
  const [layoutMode,    setLayoutMode]    = useState<LayoutMode>("panel");

  const origin      = waypoints[0];
  const destination = waypoints[waypoints.length - 1];

  const canSearch =
    waypoints.every((w) => w !== null) && waypoints.length >= 2 && !loading;

  const criticalCount = useMemo(
    () => incidents.filter((i) => i.severity === "critical").length,
    [incidents],
  );

  const activePickMode = pickingIndex !== null;

  // ─── Mutaciones de waypoints ──────────────────────────────────────────────

  function setWaypointAt(idx: number, lngLat: LngLat, address: string | null = null) {
    setWaypoints((prev) => { const n = [...prev]; n[idx] = lngLat; return n; });
    setAddresses((prev) => { const n = [...prev]; n[idx] = address; return n; });
  }

  function addWaypoint() {
    setWaypoints((prev) => {
      if (prev.length >= MAX_WAYPOINTS) return prev;
      const n = [...prev];
      n.splice(prev.length - 1, 0, null);
      return n;
    });
    setAddresses((prev) => {
      const n = [...prev];
      n.splice(prev.length - 1, 0, null);
      return n;
    });
  }

  function removeWaypoint(idx: number) {
    setWaypoints((prev) => {
      if (prev.length <= 2) return prev;
      return prev.filter((_, i) => i !== idx);
    });
    setAddresses((prev) => prev.filter((_, i) => i !== idx));
    if (pickingIndex === idx) setPickingIndex(null);
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
      }
    },
    [pickingIndex, geocoder],
  );

  const cancelPickMode = useCallback(() => {
    setPickingIndex(null);
  }, []);

  // ─── Calcular ruta con Google Directions ─────────────────────────────────

  async function handleSearch(): Promise<void> {
    const defined = waypoints.filter((w): w is LngLat => w !== null);
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

    if (directionsResult.status === "fulfilled") {
      const allRoutes = directionsResult.value.routes;
      // Convertir todas las rutas alternativas a LngLat[][]
      const converted: LngLat[][] = allRoutes.map((r) =>
        r.overview_path.map((p): LngLat => [p.lng(), p.lat()]),
      );
      setRoutes(converted);
      setSelectedRouteIdx(0);

      const primary = allRoutes[0];
      if (primary) {
        resolvedCoords = converted[0] ?? null;
        const dist = primary.legs.reduce((s, l) => s + (l.distance?.value ?? 0), 0);
        const dur  = primary.legs.reduce((s, l) => s + (l.duration?.value ?? 0), 0);
        setRouteInfo({ distanceMeters: dist, durationSeconds: dur });
      }
    } else {
      setRoutes([defined]);
      setSelectedRouteIdx(0);
      setRouteInfo(null);
    }

    if (incidentsResult.status === "fulfilled") {
      const raw      = incidentsResult.value.data;
      const filtered = resolvedCoords ? filterIncidentsByRoute(raw, resolvedCoords) : raw;
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

    setLoading(false);
  }

  function handleSelectRoute(idx: number) {
    setSelectedRouteIdx(idx);
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
      : `la parada ${pickingIndex ?? ""}`;

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

  // ─── Formulario de planificación ──────────────────────────────────────────

  function renderPlannerForm(compact = false) {
    return (
      <div className={cn("space-y-3", compact && "text-sm")}>

        {/* Lista de waypoints */}
        <div className="space-y-1">
          {waypoints.map((wp, idx) => {
            const isFirst = idx === 0;
            const isLast  = idx === waypoints.length - 1;
            const label   = isFirst
              ? "Punto de salida"
              : isLast
                ? "Destino"
                : `Parada ${idx}`;

            return (
              <div key={idx} className="flex items-stretch gap-2">
                {/* Conector vertical */}
                <div className="flex w-6 shrink-0 flex-col items-center">
                  <div className={cn("flex size-6 shrink-0 items-center justify-center", isLast && "mt-0.5")}>
                    {isFirst ? (
                      <span className="flex size-4 items-center justify-center rounded-full border-2 border-emerald-500">
                        <span className="size-1.5 rounded-full bg-emerald-500" />
                      </span>
                    ) : isLast ? (
                      <span className="flex size-6 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
                        <Flag className="size-3" />
                      </span>
                    ) : (
                      <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-white">
                        {idx}
                      </span>
                    )}
                  </div>
                  {!isLast && <div className="w-px flex-1 bg-border/50 my-0.5" />}
                </div>

                {/* Input con Places Autocomplete */}
                <div className="flex min-w-0 flex-1 flex-col pb-1">
                  <div className="flex items-center gap-1 py-0.5">
                    <WaypointInput
                      idx={idx}
                      placeholder={label}
                      address={addresses[idx] ?? null}
                      placesLib={placesLib}
                      isPicking={pickingIndex === idx}
                      onSelect={(lngLat, addr) => setWaypointAt(idx, lngLat, addr)}
                      onPickOnMap={() => setPickingIndex((p) => p === idx ? null : idx)}
                    />
                    {!isFirst && !isLast && (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => removeWaypoint(idx)}
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
          })}
        </div>

        {/* Añadir parada */}
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

        <Separator />

        {/* Coordenadas exactas */}
        <details className="group rounded-xl border border-border/50 bg-muted/30">
          <summary className="flex cursor-pointer select-none items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
            <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
            Coordenadas exactas
          </summary>
          <div className="space-y-2 px-3 pb-3">
            {waypoints.map((wp, idx) => {
              const isFirst = idx === 0;
              const isLast  = idx === waypoints.length - 1;
              const label   = isFirst ? "Origen" : isLast ? "Destino" : `Parada ${idx}`;
              return (
                <div key={idx}>
                  <p className="mb-1 text-[11px] font-medium text-muted-foreground">{label}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <CoordinateInput
                      id={`wp-${idx}-lat`}
                      label="Lat"
                      value={wp ? wp[1] : 0}
                      onChange={(v) => updateWaypointCoord(idx, "lat", v)}
                    />
                    <CoordinateInput
                      id={`wp-${idx}-lng`}
                      label="Lng"
                      value={wp ? wp[0] : 0}
                      onChange={(v) => updateWaypointCoord(idx, "lng", v)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </details>

        <Button className="w-full" onClick={() => void handleSearch()} disabled={!canSearch}>
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

            {/* Selector de rutas alternativas */}
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
        <aside className="flex w-1/2 min-w-[320px] max-w-[560px] shrink-0 flex-col border-r bg-background">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Planificador</p>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" aria-label="Abrir guía" onClick={() => setHelpOpen(true)}>
                <HelpCircle className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Modo pantalla completa" onClick={() => setLayoutMode("full")}>
                <Maximize2 className="size-4" />
              </Button>
            </div>
          </div>

          <div className="overflow-y-auto border-b p-4">
            {renderPlannerForm(true)}
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            <IncidentSidebar
              incidents={incidents}
              loading={loading}
              error={error}
              hasSearched={searched}
              selectedIncidentId={selectedIncident?.id ?? null}
              onSelectIncident={handleSelectFromList}
            />
          </div>
        </aside>

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
              />
              {pickModeIndicator}
              {legendPill}
            </>
          )}
          {mapOverlay}
        </div>

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
        />
      </div>

      {pickModeIndicator}

      <aside className="absolute left-4 top-4 z-10 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-border/60 bg-background/80 shadow-lg backdrop-blur">
        <div className="flex items-center justify-between border-b border-border/50 px-4 py-2.5">
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
      {mapOverlay}
      {sharedDialogs}
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

interface WaypointInputProps {
  idx: number;
  placeholder: string;
  address: string | null;
  placesLib: google.maps.PlacesLibrary | null;
  isPicking: boolean;
  onSelect: (lngLat: LngLat, address: string) => void;
  onPickOnMap: () => void;
}

function WaypointInput({
  placeholder,
  address,
  placesLib,
  isPicking,
  onSelect,
  onPickOnMap,
}: WaypointInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const acRef    = useRef<google.maps.places.Autocomplete | null>(null);

  // Inicializar Autocomplete cuando la librería esté lista
  useEffect(() => {
    if (!placesLib || !inputRef.current || acRef.current) return;

    const ac = new placesLib.Autocomplete(inputRef.current, {
      componentRestrictions: { country: "ec" },
      fields: ["geometry.location", "formatted_address", "name"],
    });
    acRef.current = ac;

    const listener = ac.addListener("place_changed", () => {
      const place = ac.getPlace();
      const loc   = place?.geometry?.location;
      if (!loc) return;
      const addr = place.formatted_address ?? place.name ?? "";
      onSelect([loc.lng(), loc.lat()], addr);
    });

    return () => {
      window.google?.maps.event.removeListener(listener);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placesLib]);

  // Sincronizar el valor del input cuando cambia la dirección externamente
  useEffect(() => {
    if (!inputRef.current) return;
    const isFocused = document.activeElement === inputRef.current;
    if (!isFocused) inputRef.current.value = address ?? "";
  }, [address]);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        defaultValue={address ?? ""}
        className="min-w-0 flex-1 rounded-lg border border-transparent bg-muted/40 px-2.5 py-1.5 text-sm outline-none transition-[border,box-shadow] placeholder:text-muted-foreground/60 focus:border-ring focus:ring-2 focus:ring-ring/20"
      />
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
