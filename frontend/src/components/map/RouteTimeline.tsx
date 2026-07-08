'use client';

import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { AlertTriangle, ChevronDown, ChevronUp, LoaderCircle, Route } from 'lucide-react';
import { cn } from '@/lib/utils';
import { subsampleRoute, haversineKm } from '@/lib/geo';
import { formatDistance, formatDuration } from '@/lib/incidents/format';
import type { RouteCalculatedData } from '@/components/routes/RoutePlanner';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ElevPoint {
  km: number;
  elevacion: number;
}

interface GoogleElevationResponse {
  results: Array<{ elevation: number }>;
  status: string;
  error_message?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: ElevPoint }>;
  label?: number;
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-background/95 px-2.5 py-1.5 text-[11px] shadow-lg backdrop-blur">
      <p className="font-semibold text-foreground">km {label?.toFixed(1)}</p>
      <p className="text-muted-foreground">
        {payload[0]!.payload.elevacion.toLocaleString('es-EC')} m.s.n.m.
      </p>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchElevation(
  routeData: RouteCalculatedData,
): Promise<{ elevPoints: ElevPoint[]; incidentKms: number[] }> {
  const samples = subsampleRoute(routeData.coords, 50);
  const locations = samples.map((s) => ({ lat: s.point[1], lng: s.point[0] }));

  const res = await fetch('/api/elevation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ locations }),
  });

  const raw = (await res.json()) as Partial<GoogleElevationResponse> & { error?: string };
  if (!res.ok || !raw.results) {
    throw new Error(raw.error ?? raw.error_message ?? raw.status ?? 'Error de elevación');
  }

  const elevPoints: ElevPoint[] = raw.results.map((r, i) => ({
    km: samples[i]!.km,
    elevacion: Math.round(r.elevation),
  }));

  // Posicionar cada incidente en el km más cercano del muestreo
  const incidentKms = routeData.incidents.map((inc) => {
    let bestKm = 0;
    let bestDist = Infinity;
    for (const s of samples) {
      const d = haversineKm(
        { lat: inc.latitude, lng: inc.longitude },
        { lat: s.point[1], lng: s.point[0] },
      );
      if (d < bestDist) { bestDist = d; bestKm = s.km; }
    }
    return bestKm;
  });

  return { elevPoints, incidentKms };
}

// ─── Componente ───────────────────────────────────────────────────────────────

interface Props {
  routeData: RouteCalculatedData | null;
}

export function RouteTimeline({ routeData }: Props) {
  const [open,         setOpen]         = useState(true);
  const [elevPoints,   setElevPoints]   = useState<ElevPoint[]>([]);
  const [incidentKms,  setIncidentKms]  = useState<number[]>([]);
  const [loading,      setLoading]      = useState(false);
  const [elevError,    setElevError]    = useState<string | null>(null);

  useEffect(() => {
    if (!routeData) {
      setElevPoints([]);
      setIncidentKms([]);
      return;
    }

    setLoading(true);
    setElevError(null);

    void fetchElevation(routeData)
      .then(({ elevPoints: ep, incidentKms: ik }) => {
        setElevPoints(ep);
        setIncidentKms(ik);
      })
      .catch((err: unknown) =>
        setElevError(err instanceof Error ? err.message : 'Error de elevación'),
      )
      .finally(() => setLoading(false));
  }, [routeData]);

  const criticalCount = routeData?.incidents.filter((i) => i.severity === 'critical').length ?? 0;

  return (
    <div
      className={cn(
        'shrink-0 border-t border-border/60 bg-background/95 backdrop-blur transition-all duration-300',
        open ? 'h-[22vh] min-h-[9rem]' : 'h-9',
      )}
    >
      {/* Encabezado */}
      <div className="flex h-9 shrink-0 items-center gap-3 border-b border-border/40 px-4">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 text-xs font-semibold text-foreground/80 transition-colors hover:text-foreground"
        >
          {open ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
          Perfil de elevación
        </button>

        {routeData && (
          <>
            <span className="h-3.5 w-px bg-border/60" />
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
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
              {elevError && (
                <span className="italic text-destructive/70">sin elevación</span>
              )}
            </div>
          </>
        )}
      </div>

      {/* Contenido */}
      {open && (
        routeData && elevPoints.length > 0 ? (
          <div className="h-[calc(22vh-2.25rem)] min-h-[calc(9rem-2.25rem)] px-2 pb-1 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={elevPoints} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="tlElevGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--color-primary)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.35} />
                <XAxis
                  dataKey="km"
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(v: number) => `${v.toFixed(0)} km`}
                  axisLine={false}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={['auto', 'auto']}
                  tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}k`}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                <Tooltip content={<CustomTooltip />} />

                {/* Marcadores de incidentes */}
                {incidentKms.map((km, i) => (
                  <ReferenceLine
                    key={i}
                    x={km}
                    stroke="hsl(var(--destructive))"
                    strokeDasharray="3 2"
                    strokeOpacity={0.65}
                    strokeWidth={1.5}
                  />
                ))}

                <Area
                  type="monotone"
                  dataKey="elevacion"
                  stroke="hsl(var(--primary))"
                  strokeWidth={1.5}
                  fill="url(#tlElevGradient)"
                  dot={false}
                  activeDot={{
                    r: 4,
                    fill: 'hsl(var(--primary))',
                    stroke: 'hsl(var(--background))',
                    strokeWidth: 2,
                  }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex h-[calc(22vh-2.25rem)] min-h-[calc(9rem-2.25rem)] items-center justify-center gap-3 text-muted-foreground/60">
            {loading ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <>
                <Route className="size-5 shrink-0" />
                <p className="text-sm">Calcula una ruta para ver el perfil de elevación</p>
              </>
            )}
          </div>
        )
      )}
    </div>
  );
}
