'use client';

import { useEffect, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { TrendingDown, TrendingUp, Mountain, LoaderCircle } from 'lucide-react';
import { subsampleRoute } from '@/lib/geo';
import type { LngLat } from '@/lib/mapbox/directions';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface ElevPoint {
  km: number;
  elevacion: number;
}

interface GoogleElevationResponse {
  results: Array<{ elevation: number; location: { lat: number; lng: number } }>;
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
  const d = payload[0]!.payload;
  return (
    <div className="rounded-xl border border-border/60 bg-background/95 px-3 py-2 text-xs shadow-lg backdrop-blur">
      <p className="mb-1 font-semibold text-foreground">km {label?.toFixed(1)}</p>
      <p className="text-muted-foreground">
        Elevación:{' '}
        <span className="font-medium text-foreground">{d.elevacion.toLocaleString('es-EC')} m</span>
      </p>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchElevation(coords: LngLat[]): Promise<ElevPoint[]> {
  const samples = subsampleRoute(coords, 50);
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

  return raw.results.map((r, i) => ({
    km: samples[i]!.km,
    elevacion: Math.round(r.elevation),
  }));
}

// ─── Componente ───────────────────────────────────────────────────────────────

interface Props {
  routeCoords?: LngLat[] | null;
}

export function AltimetriaPanel({ routeCoords }: Props) {
  const [data,    setData]    = useState<ElevPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!routeCoords || routeCoords.length === 0) {
      setData([]);
      return;
    }

    setLoading(true);
    setError(null);

    void fetchElevation(routeCoords)
      .then(setData)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : 'Error al cargar elevación'),
      )
      .finally(() => setLoading(false));
  }, [routeCoords]);

  // ── Stats derivadas ──────────────────────────────────────────────────────────
  const maxElev = data.length > 0 ? Math.max(...data.map((d) => d.elevacion)) : null;
  const minElev = data.length > 0 ? Math.min(...data.map((d) => d.elevacion)) : null;

  let ascent = 0, descent = 0;
  for (let i = 1; i < data.length; i++) {
    const diff = data[i]!.elevacion - data[i - 1]!.elevacion;
    if (diff > 0) ascent  += diff;
    else          descent += Math.abs(diff);
  }

  return (
    <div className="flex h-full flex-col gap-6 bg-background p-6">

      {/* Encabezado */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Mountain className="size-4 text-primary" />
            Perfil de Altimetría
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {data.length > 0
              ? `${data.length} muestras · Elevation API`
              : 'Calcula una ruta para ver el perfil de elevación'}
          </p>
        </div>

        {data.length > 0 && (
          <div className="flex flex-wrap gap-4 text-xs">
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-muted-foreground">Punto más alto</span>
              <span className="font-semibold text-foreground">{maxElev?.toLocaleString('es-EC')} m</span>
            </div>
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-muted-foreground">Punto más bajo</span>
              <span className="font-semibold text-foreground">{minElev?.toLocaleString('es-EC')} m</span>
            </div>
            <span className="flex items-center gap-1.5 font-medium text-emerald-500">
              <TrendingUp className="size-3.5" />+{ascent.toLocaleString('es-EC')} m
            </span>
            <span className="flex items-center gap-1.5 font-medium text-red-400">
              <TrendingDown className="size-3.5" />−{descent.toLocaleString('es-EC')} m
            </span>
          </div>
        )}
      </div>

      {/* Área central */}
      <div className="flex min-h-0 flex-1 items-center justify-center">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            Cargando perfil de elevación…
          </div>
        ) : error ? (
          <p className="max-w-xs text-center text-sm text-destructive">{error}</p>
        ) : data.length === 0 ? (
          <div className="flex flex-col items-center gap-2 text-muted-foreground/60">
            <Mountain className="size-8" />
            <p className="text-sm">Sin ruta calculada</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="elevGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--color-primary)" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
              <XAxis
                dataKey="km"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(v: number) => `km ${v.toFixed(0)}`}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={['auto', 'auto']}
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}k`}
                axisLine={false}
                tickLine={false}
                width={44}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="elevacion"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                fill="url(#elevGradient)"
                dot={false}
                activeDot={{
                  r: 5,
                  fill: 'hsl(var(--primary))',
                  stroke: 'hsl(var(--background))',
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Leyenda */}
      {data.length > 0 && (
        <div className="flex items-center gap-4 border-t border-border/40 pt-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm bg-primary/60" />
            Elevación (m.s.n.m.)
          </span>
          <span>Google Elevation API · {data.length} puntos</span>
        </div>
      )}
    </div>
  );
}
