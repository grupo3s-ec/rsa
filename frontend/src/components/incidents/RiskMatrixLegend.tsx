'use client';

import {
  getRiskLevel,
  getRiskScore,
  RISK_LEVEL_META,
  type RiskLevel,
} from '@/lib/risk-matrix';

// ─── Colores de celda — coinciden con la imagen ISO 31000 ─────────────────────

const CELL_BG: Record<RiskLevel, string> = {
  muy_bajo: '#16a34a',
  bajo:     '#4ade80',
  medio:    '#facc15',
  alto:     '#f97316',
  muy_alto: '#ef4444',
  extremo:  '#991b1b',
};

const CELL_FG: Record<RiskLevel, string> = {
  muy_bajo: '#fff',
  bajo:     '#14532d',
  medio:    '#78350f',
  alto:     '#fff',
  muy_alto: '#fff',
  extremo:  '#fff',
};

const PROBS   = [5, 4, 3, 2, 1] as const;   // top → bottom (mayor a menor)
const IMPACTS = [1, 2, 3, 4, 5] as const;   // left → right

const PROB_ABBR: Record<number, string> = {
  5: 'Casi seg.',
  4: 'Probable',
  3: 'Moderado',
  2: 'Poco prob.',
  1: 'Raro',
};

const IMPACT_ABBR: Record<number, string> = {
  1: 'Insig.',
  2: 'Menor',
  3: 'Signif.',
  4: 'Mayor',
  5: 'Severo',
};

/** Versión de solo lectura de la matriz ISO 31000 — explica cómo se calificó cada tipo del catálogo, sin permitir seleccionar celdas. */
export function RiskMatrixLegend() {
  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        La severidad de cada tipo de incidente ya está calificada según esta matriz
        (Probabilidad × Impacto, ISO 31000) — no se elige a mano al reportar.
      </p>

      <div className="flex items-stretch gap-1.5">
        <div className="flex shrink-0 flex-col justify-around">
          <div className="h-5" />
          {PROBS.map((p) => (
            <div key={p} className="flex h-6 items-center justify-end pr-1.5 text-[9px] leading-tight text-muted-foreground">
              {PROB_ABBR[p]}
            </div>
          ))}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex gap-0.5">
            {IMPACTS.map((i) => (
              <div key={i} className="flex-1 truncate text-center text-[9px] text-muted-foreground">
                {IMPACT_ABBR[i]}
              </div>
            ))}
          </div>

          {PROBS.map((p) => (
            <div key={p} className="flex gap-0.5">
              {IMPACTS.map((i) => {
                const level = getRiskLevel(p, i);
                const score = getRiskScore(p, i);
                return (
                  <span
                    key={i}
                    title={`${RISK_LEVEL_META[level].label} · ${score}`}
                    className="flex h-6 flex-1 items-center justify-center rounded text-[10px] font-bold"
                    style={{ backgroundColor: CELL_BG[level], color: CELL_FG[level] }}
                  >
                    {score}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {(Object.entries(CELL_BG) as [RiskLevel, string][]).map(([level, bg]) => (
          <span key={level} className="flex items-center gap-1 text-[9px] text-muted-foreground">
            <span className="size-2 rounded-sm" style={{ backgroundColor: bg }} />
            {RISK_LEVEL_META[level].label}
          </span>
        ))}
      </div>
    </div>
  );
}
