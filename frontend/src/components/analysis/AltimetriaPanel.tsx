'use client';

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
import { TrendingDown, TrendingUp, Mountain, AlertTriangle } from 'lucide-react';

interface ElevPoint {
  km: number;
  elevacion: number;
  incidents: number;
}

// Perfil de elevación referencial — ruta tipo Quito → valle
const DATA: ElevPoint[] = [
  { km: 0,  elevacion: 2820, incidents: 0 },
  { km: 1,  elevacion: 2870, incidents: 1 },
  { km: 2,  elevacion: 2940, incidents: 0 },
  { km: 3,  elevacion: 3020, incidents: 0 },
  { km: 4,  elevacion: 3110, incidents: 2 },
  { km: 5,  elevacion: 3180, incidents: 0 },
  { km: 6,  elevacion: 3090, incidents: 1 },
  { km: 7,  elevacion: 2980, incidents: 0 },
  { km: 8,  elevacion: 2860, incidents: 0 },
  { km: 9,  elevacion: 2760, incidents: 1 },
  { km: 10, elevacion: 2680, incidents: 0 },
  { km: 11, elevacion: 2620, incidents: 0 },
  { km: 12, elevacion: 2560, incidents: 0 },
  { km: 13, elevacion: 2500, incidents: 2 },
  { km: 14, elevacion: 2460, incidents: 0 },
  { km: 15, elevacion: 2430, incidents: 0 },
  { km: 16, elevacion: 2410, incidents: 1 },
  { km: 17, elevacion: 2400, incidents: 0 },
  { km: 18, elevacion: 2390, incidents: 0 },
];

const maxElev   = Math.max(...DATA.map(d => d.elevacion));
const minElev   = Math.min(...DATA.map(d => d.elevacion));
const ascending = DATA.filter((d, i) => i > 0 && d.elevacion > DATA[i - 1]!.elevacion).reduce((s, d, i) => s + (d.elevacion - DATA[DATA.indexOf(d) - 1]!.elevacion), 0);
const descend   = DATA.filter((d, i) => i > 0 && d.elevacion < DATA[i - 1]!.elevacion).reduce((s, d, i) => s + (DATA[DATA.indexOf(d) - 1]!.elevacion - d.elevacion), 0);
const critZones = DATA.filter(d => d.incidents >= 2).length;

interface TooltipPayload { value: number; }
interface CustomTooltipProps {
  active?: boolean;
  payload?: { payload: ElevPoint; value: number }[];
  label?: number;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0]!.payload;
  return (
    <div className="rounded-xl border border-border/60 bg-background/95 px-3 py-2 shadow-lg text-xs backdrop-blur">
      <p className="font-semibold text-foreground mb-1">km {label}</p>
      <p className="text-muted-foreground">Elevación: <span className="text-foreground font-medium">{d.elevacion.toLocaleString()} m</span></p>
      {d.incidents > 0 && (
        <p className="text-red-500 mt-0.5">⚠ {d.incidents} incidente{d.incidents > 1 ? 's' : ''}</p>
      )}
    </div>
  );
}

export function AltimetriaPanel() {
  return (
    <div className="flex h-full flex-col bg-background p-6 gap-6">
      {/* Encabezado */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Mountain className="size-4 text-primary" />
            Perfil de Altimetría
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Elevación por kilómetro de ruta · datos referenciales
          </p>
        </div>

        {/* Stats rápidas */}
        <div className="flex gap-4 text-xs">
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-muted-foreground">Punto más alto</span>
            <span className="font-semibold text-foreground">{maxElev.toLocaleString()} m</span>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-muted-foreground">Punto más bajo</span>
            <span className="font-semibold text-foreground">{minElev.toLocaleString()} m</span>
          </div>
          <div className="flex items-center gap-1.5 text-emerald-500 font-medium">
            <TrendingUp className="size-3.5" />
            +{ascending.toLocaleString()} m
          </div>
          <div className="flex items-center gap-1.5 text-red-400 font-medium">
            <TrendingDown className="size-3.5" />
            −{descend.toLocaleString()} m
          </div>
          {critZones > 0 && (
            <div className="flex items-center gap-1.5 text-amber-500 font-medium">
              <AlertTriangle className="size-3.5" />
              {critZones} zona{critZones > 1 ? 's' : ''} crítica{critZones > 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {/* Gráfico */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={DATA} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
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
              tickFormatter={(v: number) => `km ${v}`}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={['auto', 'auto']}
              tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}k m`}
              axisLine={false}
              tickLine={false}
              width={52}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Líneas de referencia en zonas con incidentes */}
            {DATA.filter(d => d.incidents >= 2).map(d => (
              <ReferenceLine
                key={d.km}
                x={d.km}
                stroke="hsl(var(--destructive))"
                strokeDasharray="4 2"
                strokeOpacity={0.6}
              />
            ))}

            <Area
              type="monotone"
              dataKey="elevacion"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#elevGradient)"
              dot={false}
              activeDot={{ r: 5, fill: 'hsl(var(--primary))', stroke: 'hsl(var(--background))', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-6 text-[11px] text-muted-foreground border-t border-border/40 pt-3">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-primary/60" />
          Elevación (m.s.n.m.)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-5 border-t-2 border-dashed border-destructive/60" />
          Zona con múltiples incidentes
        </span>
      </div>
    </div>
  );
}
