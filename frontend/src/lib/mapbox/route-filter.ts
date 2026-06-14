import type { LngLat } from "@/lib/mapbox/directions";
import type { Incident } from "@/types/incident";

/** Distancia en metros entre dos puntos [lng, lat] (Haversine). */
function haversineMeters([lng1, lat1]: LngLat, [lng2, lat2]: LngLat): number {
  const R = 6_371_000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Distancia mínima en metros desde un punto hasta el segmento [a, b].
 * Usa proyección plana (válida para distancias < 50 km).
 */
function pointToSegmentMeters(point: LngLat, a: LngLat, b: LngLat): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lenSq = dx * dx + dy * dy;

  if (lenSq < 1e-12) {
    return haversineMeters(point, a);
  }

  const t = Math.max(
    0,
    Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dy) / lenSq),
  );

  return haversineMeters(point, [a[0] + t * dx, a[1] + t * dy]);
}

/**
 * Retorna solo los incidentes cuya posición esté a ≤ thresholdMeters
 * de algún segmento de la polilínea de la ruta.
 */
export function filterIncidentsByRoute(
  incidents: Incident[],
  routeCoords: LngLat[],
  thresholdMeters = 400,
): Incident[] {
  if (routeCoords.length < 2) return incidents;

  return incidents.filter((incident) => {
    const point: LngLat = [incident.longitude, incident.latitude];

    for (let i = 0; i < routeCoords.length - 1; i++) {
      if (
        pointToSegmentMeters(point, routeCoords[i], routeCoords[i + 1]) <=
        thresholdMeters
      ) {
        return true;
      }
    }

    return false;
  });
}
