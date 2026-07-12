export const INCIDENT_CONDITIONS = [
  "fisica",
  "natural",
  "entorno_riesgo_publico",
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

export type IncidentCondition = (typeof INCIDENT_CONDITIONS)[number];
export type IncidentSeverity = (typeof INCIDENT_SEVERITIES)[number];
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];
export type IncidentSource = (typeof INCIDENT_SOURCES)[number];

/** Catálogo de peligros — cada fila es un "Tipo de Condición" reportable, con su Condición, Riesgos y Severidad ya fijos. */
export interface HazardType {
  id: number;
  condition: IncidentCondition;
  name: string;
  risks: string | null;
  severity: IncidentSeverity;
}

export interface Incident {
  id: number;
  title: string;
  /** Nombre legible del hazard type seleccionado (denormalizado, ej. "Curva peligrosa"). */
  type: string;
  severity: IncidentSeverity;
  hazard_type_id: number | null;
  condition: IncidentCondition | null;
  risks: string | null;
  description: string | null;
  latitude: number;
  longitude: number;
  source: IncidentSource;
  video_url: string | null;
  occurred_at: string | null;
  status: IncidentStatus;
  geotab_exception_event_id: string | null;
  geotab_device_id: string | null;
  geotab_rule_id: string | null;
  altitude_meters: number | null;
  probability: number | null;
  impact: number | null;
  risk_score: number | null;
  risk_level: string | null;
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
export interface IncidentMedia {
  id: number;
  incident_id: number;
  media_type: 'photo' | 'video';
  url: string | null;
  thumbnail_url: string | null;
  file_name: string | null;
  file_size: number | null;
  geotab_media_file_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface IncidentHistoryEntry {
  id: number;
  incident_id: number;
  user_id: number | null;
  user: { id: number; name: string } | null;
  from_status: IncidentStatus | null;
  to_status: IncidentStatus;
  note: string | null;
  created_at: string;
}

export interface CreateIncidentPayload {
  title: string;
  hazard_type_id: number;
  description: string | null;
  latitude: number;
  longitude: number;
  source: IncidentSource;
  video_url: string | null;
  occurred_at: string | null;
  status?: IncidentStatus;
  probability?: number | null;
  impact?: number | null;
}
