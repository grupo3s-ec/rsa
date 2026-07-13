import { Cloud, CloudLightning, CloudRain, Sun, type LucideIcon } from 'lucide-react';
import { haversineKm, subsampleRoute } from '@/lib/geo';
import {
  ESTACIONES_META,
  DATOS_PRECIPITACION,
  DATOS_TEMPERATURA,
  DATOS_HUMEDAD,
} from '@/lib/precipitacion-data';
import type { LngLat } from '@/lib/mapbox/directions';

export type ClimaKm = {
  km: number;
  mm: number;
  tempC: number;
  humPct: number;
  estacion: string;
};

type EstacionMeta = { codigo: string; nombre: string; lng: number; lat: number; altitud: number };

function getEstacionMasCercana(lat: number, lng: number): EstacionMeta {
  let best: EstacionMeta = ESTACIONES_META[0] as EstacionMeta;
  let bestDist = Infinity;
  for (const e of (ESTACIONES_META as readonly EstacionMeta[])) {
    const d = haversineKm({ lat: e.lat, lng: e.lng }, { lat, lng });
    if (d < bestDist) { bestDist = d; best = e; }
  }
  return best;
}

function promedio(vals: (string | number | null)[]): number {
  const nums = vals.filter((v): v is number => typeof v === 'number');
  return nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
}

export function getPerfilClimatico(
  coords: LngLat[],
  distanceMeters: number,
  mesIdx: number,
  n = 50,
): ClimaKm[] {
  const samples = subsampleRoute(coords, n);
  const haversineTotal = samples[samples.length - 1]?.km ?? 0;
  const roadTotalKm = distanceMeters / 1000;
  const scale = haversineTotal > 0 ? roadTotalKm / haversineTotal : 1;

  return samples.map((s) => {
    const est = getEstacionMasCercana(s.point[1], s.point[0]);
    const mm     = promedio(DATOS_PRECIPITACION.filter(d => d.codigo === est.codigo).map(d => d.meses[mesIdx] ?? null));
    const tempC  = promedio(DATOS_TEMPERATURA  .filter(d => d.codigo === est.codigo).map(d => d.meses[mesIdx] ?? null));
    const humPct = promedio(DATOS_HUMEDAD      .filter(d => d.codigo === est.codigo).map(d => d.meses[mesIdx] ?? null));
    return {
      km: Math.round(s.km * scale * 10) / 10,
      mm:     Math.round(mm     * 10) / 10,
      tempC:  Math.round(tempC  * 10) / 10,
      humPct: Math.round(humPct * 10) / 10,
      estacion: est.nombre.split('-')[0]?.trim() ?? est.nombre,
    };
  });
}

export type CondicionClima = 'sunny' | 'cloudy' | 'rain' | 'storm';

export function mmToCondicion(mm: number): CondicionClima {
  if (mm >= 150) return 'storm';
  if (mm >= 80)  return 'rain';
  if (mm >= 30)  return 'cloudy';
  return 'sunny';
}

/** Color por cantidad de precipitación — única fuente de verdad para que el
 * tab Clima y el gráfico combinado del panel lateral coincidan exactamente. */
export function mmToColor(mm: number): string {
  if (mm >= 200) return '#7c3aed';
  if (mm >= 120) return '#0ea5e9';
  if (mm >= 60)  return '#38bdf8';
  if (mm >= 25)  return '#7dd3fc';
  return '#bae6fd';
}

interface CondicionMeta {
  icon: LucideIcon;
  label: string;
  colorClass: string;
}

export const CONDICION_META: Record<CondicionClima, CondicionMeta> = {
  sunny:  { icon: Sun,            label: 'Despejado', colorClass: 'text-yellow-400'  },
  cloudy: { icon: Cloud,          label: 'Nublado',   colorClass: 'text-slate-400'   },
  rain:   { icon: CloudRain,      label: 'Lluvia',    colorClass: 'text-sky-500'     },
  storm:  { icon: CloudLightning, label: 'Tormenta',  colorClass: 'text-violet-500'  },
};

export const MES_NOMBRE = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];
