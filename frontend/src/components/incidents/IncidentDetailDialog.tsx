'use client';

import { useEffect, useId, useRef, useState } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetTitle,
} from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ExternalLink, Film, ImageOff, MapPin, Plus, Upload, VideoOff, X } from 'lucide-react';
import { SeverityBadge } from '@/components/incidents/SeverityBadge';
import {
  conditionMeta,
  formatDateEs,
  severityMeta,
  statusMeta,
  toEmbedUrl,
} from '@/lib/incidents/format';
import { getHazardTypeIcon } from '@/lib/incidents/hazard-types';
import { toast } from 'sonner';
import {
  addIncidentMedia,
  deleteIncidentMedia,
  getIncidentHistory,
  getIncidentMedia,
  updateIncidentStatus,
  uploadIncidentPhoto,
} from '@/services/incidents.service';
import type {
  Incident,
  IncidentHistoryEntry,
  IncidentMedia,
  IncidentSource,
  IncidentStatus,
} from '@/types/incident';

// ── Transiciones válidas por estado ──────────────────────────────────────────

interface StatusAction { to: IncidentStatus; label: string; primary: boolean }

const STATUS_TRANSITIONS: Record<IncidentStatus, StatusAction[]> = {
  open:        [{ to: 'in_progress', label: 'Iniciar atención', primary: false }, { to: 'resolved', label: 'Resolver',  primary: true  }],
  in_progress: [{ to: 'resolved',    label: 'Resolver',         primary: true  }, { to: 'archived', label: 'Archivar', primary: false }],
  resolved:    [{ to: 'open',        label: 'Reabrir',          primary: false }, { to: 'archived', label: 'Archivar', primary: false }],
  archived:    [{ to: 'open',        label: 'Reabrir',          primary: false }],
};

const STATUS_DOT: Record<IncidentStatus, string> = {
  open:        'bg-blue-500',
  in_progress: 'bg-purple-500',
  resolved:    'bg-emerald-500',
  archived:    'bg-gray-400',
};

const SOURCE_LABELS: Record<IncidentSource, string> = {
  manual:       'Reporte manual',
  google_drive: 'Google Drive',
  geotab:       'Geotab',
};

// ── Sub-componentes ───────────────────────────────────────────────────────────

function VideoSection({ videoUrl, title }: { videoUrl: string | null; title: string }) {
  const embed = toEmbedUrl(videoUrl);

  if (embed.kind === 'drive' && embed.url) {
    return (
      <iframe
        src={embed.url}
        title={`Video: ${title}`}
        allow="autoplay; encrypted-media"
        allowFullScreen
        className="aspect-video w-full rounded-xl border border-border/60 bg-muted"
      />
    );
  }

  if (embed.kind === 'external' && embed.url) {
    return (
      <Button
        variant="outline"
        className="w-full"
        nativeButton={false}
        render={<a href={embed.url} target="_blank" rel="noreferrer" />}
      >
        <ExternalLink data-icon="inline-start" />
        Ver referencia externa
      </Button>
    );
  }

  return (
    <div className="flex aspect-video w-full items-center justify-center rounded-xl border border-dashed border-border/60 bg-muted/40 text-muted-foreground">
      <span className="flex items-center gap-2 text-xs">
        <VideoOff className="size-4" />
        Sin video
      </span>
    </div>
  );
}

interface MediaItemProps { item: IncidentMedia; onDelete: () => void }

