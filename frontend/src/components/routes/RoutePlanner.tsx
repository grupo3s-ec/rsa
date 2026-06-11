"use client";

/**
 * Orquestador de la experiencia tipo Waze: mapa a pantalla completa
 * con overlays flotantes para planificar la ruta A→B y revisar alertas.
 */

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import {
  Bell,
  ChevronRight,
  Crosshair,
  Flag,
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
import { cn } from "@/lib/utils";
import { IS_MAPBOX_CONFIGURED, MAPBOX_TOKEN } from "@/lib/config";
import { formatDistance, formatDuration } from "@/lib/incidents/format";
import {
  fetchDirectionsRoute,
  type LngLat,
  type RouteLineString,
} from "@/lib/mapbox/directions";
import { getRouteIncidents } from "@/services/routes.service";
import type { Incident } from "@/types/incident";

// El mapa solo vive en el cliente (mapbox-gl usa window).
const RouteMap = dynamic(() => import("@/components/map/RouteMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-muted/40 absolute inset-0">
      <LoaderCircle className="size-6 animate-spin text-muted-foreground" />
    </div>
  ),
});

/** Lugares frecuentes de Quito para fijar origen/destino sin lat/lng crudas. */
interface LocationPreset {
  name: string;
  coords: LngLat;
}

const LOCATION_PRESETS: LocationPreset[] = [
  { name: "Quito Centro", coords: [-78.5125, -0.22] },
  { name: "Cumbayá", coords: [-78.428, -0.205] },
  { name: "Aeropuerto (Tababela)", coords: [-78.3575, -0.1252] },
  { name: "Quito Norte", coords: [-78.485, -0.11] },
];

const DEFAULT_ORIGIN: LngLat = [-78.485, -0.11]; // Quito Norte
const DEFAULT_DESTINATION: LngLat = [-78.428, -0.205]; // Cumbayá

type PickMode = "origin" | "destination" | null;

interface RouteInfo {
  distanceMeters: number;
  durationSeconds: number;
}

