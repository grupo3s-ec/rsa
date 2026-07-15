'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  Bar, BarChart,
  CartesianGrid, Cell,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis, YAxis,
} from 'recharts';
import {
  AlertTriangle, Bell, ChevronLeft, ChevronRight, LoaderCircle,
  Mountain, CloudRain, Route, History, Flame, BarChart2, ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { subsampleRoute, haversineKm } from '@/lib/geo';
import { conditionMeta, formatDistance, formatDuration, severityMeta } from '@/lib/incidents/format';
import { CONDICION_META, getPerfilClimatico, mmToCondicion, mmToColor, MES_NOMBRE } from '@/lib/inamhi';
import { DATOS_PRECIPITACION, ESTACIONES_META } from '@/lib/precipitacion-data';
import { CalorPanel } from '@/components/analysis/CalorPanel';
import { ViaEstadoPanel } from '@/components/analysis/ViaEstadoPanel';
import { AntStatsPanel } from '@/components/analysis/AntStatsPanel';
import { EvaluacionRiesgoPanel } from '@/components/analysis/EvaluacionRiesgoPanel';
import type { RouteCalculatedData } from '@/components/routes/RoutePlanner';
import type { Incident } from '@/types/incident';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type TimelineTab = 'alertas' | 'perfil' | 'cierres' | 'vias' | 'ant' | 'riesgo';
interface ElevPoint { km: number; elevacion: number; }
interface GoogleElevationResponse {
  results: Array<{ elevation: number }>;
  status: string;
  error_message?: string;
}

const MES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const AÑO_MIN = 1980;
const AÑO_MAX = 2021;

// ─── Tooltips ────────────────────────────────────────────────────────────────

interface CombinedTooltipPoint {
  dataKey?: string;
  value?: number;
  payload: { estacion?: string; probLluviaPct?: number; aniosDatos?: number };
}

/** Tooltip único para el perfil combinado — muestra elevación y/o precipitación
 * según qué capas estén activas y tengan un punto cerca de ese km. */
function CombinedProfileTooltip({ active, payload, label }: { active?: boolean; payload?: CombinedTooltipPoint[]; label?: number }) {
  if (!active || !payload?.length) return null;
  const elev   = payload.find(p => p.dataKey === 'elevacion');
  const precip = payload.find(p => p.dataKey === 'mm');
  return (
    <div className="space-y-0.5 rounded-lg border border-border/60 bg-background/95 px-2.5 py-1.5 text-[11px] shadow-lg backdrop-blur">
      <p className="font-semibold">km {label?.toFixed(1)}</p>
      {elev && (
        <p className="text-muted-foreground">{elev.value!.toLocaleString('es-EC')} m.s.n.m.</p>
      )}
      {precip && (
        <>
          <p className="text-sky-500 font-medium">
            {precip.value!.toFixed(1)} mm/mes
            {precip.payload.estacion ? ` · ${precip.payload.estacion}` : ''}
          </p>
          {!!precip.payload.aniosDatos && (
            <p className="text-muted-foreground">
              Probabilidad de lluvia: <span className="text-foreground font-medium">{precip.payload.probLluviaPct}%</span>
              <span className="text-muted-foreground/60"> ({precip.payload.aniosDatos} años)</span>
            </p>
          )}
        </>
      )}
    </div>
  );
}

function HistorialTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-background/95 px-2.5 py-1.5 text-[11px] shadow-lg backdrop-blur">
      <p className="font-semibold">{label}</p>
      <p className="text-sky-500 font-medium">{payload[0]!.value.toFixed(1)} mm/mes</p>
    </div>
  );
}

// ─── Helpers historial ────────────────────────────────────────────────────────

function getHistorialMensual(codigos: string[], anoMin: number, anoMax: number) {
  const mesActual = new Date().getMonth();
  return MES_CORTO.map((mes, i) => {
    const vals = DATOS_PRECIPITACION
      .filter(d => codigos.includes(d.codigo) && d.anio >= anoMin && d.anio <= anoMax)
      .map(d => d.meses[i])
      .filter((v): v is number => v !== null);
    const mm = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length * 10) / 10 : 0;
    return { mes, mm, esMesActual: i === mesActual };
  });
}


// ─── Helper elevación ─────────────────────────────────────────────────────────

