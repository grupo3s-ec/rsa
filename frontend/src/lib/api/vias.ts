import { apiClient } from '@/lib/api/client';

export interface ViaStatusEvent {
  id: number;
  via_ecu911_id: string;
  descripcion: string;
  provincia: string;
  canton: string | null;
  estado_anterior_id: number | null;
  estado_actual_id: number;
  estado_actual_nombre: string;
  observaciones: string | null;
  via_modified_at: string | null;
  detected_at: string;
}

export interface ViaHistoryPage {
  data: ViaStatusEvent[];
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
}

export interface ViaHistoryFilters {
  provincias?: string[];
  estadoActualId?: number;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
}

export function getViaHistory(filters: ViaHistoryFilters = {}): Promise<ViaHistoryPage> {
  return apiClient.get<ViaHistoryPage>('/vias/history', {
    query: {
      provincias: filters.provincias?.length ? filters.provincias.join(',') : undefined,
      estado_actual_id: filters.estadoActualId,
      from: filters.from,
      to: filters.to,
      search: filters.search,
      page: filters.page,
    },
  });
}
