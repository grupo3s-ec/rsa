import { apiClient } from "@/lib/api/client";
import type {
  ApiResourceResponse,
  CreateIncidentPayload,
  Incident,
  PaginatedApiResponse,
} from "@/types/incident";

export function getIncidents(): Promise<PaginatedApiResponse<Incident>> {
  return apiClient.get<PaginatedApiResponse<Incident>>("/incidents");
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
