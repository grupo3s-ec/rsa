export const INCIDENT_TYPES = [
  "accident",
  "road_damage",
  "landslide",
  "closure",
  "risk",
  "checkpoint",
  "assistance",
] as const;

export const INCIDENT_SEVERITIES = [
  "low",
  "medium",
  "high",
  "critical",
] as const;

export const INCIDENT_STATUSES = [
  "open",
  "in_progress",
  "resolved",
  "archived",
] as const;

export const INCIDENT_SOURCES = [
  "manual",
  "google_drive",
  "geotab",
] as const;

export type IncidentType = (typeof INCIDENT_TYPES)[number];
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];
export type IncidentSource = (typeof INCIDENT_SOURCES)[number];

export interface Incident {
  id: number;
  title: string;
  type: IncidentType;
  severity: IncidentSeverity;
  description: string | null;
  latitude: number;
  longitude: number;
  source: IncidentSource;
  video_url: string | null;
  occurred_at: string | null;
  status: IncidentStatus;
  created_at: string | null;
  updated_at: string | null;
}

export interface PaginatedApiResponse<TItem> {
  data: TItem[];
  links: {
    first: string | null;
    last: string | null;
    prev: string | null;
    next: string | null;
  };
  meta: {
    current_page: number;
    from: number | null;
    last_page: number;
    path: string;
    per_page: number;
    to: number | null;
    total: number;
  };
}

export interface ApiResourceResponse<TItem> {
  data: TItem;
}

export interface RouteIncidentQuery {
  origin_lat: number;
  origin_lng: number;
  destination_lat: number;
  destination_lng: number;
}

/** Payload para POST /incidents — refleja las reglas de StoreIncidentRequest del backend. */
export interface CreateIncidentPayload {
  title: string;
  type: IncidentType;
  severity: IncidentSeverity;
  description: string | null;
  latitude: number;
  longitude: number;
  source: IncidentSource;
  video_url: string | null;
  occurred_at: string | null;
  status?: IncidentStatus;
}
