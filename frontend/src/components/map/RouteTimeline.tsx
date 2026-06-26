'use client';

import { useState } from 'react';
import { AlertTriangle, CloudRain, ChevronDown, ChevronUp, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KmPoint {
  km: number;
  risk: 'low' | 'medium' | 'high';
  incidents: number;
  rainPct: number;
}

// Datos de ejemplo — se reemplazarán con datos reales de la BD por latitud/longitud
const DUMMY_POINTS: KmPoint[] = [
  { km: 0,  risk: 'low',    incidents: 0, rainPct: 10 },
  { km: 1,  risk: 'low',    incidents: 0, rainPct: 12 },
  { km: 2,  risk: 'medium', incidents: 1, rainPct: 25 },
  { km: 3,  risk: 'high',   incidents: 2, rainPct: 40 },
  { km: 4,  risk: 'high',   incidents: 1, rainPct: 45 },
  { km: 5,  risk: 'medium', incidents: 1, rainPct: 35 },
  { km: 6,  risk: 'low',    incidents: 0, rainPct: 20 },
  { km: 7,  risk: 'low',    incidents: 0, rainPct: 15 },
  { km: 8,  risk: 'medium', incidents: 1, rainPct: 30 },
  { km: 9,  risk: 'low',    incidents: 0, rainPct: 18 },
  { km: 10, risk: 'low',    incidents: 0, rainPct: 10 },
  { km: 11, risk: 'medium', incidents: 1, rainPct: 28 },
  { km: 12, risk: 'high',   incidents: 2, rainPct: 55 },
  { km: 13, risk: 'high',   incidents: 3, rainPct: 60 },
  { km: 14, risk: 'medium', incidents: 1, rainPct: 42 },
  { km: 15, risk: 'low',    incidents: 0, rainPct: 20 },
  { km: 16, risk: 'low',    incidents: 0, rainPct: 15 },
  { km: 17, risk: 'medium', incidents: 1, rainPct: 32 },
  { km: 18, risk: 'low',    incidents: 0, rainPct: 8  },
];

const RISK_COLOR: Record<KmPoint['risk'], string> = {
  low:    'bg-emerald-500 border-emerald-400',
  medium: 'bg-amber-500   border-amber-400',
  high:   'bg-red-500     border-red-400',
};

const RISK_LINE: Record<KmPoint['risk'], string> = {
  low:    'bg-emerald-500/40',
  medium: 'bg-amber-500/40',
  high:   'bg-red-500/40',
};

export function RouteTimeline() {
  const [open, setOpen] = useState(true);

  const totalIncidents = DUMMY_POINTS.reduce((s, p) => s + p.incidents, 0);
  const highRisk       = DUMMY_POINTS.filter(p => p.risk === 'high').length;

  return (
    <div className={cn(
      'shrink-0 border-t border-border/60 bg-background/95 backdrop-blur transition-all duration-300',
      open ? 'h-[25vh] min-h-[10rem]' : 'h-9',
    )}>
      {/* Encabezado del panel */}
      <div className="flex h-9 items-center gap-3 border-b border-border/40 px-4">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 text-xs font-semibold text-foreground/80 hover:text-foreground transition-colors"
        >
          {open ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
          Timeline de ruta
        </button>

        <span className="h-3.5 w-px bg-border/60" />

        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Navigation className="size-3 text-primary" />
            18.3 km · 35 min
          </span>
          {totalIncidents > 0 && (
            <span className="flex items-center gap-1 text-amber-500">
              <AlertTriangle className="size-3" />
              {totalIncidents} alertas
            </span>
          )}
          {highRisk > 0 && (
            <span className="flex items-center gap-1 text-red-500">
              <span className="size-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.7)]" />
              {highRisk} km de alto riesgo
            </span>
          )}
        </div>

        <span className="ml-auto text-[10px] text-muted-foreground/60 italic">
          datos de referencia
        </span>
      </div>

      {/* Timeline scrolleable */}
      {open && (
        <div className="flex h-[calc(25vh-2.25rem)] min-h-[calc(10rem-2.25rem)] items-center overflow-x-auto px-4 scrollbar-thin">
          <div className="flex items-center gap-0 min-w-max py-3">
            {DUMMY_POINTS.map((point, idx) => {
              const isLast = idx === DUMMY_POINTS.length - 1;
              return (
                <div key={point.km} className="flex items-center">
                  {/* Nodo km */}
                  <div className="group relative flex flex-col items-center gap-1.5">
                    {/* Icono de lluvia si >40% */}
                    <div className="flex h-5 items-center justify-center">
                      {point.rainPct > 40 ? (
                        <CloudRain className="size-4 text-sky-400" />
                      ) : (
                        <span className="text-[10px] text-muted-foreground/50">
                          {point.rainPct}%
                        </span>
                      )}
                    </div>

                    {/* Círculo del km */}
                    <div className={cn(
                      'flex size-11 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold text-white shadow-md transition-transform hover:scale-110 cursor-default',
                      RISK_COLOR[point.risk],
                    )}>
                      {point.km}
                    </div>

                    {/* Indicador de incidentes */}
                    <div className="flex h-5 items-center justify-center">
                      {point.incidents > 0 ? (
                        <span className="flex size-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white shadow-sm">
                          {point.incidents}
                        </span>
                      ) : (
                        <span className="size-1.5 rounded-full bg-border/40" />
                      )}
                    </div>

                    {/* Tooltip */}
                    <div className="pointer-events-none absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-50 rounded-lg border bg-popover px-2.5 py-1.5 text-[11px] text-popover-foreground shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      <p className="font-semibold">km {point.km}</p>
                      <p>{point.incidents} incidente{point.incidents !== 1 ? 's' : ''}</p>
                      <p>Lluvia: {point.rainPct}%</p>
                    </div>
                  </div>

                  {/* Línea conectora */}
                  {!isLast && (
                    <div className={cn('h-1.5 w-8 rounded-full', RISK_LINE[point.risk])} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
