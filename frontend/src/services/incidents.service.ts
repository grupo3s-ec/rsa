import { apiClient } from "@/lib/api/client";
import type {
  ApiResourceResponse,
  CreateIncidentPayload,
  HazardType,
  Incident,
  IncidentHistoryEntry,
  IncidentMedia,
  IncidentStatus,
  PaginatedApiResponse,
} from "@/types/incident";

export function getIncidents(): Promise<PaginatedApiResponse<Incident>> {
  return apiClient.get<PaginatedApiResponse<Incident>>("/incidents");
}

export function getHazardTypes(): Promise<ApiResourceResponse<HazardType[]>> {
  return apiClient.get<ApiResourceResponse<HazardType[]>>("/hazard-types");
}

export function getIncident(id: number): Promise<ApiResourceResponse<Incident>> {
  return apiClient.get<ApiResourceResponse<Incident>>(`/incidents/${id}`);
}

export function createIncident(
  payload: CreateIncidentPayload,
): Promise<ApiResourceResponse<Incident>> {
  return apiClient.post<ApiResourceResponse<Incident>, CreateIncidentPayload>(
    "/incidents",
    payload,
  );
}

export function updateIncidentStatus(
  id: number,
  status: IncidentStatus,
  note?: string,
): Promise<ApiResourceResponse<Incident>> {
  return apiClient.patch<ApiResourceResponse<Incident>, { status: IncidentStatus; note?: string }>(
    `/incidents/${id}`,
    { status, ...(note ? { note } : {}) },
  );
}

export function getIncidentHistory(id: number): Promise<IncidentHistoryEntry[]> {
  return apiClient.get<IncidentHistoryEntry[]>(`/incidents/${id}/history`);
}

export function getIncidentMedia(id: number): Promise<IncidentMedia[]> {
  return apiClient.get<IncidentMedia[]>(`/incidents/${id}/media`);
}

export function addIncidentMedia(
  id: number,
  payload: { url: string; media_type: 'photo' | 'video'; file_name?: string },
): Promise<IncidentMedia> {
  return apiClient.post<IncidentMedia, typeof payload>(`/incidents/${id}/media`, payload);
}

export function deleteIncidentMedia(incidentId: number, mediaId: number): Promise<void> {
  return apiClient.delete<void>(`/incidents/${incidentId}/media/${mediaId}`);
}

export function uploadIncidentPhoto(
  id: number,
  file: File,
  mediaType: 'photo' | 'video' = 'photo',
): Promise<IncidentMedia> {
  const form = new FormData();
  form.append('file', file);
  form.append('media_type', mediaType);
  return apiClient.form<IncidentMedia>(`/incidents/${id}/media/upload`, form);
}
