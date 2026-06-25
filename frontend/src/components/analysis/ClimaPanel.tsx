'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Cloud, CloudRain, Sun, Wind, Thermometer, CloudLightning } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WeatherPoint {
  km: number;
  tempC: number;
  rainPct: number;
  windKmh: number;
  cond: 'sunny' | 'cloudy' | 'rain' | 'storm';
}

// Pronóstico dummy para una ruta Quito → Tumbaco
const DATA: WeatherPoint[] = [
  { km: 0,  tempC: 18, rainPct: 8,  windKmh: 12, cond: 'sunny'  },
  { km: 1,  tempC: 18, rainPct: 10, windKmh: 14, cond: 'sunny'  },
  { km: 2,  tempC: 17, rainPct: 15, windKmh: 14, cond: 'cloudy' },
  { km: 3,  tempC: 17, rainPct: 22, windKmh: 16, cond: 'cloudy' },
  { km: 4,  tempC: 16, rainPct: 35, windKmh: 18, cond: 'rain'   },
  { km: 5,  tempC: 15, rainPct: 48, windKmh: 20, cond: 'rain'   },
  { km: 6,  tempC: 14, rainPct: 62, windKmh: 22, cond: 'rain'   },
  { km: 7,  tempC: 14, rainPct: 70, windKmh: 25, cond: 'storm'  },
  { km: 8,  tempC: 13, rainPct: 75, windKmh: 28, cond: 'storm'  },
  { km: 9,  tempC: 14, rainPct: 60, windKmh: 24, cond: 'rain'   },
  { km: 10, tempC: 15, rainPct: 45, windKmh: 20, cond: 'rain'   },
  { km: 11, tempC: 16, rainPct: 30, windKmh: 18, cond: 'cloudy' },
  { km: 12, tempC: 17, rainPct: 20, windKmh: 15, cond: 'cloudy' },
  { km: 13, tempC: 18, rainPct: 15, windKmh: 14, cond: 'cloudy' },
  { km: 14, tempC: 19, rainPct: 10, windKmh: 12, cond: 'sunny'  },
  { km: 15, tempC: 20, rainPct: 8,  windKmh: 10, cond: 'sunny'  },
  { km: 16, tempC: 21, rainPct: 5,  windKmh: 9,  cond: 'sunny'  },
  { km: 17, tempC: 22, rainPct: 5,  windKmh: 8,  cond: 'sunny'  },
  { km: 18, tempC: 22, rainPct: 5,  windKmh: 8,  cond: 'sunny'  },
];

const COND_META: Record<WeatherPoint['cond'], { icon: React.ElementType; label: string; color: string }> = {
  sunny:  { icon: Sun,            label: 'Despejado',  color: 'text-yellow-400' },
  cloudy: { icon: Cloud,          label: 'Nublado',    color: 'text-slate-400'  },
  rain:   { icon: CloudRain,      label: 'Lluvia',     color: 'text-sky-500'    },
  storm:  { icon: CloudLightning, label: 'Tormenta',   color: 'text-violet-500' },
};

function rainColor(pct: number): string {
  if (pct >= 70) return '#7c3aed';
  if (pct >= 50) return '#0ea5e9';
  if (pct >= 30) return '#38bdf8';
  if (pct >= 15) return '#93c5fd';
  return '#bfdbfe';
}

interface TooltipProps {
  active?: boolean;
  payload?: { payload: WeatherPoint }[];
  label?: number;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0]!.payload;
  const C = COND_META[d.cond];
  return (
    <div className="rounded-xl border border-border/60 bg-background/95 px-3 py-2 shadow-lg text-xs backdrop-blur">
      <p className="font-semibold mb-1">km {label}</p>
      <p className="flex items-center gap-1"><C.icon className={cn('size-3', C.color)} /> {C.label}</p>
      <p className="text-muted-foreground">Temp: <span className="text-foreground font-medium">{d.tempC}°C</span></p>
      <p className="text-muted-foreground">Lluvia: <span className="text-sky-500 font-medium">{d.rainPct}%</span></p>
      <p className="text-muted-foreground">Viento: <span className="text-foreground font-medium">{d.windKmh} km/h</span></p>
    </div>
  );
}

export function ClimaPanel() {
  const maxRain = Math.max(...DATA.map(d => d.rainPct));
  const avgTemp = Math.round(DATA.reduce((s, d) => s + d.tempC, 0) / DATA.length);
  const stormKm = DATA.filter(d => d.cond === 'storm').length;
  const rainKm  = DATA.filter(d => d.rainPct >= 40).length;

  return (
    <div className="flex h-full flex-col bg-background p-6 gap-6 overflow-y-auto">
      {/* Encabezado */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <CloudRain className="size-4 text-sky-500" />
            Pronóstico Climático por Ruta
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Condiciones estimadas por kilómetro · datos referenciales
          </p>
        </div>

        <div className="flex gap-5 text-xs">
          <div className="flex flex-col items-center gap-0.5">
            <Thermometer className="size-4 text-orange-400" />
            <span className="font-bold text-foreground text-sm">{avgTemp}°C</span>
            <span className="text-muted-foreground">promedio</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <CloudRain className="size-4 text-sky-500" />
            <span className="font-bold text-sky-500 text-sm">{rainKm} km</span>
            <span className="text-muted-foreground">con lluvia</span>
          </div>
          {stormKm > 0 && (
            <div className="flex flex-col items-center gap-0.5">
              <CloudLightning className="size-4 text-violet-500" />
              <span className="font-bold text-violet-500 text-sm">{stormKm} km</span>
              <span className="text-muted-foreground">tormenta</span>
            </div>
          )}
          <div className="flex flex-col items-center gap-0.5">
            <Cloud className="size-4 text-amber-400" />
            <span className="font-bold text-foreground text-sm">{maxRain}%</span>
            <span className="text-muted-foreground">máx lluvia</span>
          </div>
        </div>
      </div>

      {/* Franja de condiciones por km */}
      <div className="flex gap-px h-10 rounded-xl overflow-hidden">
        {DATA.map(d => {
          const C = COND_META[d.cond];
          return (
            <div
              key={d.km}
              title={`km ${d.km} — ${C.label} · ${d.rainPct}% lluvia · ${d.tempC}°C`}
              className="flex flex-1 items-center justify-center cursor-default transition-opacity hover:opacity-75"
              style={{ backgroundColor: rainColor(d.rainPct) }}
            >
              <C.icon className="size-3 text-white/80 drop-shadow" />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground -mt-4 px-1">
        <span>km 0</span>
        <span>km 18</span>
      </div>

      {/* Gráfico de probabilidad de lluvia */}
      <div className="flex-1 min-h-[180px]">
        <p className="text-xs font-medium text-muted-foreground mb-2">Probabilidad de lluvia por km</p>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={DATA} margin={{ top: 0, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
            <XAxis
              dataKey="km"
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(v: number) => `${v}`}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(v: number) => `${v}%`}
              axisLine={false}
              tickLine={false}
              width={36}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }} />
            <Bar dataKey="rainPct" radius={[3, 3, 0, 0]} maxBarSize={20}>
              {DATA.map((d) => (
                <Cell key={d.km} fill={rainColor(d.rainPct)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-5 text-[11px] text-muted-foreground border-t border-border/40 pt-3 flex-wrap">
        {Object.entries(COND_META).map(([key, m]) => (
          <span key={key} className="flex items-center gap-1.5">
            <m.icon className={cn('size-3', m.color)} />
            {m.label}
          </span>
        ))}
        <span className="ml-auto italic">Fuente: reporte oficial (pendiente)</span>
      </div>
    </div>
  );
}
