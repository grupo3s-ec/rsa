'use client';

import { useMemo } from 'react';
import {
  Bar, BarChart,
  CartesianGrid, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import {
  Cloud, CloudRain, Sun, CloudLightning,
  Thermometer, Droplets, CloudSnow,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPerfilClimatico, mmToCondicion, MES_NOMBRE } from '@/lib/inamhi';
import type { RouteCalculatedData } from '@/components/routes/RoutePlanner';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Condicion = 'sunny' | 'cloudy' | 'rain' | 'storm';

const COND_META: Record<Condicion, { icon: React.ElementType; label: string; color: string }> = {
  sunny:  { icon: Sun,            label: 'Despejado', color: 'text-yellow-400' },
  cloudy: { icon: Cloud,          label: 'Nublado',   color: 'text-slate-400'  },
  rain:   { icon: CloudRain,      label: 'Lluvia',    color: 'text-sky-500'    },
  storm:  { icon: CloudLightning, label: 'Tormenta',  color: 'text-violet-500' },
};

function mmToColor(mm: number): string {
  if (mm >= 200) return '#7c3aed';
  if (mm >= 120) return '#0ea5e9';
  if (mm >= 60)  return '#38bdf8';
  if (mm >= 25)  return '#7dd3fc';
  return '#bae6fd';
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ payload: { km: number; mm: number; tempC: number; humPct: number; estacion: string; cond: Condicion } }>;
  label?: number;
}

function CustomTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const d = payload[0]!.payload;
  const C = COND_META[d.cond];
  return (
    <div className="rounded-xl border border-border/60 bg-background/95 px-3 py-2 shadow-lg text-xs backdrop-blur space-y-1">
      <p className="font-semibold">km {d.km.toFixed(1)}</p>
      <p className="flex items-center gap-1.5"><C.icon className={cn('size-3', C.color)} />{C.label}</p>
      <p className="text-muted-foreground">Precipitación: <span className="text-sky-500 font-medium">{d.mm} mm/mes</span></p>
      <p className="text-muted-foreground">Temperatura: <span className="text-foreground font-medium">{d.tempC}°C</span></p>
      <p className="text-muted-foreground">Humedad: <span className="text-foreground font-medium">{d.humPct}%</span></p>
      <p className="text-muted-foreground/60 text-[10px]">{d.estacion}</p>
    </div>
  );
}

// ─── Componente ───────────────────────────────────────────────────────────────

interface Props {
  routeData?: RouteCalculatedData | null;
}

