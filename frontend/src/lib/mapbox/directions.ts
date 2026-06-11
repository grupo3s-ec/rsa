/**
 * Helper tipado para la Mapbox Directions API (perfil driving).
 *
 * Devuelve la geometría GeoJSON de la mejor ruta junto con su
 * distancia (metros) y duración (segundos).
 */

/** Par [longitud, latitud] — el orden que usa Mapbox. */
export type LngLat = [number, number];

/** Geometría GeoJSON LineString de la ruta. */
export interface RouteLineString {
  type: "LineString";
  coordinates: LngLat[];
}

/** Ruta cruda dentro de la respuesta de la Directions API. */
interface DirectionsApiRoute {
  geometry: RouteLineString;
  distance: number;
  duration: number;
}

/** Respuesta cruda de la Directions API (solo los campos que usamos). */
interface DirectionsApiResponse {
  routes: DirectionsApiRoute[];
  code: string;
}

/** Ruta normalizada para el consumo de la UI. */
export interface DirectionsRoute {
  geometry: RouteLineString;
  distanceMeters: number;
  durationSeconds: number;
}

interface FetchDirectionsParams {
  origin: LngLat;
  destination: LngLat;
  token: string;
}

const DIRECTIONS_BASE_URL = "https://api.mapbox.com/directions/v5/mapbox/driving";

/**
 * Consulta la mejor ruta en auto entre origen y destino.
 * Lanza un Error con mensaje claro si falta token, falla la red o no hay ruta.
 */
export async function fetchDirectionsRoute(
  params: FetchDirectionsParams,
): Promise<DirectionsRoute> {
  const { origin, destination, token } = params;

  if (!token) {
    throw new Error("No hay token de Mapbox configurado para calcular la ruta.");
  }

  const coordinates = `${origin[0]},${origin[1]};${destination[0]},${destination[1]}`;
  const url = `${DIRECTIONS_BASE_URL}/${coordinates}?geometries=geojson&overview=full&access_token=${token}`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`La Directions API respondió con estado ${response.status}.`);
  }

  const payload = (await response.json()) as DirectionsApiResponse;
  const bestRoute = payload.routes?.[0];

  if (!bestRoute) {
    throw new Error("No se encontró una ruta entre los puntos seleccionados.");
  }

  return {
    geometry: bestRoute.geometry,
    distanceMeters: bestRoute.distance,
    durationSeconds: bestRoute.duration,
  };
}
