import { severityMeta } from '@/lib/incidents/format';
import type { RiskEvaluationCondition } from '@/lib/api/risk-evaluation';

/** Mismo semáforo que `severityMeta` (Alto/Medio/Bajo ya comparten el mismo
 * vocabulario que las severidades de incidentes) — reusa sus colores en vez
 * de definir una paleta nueva para lo mismo. */
const IMPACTO_HEX: Record<string, string> = {
  Alto: severityMeta.high.hex,
  Medio: severityMeta.medium.hex,
  Bajo: severityMeta.low.hex,
};
const IMPACTO_HEX_DEFAULT = '#64748b'; // Otro/sin dato

export function impactoHex(impacto: string | null): string {
  return (impacto && IMPACTO_HEX[impacto]) || IMPACTO_HEX_DEFAULT;
}

/** Color del marcador del km — el impacto más alto entre sus condiciones. */
export function maxImpactoHex(conditions: RiskEvaluationCondition[]): string {
  const orden = ['Alto', 'Medio', 'Bajo'];
  for (const nivel of orden) {
    if (conditions.some((c) => c.impacto === nivel)) return impactoHex(nivel);
  }
  return IMPACTO_HEX_DEFAULT;
}
