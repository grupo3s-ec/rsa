import { severityMeta } from '@/lib/incidents/format';
import type { RiskEvaluationCondition } from '@/lib/api/risk-evaluation';

/** Mismo semáforo que las alertas (`severityMeta`) — se probó una paleta
 * propia (azul/violeta) para diferenciar videos de alertas a simple vista,
 * pero rompía la convención de UI del proyecto ("rojo = peligro", ver
 * memoria de diseño) y desalineaba el color del mapa con el del PDF de
 * riesgos (que sigue en rojo/ámbar/verde). El marcador de video ya se
 * diferencia por forma: ícono de cámara + borde blanco (ver RouteMap.tsx),
 * no hacía falta también un color distinto. */
const IMPACTO_HEX: Record<string, string> = {
  Alto: severityMeta.high.hex,
  Medio: severityMeta.medium.hex,
  Bajo: severityMeta.low.hex,
};
const IMPACTO_HEX_DEFAULT = '#64748b'; // Otro/sin dato

export function impactoHex(impacto: string | null): string {
  return (impacto && IMPACTO_HEX[impacto]) || IMPACTO_HEX_DEFAULT;
}

const IMPACTO_ORDEN = ['Alto', 'Medio', 'Bajo'];

/** Color del marcador del km — el impacto más alto entre sus condiciones. */
export function maxImpactoHex(conditions: RiskEvaluationCondition[]): string {
  for (const nivel of IMPACTO_ORDEN) {
    if (conditions.some((c) => c.impacto === nivel)) return impactoHex(nivel);
  }
  return IMPACTO_HEX_DEFAULT;
}

/** Rango numérico del impacto más alto entre las condiciones de un km — mayor
 * es más riesgoso (Alto=3, Medio=2, Bajo=1, sin dato=0). Usado para poder
 * ordenar la lista de Evaluación de Riesgo de alto a bajo. */
export function maxImpactoRank(conditions: RiskEvaluationCondition[]): number {
  for (let i = 0; i < IMPACTO_ORDEN.length; i++) {
    if (conditions.some((c) => c.impacto === IMPACTO_ORDEN[i])) return IMPACTO_ORDEN.length - i;
  }
  return 0;
}
