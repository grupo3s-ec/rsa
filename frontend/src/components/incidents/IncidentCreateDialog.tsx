'use client';

import { useRef, useState } from 'react';
import { Camera, Locate, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { severityMeta, typeMeta } from '@/lib/incidents/format';
import { createIncident, uploadIncidentPhoto } from '@/services/incidents.service';
import { INCIDENT_SEVERITIES, INCIDENT_TYPES } from '@/types/incident';
import type { IncidentSeverity, IncidentType } from '@/types/incident';

export interface IncidentCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated?: () => void;
}

export function IncidentCreateDialog({ open, onOpenChange, onCreated }: IncidentCreateDialogProps) {
  const [type,        setType]        = useState<IncidentType>('accident');
  const [severity,    setSeverity]    = useState<IncidentSeverity>('medium');
  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [coords,      setCoords]      = useState<{ lat: number; lng: number } | null>(null);
  const [locating,    setLocating]    = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [photoFile,   setPhotoFile]   = useState<File | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  function reset() {
    setType('accident');
    setSeverity('medium');
    setTitle('');
    setDescription('');
    setCoords(null);
    setPhotoFile(null);
  }

  function detectLocation() {
    if (!navigator.geolocation) { toast.error('Geolocalización no disponible'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      pos => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => {
        toast.error('No se pudo obtener la ubicación');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!coords) { toast.error('Detecta tu ubicación antes de continuar'); return; }
    if (!title.trim()) return;

    setSaving(true);
    try {
      const { data: incident } = await createIncident({
        title:       title.trim(),
        type,
        severity,
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
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reportar novedad</DialogTitle>
        </DialogHeader>

        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-5 pb-2">

          {/* Tipo */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Tipo</p>
            <div className="grid grid-cols-4 gap-1.5">
              {INCIDENT_TYPES.map(t => {
                const meta = typeMeta[t];
                const Icon = meta.icon;
                const active = type === t;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`flex flex-col items-center gap-1.5 rounded-xl py-3 px-1 text-[10px] font-medium leading-tight transition-colors ${
                      active
                        ? 'bg-primary/10 text-primary ring-1 ring-primary/30'
                        : 'bg-muted/40 text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <Icon className="size-5" />
                    <span className="text-center">{meta.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Severidad */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Severidad</p>
            <div className="grid grid-cols-4 gap-1.5">
              {INCIDENT_SEVERITIES.map(s => {
                const meta = severityMeta[s];
                const active = severity === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSeverity(s)}
                    style={active
                      ? { backgroundColor: `${meta.hex}22`, color: meta.hex, outlineColor: `${meta.hex}66` }
                      : undefined
                    }
                    className={`rounded-lg py-2.5 text-xs font-semibold transition-colors ${
                      active
                        ? 'outline outline-1'
                        : 'bg-muted/40 text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

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
              onClick={detectLocation}
              disabled={locating}
            >
              {locating
                ? <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />
                : <Locate className="size-4 shrink-0" />
              }
              <span className="flex-1 truncate text-left font-mono text-xs">
                {coords
                  ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
                  : locating ? 'Detectando…' : 'Detectar mi ubicación'
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
            disabled={saving || !title.trim() || !coords}
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
