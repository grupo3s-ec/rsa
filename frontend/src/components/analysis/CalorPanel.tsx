'use client';

import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Segment {
  label: string;
  km: string;
  risk: 'low' | 'medium' | 'high' | 'critical';
  incidents: number;
  desc: string;
}

const SEGMENTS: Segment[] = [
  { label: 'Centro Histórico',   km: 'km 0–3',   risk: 'medium',   incidents: 3,  desc: 'Tráfico denso, vías estrechas' },
  { label: 'La Floresta',        km: 'km 3–6',   risk: 'high',     incidents: 6,  desc: 'Zona con mayor concentración de siniestros' },
  { label: 'La Carolina',        km: 'km 6–9',   risk: 'low',      incidents: 1,  desc: 'Vía amplia, bajo historial de accidentes' },
  { label: 'Av. Naciones Unidas',km: 'km 9–12',  risk: 'medium',   incidents: 4,  desc: 'Intersecciones conflictivas' },
  { label: 'El Inca',            km: 'km 12–15', risk: 'critical', incidents: 9,  desc: 'Punto crítico — alta siniestralidad nocturna' },
  { label: 'Calderón',           km: 'km 15–18', risk: 'low',      incidents: 2,  desc: 'Zona periférica, riesgo reducido' },
];

const RISK_META: Record<Segment['risk'], { label: string; bar: string; bg: string; text: string; dot: string }> = {
  low:      { label: 'Bajo',     bar: 'bg-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  medium:   { label: 'Medio',    bar: 'bg-amber-500',   bg: 'bg-amber-500/10',   text: 'text-amber-600   dark:text-amber-400',   dot: 'bg-amber-500'   },
  high:     { label: 'Alto',     bar: 'bg-red-500',     bg: 'bg-red-500/10',     text: 'text-red-600     dark:text-red-400',     dot: 'bg-red-500'     },
  critical: { label: 'Crítico',  bar: 'bg-red-700',     bg: 'bg-red-700/15',     text: 'text-red-700     dark:text-red-300',     dot: 'bg-red-700 shadow-[0_0_8px_rgba(185,28,28,0.8)]' },
};

const maxIncidents = Math.max(...SEGMENTS.map(s => s.incidents));

export function CalorPanel() {
  const total    = SEGMENTS.reduce((s, seg) => s + seg.incidents, 0);
  const critical = SEGMENTS.filter(s => s.risk === 'critical').length;

  return (
    <div className="flex h-full flex-col bg-background p-6 gap-6 overflow-y-auto">
      {/* Encabezado */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Flame className="size-4 text-orange-500" />
            Mapa de Calor — Densidad de Siniestros
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Concentración de incidentes por segmento de ruta · datos referenciales
          </p>
        </div>

        <div className="flex gap-4 text-xs">
          <div className="flex flex-col items-end">
            <span className="text-muted-foreground">Total incidentes</span>
            <span className="font-bold text-foreground text-base">{total}</span>
          </div>
          {critical > 0 && (
            <div className="flex flex-col items-end">
              <span className="text-muted-foreground">Zonas críticas</span>
              <span className="font-bold text-red-600 dark:text-red-400 text-base">{critical}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tira de calor visual */}
      <div className="flex h-6 rounded-full overflow-hidden gap-px">
        {SEGMENTS.map((seg) => (
          <div
            key={seg.label}
            title={`${seg.label}: ${seg.incidents} incidentes`}
            className={cn('flex-1 transition-opacity hover:opacity-80', RISK_META[seg.risk].bar)}
            style={{ opacity: 0.4 + (seg.incidents / maxIncidents) * 0.6 }}
          />
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground -mt-4 px-1">
        <span>km 0</span>
        <span>km 18</span>
      </div>

      {/* Lista de segmentos */}
      <div className="flex flex-col gap-2">
        {SEGMENTS.map((seg) => {
          const meta    = RISK_META[seg.risk];
          const barPct  = (seg.incidents / maxIncidents) * 100;
          return (
            <div key={seg.label} className={cn('rounded-xl border border-border/40 p-4 transition-colors hover:border-border', meta.bg)}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={cn('size-2 rounded-full shrink-0', meta.dot)} />
                  <span className="text-sm font-medium text-foreground">{seg.label}</span>
                  <span className="text-xs text-muted-foreground">{seg.km}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={cn('text-xs font-semibold', meta.text)}>{meta.label}</span>
                  <span className="text-sm font-bold text-foreground tabular-nums">
                    {seg.incidents} incidente{seg.incidents !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>

              {/* Barra de densidad */}
              <div className="h-1.5 rounded-full bg-border/30 overflow-hidden">
                <div
                  className={cn('h-full rounded-full transition-all', meta.bar)}
                  style={{ width: `${barPct}%` }}
                />
              </div>

              <p className="text-xs text-muted-foreground mt-2">{seg.desc}</p>
            </div>
          );
        })}
      </div>

      {/* Leyenda */}
      <div className="flex items-center gap-5 text-[11px] text-muted-foreground border-t border-border/40 pt-3 flex-wrap">
        {Object.entries(RISK_META).map(([key, m]) => (
          <span key={key} className="flex items-center gap-1.5">
            <span className={cn('size-2.5 rounded-full', m.dot)} />
            {m.label}
          </span>
        ))}
      </div>
    </div>
  );
}
