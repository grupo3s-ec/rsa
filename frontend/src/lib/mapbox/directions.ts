// Tipos geoespaciales compartidos usados en todo el proyecto.
// El cálculo de rutas se hace via Google Maps DirectionsService en RoutePlanner.

export type LngLat = [number, number];

export interface RouteLineString {
  type: "LineString";
  coordinates: LngLat[];
}

export interface DirectionsRoute {
  geometry: RouteLineString;
  distanceMeters: number;
  durationSeconds: number;
}
