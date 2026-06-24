import { apiClient } from './client';
import type { AdminUser, AuditLogPage, IncidentReport, PredefinedRoute, UserRole, Vehicle } from '@/lib/types/admin';
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

// ── Reportería ────────────────────────────────────────────────────────────────

export function getIncidentReport(from?: string, to?: string): Promise<IncidentReport> {
  return apiClient.get<IncidentReport>('/admin/reports/incidents', {
    query: { ...(from ? { from } : {}), ...(to ? { to } : {}) },
  });
}

export function getReportExportUrl(from?: string, to?: string): string {
  const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').replace(/\/$/, '');
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to)   params.set('to', to);
  const qs = params.toString();
  return `${base}/admin/reports/incidents/export${qs ? `?${qs}` : ''}`;
}

// ── Auditoría ─────────────────────────────────────────────────────────────────

export function getAuditLog(params?: {
  page?: number;
  action?: string;
  user_id?: number;
  entity_type?: string;
}): Promise<AuditLogPage> {
  return apiClient.get<AuditLogPage>('/admin/audit', { query: params as Record<string, string | number | boolean | null | undefined> });
}
