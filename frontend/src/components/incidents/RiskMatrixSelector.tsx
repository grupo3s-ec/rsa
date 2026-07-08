'use client';

import { cn } from '@/lib/utils';
import {
  getRiskLevel,
  getRiskScore,
  IMPACT_LABELS,
  PROBABILITY_LABELS,
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

// ─── Datos de la matriz ───────────────────────────────────────────────────────

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

// ─── Props ────────────────────────────────────────────────────────────────────

export interface RiskMatrixSelectorProps {
  probability: number | null;
  impact: number | null;
  /** Recibe los nuevos valores de P e I al hacer clic en una celda. */
  onChange: (probability: number, impact: number) => void;
}

// ─── Componente ───────────────────────────────────────────────────────────────

export function RiskMatrixSelector({ probability, impact, onChange }: RiskMatrixSelectorProps) {
  const selectedLevel = probability !== null && impact !== null
    ? getRiskLevel(probability, impact)
    : null;
  const selectedScore = probability !== null && impact !== null
    ? getRiskScore(probability, impact)
    : null;
  const selectedMeta = selectedLevel ? RISK_LEVEL_META[selectedLevel] : null;

  return (
    <div className="space-y-3">

      {/* Matriz 5×5 */}
      <div className="flex items-stretch gap-1.5">

        {/* Etiquetas de fila (probabilidad) */}
        <div className="flex shrink-0 flex-col justify-around">
          <div className="h-5" />{/* alineación con encabezados de columna */}
          {PROBS.map((p) => (
            <div
              key={p}
              className={cn(
                'flex h-7 items-center justify-end pr-1.5 text-[9px] leading-tight text-muted-foreground transition-colors',
                probability === p && 'font-semibold text-foreground',
              )}
            >
              {PROB_ABBR[p]}
            </div>
          ))}
        </div>

        {/* Columnas + encabezados de impacto */}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">

          {/* Encabezados de impacto */}
          <div className="flex gap-0.5">
            {IMPACTS.map((i) => (
              <div
                key={i}
                className={cn(
                  'flex-1 truncate text-center text-[9px] text-muted-foreground transition-colors',
                  impact === i && 'font-semibold text-foreground',
                )}
              >
                {IMPACT_ABBR[i]}
              </div>
            ))}
          </div>

          {/* Filas de celdas */}
          {PROBS.map((p) => (
            <div key={p} className="flex gap-0.5">
              {IMPACTS.map((i) => {
                const level = getRiskLevel(p, i);
                const score = getRiskScore(p, i);
                const isSelected = probability === p && impact === i;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onChange(p, i)}
                    title={`${PROBABILITY_LABELS[p]} × ${IMPACT_LABELS[i]} = ${score} · ${RISK_LEVEL_META[level].label}`}
                    className="relative flex h-7 flex-1 items-center justify-center rounded text-[11px] font-bold transition-opacity hover:opacity-75 focus-visible:outline-none"
                    style={{
                      backgroundColor: CELL_BG[level],
                      color: CELL_FG[level],
                      boxShadow: isSelected
                        ? `inset 0 0 0 2px rgba(255,255,255,0.85), inset 0 0 0 3.5px rgba(0,0,0,0.25)`
                        : undefined,
                      transform: isSelected ? 'scale(1.08)' : undefined,
                      zIndex: isSelected ? 10 : undefined,
                    }}
                  >
                    {score}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Resultado seleccionado */}
      {selectedMeta && selectedScore !== null && probability !== null && impact !== null ? (
        <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/20 px-3 py-2">
          <span className="text-[11px] text-muted-foreground">
            {PROBABILITY_LABELS[probability]} × {IMPACT_LABELS[impact]}
          </span>
          <span className={cn(
            'rounded-full border px-2.5 py-0.5 text-[11px] font-semibold',
            selectedMeta.color, selectedMeta.bg, selectedMeta.border,
          )}>
            {selectedMeta.label} · {selectedScore}
          </span>
        </div>
      ) : (
        <p className="text-center text-[11px] text-muted-foreground/70">
          Selecciona una celda para calificar el riesgo
        </p>
      )}

      {/* Leyenda */}
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
