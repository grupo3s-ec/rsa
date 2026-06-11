"use client";

/**
 * Drawer inferior para reportar una novedad vial desde el mapa.
 *
 * Flujo: el operador abre el drawer con el botón flotante del planificador,
 * completa el formulario y guarda. La ubicación puede fijarse tocando el
 * mapa (el drawer se oculta, el RoutePlanner activa el modo selección y al
 * volver entrega las coordenadas vía `pendingPickCoords`).
 */

import { useEffect, useId, useState } from "react";
import { Drawer } from "@base-ui/react/drawer";
import { Select } from "@base-ui/react/select";
import {
  Check,
  ChevronRight,
  ChevronsUpDown,
  CircleAlert,
  Crosshair,
  LoaderCircle,
  MapPin,
} from "lucide-react";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { severityMeta, typeMeta } from "@/lib/incidents/format";
import type { LngLat } from "@/lib/mapbox/directions";
import { createIncident } from "@/services/incidents.service";
import {
  INCIDENT_SEVERITIES,
  INCIDENT_SOURCES,
  INCIDENT_TYPES,
  type IncidentSeverity,
  type IncidentSource,
  type IncidentType,
} from "@/types/incident";

interface ReportDrawerProps {
  /** Coordenadas por defecto para la ubicación (origen del planificador). */
  defaultCoords: LngLat;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Activa el modo "tocar el mapa" en RoutePlanner (cierra el drawer). */
  onPickLocation: () => void;
  /** Coordenadas entregadas por el click en el mapa, si las hay. */
  pendingPickCoords: LngLat | null;
  /** Notifica al padre que se creó la novedad (para refrescar alertas). */
  onCreated?: () => void;
}

const SOURCE_LABELS: Record<IncidentSource, string> = {
  manual: "Manual",
  google_drive: "Google Drive",
  geotab: "Geotab",
};

