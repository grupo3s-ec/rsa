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

export interface RouteSample { point: [number, number]; km: number; }

/** km acumulados de cada punto original de la polilínea (mismo orden que `coords`). */
function cumulativeKm(coords: Array<[number, number]>): number[] {
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
  return cumKm;
}

/** Búsqueda binaria del índice de `cumKm` cuyo km está más cerca de `targetKm`. */
function nearestCumKmIndex(cumKm: number[], targetKm: number): number {
  let lo = 0, hi = cumKm.length - 1;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (cumKm[mid]! < targetKm) lo = mid; else hi = mid;
  }
  return Math.abs(cumKm[lo]! - targetKm) <= Math.abs(cumKm[hi]! - targetKm) ? lo : hi;
}

/**
 * Toma N puntos equidistantes de la polilínea y devuelve cada punto
 * junto con su posición acumulada en km desde el inicio.
 */
export function subsampleRoute(
  coords: Array<[number, number]>, // [lng, lat]
  n: number,
): RouteSample[] {
  if (coords.length === 0) return [];

  const cumKm = cumulativeKm(coords);

  if (coords.length <= n) {
    return coords.map((c, i) => ({ point: c, km: Math.round(cumKm[i]! * 10) / 10 }));
  }

  const total = cumKm[cumKm.length - 1]!;
  const result: RouteSample[] = [];

  for (let s = 0; s < n; s++) {
    const targetKm = (s / (n - 1)) * total;
    const idx = nearestCumKmIndex(cumKm, targetKm);
    result.push({ point: coords[idx]!, km: Math.round(cumKm[idx]! * 10) / 10 });
  }

  return result;
}

/**
 * Como `subsampleRoute`, pero muestrea N puntos equidistantes solo dentro de
 * `[fromKm, toKm]` (recortado a los límites reales de la ruta) — permite
 * "hacer zoom" a un tramo mostrando más densidad de puntos en ese rango, sin
 * volver a pedir datos (útil para el gráfico de altimetría/clima cuando el
 * mapa se enfoca en una sección).
 */
export function subsampleRouteRange(
  coords: Array<[number, number]>,
  fromKm: number,
  toKm: number,
  n: number,
): RouteSample[] {
  if (coords.length === 0) return [];

  const cumKm = cumulativeKm(coords);
  const total = cumKm[cumKm.length - 1]!;
  const from = Math.max(0, Math.min(fromKm, total));
  const to = Math.max(from, Math.min(toKm, total));

  if (to - from < 1e-9) {
    const idx = nearestCumKmIndex(cumKm, from);
    return [{ point: coords[idx]!, km: Math.round(cumKm[idx]! * 10) / 10 }];
  }

  const result: RouteSample[] = [];
  for (let s = 0; s < n; s++) {
    const targetKm = from + (s / (n - 1)) * (to - from);
    const idx = nearestCumKmIndex(cumKm, targetKm);
    result.push({ point: coords[idx]!, km: Math.round(cumKm[idx]! * 10) / 10 });
  }
  return result;
}

/** Bounding box lat/lng crudo, sin depender de la API de Google Maps —
 * `RouteMap` construye el `google.maps.LatLngBounds` real a partir de esto. */
export interface RawLatLngBounds { north: number; south: number; east: number; west: number; }

/** Posición en km a lo largo de la ruta del punto de `samples` más cercano a
 * `point` (línea recta, no por carretera) — `scale` corrige el km acumulado
 * por Haversine contra el km real de la ruta (distancia por carretera de la
 * API de rutas, siempre algo mayor que la suma de líneas rectas). Mismo
 * patrón usado en 3 lugares de `RouteTimeline.tsx` antes de extraerlo aquí. */
export function kmPositionAlongRoute(
  point: { lat: number; lng: number },
  samples: RouteSample[],
  scale: number,
): number {
  let bestKm = 0, bestDist = Infinity;
  for (const s of samples) {
    const d = haversineKm(point, { lat: s.point[1], lng: s.point[0] });
    if (d < bestDist) { bestDist = d; bestKm = s.km; }
  }
  return Math.round(bestKm * scale * 10) / 10;
}

/** Rango de km de la ruta que cae dentro del viewport visible del mapa —
 * `null` si ningún punto muestreado de la ruta está dentro de `bounds`
 * (el usuario se alejó/paneó fuera de la ruta por completo).
 *
 * Nos quedamos solo con el tramo CONTIGUO más largo de muestras visibles (por
 * índice en `samples`, no por km) en vez de fusionar el km mínimo y máximo
 * global: en una ruta con una curva en herradura, el viewport puede contener
 * dos pasadas de la ruta que están cerca en el mapa pero lejos en progreso de
 * ruta — fusionarlas produciría un rango absurdamente ancho que incluye todo
 * el tramo intermedio, que en realidad no está visible. */
export function kmRangeVisibleInBounds(
  samples: RouteSample[],
  bounds: RawLatLngBounds,
): [number, number] | null {
  const visibleIdx: number[] = [];
  samples.forEach((s, i) => {
    const [lng, lat] = s.point;
    if (lat <= bounds.north && lat >= bounds.south && lng >= bounds.west && lng <= bounds.east) {
      visibleIdx.push(i);
    }
  });
  if (visibleIdx.length === 0) return null;

  let bestStart = visibleIdx[0]!, bestEnd = visibleIdx[0]!;
  let curStart = visibleIdx[0]!, curEnd = visibleIdx[0]!;
  for (let i = 1; i < visibleIdx.length; i++) {
    if (visibleIdx[i] === curEnd + 1) {
      curEnd = visibleIdx[i]!;
    } else {
      if (curEnd - curStart > bestEnd - bestStart) { bestStart = curStart; bestEnd = curEnd; }
      curStart = visibleIdx[i]!;
      curEnd = visibleIdx[i]!;
    }
  }
  if (curEnd - curStart > bestEnd - bestStart) { bestStart = curStart; bestEnd = curEnd; }

  return [samples[bestStart]!.km, samples[bestEnd]!.km];
}

/** Inverso de `kmRangeVisibleInBounds`: bounding box lat/lng de los puntos de
 * la ruta dentro de `[fromKm, toKm]` — para que el mapa haga `fitBounds` al
 * rango seleccionado en el gráfico. `null` solo si no hay ninguna muestra
 * (ruta vacía); si el rango es más angosto que la separación entre muestras
 * (posible con pocas muestras y un arrastre muy corto del selector), usamos
 * el punto muestreado más cercano al centro del rango como aproximación en
 * vez de devolver null — así el mapa siempre sigue un foco activo, aunque
 * sea con un punto en vez de una caja. */
export function boundsForKmRange(
  samples: RouteSample[],
  range: [number, number],
): RawLatLngBounds | null {
  if (samples.length === 0) return null;
  const [fromKm, toKm] = range;
  let north = -Infinity, south = Infinity, east = -Infinity, west = Infinity;
  let found = false;
  for (const s of samples) {
    if (s.km < fromKm || s.km > toKm) continue;
    found = true;
    const [lng, lat] = s.point;
    if (lat > north) north = lat;
    if (lat < south) south = lat;
    if (lng > east) east = lng;
    if (lng < west) west = lng;
  }
  if (found) return { north, south, east, west };

  const centerKm = (fromKm + toKm) / 2;
  let nearest = samples[0]!;
  let bestDist = Math.abs(nearest.km - centerKm);
  for (const s of samples) {
    const d = Math.abs(s.km - centerKm);
    if (d < bestDist) { bestDist = d; nearest = s; }
  }
  const [lng, lat] = nearest.point;
  return { north: lat, south: lat, east: lng, west: lng };
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
