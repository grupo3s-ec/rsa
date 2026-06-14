"use client";

/**
 * Orquestador de la experiencia tipo Waze: mapa a pantalla completa
 * con overlays flotantes para planificar la ruta A→B y revisar alertas.
 */

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  ChevronRight,
  Crosshair,
  Flag,
  HelpCircle,
  LoaderCircle,
  Navigation,
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
  { name: "Cumbayá", coords: [-78.428, -0.205] },
  { name: "Aeropuerto", coords: [-78.3575, -0.1252] },
  { name: "Quito Norte", coords: [-78.485, -0.11] },
];

const DEFAULT_ORIGIN: LngLat = [-78.485, -0.11];
const DEFAULT_DESTINATION: LngLat = [-78.428, -0.205];

type PickMode = "origin" | "destination" | null;

interface RouteInfo {
  distanceMeters: number;
  durationSeconds: number;
}

function resolvePointName(point: LngLat): string {
  const match = LOCATION_PRESETS.find(
    (preset) =>
      Math.abs(preset.coords[0] - point[0]) < 1e-6 &&
      Math.abs(preset.coords[1] - point[1]) < 1e-6,
  );

  return match ? match.name : "Punto en el mapa";
}

export function RoutePlanner() {
  const [origin, setOrigin] = useState<LngLat>(DEFAULT_ORIGIN);
  const [destination, setDestination] = useState<LngLat>(DEFAULT_DESTINATION);
  const [routeGeometry, setRouteGeometry] = useState<RouteLineString | null>(null);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickMode, setPickMode] = useState<PickMode>(null);
  const [panelOpen, setPanelOpen] = useState(true);
  const [searched, setSearched] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportPickActive, setReportPickActive] = useState(false);
  const [pickedReportCoords, setPickedReportCoords] = useState<LngLat | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  const originName = useMemo(() => resolvePointName(origin), [origin]);
  const destinationName = useMemo(() => resolvePointName(destination), [destination]);

  const criticalCount = useMemo(
    () => incidents.filter((i) => i.severity === "critical").length,
    [incidents],
  );

  const handleMapClick = useCallback(
    (lngLat: LngLat) => {
      if (reportPickActive) {
        setPickedReportCoords(lngLat);
        setReportPickActive(false);
        setPickMode(null);
        setReportOpen(true);
        return;
      }

      if (pickMode === "origin") {
        setOrigin(lngLat);
        setPickMode(null);
      } else if (pickMode === "destination") {
        setDestination(lngLat);
        setPickMode(null);
      }
    },
    [pickMode, reportPickActive],
  );

  const cancelPickMode = useCallback(() => {
    setPickMode(null);

    if (reportPickActive) {
      setReportPickActive(false);
      setReportOpen(true);
    }
  }, [reportPickActive]);

  async function handleSearch(): Promise<void> {
    setLoading(true);
    setError(null);
    setSearched(true);
    setPanelOpen(true);

    const [incidentsResult, directionsResult] = await Promise.allSettled([
      getRouteIncidents({
        origin_lat: origin[1],
        origin_lng: origin[0],
        destination_lat: destination[1],
        destination_lng: destination[0],
      }),
      IS_MAPBOX_CONFIGURED
        ? fetchDirectionsRoute({ origin, destination, token: MAPBOX_TOKEN })
        : Promise.reject(new Error("Mapbox no configurado.")),
    ]);

    let resolvedCoords: LngLat[] | null = null;

    if (directionsResult.status === "fulfilled") {
      const geometry = directionsResult.value.geometry;
      resolvedCoords = geometry.coordinates;
      setRouteGeometry(geometry);
      setRouteInfo({
        distanceMeters: directionsResult.value.distanceMeters,
        durationSeconds: directionsResult.value.durationSeconds,
      });
    } else {
      setRouteGeometry({ type: "LineString", coordinates: [origin, destination] });
      setRouteInfo(null);
    }

    if (incidentsResult.status === "fulfilled") {
      const raw = incidentsResult.value.data;
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
    if (selectedIncident?.id === incident.id) {
      setDetailOpen(true);
      return;
    }

    setSelectedIncident(incident);
  }

  function updateCoordinate(
    target: "origin" | "destination",
    axis: "lat" | "lng",
    rawValue: string,
  ): void {
    const value = Number(rawValue);

    if (Number.isNaN(value)) return;

    const apply = (current: LngLat): LngLat =>
      axis === "lng" ? [value, current[1]] : [current[0], value];

    if (target === "origin") {
      setOrigin(apply);
    } else {
      setDestination(apply);
    }
  }

  // Atajos de teclado — ref para evitar closures obsoletas.
  const kbHandlerRef = useRef<((e: KeyboardEvent) => void) | null>(null);

  kbHandlerRef.current = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    const isTyping =
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.isContentEditable;

    if (isTyping) return;

    switch (event.key) {
      case "Enter":
        if (!loading && !reportOpen && !detailOpen && !helpOpen) {
          event.preventDefault();
          void handleSearch();
        }
        break;
      case "Escape":
        if (pickMode !== null) {
          event.preventDefault();
          cancelPickMode();
        }
        break;
      case "r":
      case "R":
        if (pickMode === null && !reportOpen && !detailOpen && !helpOpen) {
          event.preventDefault();
          setReportOpen(true);
        }
        break;
      case "a":
      case "A":
        if (!reportOpen && !detailOpen && !helpOpen) {
          event.preventDefault();
          setPanelOpen((open) => !open);
        }
        break;
      case "?":
        event.preventDefault();
        setHelpOpen((open) => !open);
        break;
      case "ArrowLeft":
        if (incidents.length > 0 && !detailOpen) {
          event.preventDefault();
          const currentIdx = incidents.findIndex((i) => i.id === selectedIncident?.id);
          const prevIdx = currentIdx <= 0 ? incidents.length - 1 : currentIdx - 1;
          setSelectedIncident(incidents[prevIdx]);
        }
        break;
      case "ArrowRight":
        if (incidents.length > 0 && !detailOpen) {
          event.preventDefault();
          const currentIdx = incidents.findIndex((i) => i.id === selectedIncident?.id);
          const nextIdx = currentIdx >= incidents.length - 1 ? 0 : currentIdx + 1;
          setSelectedIncident(incidents[nextIdx]);
        }
        break;
    }
  };

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      kbHandlerRef.current?.(event);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-muted/30">
      {/* Mapa héroe a pantalla completa. */}
      <div
        className={cn(
          "absolute inset-0",
          pickMode !== null &&
            "cursor-crosshair [&_.mapboxgl-canvas-container]:cursor-crosshair!",
        )}
      >
        <RouteMap
          origin={origin}
          destination={destination}
          routeGeometry={routeGeometry}
          incidents={incidents}
          selectedIncidentId={selectedIncident?.id ?? null}
          onSelectIncident={handleSelectFromMap}
          onMapClick={handleMapClick}
        />
      </div>

      {/* Aviso de modo selección: pill flotante superior-centro. */}
      {pickMode !== null ? (
        <div className="pointer-events-none absolute inset-x-0 top-4 z-20 flex justify-center">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full border border-border/60 bg-background/85 px-4 py-2 text-sm shadow-lg backdrop-blur">
            <Crosshair className="size-4 text-primary" />
            <span>
              Toca el mapa para marcar{" "}
              <span className="font-semibold">
                {reportPickActive
                  ? "la ubicación del incidente"
                  : pickMode === "origin"
                    ? "el punto de salida"
                    : "el destino"}
              </span>
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
      ) : null}

      {/* Planificador de ruta: overlay superior-izquierda glassy. */}
      <aside className="absolute left-4 top-4 z-10 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-border/60 bg-background/80 p-4 shadow-lg backdrop-blur">
        <div className="space-y-3">
          <RoutePointRow
            kind="origin"
            name={originName}
            picking={pickMode === "origin"}
            onPick={() =>
              setPickMode((mode) => (mode === "origin" ? null : "origin"))
            }
          />
          <RoutePointRow
            kind="destination"
            name={destinationName}
            picking={pickMode === "destination"}
            onPick={() =>
              setPickMode((mode) =>
                mode === "destination" ? null : "destination",
              )
            }
          />

          {/* Presets: ícono de salida y llegada explícitos por lugar. */}
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

            {LOCATION_PRESETS.map((preset) => (
              <div key={preset.name} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-xs font-medium">
                  {preset.name}
                </span>
                <button
                  type="button"
                  title={`Ir desde ${preset.name}`}
                  onClick={() => setOrigin(preset.coords)}
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border border-border/70 transition-colors hover:border-emerald-400 hover:bg-emerald-500/10",
                    origin[0] === preset.coords[0] &&
                      origin[1] === preset.coords[1]
                      ? "border-emerald-500 bg-emerald-500/10"
                      : "bg-background/60",
                  )}
                  aria-label={`Salida: ${preset.name}`}
                >
                  <span className="size-2.5 rounded-full border-2 border-emerald-500" />
                </button>
                <button
                  type="button"
                  title={`Ir hasta ${preset.name}`}
                  onClick={() => setDestination(preset.coords)}
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border border-border/70 transition-colors hover:border-slate-500 hover:bg-slate-500/10",
                    destination[0] === preset.coords[0] &&
                      destination[1] === preset.coords[1]
                      ? "border-slate-700 bg-slate-500/10 dark:border-slate-300"
                      : "bg-background/60",
                  )}
                  aria-label={`Llegada: ${preset.name}`}
                >
                  <Flag className="size-3 text-slate-600 dark:text-slate-400" />
                </button>
              </div>
            ))}
          </div>

          {/* Coordenadas exactas: opción avanzada, discreta. */}
          <details className="group rounded-xl border border-border/50 bg-muted/30">
            <summary className="flex cursor-pointer select-none items-center gap-1.5 px-3 py-2 text-xs text-muted-foreground transition-colors hover:text-foreground">
              <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
              Coordenadas exactas
            </summary>
            <div className="grid grid-cols-2 gap-2 px-3 pb-3">
              <CoordinateInput
                id="origin-lat"
                label="Origen lat"
                value={origin[1]}
                onChange={(value) => updateCoordinate("origin", "lat", value)}
              />
              <CoordinateInput
                id="origin-lng"
                label="Origen lng"
                value={origin[0]}
                onChange={(value) => updateCoordinate("origin", "lng", value)}
              />
              <CoordinateInput
                id="destination-lat"
                label="Destino lat"
                value={destination[1]}
                onChange={(value) =>
                  updateCoordinate("destination", "lat", value)
                }
              />
              <CoordinateInput
                id="destination-lng"
                label="Destino lng"
                value={destination[0]}
                onChange={(value) =>
                  updateCoordinate("destination", "lng", value)
                }
              />
            </div>
          </details>

          <Button className="w-full" onClick={handleSearch} disabled={loading}>
            {loading ? (
              <LoaderCircle data-icon="inline-start" className="animate-spin" />
            ) : (
              <Navigation data-icon="inline-start" />
            )}
            {loading ? "Calculando ruta…" : "Ver ruta y alertas"}
          </Button>
        </div>

        {/* Resumen de ruta: ETA, distancia y conteo de alertas. */}
        {routeInfo || (searched && !loading) ? (
          <>
            <Separator className="my-3" />
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
                <span className="text-xs text-muted-foreground">
                  Trayecto referencial
                </span>
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
      </aside>

      {/* Controles top-right: botón alertas y botón de ayuda. */}
      <div className="absolute right-4 top-4 z-10 flex flex-col gap-2">
        <Button
          variant="outline"
          size="icon-lg"
          aria-label={panelOpen ? "Ocultar alertas" : "Mostrar alertas"}
          aria-expanded={panelOpen}
          onClick={() => setPanelOpen((open) => !open)}
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

      {/* Panel de alertas flotante. */}
      <div
        className={cn(
          "absolute bottom-4 right-4 top-20 z-10 w-[min(20rem,calc(100vw-2rem))] transition-all duration-300 ease-out",
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

      {/* Leyenda de controles del mapa — pill bottom-center. */}
      <div className="pointer-events-none absolute bottom-6 left-1/2 z-10 -translate-x-1/2">
        <div className="flex items-center gap-3 rounded-full border border-border/50 bg-background/70 px-4 py-1.5 text-[11px] text-muted-foreground shadow backdrop-blur">
          <span className="flex items-center gap-1">
            <kbd className="rounded border border-border/60 bg-muted px-1 font-mono text-[10px]">
              scroll
            </kbd>
            zoom
          </span>
          <span className="text-border/80">·</span>
          <span>arrastrar para mover</span>
          <span className="text-border/80">·</span>
          <span>
            <kbd className="rounded border border-border/60 bg-muted px-1 font-mono text-[10px]">
              ?
            </kbd>{" "}
            ayuda
          </span>
        </div>
      </div>

      {/* Botón flotante para reportar un incidente. */}
      {pickMode === null ? (
        <div className="absolute bottom-6 left-4 z-10">
          <Button
            aria-label="Reportar incidente"
            onClick={() => setReportOpen(true)}
            className="size-12 rounded-full shadow-xl"
          >
            <TriangleAlert className="size-5" />
          </Button>
        </div>
      ) : null}

      <ReportDrawer
        defaultCoords={origin}
        open={reportOpen}
        onOpenChange={setReportOpen}
        onPickLocation={() => {
          setReportOpen(false);
          setReportPickActive(true);
          setPickMode("origin");
        }}
        pendingPickCoords={pickedReportCoords}
        onCreated={() => {
          void handleSearch();
        }}
      />

      <IncidentDetailDialog
        incident={selectedIncident}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />

      <MapHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </div>
  );
}

interface RoutePointRowProps {
  kind: "origin" | "destination";
  name: string;
  picking: boolean;
  onPick: () => void;
}

function RoutePointRow({ kind, name, picking, onPick }: RoutePointRowProps) {
  return (
    <div className="flex items-center gap-2.5">
      {kind === "origin" ? (
        <span className="flex size-6 shrink-0 items-center justify-center">
          <span className="flex size-4 items-center justify-center rounded-full border-2 border-emerald-500">
            <span className="size-1.5 rounded-full bg-emerald-500" />
          </span>
        </span>
      ) : (
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900">
          <Flag className="size-3" />
        </span>
      )}

      <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>

      <Button
        variant={picking ? "secondary" : "ghost"}
        size="xs"
        onClick={onPick}
        className={cn("shrink-0", picking && "text-primary")}
      >
        <Crosshair data-icon="inline-start" />
        {picking ? "Eligiendo…" : "Tocar mapa"}
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
        onChange={(event) => onChange(event.target.value)}
        className="h-7 text-xs"
      />
    </div>
  );
}
