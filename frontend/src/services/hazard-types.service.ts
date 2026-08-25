import { apiClient } from "@/lib/api/client";
import type { HazardType, IncidentCondition, IncidentSeverity } from "@/types/incident";

export function getHazardTypes(): Promise<{ data: HazardType[] }> {
  return apiClient.get<{ data: HazardType[] }>("/hazard-types");
}

export interface CreateHazardTypePayload {
  name: string;
  condition: IncidentCondition;
  severity: IncidentSeverity;
  risks?: string | null;
}

/** Crea (o devuelve el existente, si ya hay uno con ese nombre) un tipo de
 * incidente nuevo — usado por el combobox de texto libre en
 * IncidentCreateDialog cuando el tipo que se necesita no está en el catálogo. */
export function createHazardType(payload: CreateHazardTypePayload): Promise<HazardType> {
  return apiClient.post<HazardType, CreateHazardTypePayload>("/hazard-types", payload);
}
