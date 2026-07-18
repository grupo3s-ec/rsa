'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { Camera, HelpCircle, MapPin, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SeverityBadge } from '@/components/incidents/SeverityBadge';
import { RiskMatrixLegend } from '@/components/incidents/RiskMatrixLegend';
import { conditionMeta, severityMeta } from '@/lib/incidents/format';
import { HAZARD_TYPES, getHazardTypeIcon } from '@/lib/incidents/hazard-types';
import { createIncident, uploadIncidentPhoto } from '@/services/incidents.service';
import { cn } from '@/lib/utils';
import type { HazardType, IncidentCondition } from '@/types/incident';
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

/** Orden de las secciones de tipo de condición, agrupadas por condición. */
const CONDITION_ORDER: IncidentCondition[] = ['fisica', 'natural', 'entorno_riesgo_publico'];

export function IncidentCreateDialog({
  open,
  onOpenChange,
  onCreated,
  onRequestPickLocation,
  pickActive = false,
  pickedCoords,
  onPickedCoordsConsumed,
}: IncidentCreateDialogProps) {
  const [hazardTypeId, setHazardTypeId] = useState<number | null>(null);
  const [activeCondition, setActiveCondition] = useState<IncidentCondition>('fisica');
  const [title,        setTitle]        = useState('');
  const [description,  setDescription]  = useState('');
  const [coords,        setCoords]      = useState<{ lat: number; lng: number } | null>(null);
  const [saving,        setSaving]      = useState(false);
  const [photoFile,     setPhotoFile]   = useState<File | null>(null);
  // Se activa solo tras un intento de submit fallido — antes de eso no se
  // resalta nada en rojo (el usuario aún no "hizo algo mal", solo no ha
  // terminado). Reemplaza los toasts de validación: la señal vive en el
  // campo que falta, no en una esquina de la pantalla.
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
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

  const groupedHazardTypes = useMemo(() => {
    const groups = new Map<IncidentCondition, HazardType[]>();
    for (const condition of CONDITION_ORDER) groups.set(condition, []);
    for (const hazardType of HAZARD_TYPES) {
      groups.get(hazardType.condition)?.push(hazardType);
    }
    for (const list of groups.values()) list.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    return groups;
  }, []);

  const selectedHazardType = HAZARD_TYPES.find(h => h.id === hazardTypeId) ?? null;

  function reset() {
    setHazardTypeId(null);
    setActiveCondition('fisica');
    setTitle('');
    setDescription('');
    setCoords(null);
    setPhotoFile(null);
    setAttemptedSubmit(false);
  }

  function handlePickLocation() {
    onOpenChange(false);
    onRequestPickLocation?.();
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!coords || !hazardTypeId || !title.trim()) { setAttemptedSubmit(true); return; }

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

      toast.success('Reportado ✓');
      reset();
      onOpenChange(false);
      onCreated?.();
    } catch {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v && !pickActive) reset(); onOpenChange(v); }}>
      <SheetContent className="sm:max-w-[30vw]">
        <SheetHeader>
          <SheetTitle>Reportar novedad</SheetTitle>
        </SheetHeader>

        <SheetBody>
        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-5 pb-2">

          {/* Tipo de incidente */}
          <div
            className={cn(
              'space-y-2 rounded-xl transition-shadow',
              attemptedSubmit && !hazardTypeId && 'ring-2 ring-destructive/50',
            )}
          >
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
            {/* Tabs por categoría — antes se mostraban las 3 categorías
                apiladas (14 botones de Física siempre visibles), lo que
                hacía el diálogo muy alto. Ahora solo se ve una a la vez. */}
            <div className="flex items-center gap-0.5 rounded-lg border border-border/50 bg-muted/40 p-0.5">
              {CONDITION_ORDER.map(condition => {
                const meta = conditionMeta[condition];
                const ConditionIcon = meta.icon;
                const active = activeCondition === condition;
                return (
                  <button
                    key={condition}
                    type="button"
                    onClick={() => setActiveCondition(condition)}
                    className={cn(
                      'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors',
                      active ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    <ConditionIcon className="size-3.5" />
                    {meta.label}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-1.5">
              {(groupedHazardTypes.get(activeCondition) ?? []).map(hazardType => {
                const active = hazardTypeId === hazardType.id;
                const TypeIcon = getHazardTypeIcon(hazardType.name);
                return (
                  <button
                    key={hazardType.id}
                    type="button"
                    onClick={() => setHazardTypeId(hazardType.id)}
                    className={cn(
                      'flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs font-medium transition-colors',
                      active
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border/50 text-muted-foreground hover:text-foreground hover:border-border',
                    )}
                  >
                    <TypeIcon className="size-3.5 shrink-0" />
                    {hazardType.name}
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: severityMeta[hazardType.severity].hex }}
                    />
                  </button>
                );
              })}
            </div>
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
              aria-invalid={attemptedSubmit && !title.trim()}
              className="h-11 text-sm"
            />
          </div>

          {/* Ubicación */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Ubicación *</p>
            <Button
              type="button"
              variant="outline"
              aria-invalid={attemptedSubmit && !coords}
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
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