function MediaItem({ item, onDelete }: MediaItemProps) {
  const [imgError, setImgError] = useState(false);
  const isPhoto = item.media_type === 'photo';

  return (
    <div className="group relative overflow-hidden rounded-lg border border-border/60 bg-muted/40">
      {isPhoto && item.url && !imgError ? (
        <a href={item.url} target="_blank" rel="noreferrer">
          <img
            src={item.url}
            alt={item.file_name ?? 'Foto'}
            className="h-24 w-full object-cover transition-opacity group-hover:opacity-80"
            onError={() => setImgError(true)}
          />
        </a>
      ) : (
        <a
          href={item.url ?? undefined}
          target={item.url ? '_blank' : undefined}
          rel="noreferrer"
          className="flex h-24 w-full items-center justify-center text-muted-foreground"
        >
          {isPhoto ? <ImageOff className="size-6" /> : <Film className="size-6" />}
        </a>
      )}
      <button
        type="button"
        onClick={onDelete}
        aria-label="Eliminar evidencia"
        className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-background/80 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-destructive"
      >
        <X className="size-3" />
      </button>
      {item.file_name && (
        <p className="truncate px-2 py-1 text-[11px] text-muted-foreground">{item.file_name}</p>
      )}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

export interface IncidentDetailDialogProps {
  incident:         Incident | null;
  open:             boolean;
  onOpenChange:     (open: boolean) => void;
  onStatusChanged?: (updated: Incident) => void;
}

export function IncidentDetailDialog({
  incident,
  open,
  onOpenChange,
  onStatusChanged,
}: IncidentDetailDialogProps) {
  const fieldId = useId();

  // Copia local: permite actualizar el dialog sin cerrar ni esperar al padre
  const [local, setLocal] = useState<Incident | null>(incident);
  useEffect(() => { if (incident) setLocal(incident); }, [incident]);

  // Datos adicionales
  const [history,       setHistory]       = useState<IncidentHistoryEntry[]>([]);
  const [media,         setMedia]         = useState<IncidentMedia[]>([]);
  const [loadingExtras, setLoadingExtras] = useState(false);

  // Acción de estado en curso
  const [changingTo, setChangingTo] = useState<IncidentStatus | null>(null);

  // Añadir media por URL
  const [showAddMedia, setShowAddMedia] = useState(false);
  const [newUrl,       setNewUrl]       = useState('');
  const [newType,      setNewType]      = useState<'photo' | 'video'>('photo');
  const [savingMedia,  setSavingMedia]  = useState(false);

  // Upload de archivo
  const fileInputRef               = useRef<HTMLInputElement>(null);
  const [uploading, setUploading]  = useState(false);

  // Cargar historial + media cada vez que se abre el dialog (o cambia el incidente)
  useEffect(() => {
    if (!open || !incident) return;
    setHistory([]);
    setMedia([]);
    setShowAddMedia(false);
    setChangingTo(null);
    setLoadingExtras(true);
    Promise.all([
      getIncidentHistory(incident.id),
      getIncidentMedia(incident.id),
    ])
      .then(([h, m]) => { setHistory(h); setMedia(m); })
      .finally(() => setLoadingExtras(false));
  }, [open, incident?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!local) return null;

  // Alias tipado: TypeScript no estrecha state variables en closures async,
  // pero sí constantes declaradas tras la guarda de null.
  const inc      = local;
  const severity = severityMeta[inc.severity];
  const TypeIcon = getHazardTypeIcon(inc.type);
  const actions  = STATUS_TRANSITIONS[inc.status];

  // ── Handlers ─────────────────────────────────────────────────────────────────

  async function handleStatusChange(to: IncidentStatus): Promise<void> {
    setChangingTo(to);
    try {
      const { data: updated } = await updateIncidentStatus(inc.id, to);
      setLocal(updated);
      onStatusChanged?.(updated);
      getIncidentHistory(inc.id).then(setHistory).catch(() => {});
      toast.success(`Estado: ${statusMeta[to].label}`);
    } catch {
      toast.error('No se pudo actualizar el estado');
    } finally {
      setChangingTo(null);
    }
  }

  async function handleAddMedia(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!newUrl.trim()) return;
    setSavingMedia(true);
    try {
      const created = await addIncidentMedia(inc.id, { url: newUrl.trim(), media_type: newType });
      setMedia(prev => [...prev, created]);
      setNewUrl('');
      setShowAddMedia(false);
      toast.success('Evidencia añadida');
    } catch {
      toast.error('No se pudo añadir la evidencia');
    } finally {
      setSavingMedia(false);
    }
  }

  async function handleDeleteMedia(mediaId: number): Promise<void> {
    setMedia(prev => prev.filter(m => m.id !== mediaId));
    try {
      await deleteIncidentMedia(inc.id, mediaId);
      toast.success('Evidencia eliminada');
    } catch {
      getIncidentMedia(inc.id).then(setMedia).catch(() => {});
      toast.error('No se pudo eliminar');
    }
  }

  async function handleUploadFile(file: File): Promise<void> {
    setUploading(true);
    try {
      const created = await uploadIncidentPhoto(inc.id, file);
      setMedia(prev => [...prev, created]);
      toast.success('Foto subida');
    } catch {
      toast.error('No se pudo subir la foto');
    } finally {
      setUploading(false);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[36vw]">

        {/* Cabecera */}
        <SheetHeader>
          <div className="flex items-start gap-3 pr-8">
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-full text-white shadow-md"
              style={{ backgroundColor: severity.hex }}
            >
              <TypeIcon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <SheetTitle className="leading-snug">{inc.title}</SheetTitle>
            </div>
          </div>
        </SheetHeader>

        <SheetBody>
        {/* Clasificación del peligro — Condición, Tipo de Condición, Riesgos
            y Severidad, agrupados en un solo bloque (antes dispersos entre
            el encabezado y la fila de meta). */}
        <div className="space-y-1.5 rounded-xl border border-border/50 bg-muted/20 p-3.5 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">
              <span className="font-medium text-foreground/80">Condición: </span>
              {conditionMeta[inc.condition ?? 'fisica'].label}
            </span>
            <SeverityBadge severity={inc.severity} />
          </div>
          <p className="text-foreground/90">
            <span className="font-medium text-foreground/80">Tipo de condición: </span>
            {inc.type}
          </p>
          {inc.risks && (
            <p className="text-muted-foreground">
              <span className="font-medium text-foreground/80">Riesgos: </span>
              {inc.risks}
            </p>
          )}
        </div>

        {/* Video */}
        <VideoSection videoUrl={inc.video_url} title={inc.title} />

        {/* Descripción */}
        {inc.description && (
          <p className="text-sm leading-relaxed text-foreground/90">{inc.description}</p>
        )}

        <Separator />

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className={`size-1.5 rounded-full ${
              inc.status === 'resolved' || inc.status === 'archived'
                ? 'bg-muted-foreground/50'
                : 'bg-emerald-500'
            }`} />
            {statusMeta[inc.status].label}
          </span>
          <span>{SOURCE_LABELS[inc.source]}</span>
          <span>{formatDateEs(inc.occurred_at)}</span>
          <span className="flex items-center gap-1 font-mono">
            <MapPin className="size-3" />
            {inc.latitude.toFixed(5)}, {inc.longitude.toFixed(5)}
          </span>
        </div>

        {/* Acciones de estado */}
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {actions.map(action => (
              <Button
                key={action.to}
                size="sm"
                variant={action.primary ? 'default' : 'outline'}
                disabled={changingTo !== null}
                onClick={() => { void handleStatusChange(action.to); }}
                className="text-xs"
              >
                {changingTo === action.to
                  ? <span className="flex items-center gap-1.5">
                      <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      {action.label}…
                    </span>
                  : action.label
                }
              </Button>
            ))}
          </div>
        )}

        <Separator />

        {/* ── Evidencias ─────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-foreground/80">Evidencias</p>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-xs"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading
                  ? <span className="size-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  : <Upload className="size-3" />
                }
                Foto
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 gap-1 px-2 text-xs"
                onClick={() => setShowAddMedia(v => !v)}
              >
                <Plus className="size-3" />
                URL
              </Button>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && !uploading) void handleUploadFile(file);
              e.target.value = '';
            }}
          />

          {showAddMedia && (
            <form onSubmit={(e) => { void handleAddMedia(e); }} className="flex gap-2">
              <div className="flex flex-1 overflow-hidden rounded-lg border border-border/60">
                {(['photo', 'video'] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setNewType(t)}
                    className={`shrink-0 px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                      newType === t
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t === 'photo' ? 'Foto' : 'Video'}
                  </button>
                ))}
                <Input
                  id={`${fieldId}-url`}
                  type="url"
                  value={newUrl}
                  onChange={e => setNewUrl(e.target.value)}
                  placeholder="https://…"
                  required
                  className="h-auto flex-1 rounded-none border-0 border-l text-xs focus-visible:ring-0 focus-visible:ring-offset-0"
                />
              </div>
              <Button type="submit" size="sm" className="shrink-0 text-xs" disabled={savingMedia}>
                {savingMedia ? '…' : 'Añadir'}
              </Button>
            </form>
          )}

          {loadingExtras ? (
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
            </div>
          ) : media.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin evidencias adjuntas.</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {media.map(item => (
                <MediaItem key={item.id} item={item} onDelete={() => { void handleDeleteMedia(item.id); }} />
              ))}
            </div>
          )}
        </div>

        <Separator />

        {/* ── Historial ──────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <p className="text-xs font-medium text-foreground/80">Historial</p>

          {loadingExtras ? (
            <div className="space-y-3">
              {[1, 2].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}
            </div>
          ) : history.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin cambios registrados.</p>
          ) : (
            <ol className="space-y-0">
              {history.map((entry, idx) => (
                <li key={entry.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className={`mt-0.5 size-2 shrink-0 rounded-full ${STATUS_DOT[entry.to_status]}`} />
                    {idx < history.length - 1 && (
                      <span className="mt-1 w-px flex-1 bg-border/50" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 pb-3">
                    <p className="text-xs text-foreground/90">
                      {entry.from_status === null
                        ? 'Incidente creado'
                        : <>{statusMeta[entry.from_status].label}{' → '}<strong>{statusMeta[entry.to_status].label}</strong></>
                      }
                    </p>
                    {entry.note && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{entry.note}</p>
                    )}
                    <p className="mt-0.5 text-[11px] text-muted-foreground/70">
                      {entry.user?.name ?? 'Sistema'} · {formatDateEs(entry.created_at)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
        </SheetBody>

      </SheetContent>
    </Sheet>
  );
}
