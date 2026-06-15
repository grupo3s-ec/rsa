import { apiClient } from './client';

export interface GeotabStatus {
  configured: boolean;
  connected?: boolean;
  error?: string;
  message?: string;
}

export interface GeotabDevice {
  id: string;
  name: string;
  serialNumber: string | null;
  licensePlate: string | null;
  comment: string | null;
}

export interface GeotabSyncPayload {
  from_date: string;
  to_date: string;
  device_id: string | null;
}

export interface GeotabSyncResult {
  events_found: number;
  created: number;
  skipped: number;
}

export function getGeotabStatus(): Promise<GeotabStatus> {
  return apiClient.get<GeotabStatus>('/admin/geotab/status');
}

export function getGeotabDevices(): Promise<GeotabDevice[]> {
  return apiClient.get<GeotabDevice[]>('/admin/geotab/devices');
}

export function syncGeotab(payload: GeotabSyncPayload): Promise<GeotabSyncResult> {
  return apiClient.post<GeotabSyncResult, GeotabSyncPayload>('/admin/geotab/sync', payload);
}
