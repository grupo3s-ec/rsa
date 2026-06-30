export type RiskLevel = 'muy_bajo' | 'bajo' | 'medio' | 'alto' | 'muy_alto' | 'extremo';

/**
 * Matriz ISO 31000: [probabilidad 1-5][impacto 1-5] → nivel de riesgo.
 */
const RISK_MATRIX: Record<number, Record<number, RiskLevel>> = {
  1: { 1: 'muy_bajo', 2: 'muy_bajo', 3: 'bajo',     4: 'medio',    5: 'medio'    },
  2: { 1: 'muy_bajo', 2: 'bajo',     3: 'medio',    4: 'medio',    5: 'alto'     },
  3: { 1: 'bajo',     2: 'medio',    3: 'alto',     4: 'alto',     5: 'muy_alto' },
  4: { 1: 'medio',    2: 'alto',     3: 'alto',     4: 'muy_alto', 5: 'extremo'  },
  5: { 1: 'medio',    2: 'alto',     3: 'muy_alto', 4: 'extremo',  5: 'extremo'  },
};

export function getRiskLevel(probability: number, impact: number): RiskLevel {
  return RISK_MATRIX[probability]?.[impact] ?? 'muy_bajo';
}

export function getRiskScore(probability: number, impact: number): number {
  return probability * impact;
}

export const PROBABILITY_LABELS: Record<number, string> = {
  1: 'Raro',
  2: 'Poco probable',
  3: 'Moderado',
  4: 'Probable',
  5: 'Casi seguro',
};

export const IMPACT_LABELS: Record<number, string> = {
  1: 'Insignificante',
  2: 'Menor',
  3: 'Significativo',
  4: 'Mayor',
  5: 'Severo',
};

export interface RiskLevelMeta {
  label: string;
  color: string;
  bg: string;
  border: string;
}

export const RISK_LEVEL_META: Record<RiskLevel, RiskLevelMeta> = {
  muy_bajo: { label: 'Muy bajo', color: 'text-slate-500',              bg: 'bg-slate-500/10',   border: 'border-slate-500/30'   },
  bajo:     { label: 'Bajo',     color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
  medio:    { label: 'Medio',    color: 'text-amber-600 dark:text-amber-400',     bg: 'bg-amber-500/10',   border: 'border-amber-500/30'   },
  alto:     { label: 'Alto',     color: 'text-orange-600 dark:text-orange-400',   bg: 'bg-orange-500/10',  border: 'border-orange-500/30'  },
  muy_alto: { label: 'Muy alto', color: 'text-red-600 dark:text-red-400',         bg: 'bg-red-500/10',     border: 'border-red-500/30'     },
  extremo:  { label: 'Extremo',  color: 'text-red-700 dark:text-red-300',         bg: 'bg-red-700/15',     border: 'border-red-700/40'     },
};