/** Convierte el valor de un input datetime-local a ISO 8601, o null. */
function toIsoOrNull(localValue: string): string | null {
  if (!localValue) {
    return null;
  }

  const date = new Date(localValue);

  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function ReportDrawer({
  defaultCoords,
  open,
  onOpenChange,
  onPickLocation,
  pendingPickCoords,
  onCreated,
}: ReportDrawerProps) {
  const fieldId = useId();

  const [type, setType] = useState<IncidentType>("accident");
  const [severity, setSeverity] = useState<IncidentSeverity>("medium");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [coords, setCoords] = useState<LngLat>(defaultCoords);
  const [coordsPinned, setCoordsPinned] = useState(false);
  const [source, setSource] = useState<IncidentSource>("manual");
  const [videoUrl, setVideoUrl] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Coordenadas fijadas tocando el mapa: el padre las entrega al reabrir.
  useEffect(() => {
    if (pendingPickCoords) {
      setCoords(pendingPickCoords);
      setCoordsPinned(true);
    }
  }, [pendingPickCoords]);

  /** Edición manual discreta de lat/lng. */
  function updateCoordinate(axis: "lat" | "lng", rawValue: string): void {
    const value = Number(rawValue);

    if (Number.isNaN(value)) {
      return;
    }

    setCoords((current) =>
      axis === "lng" ? [value, current[1]] : [current[0], value],
    );
    setCoordsPinned(true);
  }

  function resetForm(): void {
    setType("accident");
    setSeverity("medium");
    setTitle("");
    setDescription("");
    setCoords(defaultCoords);
    setCoordsPinned(false);
    setSource("manual");
    setVideoUrl("");
    setOccurredAt("");
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();

    const cleanTitle = title.trim();

    if (!cleanTitle) {
      setError("El título es obligatorio.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await createIncident({
        title: cleanTitle,
        type,
        severity,
        description: description.trim() || null,
        latitude: coords[1],
        longitude: coords[0],
        source,
        video_url: videoUrl.trim() || null,
        occurred_at: toIsoOrNull(occurredAt),
      });

      resetForm();
      onOpenChange(false);
      onCreated?.();
    } catch (cause: unknown) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo guardar la novedad.",
      );
    } finally {
      setSaving(false);
    }
  }

  const SelectedTypeIcon = typeMeta[type].icon;

  return (
    <Drawer.Root open={open} onOpenChange={(nextOpen) => onOpenChange(nextOpen)}>
      <Drawer.Portal>
        <Drawer.Backdrop className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[2px] transition-opacity duration-300 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Drawer.Viewport className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
          <Drawer.Popup className="pointer-events-auto absolute inset-x-0 bottom-0 mx-auto flex max-h-[calc(100dvh-3rem)] w-full max-w-lg flex-col rounded-t-3xl border border-b-0 border-border/60 bg-background shadow-2xl outline-none transition-transform duration-350 ease-[cubic-bezier(0.32,0.72,0,1)] data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full">
            {/* Drag handle. */}
            <div className="flex shrink-0 justify-center pb-2 pt-3">
              <span className="h-1 w-10 rounded-full bg-muted-foreground/30" />
            </div>

            <Drawer.Content className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
              <header className="space-y-1">
                <Drawer.Title className="text-base font-semibold tracking-tight">
                  Reportar novedad
                </Drawer.Title>
                <Drawer.Description className="text-xs text-muted-foreground">
                  Los datos se guardan de forma inmediata.
                </Drawer.Description>
              </header>

              <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                {/* Tipo: Select con icono por tipo. */}
                <div className="space-y-1.5">
                  <Label htmlFor={`${fieldId}-type`}>Tipo</Label>
                  <Select.Root<IncidentType>
                    value={type}
                    onValueChange={(value) => {
                      if (value) {
                        setType(value);
                      }
                    }}
                    modal={false}
                  >
                    <Select.Trigger
                      id={`${fieldId}-type`}
                      className="flex h-9 w-full items-center gap-2 rounded-2xl border border-transparent bg-input/50 px-3 text-sm outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30"
                    >
                      <SelectedTypeIcon className="size-4 text-muted-foreground" />
                      <span className="flex-1 truncate text-left">
                        {typeMeta[type].label}
                      </span>
                      <Select.Icon>
                        <ChevronsUpDown className="size-3.5 text-muted-foreground" />
                      </Select.Icon>
                    </Select.Trigger>
                    <Select.Portal>
                      <Select.Positioner
                        className="z-[60] outline-none"
                        sideOffset={6}
                        alignItemWithTrigger={false}
                      >
                        <Select.Popup className="max-h-72 w-[var(--anchor-width)] overflow-y-auto rounded-2xl border border-border/60 bg-popover p-1 text-popover-foreground shadow-xl outline-none">
                          {INCIDENT_TYPES.map((incidentType) => {
                            const meta = typeMeta[incidentType];
                            const TypeIcon = meta.icon;

                            return (
                              <Select.Item
                                key={incidentType}
                                value={incidentType}
                                className="grid cursor-default grid-cols-[1rem_1fr_1rem] items-center gap-2 rounded-xl px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-muted"
                              >
                                <TypeIcon className="size-4 text-muted-foreground" />
                                <Select.ItemText>{meta.label}</Select.ItemText>
                                <Select.ItemIndicator>
                                  <Check className="size-3.5 text-primary" />
                                </Select.ItemIndicator>
                              </Select.Item>
                            );
                          })}
                        </Select.Popup>
                      </Select.Positioner>
                    </Select.Portal>
                  </Select.Root>
                </div>

                {/* Severidad: toggles con señal de color directa. */}
                <div className="space-y-1.5">
                  <Label>Severidad</Label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {INCIDENT_SEVERITIES.map((level) => {
                      const meta = severityMeta[level];
                      const active = severity === level;

                      return (
                        <button
                          key={level}
                          type="button"
                          onClick={() => setSeverity(level)}
                          aria-pressed={active}
                          className={cn(
                            "flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-medium transition-colors",
                            active
                              ? cn(
                                  "border-transparent bg-current/10 ring-1",
                                  meta.textClass,
                                  meta.ring,
                                )
                              : "border-border/60 text-muted-foreground hover:bg-muted/60",
                          )}
                        >
                          <span
                            className={cn(
                              "size-1.5 rounded-full",
                              active ? meta.dotClass : "bg-muted-foreground/40",
                            )}
                          />
                          {meta.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Título. */}
                <div className="space-y-1.5">
                  <Label htmlFor={`${fieldId}-title`}>Título</Label>
                  <Input
                    id={`${fieldId}-title`}
                    value={title}
                    maxLength={160}
                    placeholder="Ej. Derrumbe parcial en la vía"
                    onChange={(event) => setTitle(event.target.value)}
                  />
                </div>

                {/* Descripción opcional. */}
                <div className="space-y-1.5">
                  <Label htmlFor={`${fieldId}-description`}>
                    Descripción
                    <span className="font-normal text-muted-foreground"> · opcional</span>
                  </Label>
                  <Textarea
                    id={`${fieldId}-description`}
                    value={description}
                    rows={3}
                    placeholder="Detalles que ayuden al operador…"
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </div>

                {/* Ubicación: coords actuales + fijar en el mapa + edición manual. */}
                <div className="space-y-1.5">
                  <Label>Ubicación</Label>
                  <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-muted/30 py-1.5 pl-3 pr-1.5">
                    <MapPin
                      className={cn(
                        "size-4 shrink-0",
                        coordsPinned ? "text-emerald-500" : "text-muted-foreground",
                      )}
                    />
                    <span className="flex-1 truncate font-mono text-xs tabular-nums">
                      {coords[1].toFixed(5)}, {coords[0].toFixed(5)}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={onPickLocation}
                      className="shrink-0 text-primary"
                    >
                      <Crosshair data-icon="inline-start" />
                      Fijar en el mapa
                    </Button>
                  </div>
                  <details className="group rounded-xl border border-border/50 bg-muted/20">
                    <summary className="flex cursor-pointer select-none items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground">
                      <ChevronRight className="size-3 transition-transform group-open:rotate-90" />
                      Editar coordenadas
                    </summary>
                    <div className="grid grid-cols-2 gap-2 px-3 pb-3">
                      <div className="space-y-1">
                        <Label
                          htmlFor={`${fieldId}-lat`}
                          className="text-[11px] text-muted-foreground"
                        >
                          Latitud
                        </Label>
                        <Input
                          id={`${fieldId}-lat`}
                          type="number"
                          step="0.0001"
                          value={coords[1]}
                          onChange={(event) =>
                            updateCoordinate("lat", event.target.value)
                          }
                          className="h-7 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label
                          htmlFor={`${fieldId}-lng`}
                          className="text-[11px] text-muted-foreground"
                        >
                          Longitud
                        </Label>
                        <Input
                          id={`${fieldId}-lng`}
                          type="number"
                          step="0.0001"
                          value={coords[0]}
                          onChange={(event) =>
                            updateCoordinate("lng", event.target.value)
                          }
                          className="h-7 text-xs"
                        />
                      </div>
                    </div>
                  </details>
                </div>

                {/* Fuente: control segmentado. */}
                <div className="space-y-1.5">
                  <Label>Fuente</Label>
                  <div className="grid grid-cols-3 gap-0.5 rounded-2xl bg-muted/60 p-0.5">
                    {INCIDENT_SOURCES.map((sourceOption) => (
                      <button
                        key={sourceOption}
                        type="button"
                        onClick={() => setSource(sourceOption)}
                        aria-pressed={source === sourceOption}
                        className={cn(
                          "rounded-[0.875rem] py-1.5 text-xs font-medium transition-colors",
                          source === sourceOption
                            ? "bg-background text-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {SOURCE_LABELS[sourceOption]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Video URL opcional. */}
                <div className="space-y-1.5">
                  <Label htmlFor={`${fieldId}-video`}>
                    Video URL
                    <span className="font-normal text-muted-foreground"> · opcional</span>
                  </Label>
                  <Input
                    id={`${fieldId}-video`}
                    type="url"
                    value={videoUrl}
                    placeholder="https://drive.google.com/..."
                    onChange={(event) => setVideoUrl(event.target.value)}
                  />
                </div>

                {/* Fecha del evento opcional. */}
                <div className="space-y-1.5">
                  <Label htmlFor={`${fieldId}-occurred`}>
                    Fecha del evento
                    <span className="font-normal text-muted-foreground"> · opcional</span>
                  </Label>
                  <Input
                    id={`${fieldId}-occurred`}
                    type="datetime-local"
                    value={occurredAt}
                    onChange={(event) => setOccurredAt(event.target.value)}
                  />
                </div>

                {error ? (
                  <Alert variant="destructive">
                    <CircleAlert />
                    <AlertTitle>{error}</AlertTitle>
                  </Alert>
                ) : null}

                <div className="flex gap-2 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onOpenChange(false)}
                    disabled={saving}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" className="flex-1" disabled={saving}>
                    {saving ? (
                      <LoaderCircle data-icon="inline-start" className="animate-spin" />
                    ) : null}
                    {saving ? "Guardando…" : "Guardar novedad"}
                  </Button>
                </div>
              </form>
            </Drawer.Content>
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
