/** Distancia Haversine en km entre dos puntos lat/lng. */
export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) *
      Math.cos((b.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}

/**
 * Toma N puntos equidistantes de la polilínea y devuelve cada punto
 * junto con su posición acumulada en km desde el inicio.
 */
export function subsampleRoute(
  coords: Array<[number, number]>, // [lng, lat]
  n: number,
): Array<{ point: [number, number]; km: number }> {
  if (coords.length === 0) return [];

  // km acumulados para cada punto original
  const cumKm: number[] = [0];
  for (let i = 1; i < coords.length; i++) {
    cumKm.push(
      cumKm[i - 1]! +
        haversineKm(
          { lat: coords[i - 1]![1], lng: coords[i - 1]![0] },
          { lat: coords[i]![1], lng: coords[i]![0] },
        ),
    );
  }

  if (coords.length <= n) {
    return coords.map((c, i) => ({ point: c, km: Math.round(cumKm[i]! * 10) / 10 }));
  }

  const total = cumKm[cumKm.length - 1]!;
  const result: Array<{ point: [number, number]; km: number }> = [];

  for (let s = 0; s < n; s++) {
    const targetKm = (s / (n - 1)) * total;
    // búsqueda binaria del índice más cercano
    let lo = 0, hi = cumKm.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (cumKm[mid]! < targetKm) lo = mid; else hi = mid;
    }
    const idx =
      Math.abs(cumKm[lo]! - targetKm) <= Math.abs(cumKm[hi]! - targetKm) ? lo : hi;
    result.push({ point: coords[idx]!, km: Math.round(cumKm[idx]! * 10) / 10 });
  }

  return result;
}

/**
 * Devuelve true si `point` está dentro de `thresholdKm` km
 * de cualquier punto muestreado de `polyline`.
 */
export function pointNearPolyline(
  point: { lat: number; lng: number },
  polyline: { lat: number; lng: number }[],
  thresholdKm: number,
): boolean {
  return polyline.some((p) => haversineKm(point, p) <= thresholdKm);
}