async function fetchElevation(routeData: RouteCalculatedData) {
  const samples = subsampleRoute(routeData.coords, 50);
  const locations = samples.map(s => ({ lat: s.point[1], lng: s.point[0] }));
  const res = await fetch('/api/elevation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locations }),
  });
  const raw = (await res.json()) as Partial<GoogleElevationResponse> & { error?: string };
  if (!res.ok || !raw.results) throw new Error(raw.error ?? raw.error_message ?? raw.status ?? 'Error');

  const haversineTotal = samples[samples.length - 1]?.km ?? 0;
  const roadTotalKm = routeData.distanceMeters / 1000;
  const scale = haversineTotal > 0 ? roadTotalKm / haversineTotal : 1;

  const elevPoints: ElevPoint[] = raw.results.map((r, i) => ({
    km: Math.round(samples[i]!.km * scale * 10) / 10,
    elevacion: Math.round(r.elevation),
  }));
  const incidentKms = routeData.incidents.map(inc => {
    let bestKm = 0, bestDist = Infinity;
    for (const s of samples) {
      const d = haversineKm({ lat: inc.latitude, lng: inc.longitude }, { lat: s.point[1], lng: s.point[0] });
      if (d < bestDist) { bestDist = d; bestKm = s.km; }
    }
    return Math.round(bestKm * scale * 10) / 10;
  });
  return { elevPoints, incidentKms };
}

// ─── Componente ───────────────────────────────────────────────────────────────

interface Props {
  routeData: RouteCalculatedData | null;
  onSelectIncident?: (incident: Incident) => void;
  selectedIncidentId?: number | null;
  /** Provincias con restricciones viales cercanas a la ruta calculada (para el tab Cierres). */
  conflictProvinces?: string[] | null;
}

