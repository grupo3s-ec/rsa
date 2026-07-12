'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Select } from '@base-ui/react/select';
import { Popover } from '@base-ui/react/popover';
import { Camera, Check, ChevronsUpDown, HelpCircle, MapPin, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SeverityBadge } from '@/components/incidents/SeverityBadge';
import { RiskMatrixLegend } from '@/components/incidents/RiskMatrixLegend';
import { conditionMeta, severityMeta } from '@/lib/incidents/format';
import { createIncident, getHazardTypes, uploadIncidentPhoto } from '@/services/incidents.service';
import type { HazardType, IncidentSeverity } from '@/types/incident';
import type { LngLat } from '@/lib/mapbox/directions';

export interface IncidentCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
  /** Pide al padre activar el modo "click en el mapa" para marcar la ubicación. */
  onRequestPickLocation?: () => void;
  /** true mientras el padre está esperando un click en el mapa (dialog cerrado). */
  pickActive?: boolean;
  /** Coordenadas resultantes de ese modo, o null si no hay ninguna pendiente. */
  pickedCoords?: LngLat | null;
  /** Confirma al padre que ya se consumieron `pickedCoords`. */
  onPickedCoordsConsumed?: () => void;
}

/** Orden de urgencia para los grupos del select: Alta → Media → Baja. */
const SEVERITY_GROUP_ORDER: IncidentSeverity[] = ['high', 'medium', 'low'];

