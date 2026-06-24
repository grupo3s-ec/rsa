export type LngLat = [number, number];

export interface RouteLineString {
  type: "LineString";
  coordinates: LngLat[];
}

interface DirectionsApiRoute {
  geometry: RouteLineString;
  distance: number;
  duration: number;
}

interface DirectionsApiResponse {
  routes: DirectionsApiRoute[];
  code: string;
}

export interface DirectionsRoute {
  geometry: RouteLineString;
  distanceMeters: number;
  durationSeconds: number;
}

export interface FetchDirectionsParams {
  waypoints: LngLat[];
  token: string;
}

const DIRECTIONS_BASE_URL = "https://api.mapbox.com/directions/v5/mapbox/driving";

export async function fetchDirectionsRoute(
  params: FetchDirectionsParams,
): Promise<DirectionsRoute> {
  const { waypoints, token } = params;

  if (!token) {
    throw new Error("No hay token de Mapbox configurado para calcular la ruta.");
  }
  if (waypoints.length < 2) {
    throw new Error("Se necesitan al menos 2 puntos para calcular la ruta.");
  }

  const coordinates = waypoints.map(([lng, lat]) => `${lng},${lat}`).join(";");
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