export function RouteTimeline({ routeData, onSelectIncident, selectedIncidentId, conflictProvinces }: Props) {
  const [open,         setOpen]         = useState(true);
  const [tab,          setTab]          = useState<TimelineTab>('alertas');
  const [showAltimetria, setShowAltimetria] = useState(true);
  const [showClima,      setShowClima]      = useState(true);
  const [showHistorial,setShowHistorial]= useState(false);
  const [elevPoints,   setElevPoints]   = useState<ElevPoint[]>([]);
  const [incidentKms,  setIncidentKms]  = useState<number[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [elevError,    setElevError]    = useState<string | null>(null);
  const [anoMin,       setAnoMin]       = useState(AÑO_MIN);
  const [anoMax,       setAnoMax]       = useState(AÑO_MAX);

  const mesActual = new Date().getMonth();

  useEffect(() => {
    if (!routeData) { setElevPoints([]); setIncidentKms([]); return; }
    setLoading(true); setElevError(null);
    void fetchElevation(routeData)
      .then(({ elevPoints: ep, incidentKms: ik }) => { setElevPoints(ep); setIncidentKms(ik); })
      .catch((err: unknown) => setElevError(err instanceof Error ? err.message : 'Error'))
      .finally(() => setLoading(false));
  }, [routeData]);

  // Posición km de cada incidente sobre la ruta
  const incidentPositions = useMemo(() => {
    if (!routeData || routeData.incidents.length === 0) return [];
    const samples = subsampleRoute(routeData.coords, 150);
    const haversineTotal = samples[samples.length - 1]?.km ?? 0;
    const roadTotalKm    = routeData.distanceMeters / 1000;
    const scale          = haversineTotal > 0 ? roadTotalKm / haversineTotal : 1;
    return routeData.incidents.map(inc => {
      let bestKm = 0, bestDist = Infinity;
      for (const s of samples) {
        const d = haversineKm({ lat: inc.latitude, lng: inc.longitude }, { lat: s.point[1], lng: s.point[0] });
        if (d < bestDist) { bestDist = d; bestKm = s.km; }
      }
      return { inc, km: Math.round(bestKm * scale * 10) / 10 };
    }).sort((a, b) => a.km - b.km);
  }, [routeData]);

  // Perfil de precipitación por km (datos INAMHI, mes actual)
  const precipKmData = useMemo(() => {
    if (!routeData) return [];
    return getPerfilClimatico(routeData.coords, routeData.distanceMeters, mesActual);
  }, [routeData, mesActual]);

  // Altimetría y clima comparten el mismo muestreo por índice (ambos subsample-an
  // los mismos coords con n=50) — se combinan en un solo array para el gráfico,
  // ya que recharts no admite un `data` distinto por serie dentro de un Bar.
  const perfilChartData = useMemo(() => {
    const len = Math.max(elevPoints.length, precipKmData.length);
    const rows: Array<{ km: number; elevacion?: number; mm?: number; estacion?: string; probLluviaPct?: number; aniosDatos?: number }> = [];
    for (let i = 0; i < len; i++) {
      const e = elevPoints[i];
      const p = precipKmData[i];
      rows.push({
        km: e?.km ?? p?.km ?? 0,
        elevacion: e?.elevacion,
        mm: p?.mm,
        estacion: p?.estacion,
        probLluviaPct: p?.probLluviaPct,
        aniosDatos: p?.aniosDatos,
      });
    }
    return rows;
  }, [elevPoints, precipKmData]);

  // Estaciones más cercanas para historial
  const estacionesCercanas = useMemo(() => {
    if (!routeData) return ESTACIONES_META.slice(0, 2);
    const sample = routeData.coords.filter((_, i) => i % Math.max(1, Math.floor(routeData.coords.length / 20)) === 0);
    return [...ESTACIONES_META]
      .map(e => ({ e, d: Math.min(...sample.map(c => haversineKm({ lat: e.lat, lng: e.lng }, { lat: c[1], lng: c[0] }))) }))
      .sort((a, b) => a.d - b.d).slice(0, 2).map(x => x.e);
  }, [routeData]);

  const historialData = useMemo(
    () => getHistorialMensual(estacionesCercanas.map(e => e.codigo), anoMin, anoMax),
    [estacionesCercanas, anoMin, anoMax],
  );

  const totalMmAno = useMemo(
    () => historialData.reduce((s, d) => s + (d.mm ?? 0), 0),
    [historialData],
  );

  const criticalCount = routeData?.incidents.filter(i => i.severity === 'critical').length ?? 0;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Mostrar alertas, altimetría y clima"
        className="flex h-full w-10 shrink-0 flex-col items-center gap-2 border-l border-border/60 bg-background/95 py-3 text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        <span className="[writing-mode:vertical-rl] text-[11px] font-medium tracking-wide">
          Alertas · Altimetría · Clima
        </span>
      </button>
    );
  }

  return (
    <div className="flex h-full w-1/3 min-w-[300px] max-w-[480px] shrink-0 flex-col border-l border-border/60 bg-background/95 backdrop-blur">
      {/* ── Encabezado ── */}
      <div className="flex shrink-0 flex-col gap-2 border-b border-border/40 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          {/* Tabs */}
          <div className="flex flex-wrap items-center gap-0.5 rounded-lg border border-border/50 bg-muted/40 p-0.5">
            <button type="button" onClick={() => setTab('alertas')}
              className={cn('relative flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors',
                tab === 'alertas' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              <Bell className="size-3" /> Alertas
              {(routeData?.incidents.length ?? 0) > 0 && (
                <span className={cn('ml-0.5 rounded-full px-1 text-[9px] font-bold',
                  (routeData?.incidents.some(i => i.severity === 'critical')) ? 'bg-red-500 text-white' : 'bg-amber-500 text-white')}>
                  {routeData!.incidents.length}
                </span>
              )}
            </button>
            <button type="button" onClick={() => setTab('perfil')}
              className={cn('flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors',
                tab === 'perfil' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              <Mountain className="size-3" /> Altimetría · Clima
            </button>
            <button type="button" onClick={() => setTab('cierres')} title="Cierres Viales"
              className={cn('flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors',
                tab === 'cierres' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              <Flame className="size-3" /> Cierres
            </button>
            <button type="button" onClick={() => setTab('vias')} title="Estado Vías ECU911"
              className={cn('flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors',
                tab === 'vias' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              <Route className="size-3" /> Vías
            </button>
            <button type="button" onClick={() => setTab('ant')} title="ANT"
              className={cn('flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors',
                tab === 'ant' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              <BarChart2 className="size-3" /> ANT
            </button>
            <button type="button" onClick={() => setTab('riesgo')} title="Evaluación de Riesgo"
              className={cn('flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors',
                tab === 'riesgo' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              <ShieldCheck className="size-3" /> Riesgo
            </button>
          </div>

          <button type="button" onClick={() => setOpen(false)}
            aria-label="Ocultar panel"
            className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground">
            <ChevronRight className="size-3.5" />
          </button>
        </div>

        {/* Info contextual */}
        {tab === 'perfil' && (
          <div className="flex flex-col gap-1.5">
            {routeData && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                <span>{formatDistance(routeData.distanceMeters)}</span>
                <span className="text-border/60">·</span>
                <span>{formatDuration(routeData.durationSeconds)}</span>
                {routeData.incidents.length > 0 && (
                  <>
                    <span className="text-border/60">·</span>
                    <span className={cn('flex items-center gap-1', criticalCount > 0 ? 'text-red-500' : 'text-amber-500')}>
                      <AlertTriangle className="size-3" />
                      {routeData.incidents.length} alerta{routeData.incidents.length !== 1 ? 's' : ''}
                    </span>
                  </>
                )}
                {loading && <LoaderCircle className="size-3 animate-spin" />}
                {elevError && <span className="italic text-destructive/70">sin elevación</span>}
              </div>
            )}

            {/* Toggles de capas — se superponen en un mismo gráfico */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button type="button" onClick={() => setShowAltimetria(v => !v)}
                className={cn('flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors',
                  showAltimetria
                    ? 'border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-400'
                    : 'border-border/50 text-muted-foreground hover:text-foreground')}>
                <Mountain className="size-3" /> Altimetría
              </button>
              <button type="button" onClick={() => setShowClima(v => !v)}
                className={cn('flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors',
                  showClima
                    ? 'border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400'
                    : 'border-border/50 text-muted-foreground hover:text-foreground')}>
                <CloudRain className="size-3" /> Clima
              </button>
              {showClima && (
                <button type="button" onClick={() => setShowHistorial(h => !h)}
                  className={cn('ml-auto flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium transition-colors',
                    showHistorial
                      ? 'border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-400'
                      : 'border-border/50 text-muted-foreground hover:text-foreground')}>
                  <History className="size-3" />
                  {showHistorial ? 'Por km' : 'Historial'}
                </button>
              )}
            </div>

            {!showHistorial && showClima && precipKmData.length > 0 && (
              <span className="text-[11px] text-muted-foreground">
                {MES_NOMBRE[mesActual]} · Estimación INAMHI
              </span>
            )}
            {showHistorial && showClima && (
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                <select value={anoMin} onChange={e => setAnoMin(Math.min(Number(e.target.value), anoMax))}
                  className="rounded border border-border/50 bg-background px-1 py-0.5 text-[11px] text-foreground">
                  {Array.from({ length: AÑO_MAX - AÑO_MIN + 1 }, (_, i) => AÑO_MIN + i).map(y =>
                    <option key={y} value={y}>{y}</option>)}
                </select>
                <span>–</span>
                <select value={anoMax} onChange={e => setAnoMax(Math.max(Number(e.target.value), anoMin))}
                  className="rounded border border-border/50 bg-background px-1 py-0.5 text-[11px] text-foreground">
                  {Array.from({ length: AÑO_MAX - AÑO_MIN + 1 }, (_, i) => AÑO_MIN + i).map(y =>
                    <option key={y} value={y}>{y}</option>)}
                </select>
                <span className="text-sky-500 font-medium">{Math.round(totalMmAno)} mm/año</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Contenido ── */}
      <div className="min-h-0 flex-1">
        {tab === 'alertas' ? (
          <div className="h-full flex flex-col px-4 py-3 gap-2">
            {!routeData ? (
              <div className="flex h-full items-center justify-center gap-2 text-muted-foreground/60">
                <Route className="size-4 shrink-0" />
                <p className="text-sm">Calcula una ruta para ver las alertas en camino</p>
              </div>
            ) : routeData.incidents.length === 0 ? (
              <div className="flex h-full items-center justify-center gap-2 text-muted-foreground/60">
                <span className="text-lg">✅</span>
                <p className="text-sm">Ruta despejada — sin incidentes reportados</p>
              </div>
            ) : (() => {
              const totalKm = routeData.distanceMeters / 1000;
              return (
                <>
                  {/* Trazado de ruta con pines posicionados por km */}
                  <div className="relative pt-8 pb-4 shrink-0">
                    {/* Línea de ruta */}
                    <div className="relative h-1.5 rounded-full bg-border/50 mx-1">
                      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary/50 via-primary/30 to-primary/20" />
                      {/* Punto de inicio */}
                      <span className="absolute -left-1 top-1/2 -translate-y-1/2 size-3 rounded-full bg-emerald-500 border-2 border-background shadow-sm" />
                      {/* Punto de fin */}
                      <span className="absolute -right-1 top-1/2 -translate-y-1/2 size-3 rounded-full bg-slate-700 dark:bg-slate-300 border-2 border-background shadow-sm" />

                      {/* Pines de incidentes */}
                      {incidentPositions.map(({ inc, km }, idx) => {
                        const sev  = severityMeta[inc.severity];
                        const Icon = conditionMeta[inc.condition ?? 'fisica'].icon;
                        const pct  = Math.min(98, Math.max(2, (km / totalKm) * 100));
                        const isSelected = selectedIncidentId === inc.id;
                        // Alterna arriba/abajo para incidentes solapados
                        const up = idx % 2 === 0;
                        return (
                          <button
                            key={inc.id}
                            type="button"
                            title={`km ${km} · ${inc.title}`}
                            onClick={() => onSelectIncident?.(inc)}
                            className={cn(
                              'absolute -translate-x-1/2 flex flex-col items-center transition-transform hover:scale-110 focus:outline-none',
                              up ? 'bottom-[calc(50%+2px)]' : 'top-[calc(50%+2px)]',
                              isSelected && 'scale-125',
                            )}
                            style={{ left: `${pct}%` }}
                          >
                            {up && (
                              <>
                                <span className="flex size-6 items-center justify-center rounded-full border-2 border-background text-white shadow-md"
                                  style={{ backgroundColor: sev.hex }}>
                                  <Icon className="size-3" />
                                </span>
                                <span className="w-px h-2 opacity-60" style={{ backgroundColor: sev.hex }} />
                              </>
                            )}
                            {!up && (
                              <>
                                <span className="w-px h-2 opacity-60" style={{ backgroundColor: sev.hex }} />
                                <span className="flex size-6 items-center justify-center rounded-full border-2 border-background text-white shadow-md"
                                  style={{ backgroundColor: sev.hex }}>
                                  <Icon className="size-3" />
                                </span>
                              </>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Eje km */}
                    <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground px-1">
                      <span>0 km</span>
                      <span>{Math.round(totalKm / 2)} km</span>
                      <span>{Math.round(totalKm)} km</span>
                    </div>
                  </div>

                  {/* Lista compacta ordenada por km */}
                  <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
                    {incidentPositions.map(({ inc, km }) => {
                      const sev  = severityMeta[inc.severity];
                      const Icon = conditionMeta[inc.condition ?? 'fisica'].icon;
                      const isSelected = selectedIncidentId === inc.id;
                      return (
                        <button
                          key={inc.id}
                          type="button"
                          onClick={() => onSelectIncident?.(inc)}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted/60',
                            isSelected && 'bg-muted/60 ring-1 ring-ring/30',
                          )}
                        >
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full text-white"
                            style={{ backgroundColor: sev.hex }}>
                            <Icon className="size-2.5" />
                          </span>
                          <span className="text-[10px] font-medium text-muted-foreground tabular-nums w-12 shrink-0">km {km}</span>
                          <span className="flex-1 truncate text-[11px] font-medium text-foreground">{inc.title}</span>
                          <span className={cn('shrink-0 text-[9px] font-semibold uppercase', sev.textClass)}>{sev.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </>
              );
            })()}
          </div>
        ) : tab === 'perfil' ? (
          /* ── Tab Perfil: Altimetría + Clima superpuestos en un solo gráfico ── */
          !routeData ? (
            <div className="flex h-full items-center justify-center gap-3 text-muted-foreground/60">
              <Route className="size-5 shrink-0" />
              <p className="text-sm">Calcula una ruta para ver el perfil</p>
            </div>
          ) : showHistorial && showClima ? (
            /* Vista historial de precipitación: barras mensuales */
            <div className="flex h-full flex-col px-2 pb-1 pt-1.5">
              <p className="mb-1 text-[10px] text-muted-foreground/70">
                Datos INAMHI {anoMin}–{anoMax} · Estaciones: {estacionesCercanas.map(e => e.nombre.split('-')[0]?.trim()).join(', ')}
              </p>
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={historialData} margin={{ top: 2, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.35} />
                    <XAxis dataKey="mes" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} width={32} unit=" mm" />
                    <Tooltip content={<HistorialTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }} />
                    <Bar dataKey="mm" radius={[3, 3, 0, 0]} maxBarSize={28}>
                      {historialData.map((d, i) => (
                        <Cell key={i} fill={mmToColor(d.mm)} opacity={d.esMesActual ? 1 : 0.7} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : !showAltimetria && !showClima ? (
            <div className="flex h-full items-center justify-center gap-3 text-muted-foreground/60">
              <p className="text-sm">Activa Altimetría o Clima para ver el gráfico</p>
            </div>
          ) : (showAltimetria && elevPoints.length === 0 && loading) ? (
            <div className="flex h-full items-center justify-center gap-3 text-muted-foreground/60">
              <LoaderCircle className="size-4 animate-spin" />
            </div>
          ) : (
            <div className="flex h-full flex-col px-2 pb-1 pt-2 gap-1.5">
              {/* Franja de condiciones por km — mismos colores/íconos que el tab Clima */}
              {showClima && precipKmData.length > 0 && (
                <div className="flex shrink-0 gap-px h-6 rounded-lg overflow-hidden">
                  {precipKmData.map((d, i) => {
                    const C = CONDICION_META[mmToCondicion(d.mm)];
                    return (
                      <div key={i}
                        title={`km ${d.km.toFixed(1)} — ${C.label} · ${d.mm} mm`}
                        className="flex flex-1 items-center justify-center cursor-default transition-opacity hover:opacity-80"
                        style={{ backgroundColor: mmToColor(d.mm) }}>
                        <C.icon className="size-2.5 text-white/85 drop-shadow" />
                      </div>
                    );
                  })}
                </div>
              )}
              <div className="min-h-0 flex-1">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={perfilChartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                  <defs>
                    {/*
                      Paleta estilo mapa topográfico físico:
                      cima (top SVG = elevación alta) → falda → valle (bottom SVG = base)
                      rojo-naranja: >3500 m (páramo/nieve)
                      ámbar:        2000-3500 m (sierra alta)
                      verde olivo:  1000-2000 m (sierra media/valles)
                      verde:        500-1000 m  (estribaciones)
                      cian→azul:    <500 m      (costa/amazonia baja)
                    */}
                    <linearGradient id="tlElevTopoFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor="#dc2626" stopOpacity={0.92} />
                      <stop offset="12%"  stopColor="#ea580c" stopOpacity={0.88} />
                      <stop offset="28%"  stopColor="#d97706" stopOpacity={0.82} />
                      <stop offset="44%"  stopColor="#84cc16" stopOpacity={0.72} />
                      <stop offset="60%"  stopColor="#16a34a" stopOpacity={0.62} />
                      <stop offset="76%"  stopColor="#0891b2" stopOpacity={0.48} />
                      <stop offset="90%"  stopColor="#1d4ed8" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.04} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.35} />
                  <XAxis dataKey="km" type="number" domain={['dataMin', 'dataMax']}
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(v: number) => `${v.toFixed(0)} km`} axisLine={false} tickLine={false} />
                  {showAltimetria && (
                    <YAxis yAxisId="elev" domain={['auto', 'auto']} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}k`} axisLine={false} tickLine={false} width={36} />
                  )}
                  {showClima && (
                    <YAxis yAxisId="precip" orientation="right" domain={[0, 'auto']} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(v: number) => `${v}`} axisLine={false} tickLine={false} width={32} unit=" mm" />
                  )}
                  <Tooltip content={<CombinedProfileTooltip />} />
                  {incidentKms.map((km, i) => (
                    <ReferenceLine key={i} x={km} yAxisId={showAltimetria ? 'elev' : 'precip'}
                      stroke="rgba(148,163,184,0.75)" strokeDasharray="3 2" strokeWidth={1.5} />
                  ))}
                  {showAltimetria && (
                    <Area yAxisId="elev" dataKey="elevacion" type="monotone"
                      stroke="rgba(255,255,255,0.82)" strokeWidth={1.8}
                      fill="url(#tlElevTopoFill)" dot={false} connectNulls
                      activeDot={{ r: 4, fill: '#ffffff', stroke: '#ea580c', strokeWidth: 2 }} />
                  )}
                  {showClima && (
                    <Bar yAxisId="precip" dataKey="mm"
                      radius={[2, 2, 0, 0]} maxBarSize={10} fillOpacity={0.6}>
                      {perfilChartData.map((d, i) => (
                        <Cell key={i} fill={d.mm !== undefined ? mmToColor(d.mm) : 'transparent'} />
                      ))}
                    </Bar>
                  )}
                </ComposedChart>
              </ResponsiveContainer>
              </div>
            </div>
          )
        ) : tab === 'cierres' ? (
          <CalorPanel filterProvinces={routeData ? (conflictProvinces ?? null) : null} />
        ) : tab === 'vias' ? (
          <ViaEstadoPanel conflictProvinces={routeData ? (conflictProvinces ?? null) : null} />
        ) : tab === 'ant' ? (
          <AntStatsPanel />
        ) : (
          <EvaluacionRiesgoPanel />
        )}
      </div>
    </div>
  );
}
