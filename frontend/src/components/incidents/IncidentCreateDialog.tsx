'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { Camera, Film, HelpCircle, Link2, MapPin, Plus, X } from 'lucide-react';
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
import { createHazardType, getHazardTypes } from '@/services/hazard-types.service';
import { cn } from '@/lib/utils';
import { INCIDENT_SEVERITIES } from '@/types/incident';
import type { HazardType, IncidentCondition, IncidentSeverity } from '@/types/incident';
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

type EvidenceMode = 'photo' | 'video' | 'link';

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
  // Se activa solo tras un intento de submit fallido — antes de eso no se
  // resalta nada en rojo (el usuario aún no "hizo algo mal", solo no ha
  // terminado). Reemplaza los toasts de validación: la señal vive en el
  // campo que falta, no en una esquina de la pantalla.
  const [attemptedSubmit, setAttemptedSubmit] = useState(false);
  const wasPickActive = useRef(false);

  // Tipos de incidente creados al vuelo (o traídos en segundo plano desde el
  // backend) que no están en el espejo estático `HAZARD_TYPES` — ver el
  // comentario de ese archivo sobre por qué el catálogo base es estático
  // (evita depender de un GET lento en cold-start para abrir el diálogo).
  const [extraHazardTypes, setExtraHazardTypes] = useState<HazardType[]>([]);
  const [showNewTypeForm,  setShowNewTypeForm]  = useState(false);
  const [newTypeName,      setNewTypeName]      = useState('');
  const [newTypeSeverity,  setNewTypeSeverity]  = useState<IncidentSeverity>('medium');
  const [creatingType,     setCreatingType]     = useState(false);

  // Evidencia: foto/video (archivo) o enlace externo (URL) — antes solo
  // había "Foto". "Enlace" llena `video_url` directo (el mismo campo que ya
  // usa el visor de video del detalle), no una fila de galería aparte.
  const [evidenceMode, setEvidenceMode] = useState<EvidenceMode>('photo');
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null);
  const [evidenceUrl,  setEvidenceUrl]  = useState('');
  const evidenceRef = useRef<HTMLInputElement>(null);

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

  // Trae el catálogo real en segundo plano (no bloquea el diálogo, que ya
  // abrió instantáneo con `HAZARD_TYPES`) y agrega cualquier tipo que no
  // esté en el espejo estático — así un tipo creado por otro usuario/sesión
  // "aparece en el futuro en el selector" sin depender de actualizar el
  // archivo estático a mano.
  useEffect(() => {
    getHazardTypes()
      .then(({ data }) => {
        const knownIds = new Set(HAZARD_TYPES.map(h => h.id));
        const fresh = data.filter(h => !knownIds.has(h.id));
        if (fresh.length === 0) return;
        setExtraHazardTypes(prev => {
          const seen = new Set(prev.map(h => h.id));
          const toAdd = fresh.filter(h => !seen.has(h.id));
          return toAdd.length > 0 ? [...prev, ...toAdd] : prev;
        });
      })
      .catch(() => { /* silencioso — el catálogo estático ya cubre el caso normal */ });
  }, []);

  const allHazardTypes = useMemo(() => {
    const map = new Map<number, HazardType>(HAZARD_TYPES.map(h => [h.id, h]));
    for (const h of extraHazardTypes) map.set(h.id, h);
    return [...map.values()];
  }, [extraHazardTypes]);

  const groupedHazardTypes = useMemo(() => {
    const groups = new Map<IncidentCondition, HazardType[]>();
    for (const condition of CONDITION_ORDER) groups.set(condition, []);
    for (const hazardType of allHazardTypes) {
      groups.get(hazardType.condition)?.push(hazardType);
    }
    for (const list of groups.values()) list.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    return groups;
  }, [allHazardTypes]);

  const selectedHazardType = allHazardTypes.find(h => h.id === hazardTypeId) ?? null;

  function reset() {
    setHazardTypeId(null);
    setActiveCondition('fisica');
    setTitle('');
    setDescription('');
    setCoords(null);
    setAttemptedSubmit(false);
    setShowNewTypeForm(false);
    setNewTypeName('');
    setNewTypeSeverity('medium');
    setEvidenceMode('photo');
    setEvidenceFile(null);
    setEvidenceUrl('');
  }

  function handlePickLocation() {
    onOpenChange(false);
    onRequestPickLocation?.();
  }

  function handleSelectCondition(condition: IncidentCondition) {
    setActiveCondition(condition);
    setShowNewTypeForm(false);
  }

  async function handleCreateType(): Promise<void> {
    const name = newTypeName.trim();
    if (!name) return;
    setCreatingType(true);
    try {
      const created = await createHazardType({ name, condition: activeCondition, severity: newTypeSeverity });
      setExtraHazardTypes(prev => (prev.some(h => h.id === created.id) ? prev : [...prev, created]));
      setHazardTypeId(created.id);
      setNewTypeName('');
      setShowNewTypeForm(false);
      toast.success('Tipo agregado ✓');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'No se pudo agregar el tipo');
    } finally {
      setCreatingType(false);
    }
  }

  function handleSubmit(e: React.FormEvent): void {
    e.preventDefault();
    if (!coords || !hazardTypeId || !title.trim()) { setAttemptedSubmit(true); return; }

    const payload = {
      title:       title.trim(),
      hazard_type_id: hazardTypeId,
      description: description.trim() || null,
      latitude:    coords.lat,
      longitude:   coords.lng,
      source:      'manual' as const,
      video_url:   evidenceMode === 'link' && evidenceUrl.trim() ? evidenceUrl.trim() : null,
      occurred_at: null,
    };
    const file      = evidenceMode !== 'link' ? evidenceFile : null;
    const mediaType = evidenceMode === 'video' ? 'video' : 'photo';

    // Optimista: no se espera la respuesta de red para dar el feedback — en
    // el Render free tier el primer request tras un cold-start puede tardar
    // decenas de segundos, y antes el diálogo se quedaba "congelado" ese
    // rato. Se confirma de inmediato y se reconcilia en segundo plano; si
    // en verdad falla, un toast de error avisa para reintentar (hasta que
    // haya un servidor de pago sin este problema de latencia).
    toast.success('Reportado ✓');
    reset();
    onOpenChange(false);

    void (async () => {
      try {
        const { data: incident } = await createIncident(payload);
        if (file) {
          try { await uploadIncidentPhoto(incident.id, file, mediaType); }
          catch (err) { toast.error(err instanceof Error ? err.message : 'Error al subir la evidencia'); }
        }
        onCreated?.();
      } catch {
        toast.error('No se pudo guardar la novedad — intenta de nuevo');
      }
    })();
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v && !pickActive) reset(); onOpenChange(v); }}>
      <SheetContent side="bottom" className="sm:mx-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Reportar novedad</SheetTitle>
        </SheetHeader>

        <SheetBody>
        <form onSubmit={handleSubmit} className="space-y-5 pb-2">

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
                    onClick={() => handleSelectCondition(condition)}
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

            <div className="flex flex-wrap items-center gap-1.5">
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

              {/* "+ Otro" — el tipo que se necesita no está en el catálogo:
                  se crea al vuelo (se guarda en la BD y queda disponible
                  para todos desde entonces, ver el fetch de arriba). */}
              {showNewTypeForm ? (
                <div className="flex w-full items-center gap-1.5 rounded-xl border border-dashed border-border/60 px-2.5 py-1.5">
                  <input
                    autoFocus
                    value={newTypeName}
                    onChange={e => setNewTypeName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void handleCreateType(); } }}
                    placeholder="Nombre del tipo nuevo…"
                    className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
                  />
                  <select
                    value={newTypeSeverity}
                    onChange={e => setNewTypeSeverity(e.target.value as IncidentSeverity)}
                    className="shrink-0 rounded-md border border-border/40 bg-background px-1 py-0.5 text-[10px] text-foreground"
                  >
                    {INCIDENT_SEVERITIES.map(s => <option key={s} value={s}>{severityMeta[s].label}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleCreateType()}
                    disabled={creatingType || !newTypeName.trim()}
                    className="shrink-0 text-[11px] font-medium text-primary disabled:opacity-50"
                  >
                    {creatingType ? '…' : 'Agregar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewTypeForm(false)}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowNewTypeForm(true)}
                  className="flex items-center gap-1 rounded-full border border-dashed border-border/60 px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-border hover:text-foreground"
                >
                  <Plus className="size-3.5" /> Otro
                </button>
              )}
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

          {/* Evidencia */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Evidencia (opcional)</p>
            <div className="flex items-center gap-0.5 rounded-lg border border-border/50 bg-muted/40 p-0.5">
              {([
                { mode: 'photo' as const, label: 'Foto',   Icon: Camera },
                { mode: 'video' as const, label: 'Video',  Icon: Film },
                { mode: 'link'  as const, label: 'Enlace', Icon: Link2 },
              ]).map(({ mode, label, Icon }) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => { setEvidenceMode(mode); setEvidenceFile(null); }}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] font-medium transition-colors',
                    evidenceMode === mode ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="size-3.5" /> {label}
                </button>
              ))}
            </div>

            {evidenceMode === 'link' ? (
              <Input
                type="url"
                value={evidenceUrl}
                onChange={e => setEvidenceUrl(e.target.value)}
                placeholder="https://…"
                className="h-11 text-sm"
              />
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => evidenceRef.current?.click()}
                  className="flex w-full items-center gap-3 rounded-xl border border-dashed border-border/60 px-4 py-3 text-sm transition-colors hover:bg-muted/40"
                >
                  {evidenceMode === 'photo'
                    ? <Camera className="size-5 shrink-0 text-muted-foreground" />
                    : <Film className="size-5 shrink-0 text-muted-foreground" />
                  }
                  {evidenceFile ? (
                    <span className="flex-1 truncate text-left text-sm text-foreground">{evidenceFile.name}</span>
                  ) : (
                    <span className="text-muted-foreground">
                      {evidenceMode === 'photo' ? 'Tomar foto o seleccionar archivo' : 'Seleccionar video'}
                    </span>
                  )}
                  {evidenceFile && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={e => { e.stopPropagation(); setEvidenceFile(null); }}
                      onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); setEvidenceFile(null); } }}
                      className="ml-auto shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <X className="size-4" />
                    </span>
                  )}
                </button>
                <input
                  ref={evidenceRef}
                  type="file"
                  accept={evidenceMode === 'photo' ? 'image/*' : 'video/*'}
                  capture={evidenceMode === 'photo' ? 'environment' : undefined}
                  className="hidden"
                  onChange={e => {
                    setEvidenceFile(e.target.files?.[0] ?? null);
                    e.target.value = '';
                  }}
                />
              </>
            )}
          </div>

          <Button
            type="submit"
            className="h-12 w-full text-sm font-medium"
            disabled={!title.trim() || !coords || !hazardTypeId}
          >
            Reportar novedad
          </Button>

        </form>
        </SheetBody>
      </SheetContent>
    </Sheet>
  );
}
