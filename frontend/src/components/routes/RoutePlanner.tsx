"use client";

import dynamic from "next/dynamic";
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
  TriangleAlert,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { IncidentDetailDialog } from "@/components/incidents/IncidentDetailDialog";
import { IncidentSidebar } from "@/components/incidents/IncidentSidebar";
import { ReportDrawer } from "@/components/incidents/ReportDrawer";
import { MapHelpDialog } from "@/components/map/MapHelpDialog";
import { cn } from "@/lib/utils";
import { IS_MAPBOX_CONFIGURED, MAPBOX_TOKEN } from "@/lib/config";
import { formatDistance, formatDuration } from "@/lib/incidents/format";
import {
  fetchDirectionsRoute,
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

interface LocationPreset {
  name: string;
  coords: LngLat;
}

const LOCATION_PRESETS: LocationPreset[] = [
  { name: "Quito Centro", coords: [-78.5125, -0.22] },
  { name: "Cumbayá",      coords: [-78.428,  -0.205] },
  { name: "Aeropuerto",   coords: [-78.3575, -0.1252] },
  { name: "Quito Norte",  coords: [-78.485,  -0.11] },
];

const MAX_WAYPOINTS = 8;

type PickingIndex = number | null;
type LayoutMode   = "full" | "panel";

interface RouteInfo {
  distanceMeters: number;
  durationSeconds: number;
}

function resolvePointName(point: LngLat | null): string {
  if (!point) return "Sin seleccionar";
  const match = LOCATION_PRESETS.find(
    (p) =>
      Math.abs(p.coords[0] - point[0]) < 1e-6 &&
      Math.abs(p.coords[1] - point[1]) < 1e-6,
  );
  return match ? match.name : "Punto en el mapa";
}

export function RoutePlanner() {
  // Los dos primeros slots son origen y destino; slots intermedios son paradas.
  const [waypoints, setWaypoints] = useState<(LngLat | null)[]>([null, null]);

  const [routeGeometry, setRouteGeometry] = useState<RouteLineString | null>(null);
  const [routeInfo,     setRouteInfo]     = useState<RouteInfo | null>(null);
  const [incidents,     setIncidents]     = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [detailOpen,    setDetailOpen]    = useState(false);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const [pickingIndex,  setPickingIndex]  = useState<PickingIndex>(null);
  const [panelOpen,     setPanelOpen]     = useState(true);
  const [searched,      setSearched]      = useState(false);
  const [reportOpen,    setReportOpen]    = useState(false);
  const [reportPickActive, setReportPickActive] = useState(false);
  const [pickedReportCoords, setPickedReportCoords] = useState<LngLat | null>(null);
  const [helpOpen,      setHelpOpen]      = useState(false);
  const [layoutMode,    setLayoutMode]    = useState<LayoutMode>("panel");

  const origin      = waypoints[0];
  const destination = waypoints[waypoints.length - 1];

  const canSearch = waypoints.every((w) => w !== null) && waypoints.length >= 2 && !loading;

  const criticalCount = useMemo(
    () => incidents.filter((i) => i.severity === "critical").length,
    [incidents],
  );

  const activePickMode = reportPickActive || pickingIndex !== null;

  function setWaypoint(idx: number, lngLat: LngLat) {
    setWaypoints((prev) => {
      const next = [...prev];
      next[idx] = lngLat;
      return next;
    });
  }

  function addWaypoint() {
    setWaypoints((prev) => {
      if (prev.length >= MAX_WAYPOINTS) return prev;
      const next = [...prev];
      next.splice(prev.length - 1, 0, null);
      return next;
    });
  }

  function removeWaypoint(idx: number) {
    setWaypoints((prev) => {
      if (prev.length <= 2) return prev;
      return prev.filter((_, i) => i !== idx);
    });
    if (pickingIndex === idx) setPickingIndex(null);
  }

  function updateWaypointCoord(idx: number, axis: "lat" | "lng", rawValue: string) {
    if (rawValue.trim() === '') return;
    const value = Number(rawValue);
    if (!Number.isFinite(value)) return;
    setWaypoints((prev) => {
      const next = [...prev];
      const base = next[idx] ?? [0, 0];
      const axisIdx = axis === 'lng' ? 0 : 1;
      if (base[axisIdx] === value) return prev;
      next[idx] = axis === 'lng' ? [value, base[1]] : [base[0], value];
      return next;
    });
  }

  const handleMapClick = useCallback(
    (lngLat: LngLat) => {
      if (reportPickActive) {
        setPickedReportCoords(lngLat);
        setReportPickActive(false);
        setPickingIndex(null);
        setReportOpen(true);
        return;
      }
      if (pickingIndex !== null) {
        setWaypoint(pickingIndex, lngLat);
        setPickingIndex(null);
      }
    },
    [pickingIndex, reportPickActive],
  );

  const cancelPickMode = useCallback(() => {
    setPickingIndex(null);
    if (reportPickActive) {
      setReportPickActive(false);
      setReportOpen(true);
    }
  }, [reportPickActive]);

  async function handleSearch(): Promise<void> {
    const definedWaypoints = waypoints.filter((w): w is LngLat => w !== null);
    if (definedWaypoints.length < 2) return;
    setLoading(true);
    setError(null);
    setSearched(true);
    setPanelOpen(true);

    const first = definedWaypoints[0];
    const last  = definedWaypoints[definedWaypoints.length - 1];

    const [incidentsResult, directionsResult] = await Promise.allSettled([
      getRouteIncidents({
        origin_lat:      first[1],
        origin_lng:      first[0],
        destination_lat: last[1],
        destination_lng: last[0],
      }),
      IS_MAPBOX_CONFIGURED
        ? fetchDirectionsRoute({ waypoints: definedWaypoints, token: MAPBOX_TOKEN })
        : Promise.reject(new Error("Mapbox no configurado.")),
    ]);

    let resolvedCoords: LngLat[] | null = null;

    if (directionsResult.status === "fulfilled") {
      const geometry = directionsResult.value.geometry;
      resolvedCoords = geometry.coordinates;
      setRouteGeometry(geometry);
      setRouteInfo({
        distanceMeters:  directionsResult.value.distanceMeters,
        durationSeconds: directionsResult.value.durationSeconds,
      });
    } else {
      setRouteGeometry({ type: "LineString", coordinates: definedWaypoints });
      setRouteInfo(null);
    }

    if (incidentsResult.status === "fulfilled") {
      const raw      = incidentsResult.value.data;
      const filtered = resolvedCoords
        ? filterIncidentsByRoute(raw, resolvedCoords)
        : raw;
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

  function handleSelectFromMap(incident: Incident): void {
    setSelectedIncident(incident);
    setDetailOpen(true);
  }

  function handleSelectFromList(incident: Incident): void {
    if (selectedIncident?.id === incident.id) { setDetailOpen(true); return; }
    setSelectedIncident(incident);
  }

  // Atajos de teclado
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
        if (canSearch && !reportOpen && !detailOpen && !helpOpen) {
          event.preventDefault();
          void handleSearch();
        }
        break;
      case "Escape":
        if (activePickMode) { event.preventDefault(); cancelPickMode(); }
        break;
      case "r": case "R":
        if (!activePickMode && !reportOpen && !detailOpen && !helpOpen) {
          event.preventDefault(); setReportOpen(true);
        }
        break;
      case "a": case "A":
        if (!reportOpen && !detailOpen && !helpOpen) {
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
          const prev = idx <= 0 ? incidents.length - 1 : idx - 1;
          setSelectedIncident(incidents[prev]);
        }
        break;
      case "ArrowRight":
        if (incidents.length > 0 && !detailOpen) {
          event.preventDefault();
          const idx  = incidents.findIndex((i) => i.id === selectedIncident?.id);
          const next = idx >= incidents.length - 1 ? 0 : idx + 1;
          setSelectedIncident(incidents[next]);
        }
        break;
    }
  };

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) { kbHandlerRef.current?.(e); }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // ─── JSX compartido ──────────────────────────────────────────────────────────

  const pickModeLabel = reportPickActive
    ? "la ubicación del incidente"
    : pickingIndex === 0
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

  const reportButton = !activePickMode ? (
    <div className="absolute bottom-6 left-4 z-10">
      <Button
        aria-label="Reportar incidente"
        onClick={() => setReportOpen(true)}
        className="size-12 rounded-full shadow-xl"
      >
        <TriangleAlert className="size-5" />
      </Button>
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

  // Formulario de planificación de ruta
  function renderPlannerForm(compact = false) {
    return (
      <div className={cn("space-y-3", compact && "text-sm")}>

        {/* Lista de waypoints */}
        <div className="space-y-1">
          {waypoints.map((wp, idx) => {
            const isFirst = idx === 0;
            const isLast  = idx === waypoints.length - 1;
            return (
              <div key={idx} className="flex items-stretch gap-2">
                {/* Conector vertical */}
                <div className="flex w-6 shrink-0 flex-col items-center">
                  <div className={cn(
                    "flex size-6 shrink-0 items-center justify-center",
                    isLast && "mt-0.5",
                  )}>
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
                  {!isLast && (
                    <div className="w-px flex-1 bg-border/50 my-0.5" />
                  )}
                </div>

                {/* Contenido del waypoint */}
                <div className="flex min-w-0 flex-1 flex-col pb-1">
                  <div className="flex items-center gap-1.5 py-0.5">
                    <span className={cn(
                      "min-w-0 flex-1 truncate text-sm",
                      !wp ? "text-muted-foreground" : "font-medium",
                    )}>
                      {isFirst
                        ? (wp ? resolvePointName(wp) : "Punto de salida")
                        : isLast
                          ? (wp ? resolvePointName(wp) : "Destino")
                          : (wp ? resolvePointName(wp) : `Parada ${idx}`)
                      }
                    </span>
                    <Button
                      variant={pickingIndex === idx ? "secondary" : "ghost"}
                      size="xs"
                      onClick={() => setPickingIndex((p) => p === idx ? null : idx)}
                      className={cn("shrink-0", pickingIndex === idx && "text-primary")}
                    >
                      <Crosshair data-icon="inline-start" />
                      {pickingIndex === idx ? "Eligiendo…" : "Mapa"}
                    </Button>
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

        {/* Lugares frecuentes */}
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Lugares frecuentes
            </p>
            <div className="flex gap-3 pr-0.5 text-[10px] font-medium text-muted-foreground/60">
              <span>Salida</span>
              <span>Llegada</span>
            </div>
          </div>

          {LOCATION_PRESETS.map((preset) => {
            const lastIdx = waypoints.length - 1;
            const isOrigin = waypoints[0] &&
              waypoints[0][0] === preset.coords[0] && waypoints[0][1] === preset.coords[1];
            const isDest = waypoints[lastIdx] &&
              waypoints[lastIdx]![0] === preset.coords[0] && waypoints[lastIdx]![1] === preset.coords[1];

            return (
              <div key={preset.name} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-xs font-medium">
                  {preset.name}
                </span>
                <button
                  type="button"
                  title={`Ir desde ${preset.name}`}
                  onClick={() => setWaypoint(0, preset.coords)}
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border border-border/70 transition-colors hover:border-emerald-400 hover:bg-emerald-500/10",
                    isOrigin ? "border-emerald-500 bg-emerald-500/10" : "bg-background/60",
                  )}
                  aria-label={`Salida: ${preset.name}`}
                >
                  <span className="size-2.5 rounded-full border-2 border-emerald-500" />
                </button>
                <button
                  type="button"
                  title={`Ir hasta ${preset.name}`}
                  onClick={() => setWaypoint(lastIdx, preset.coords)}
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border border-border/70 transition-colors hover:border-slate-500 hover:bg-slate-500/10",
                    isDest ? "border-slate-700 bg-slate-500/10 dark:border-slate-300" : "bg-background/60",
                  )}
                  aria-label={`Llegada: ${preset.name}`}
                >
                  <Flag className="size-3 text-slate-600 dark:text-slate-400" />
                </button>
              </div>
            );
          })}
        </div>

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

        <Button className="w-full" onClick={handleSearch} disabled={!canSearch}>
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

  // ─── Dialogs compartidos ──────────────────────────────────────────────────────

  const sharedDialogs = (
    <>
      <ReportDrawer
        defaultCoords={origin ?? [-78.4678, -0.1807]}
        open={reportOpen}
        onOpenChange={setReportOpen}
        onPickLocation={() => {
          setReportOpen(false);
          setReportPickActive(true);
          setPickingIndex(0);
        }}
        pendingPickCoords={pickedReportCoords}
        onCreated={() => { void handleSearch(); }}
      />
      <IncidentDetailDialog
        incident={selectedIncident}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onStatusChanged={(updated) => {
          setIncidents(prev => prev.map(i => i.id === updated.id ? updated : i));
          setSelectedIncident(prev => prev?.id === updated.id ? updated : prev);
        }}
      />
      <MapHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  );

  // ─── Modo panel ───────────────────────────────────────────────────────────────

  if (layoutMode === "panel") {
    return (
      <div className="flex h-full w-full overflow-hidden">
        <aside className="flex w-[360px] shrink-0 flex-col border-r bg-background">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Planificador</p>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Abrir guía"
                onClick={() => setHelpOpen(true)}
              >
                <HelpCircle className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Modo pantalla completa"
                onClick={() => setLayoutMode("full")}
              >
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

        <div
          className={cn(
            "relative flex-1 overflow-hidden",
            activePickMode &&
              "cursor-crosshair [&_.mapboxgl-canvas-container]:cursor-crosshair!",
          )}
        >
          <RouteMap
            waypoints={waypoints}
            routeGeometry={routeGeometry}
            incidents={incidents}
            selectedIncidentId={selectedIncident?.id ?? null}
            onSelectIncident={handleSelectFromMap}
            onMapClick={handleMapClick}
          />
          {pickModeIndicator}
          {legendPill}
          {reportButton}
        </div>

        {sharedDialogs}
      </div>
    );
  }

  // ─── Modo pantalla completa ───────────────────────────────────────────────────

  return (
    <div className="relative h-full w-full overflow-hidden bg-muted/30">
      <div
        className={cn(
          "absolute inset-0",
          activePickMode &&
            "cursor-crosshair [&_.mapboxgl-canvas-container]:cursor-crosshair!",
        )}
      >
        <RouteMap
          waypoints={waypoints}
          routeGeometry={routeGeometry}
          incidents={incidents}
          selectedIncidentId={selectedIncident?.id ?? null}
          onSelectIncident={handleSelectFromMap}
          onMapClick={handleMapClick}
        />
      </div>

      {pickModeIndicator}

      <aside className="absolute left-4 top-4 z-10 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-border/60 bg-background/80 shadow-lg backdrop-blur">
        <div className="flex items-center justify-between border-b border-border/50 px-4 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Planificador
          </p>
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
        <div className="p-4">
          {renderPlannerForm()}
        </div>
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
      {reportButton}
      {sharedDialogs}
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

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