export function IncidentCreateDialog({
  open,
  onOpenChange,
  onCreated,
  onRequestPickLocation,
  pickActive = false,
  pickedCoords,
  onPickedCoordsConsumed,
}: IncidentCreateDialogProps) {
  const [hazardTypes,  setHazardTypes]  = useState<HazardType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(false);
  const [hazardTypeId, setHazardTypeId] = useState<number | null>(null);
  const [title,        setTitle]        = useState('');
  const [description,  setDescription]  = useState('');
  const [coords,        setCoords]      = useState<{ lat: number; lng: number } | null>(null);
  const [saving,        setSaving]      = useState(false);
  const [photoFile,     setPhotoFile]   = useState<File | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const wasPickActive = useRef(false);

  // Coordenadas marcadas en el mapa — el dialog está cerrado mientras se espera el click.
  useEffect(() => {
    if (!pickedCoords) return;
    setCoords({ lat: pickedCoords[1], lng: pickedCoords[0] });
    onPickedCoordsConsumed?.();
  }, [pickedCoords, onPickedCoordsConsumed]);

  // Al terminar el modo "marcar en el mapa" (con o sin selección), reabrir el dialog.
  useEffect(() => {
    if (wasPickActive.current && !pickActive) onOpenChange(true);
    wasPickActive.current = pickActive;
  }, [pickActive, onOpenChange]);

  useEffect(() => {
    if (!open || hazardTypes.length > 0) return;
    setLoadingTypes(true);
    getHazardTypes()
      .then(({ data }) => setHazardTypes(data))
      .catch(() => toast.error('No se pudo cargar el catálogo de peligros'))
      .finally(() => setLoadingTypes(false));
  }, [open, hazardTypes.length]);

  const groupedHazardTypes = useMemo(() => {
    const groups = new Map<IncidentSeverity, HazardType[]>();
    for (const severity of SEVERITY_GROUP_ORDER) groups.set(severity, []);
    for (const hazardType of hazardTypes) {
      groups.get(hazardType.severity)?.push(hazardType);
    }
    for (const list of groups.values()) list.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    return groups;
  }, [hazardTypes]);

  const selectedHazardType = hazardTypes.find(h => h.id === hazardTypeId) ?? null;

  function reset() {
    setHazardTypeId(null);
    setTitle('');
    setDescription('');
    setCoords(null);
    setPhotoFile(null);
  }

  function handlePickLocation() {
    onOpenChange(false);
    onRequestPickLocation?.();
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!coords) { toast.error('Marca la ubicación en el mapa antes de continuar'); return; }
    if (!hazardTypeId) { toast.error('Selecciona el tipo de incidente'); return; }
    if (!title.trim()) return;

    setSaving(true);
    try {
      const { data: incident } = await createIncident({
        title:       title.trim(),
        hazard_type_id: hazardTypeId,
        description: description.trim() || null,
        latitude:    coords.lat,
        longitude:   coords.lng,
        source:      'manual',
        video_url:   null,
        occurred_at: null,
      });

      if (photoFile) {
        try { await uploadIncidentPhoto(incident.id, photoFile); }
        catch { /* no bloquea — incidente ya creado */ }
      }

      toast.success('Novedad reportada');
      reset();
      onOpenChange(false);
      onCreated?.();
    } catch {
      toast.error('No se pudo guardar el incidente');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !pickActive) reset(); onOpenChange(v); }}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reportar novedad</DialogTitle>
        </DialogHeader>

        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-5 pb-2">

          {/* Tipo de incidente */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-medium text-muted-foreground">Tipo de incidente</p>
              <Popover.Root>
                <Popover.Trigger
                  aria-label="Cómo se califica el riesgo"
                  className="flex size-4 items-center justify-center rounded-full text-muted-foreground/70 outline-none transition-colors hover:text-foreground"
                >
                  <HelpCircle className="size-3.5" />
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Positioner className="z-[60] outline-none" sideOffset={8}>
                    <Popover.Popup className="w-72 rounded-2xl border border-border/60 bg-popover p-3.5 text-popover-foreground shadow-xl outline-none">
                      <RiskMatrixLegend />
                    </Popover.Popup>
                  </Popover.Positioner>
                </Popover.Portal>
              </Popover.Root>
            </div>
            <Select.Root<number>
              value={hazardTypeId ?? undefined}
              onValueChange={(value) => { if (value !== null) setHazardTypeId(value); }}
              disabled={loadingTypes}
              modal={false}
            >
              <Select.Trigger className="flex h-11 w-full items-center gap-2 rounded-xl border border-transparent bg-muted/40 px-3 text-sm outline-none transition-colors focus-visible:border-ring">
                <span className="flex-1 truncate text-left">
                  {loadingTypes
                    ? 'Cargando…'
                    : selectedHazardType?.name ?? 'Selecciona un tipo'
                  }
                </span>
                <Select.Icon>
                  <ChevronsUpDown className="size-3.5 text-muted-foreground" />
                </Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner className="z-[60] outline-none" sideOffset={6} alignItemWithTrigger={false}>
                  <Select.Popup className="max-h-80 w-[var(--anchor-width)] overflow-y-auto rounded-2xl border border-border/60 bg-popover p-1 text-popover-foreground shadow-xl outline-none">
                    {SEVERITY_GROUP_ORDER.map(severityLevel => {
                      const items = groupedHazardTypes.get(severityLevel) ?? [];
                      if (items.length === 0) return null;
                      const meta = severityMeta[severityLevel];
                      return (
                        <Select.Group key={severityLevel}>
                          <Select.GroupLabel
                            className="px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide"
                            style={{ color: meta.hex }}
                          >
                            {meta.label}
                          </Select.GroupLabel>
                          {items.map(hazardType => (
                            <Select.Item
                              key={hazardType.id}
                              value={hazardType.id}
                              className="grid cursor-default grid-cols-[1fr_1rem] items-center gap-2 rounded-xl px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-muted"
                            >
                              <Select.ItemText>{hazardType.name}</Select.ItemText>
                              <Select.ItemIndicator>
                                <Check className="size-3.5 text-primary" />
                              </Select.ItemIndicator>
                            </Select.Item>
                          ))}
                        </Select.Group>
                      );
                    })}
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </div>

          {/* Condición + Riesgos + Severidad — auto-derivados del tipo elegido, no editables */}
          {selectedHazardType && (
            <div className="space-y-2 rounded-xl border border-border/50 p-3.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">{conditionMeta[selectedHazardType.condition].label}</span>
                <SeverityBadge severity={selectedHazardType.severity} />
              </div>
              {selectedHazardType.risks && (
                <p className="text-foreground/80">{selectedHazardType.risks}</p>
              )}
            </div>
          )}

          {/* Título */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="inc-title">
              Descripción breve *
            </label>
            <Input
              id="inc-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Ej. Derrumbe bloquea carril derecho"
              required
              className="h-11 text-sm"
            />
          </div>

          {/* Ubicación */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Ubicación *</p>
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full justify-start gap-2 text-sm"
              onClick={handlePickLocation}
            >
              <MapPin className="size-4 shrink-0" />
              <span className="flex-1 truncate text-left font-mono text-xs">
                {coords
                  ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
                  : 'Marcar en el mapa'
                }
              </span>
              {coords && <span className="text-xs text-emerald-500">✓</span>}
            </Button>
          </div>

          {/* Foto */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Foto (opcional)</p>
            <button
              type="button"
              onClick={() => photoRef.current?.click()}
              className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border/60 px-4 py-3 text-sm transition-colors hover:bg-muted/40"
            >
              <Camera className="size-5 shrink-0 text-muted-foreground" />
              {photoFile ? (
                <span className="flex-1 truncate text-left text-sm text-foreground">{photoFile.name}</span>
              ) : (
                <span className="text-muted-foreground">Tomar foto o seleccionar archivo</span>
              )}
              {photoFile && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={e => { e.stopPropagation(); setPhotoFile(null); }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); setPhotoFile(null); } }}
                  className="ml-auto shrink-0 text-muted-foreground hover:text-destructive"
                >
                  <X className="size-4" />
                </span>
              )}
            </button>
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={e => {
                setPhotoFile(e.target.files?.[0] ?? null);
                e.target.value = '';
              }}
            />
          </div>

          <Button
            type="submit"
            className="h-12 w-full text-sm font-medium"
            disabled={saving || !title.trim() || !coords || !hazardTypeId}
          >
            {saving
              ? <span className="flex items-center gap-2">
                  <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Guardando…
                </span>
              : 'Reportar novedad'
            }
          </Button>

        </form>
      </DialogContent>
    </Dialog>
  );
}
