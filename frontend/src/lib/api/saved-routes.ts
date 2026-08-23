import { apiClient } from '@/lib/api/client';

export interface SavedRouteWaypoint {
  lat: number;
  lng: number;
  address: string | null;
  placeId?: string | null;
}

export interface SavedRoute {
  id: number;
  user_id: number;
  nombre: string;
  waypoints: SavedRouteWaypoint[];
  created_at: string;
  updated_at: string;
}

export function getSavedRoutes(): Promise<SavedRoute[]> {
  return apiClient.get<SavedRoute[]>('/saved-routes');
}

export function createSavedRoute(nombre: string, waypoints: SavedRouteWaypoint[]): Promise<SavedRoute> {
  return apiClient.post<SavedRoute, { nombre: string; waypoints: SavedRouteWaypoint[] }>('/saved-routes', { nombre, waypoints });
}

export function deleteSavedRoute(id: number): Promise<null> {
  return apiClient.delete<null>(`/saved-routes/${id}`);
}