/** Nombre del preset si las coordenadas coinciden, o "Punto en el mapa". */
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
  // Reporte de novedades: drawer + modo "fijar ubicación" sobre el mapa.
  const [reportOpen, setReportOpen] = useState(false);
  const [reportPickActive, setReportPickActive] = useState(false);
  const [pickedReportCoords, setPickedReportCoords] = useState<LngLat | null>(null);

  const originName = useMemo(() => resolvePointName(origin), [origin]);
  const destinationName = useMemo(
    () => resolvePointName(destination),
    [destination],
  );

  const criticalCount = useMemo(
    () => incidents.filter((incident) => incident.severity === "critical").length,
    [incidents],
  );

  /** Fija el punto activo al hacer click en el mapa (modo selección). */
  const handleMapClick = useCallback(
    (lngLat: LngLat) => {
      // Modo reporte: la coordenada es para la novedad, no para la ruta.
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

  /** Cancela el modo selección; si venía del reporte, reabre el drawer. */
  const cancelPickMode = useCallback(() => {
    setPickMode(null);

    if (reportPickActive) {
      setReportPickActive(false);
      setReportOpen(true);
    }
  }, [reportPickActive]);

  /** Consulta incidentes y ruta en paralelo, con fallback de línea recta. */
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

    if (incidentsResult.status === "fulfilled") {
      setIncidents(incidentsResult.value.data);
    } else {
      const reason: unknown = incidentsResult.reason;
      setError(
        reason instanceof Error
          ? reason.message
          : "No se pudieron cargar las alertas de la ruta.",
      );
      setIncidents([]);
    }

    if (directionsResult.status === "fulfilled") {
      setRouteGeometry(directionsResult.value.geometry);
      setRouteInfo({
        distanceMeters: directionsResult.value.distanceMeters,
        durationSeconds: directionsResult.value.durationSeconds,
      });
    } else {
      // Fallback elegante: línea recta entre los puntos, sin ETA.
      setRouteGeometry({ type: "LineString", coordinates: [origin, destination] });
      setRouteInfo(null);
    }

    setLoading(false);
  }

  function handleSelectFromMap(incident: Incident): void {
    setSelectedIncident(incident);
    setDetailOpen(true);
  }

  /** Desde la lista: primero selecciona y centra; un segundo toque abre el detalle. */
  function handleSelectFromList(incident: Incident): void {
    if (selectedIncident?.id === incident.id) {
      setDetailOpen(true);
      return;
    }

    setSelectedIncident(incident);
  }

  /** Actualiza una coordenada desde los inputs avanzados. */
  function updateCoordinate(
    target: "origin" | "destination",
    axis: "lat" | "lng",
    rawValue: string,
  ): void {
    const value = Number(rawValue);

    if (Number.isNaN(value)) {
      return;
    }

    const apply = (current: LngLat): LngLat =>
      axis === "lng" ? [value, current[1]] : [current[0], value];

    if (target === "origin") {
      setOrigin(apply);
    } else {
      setDestination(apply);
    }
  }

  return (
    <div className="relative h-full w-full overflow-hidden bg-muted/30">
      {/* Mapa héroe a pantalla completa. */}
      <div
        className={cn(
          "absolute inset-0",
          // Fuerza el cursor de selección sobre el canvas de Mapbox.
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
              Toca el mapa para fijar{" "}
              <span className="font-semibold">
                {reportPickActive
                  ? "la ubicación de la novedad"
                  : pickMode === "origin"
                    ? "el origen"
                    : "el destino"}
              </span>
            </span>
            <button
              type="button"
              onClick={cancelPickMode}
              className="ml-1 rounded-full p-0.5 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Cancelar selección"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>
      ) : null}

      {/* Planificador de ruta: overlay superior-izquierda glassy. */}
      <aside className="absolute left-4 top-4 z-10 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-border/60 bg-background/80 p-4 shadow-lg backdrop-blur">
        <div className="space-y-3">
          {/* Origen y destino con su guía visual (verde → bandera). */}
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

          {/* Presets rápidos: el camino feliz para usuarios novatos. */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              Lugares rápidos
            </p>
            <div className="flex flex-wrap gap-1.5">
              {LOCATION_PRESETS.map((preset) => (
                <div
                  key={preset.name}
                  className="flex items-center overflow-hidden rounded-full border border-border/70 bg-background/60 text-xs"
                >
                  <button
                    type="button"
                    title={`Usar ${preset.name} como origen`}
                    onClick={() => setOrigin(preset.coords)}
                    className="px-2 py-1 transition-colors hover:bg-emerald-500/10 hover:text-emerald-600"
                  >
                    {preset.name}
                  </button>
                  <button
                    type="button"
                    title={`Usar ${preset.name} como destino`}
                    onClick={() => setDestination(preset.coords)}
                    className="border-l border-border/70 px-1.5 py-1 text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
                    aria-label={`Usar ${preset.name} como destino`}
                  >
                    <Flag className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Coordenadas exactas: disponibles pero discretas. */}
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
                onChange={(value) => updateCoordinate("destination", "lat", value)}
              />
              <CoordinateInput
                id="destination-lng"
                label="Destino lng"
                value={destination[0]}
                onChange={(value) => updateCoordinate("destination", "lng", value)}
              />
            </div>
          </details>

          <Button className="w-full" onClick={handleSearch} disabled={loading}>
            {loading ? (
              <LoaderCircle data-icon="inline-start" className="animate-spin" />
            ) : (
              <Navigation data-icon="inline-start" />
            )}
            {loading ? "Analizando ruta…" : "Ver ruta y alertas"}
          </Button>
        </div>

        {/* Resumen de ruta: ETA, distancia y conteo de alertas en una línea. */}
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

      {/* Botón para mostrar/ocultar el panel de alertas. */}
      <div className="absolute right-4 top-4 z-10">
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
      </div>

      {/* Panel de alertas flotante, colapsable y con scroll interno. */}
      <div
        className={cn(
          "absolute bottom-4 right-4 top-16 z-10 w-[min(20rem,calc(100vw-2rem))] transition-all duration-300 ease-out",
          panelOpen
            ? "translate-x-0 opacity-100"
            : "pointer-events-none translate-x-6 opacity-0",
        )}
      >
        <IncidentSidebar
          incidents={incidents}
          loading={loading}
          error={error}
          selectedIncidentId={selectedIncident?.id ?? null}
          onSelectIncident={handleSelectFromList}
        />
      </div>

      {/* Botón flotante para reportar una novedad (oculto en modo selección). */}
      {pickMode === null ? (
        <div className="absolute bottom-6 left-4 z-10">
          <Button
            aria-label="Reportar novedad"
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
    </div>
  );
}

interface RoutePointRowProps {
  kind: "origin" | "destination";
  name: string;
  picking: boolean;
  onPick: () => void;
}

/** Fila de punto de ruta: señal visual (verde/bandera) + nombre + fijar en mapa. */
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
        {picking ? "Eligiendo…" : "Fijar en el mapa"}
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

/** Input numérico compacto para coordenadas avanzadas. */
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
