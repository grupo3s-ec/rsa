import type { IncidentStatus } from "@/types/incident";

export type ExpiryState = "soon" | "expired";

/** Días de antelación para avisar que un incidente está por caducar. */
const SOON_THRESHOLD_DAYS = 3;

/**
 * Estado de vigencia de un incidente activo. `null` si no aplica (sin fecha
 * de vencimiento, o ya resuelto/archivado — esos ya no necesitan seguimiento).
 */
export function getExpiryState(
  expiresAt: string | null,
  status: IncidentStatus,
): ExpiryState | null {
  if (!expiresAt || status === "resolved" || status === "archived") return null;

  const diffMs = new Date(expiresAt).getTime() - Date.now();
  if (diffMs <= 0) return "expired";
  if (diffMs <= SOON_THRESHOLD_DAYS * 24 * 60 * 60 * 1000) return "soon";
  return null;
}
