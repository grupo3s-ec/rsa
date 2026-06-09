import { apiClient } from "@/lib/api/client";
import type { QueryParams } from "@/lib/api/client";
import type { Incident, RouteIncidentQuery } from "@/types/incident";

export interface RouteIncidentsResponse {
  data: Incident[];
}

function toRouteIncidentQueryParams(query: RouteIncidentQuery): QueryParams {
  return {
    origin_lat: query.origin_lat,
    origin_lng: query.origin_lng,
    destination_lat: query.destination_lat,
    destination_lng: query.destination_lng,
  };
}

export function getRouteIncidents(
  query: RouteIncidentQuery,
): Promise<RouteIncidentsResponse> {
  return apiClient.get<RouteIncidentsResponse>("/routes/incidents", {
    query: toRouteIncidentQueryParams(query),
  });
}