export function ClimaPanel({ routeData }: Props) {
  const mesActual = new Date().getMonth();

  const perfil = useMemo(() => {
    if (!routeData) return null;
    return getPerfilClimatico(routeData.coords, routeData.distanceMeters, mesActual)
      .map(p => ({ ...p, cond: mmToCondicion(p.mm) as Condicion }));
  }, [routeData, mesActual]);

  if (!perfil || perfil.length === 0) {
    return (
      <div className="flex h-full items-center justify-center gap-3 text-muted-foreground/60 p-6">
        <CloudSnow className="size-6 shrink-0" />
        <div>
          <p className="text-sm font-medium text-foreground/70">Sin ruta calculada</p>
          <p className="text-xs mt-0.5">Calcula una ruta para ver el pronóstico climático estimado.</p>
        </div>
      </div>
    );
  }

  const avgTemp   = Math.round(perfil.reduce((s, d) => s + d.tempC, 0) / perfil.length * 10) / 10;
  const avgHum    = Math.round(perfil.reduce((s, d) => s + d.humPct, 0) / perfil.length);
  const maxMm     = Math.max(...perfil.map(d => d.mm));
  const kmLluvia  = perfil.filter(d => d.cond === 'rain' || d.cond === 'storm').length;
  const kmTormenta= perfil.filter(d => d.cond === 'storm').length;
  const totalKm   = routeData ? Math.round(routeData.distanceMeters / 1000) : 0;
  const segKm     = totalKm / perfil.length;

  return (
    <div className="flex h-full flex-col bg-background p-6 gap-5 overflow-y-auto">
      {/* Encabezado */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <CloudRain className="size-4 text-sky-500" />
            Pronóstico Climático por Ruta
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {MES_NOMBRE[mesActual]} · Estimación basada en histórico INAMHI 1980–2021
          </p>
        </div>

        <div className="flex gap-5 text-xs">
          <div className="flex flex-col items-center gap-0.5">
            <Thermometer className="size-4 text-orange-400" />
            <span className="font-bold text-foreground text-sm">{avgTemp}°C</span>
            <span className="text-muted-foreground">promedio</span>
          </div>
          <div className="flex flex-col items-center gap-0.5">
            <Droplets className="size-4 text-sky-400" />
            <span className="font-bold text-foreground text-sm">{avgHum}%</span>
            <span className="text-muted-foreground">humedad</span>
          </div>
          {kmLluvia > 0 && (
            <div className="flex flex-col items-center gap-0.5">
              <CloudRain className="size-4 text-sky-500" />
              <span className="font-bold text-sky-500 text-sm">{Math.round(kmLluvia * segKm)} km</span>
              <span className="text-muted-foreground">con lluvia</span>
            </div>
          )}
          {kmTormenta > 0 && (
            <div className="flex flex-col items-center gap-0.5">
              <CloudLightning className="size-4 text-violet-500" />
              <span className="font-bold text-violet-500 text-sm">{Math.round(kmTormenta * segKm)} km</span>
              <span className="text-muted-foreground">tormenta</span>
            </div>
          )}
          <div className="flex flex-col items-center gap-0.5">
            <CloudRain className="size-4 text-slate-400" />
            <span className="font-bold text-foreground text-sm">{maxMm} mm</span>
            <span className="text-muted-foreground">máx lluvia</span>
          </div>
        </div>
      </div>

      {/* Franja de condiciones por km */}
      <div className="flex gap-px h-10 rounded-xl overflow-hidden">
        {perfil.map((d, i) => {
          const C = COND_META[d.cond];
          return (
            <div key={i} title={`km ${d.km.toFixed(1)} — ${C.label} · ${d.mm} mm · ${d.tempC}°C`}
              className="flex flex-1 items-center justify-center cursor-default transition-opacity hover:opacity-80"
              style={{ backgroundColor: mmToColor(d.mm) }}>
              <C.icon className="size-3 text-white/80 drop-shadow" />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground -mt-3 px-1">
        <span>km 0</span>
        <span>km {totalKm}</span>
      </div>

      {/* Gráfico mm por km */}
      <div className="flex-1 min-h-[160px]">
        <p className="text-xs font-medium text-muted-foreground mb-2">Precipitación estimada por km (mm/mes)</p>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={perfil} margin={{ top: 0, right: 10, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
            <XAxis dataKey="km" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(v: number) => `${v.toFixed(0)}`} axisLine={false} tickLine={false} interval="preserveStartEnd" />
            <YAxis domain={[0, 'auto']} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
              tickFormatter={(v: number) => `${v}`} axisLine={false} tickLine={false} width={36} unit=" mm" />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted))', opacity: 0.3 }} />
            <Bar dataKey="mm" radius={[3, 3, 0, 0]} maxBarSize={20}>
              {perfil.map((d, i) => <Cell key={i} fill={mmToColor(d.mm)} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-5 text-[11px] text-muted-foreground border-t border-border/40 pt-3 flex-wrap">
        {(Object.entries(COND_META) as [Condicion, typeof COND_META[Condicion]][]).map(([key, m]) => (
          <span key={key} className="flex items-center gap-1.5">
            <m.icon className={cn('size-3', m.color)} /> {m.label}
          </span>
        ))}
        <span className="ml-auto text-[10px] italic text-muted-foreground/60">Histórico INAMHI 1980–2021</span>
      </div>
    </div>
  );
}
