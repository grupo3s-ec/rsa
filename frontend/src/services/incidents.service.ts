import { apiClient } from "@/lib/api/client";
import type {
  ApiResourceResponse,
  Incident,
  PaginatedApiResponse,
} from "@/types/incident";

export function getIncidents(): Promise<PaginatedApiResponse<Incident>> {
  return apiClient.get<PaginatedApiResponse<Incident>>("/incidents");
}

export function getIncident(id: number): Promise<ApiResourceResponse<Incident>> {
  return apiClient.get<ApiResourceResponse<Incident>>(`/incidents/${id}`);
}
