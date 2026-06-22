import { apiClient } from './client';
import type { AdminUser, PredefinedRoute, UserRole, Vehicle } from '@/lib/types/admin';
import type { DashboardStats } from '@/types/dashboard';

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function getDashboardStats(): Promise<DashboardStats> {
  return apiClient.get<DashboardStats>('/admin/dashboard');
}

// ── Usuarios ──────────────────────────────────────────────────────────────────

export function listUsers(): Promise<AdminUser[]> {
  return apiClient.get<AdminUser[]>('/admin/users');
}

export function createUser(data: {
  name: string;
  email: string;
  password: string;
  role: UserRole;
}): Promise<AdminUser> {
  return apiClient.post<AdminUser, typeof data>('/admin/users', data);
}

export function updateUser(
  id: number,
  data: Partial<{ name: string; email: string; password: string; role: UserRole }>,
): Promise<AdminUser> {
  return apiClient.patch<AdminUser, typeof data>(`/admin/users/${id}`, data);
}

export function deleteUser(id: number): Promise<void> {
  return apiClient.delete<void>(`/admin/users/${id}`);
}

// ── Vehículos ─────────────────────────────────────────────────────────────────

export function listVehicles(): Promise<Vehicle[]> {
  return apiClient.get<Vehicle[]>('/admin/vehicles');
}

export function createVehicle(data: {
  placa: string;
  marca: string;
  modelo: string;
  anio?: number | null;
  activo?: boolean;
}): Promise<Vehicle> {
  return apiClient.post<Vehicle, typeof data>('/admin/vehicles', data);
}

export function updateVehicle(
  id: number,
  data: Partial<{ placa: string; marca: string; modelo: string; anio: number | null; activo: boolean }>,
): Promise<Vehicle> {
  return apiClient.patch<Vehicle, typeof data>(`/admin/vehicles/${id}`, data);
}

export function deleteVehicle(id: number): Promise<void> {
  return apiClient.delete<void>(`/admin/vehicles/${id}`);
}

// ── Rutas predefinidas ────────────────────────────────────────────────────────

export function listPredefinedRoutes(): Promise<PredefinedRoute[]> {
  return apiClient.get<PredefinedRoute[]>('/admin/routes');
}

export function createPredefinedRoute(data: {
  nombre: string;
  descripcion?: string | null;
  origen: string;
  destino: string;
  activo?: boolean;
}): Promise<PredefinedRoute> {
  return apiClient.post<PredefinedRoute, typeof data>('/admin/routes', data);
}

export function updatePredefinedRoute(
  id: number,
  data: Partial<{
    nombre: string;
    descripcion: string | null;
    origen: string;
    destino: string;
    activo: boolean;
  }>,
): Promise<PredefinedRoute> {
  return apiClient.patch<PredefinedRoute, typeof data>(`/admin/routes/${id}`, data);
}

export function deletePredefinedRoute(id: number): Promise<void> {
  return apiClient.delete<void>(`/admin/routes/${id}`);
}
