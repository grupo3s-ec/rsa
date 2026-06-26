'use client';

import { useState } from 'react';
import { AlertTriangle, CloudRain, Navigation, Route, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KmPoint {
  km: number;
  risk: 'low' | 'medium' | 'high';
  incidents: number;
  rainPct: number;
}

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

const RISK_META: Record<KmPoint['risk'], {
  bg: string; border: string; accent: string; label: string; text: string;
}> = {
  low:    { bg: 'bg-emerald-500/8  hover:bg-emerald-500/14', border: 'border-emerald-500/30', accent: 'bg-emerald-500', label: 'Bajo',   text: 'text-emerald-600 dark:text-emerald-400' },
  medium: { bg: 'bg-amber-500/8    hover:bg-amber-500/14',   border: 'border-amber-500/30',   accent: 'bg-amber-500',   label: 'Medio',  text: 'text-amber-600   dark:text-amber-400'   },
  high:   { bg: 'bg-red-500/10     hover:bg-red-500/16',     border: 'border-red-500/30',     accent: 'bg-red-500',     label: 'Alto',   text: 'text-red-600     dark:text-red-400'     },
};

interface Props {
  hasRoute?: boolean;
}

export function RouteTimeline({ hasRoute = false }: Props) {
  const [open, setOpen] = useState(true);

  const totalIncidents = DUMMY_POINTS.reduce((s, p) => s + p.incidents, 0);
  const highRisk       = DUMMY_POINTS.filter(p => p.risk === 'high').length;

  return (
    <div className={cn(
      'shrink-0 border-t border-border/60 bg-background/95 backdrop-blur transition-all duration-300',
      open ? 'h-[25vh] min-h-[10rem]' : 'h-9',
    )}>
      {/* Encabezado */}
      <div className="flex h-9 shrink-0 items-center gap-3 border-b border-border/40 px-4">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 text-xs font-semibold text-foreground/80 hover:text-foreground transition-colors"
        >
          {open ? <ChevronDown className="size-3.5" /> : <ChevronUp className="size-3.5" />}
          Timeline de ruta
        </button>

        {hasRoute && (
          <>
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
                  {highRisk} km alto riesgo
                </span>
              )}
            </div>
          </>
        )}

        <span className="ml-auto text-[10px] text-muted-foreground/50 italic">
          {hasRoute ? 'datos de referencia' : ''}
        </span>
      </div>

      {/* Contenido */}
      {open && (
        hasRoute ? (
          /* ── Columnas verticales por km ── */
          <div className="flex h-[calc(25vh-2.25rem)] min-h-[calc(10rem-2.25rem)] overflow-x-auto scrollbar-thin">
            {DUMMY_POINTS.map((point) => {
              const meta = RISK_META[point.risk];
              return (
                <div
                  key={point.km}
                  className={cn(
                    'group relative flex flex-1 min-w-[3rem] flex-col items-center justify-between',
                    'border-r border-border/20 last:border-r-0 cursor-default transition-colors py-2 px-1',
                    meta.bg,
                  )}
                >
                  {/* Acento de color en la parte superior */}
                  <div className={cn('w-full h-1 rounded-b-sm', meta.accent)} />

                  {/* Lluvia / clima */}
                  <div className="flex flex-col items-center gap-0.5">
                    {point.rainPct > 40 ? (
                      <CloudRain className="size-3.5 text-sky-400" />
                    ) : null}
                    <span className="text-[9px] text-muted-foreground/60 tabular-nums">
                      {point.rainPct}%
                    </span>
                  </div>

                  {/* Km — centro */}
                  <div className="flex flex-col items-center gap-0.5">
                    <span className={cn('text-[11px] font-bold tabular-nums leading-none', meta.text)}>
                      {point.km}
                    </span>
                    <span className="text-[8px] text-muted-foreground/50 leading-none">km</span>
                  </div>

                  {/* Incidentes */}
                  <div className="h-5 flex items-center justify-center">
                    {point.incidents > 0 ? (
                      <span className="flex size-4 items-center justify-center rounded-full bg-destructive text-[8px] font-bold text-white shadow-sm">
                        {point.incidents}
                      </span>
                    ) : (
                      <span className="size-1 rounded-full bg-border/30" />
                    )}
                  </div>

                  {/* Tooltip */}
                  <div className="pointer-events-none absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 z-50 rounded-lg border bg-popover px-2.5 py-1.5 text-[11px] text-popover-foreground shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    <p className="font-semibold mb-0.5">km {point.km}</p>
                    <p className={cn('font-medium', meta.text)}>Riesgo {meta.label}</p>
                    <p className="text-muted-foreground">{point.incidents} incidente{point.incidents !== 1 ? 's' : ''}</p>
                    <p className="text-muted-foreground">Lluvia: {point.rainPct}%</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ── Estado vacío ── */
          <div className="flex h-[calc(25vh-2.25rem)] min-h-[calc(10rem-2.25rem)] items-center justify-center gap-3 text-muted-foreground/60">
            <Route className="size-5 shrink-0" />
            <p className="text-sm">Calcula una ruta para ver el análisis por kilómetro</p>
          </div>
        )
      )}
    </div>
  );
}
