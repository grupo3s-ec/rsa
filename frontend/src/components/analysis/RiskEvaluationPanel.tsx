'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Camera, ChevronDown, ChevronUp, Download, ExternalLink, LoaderCircle, MapPinned } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { getRiskEvaluation, getRouteRiskReportPdfUrl, type RiskEvaluationKmPoint } from '@/lib/api/risk-evaluation';
import { impactoHex, maxImpactoHex } from '@/lib/risk-evaluation';
import { driveThumbnailUrl } from '@/lib/drive';
import { toEmbedUrl } from '@/lib/incidents/format';
import { getToken } from '@/lib/auth/token';

/** Descarga con el token de auth en el header — un <a href> plano no lo
 * manda, y el endpoint requiere sesión de admin (mismo patrón que
 * admin/reporteria). El PDF tarda unos segundos (llama a Places API y a
 * Static Maps del lado del backend), de ahí el estado de carga. */
async function downloadWithAuth(url: string, filename: string): Promise<void> {
  const token = getToken();
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new Error(`No se pudo generar el PDF (${res.status}).`);
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

const TRAMO_SIZE_KM = 50;

function KmCard({ km }: { km: RiskEvaluationKmPoint }) {
  const [expanded, setExpanded] = useState(false);
  const color = maxImpactoHex(km.conditions);
  const embed = toEmbedUrl(km.video_url);

  return (
    <div className="rounded-xl border border-border/40 transition-colors hover:border-border">
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <p className="text-sm font-medium text-foreground leading-snug flex-1">{km.km_label}</p>
          <span
            className="shrink-0 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
            style={{ backgroundColor: color }}
          >
            {km.conditions.length} condición{km.conditions.length !== 1 ? 'es' : ''}
          </span>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-2">
          <span className={cn('size-1.5 rounded-full shrink-0', 'bg-current')} style={{ color }} />
          <span>{km.tipo_camino ?? 'Superficie sin dato'}</span>
          {km.video_url && (
            <span className="ml-auto shrink-0 flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <Camera className="size-3" /> Video
            </span>
          )}
        </div>

        {km.comentario && (
          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{km.comentario}</p>
        )}

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          {expanded ? 'Ver menos' : 'Ver detalle'}
        </button>

        {expanded && (
          <div className="mt-2 space-y-2.5">
            {embed.kind === 'drive' && embed.url && (
              <>
                <iframe
                  src={embed.url}
                  title={`Video ${km.km_label}`}
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                  // Alto fijo, no aspect-video: el reproductor de Drive dibuja
                  // su propia barra de controles ADEMÁS del video — con
                  // exactamente 16:9 esa barra queda cortada fuera del iframe.
                  className="h-72 w-full rounded-lg border border-border/60 bg-muted"
                />
                <a
                  href={km.video_url ?? undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ExternalLink className="size-2.5" /> Abrir en Google Drive
                </a>
              </>
            )}
            {embed.kind === 'external' && embed.url && (
              <a
                href={embed.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-1.5 rounded-lg border border-border/60 bg-muted/40 py-2.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
              >
                <Camera className="size-3.5" /> Ver video <ExternalLink className="size-3" />
              </a>
            )}

            {km.conditions.map((c, i) => {
              const thumb = driveThumbnailUrl(c.imagen_url, 120);
              return (
                <div key={i} className="flex items-start gap-2 rounded-lg border border-border/40 bg-background/60 p-2">
                  {thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt={c.tipo} className="size-9 shrink-0 rounded-md border border-border/40 object-contain bg-white" />
                  ) : (
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border/40 bg-muted text-muted-foreground">
                      <AlertTriangle className="size-3.5" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[11px] font-medium text-foreground">{c.tipo}</span>
                      {c.impacto && (
                        <span
                          className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold text-white"
                          style={{ backgroundColor: impactoHex(c.impacto) }}
                        >
                          {c.impacto}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">{c.condicion}</p>
                    {c.riesgos && <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{c.riesgos}</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/** Evaluación de Riesgo por km — reemplaza el embed viejo de SharePoint:
 * consume los datos ya estructurados (video, condiciones, imágenes) en vez
 * de mostrar el Excel tal cual. Agrupado por tramos de 50 km, como se pidió. */
export function RiskEvaluationPanel() {
  const [kms, setKms] = useState<RiskEvaluationKmPoint[] | null>(null);
  const [error, setError] = useState(false);
  const [tramo, setTramo] = useState<number | null>(null);
  const [evaluationId, setEvaluationId] = useState<number | undefined>(undefined);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    setError(false);
    getRiskEvaluation()
      .then((res) => { setKms(res.kms); setEvaluationId(res.evaluation?.id); })
      .catch(() => setError(true));
  }, [retryCount]);

  async function handleDownloadPdf(): Promise<void> {
    if (downloadingPdf) return;
    setDownloadingPdf(true);
    try {
      await downloadWithAuth(getRouteRiskReportPdfUrl(evaluationId), 'reporte-riesgos-ruta.pdf');
    } catch {
      // El botón vuelve a su estado normal — el usuario puede reintentar.
    } finally {
      setDownloadingPdf(false);
    }
  }

  const tramos = useMemo(() => {
    if (!kms || kms.length === 0) return [];
    const maxKm = Math.max(...kms.map((k) => k.km_number));
    return Array.from({ length: Math.floor(maxKm / TRAMO_SIZE_KM) + 1 }, (_, i) => i * TRAMO_SIZE_KM);
  }, [kms]);

  const visibles = useMemo(() => {
    if (!kms) return [];
    if (tramo === null) return kms;
    return kms.filter((k) => k.km_number >= tramo && k.km_number < tramo + TRAMO_SIZE_KM);
  }, [kms, tramo]);

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="shrink-0 p-4 pb-3 border-b border-border/40">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <MapPinned className="size-4 text-emerald-600 dark:text-emerald-400" />
            Evaluación de Riesgo por Km
          </h2>
          {kms && kms.length > 0 && (
            <button
              type="button"
              onClick={() => { void handleDownloadPdf(); }}
              disabled={downloadingPdf}
              title="Descargar reporte PDF con mapa de riesgos principales y gasolineras/UPC cercanas"
              className="flex shrink-0 items-center gap-1 rounded-md border border-border/50 px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground hover:border-border disabled:opacity-50"
            >
              {downloadingPdf ? <LoaderCircle className="size-3 animate-spin" /> : <Download className="size-3" />}
              PDF
            </button>
          )}
        </div>
        {kms && kms.length > 0 && (
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {kms.length} km evaluados · {tramo === null ? 'todos los tramos' : `tramo Km ${tramo}-${tramo + TRAMO_SIZE_KM - 1}`}
          </p>
        )}

        {tramos.length > 1 && (
          <div className="flex flex-wrap gap-1.5 mt-2.5">
            <button
              type="button"
              onClick={() => setTramo(null)}
              className={cn('rounded-full px-2.5 py-1 text-[10px] font-medium border transition-colors',
                tramo === null ? 'bg-foreground text-background border-foreground' : 'border-border/50 text-muted-foreground hover:text-foreground hover:border-border')}
            >
              Todos
            </button>
            {tramos.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTramo(t)}
                className={cn('rounded-full px-2.5 py-1 text-[10px] font-medium border transition-colors',
                  tramo === t ? 'bg-foreground text-background border-foreground' : 'border-border/50 text-muted-foreground hover:text-foreground hover:border-border')}
              >
                Km {t}-{t + TRAMO_SIZE_KM - 1}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
        {error ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
            <AlertTriangle className="size-5 text-amber-500" />
            <span className="text-xs text-center">No se pudo cargar la evaluación de riesgo.<br />El servidor puede tardar hasta un minuto en despertar.</span>
            <button
              type="button"
              onClick={() => setRetryCount((v) => v + 1)}
              className="mt-1 rounded-md border border-border/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground hover:border-border"
            >
              Reintentar
            </button>
          </div>
        ) : kms === null ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2 rounded-xl border border-border/40 p-3.5">
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-3 w-2/5" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        ) : kms.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-1 text-muted-foreground text-center px-4">
            <span className="text-xs">Sin evaluación de riesgo cargada — súbela desde /admin/datos.</span>
          </div>
        ) : (
          visibles.map((km) => <KmCard key={km.id} km={km} />)
        )}
      </div>
    </div>
  );
}
