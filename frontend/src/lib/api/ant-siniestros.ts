import { apiClient } from '@/lib/api/client';

export interface AntSiniestro {
  id: number;
  codigo: string;
  anio: number;
  fecha: string | null;
  hora: string | null;
  lat: number;
  lng: number;
  dpa_provincia: string | null;
  provincia: string | null;
  dpa_canton: string | null;
  canton: string | null;
  dpa_parroquia: string | null;
  parroquia: string | null;
  direccion: string | null;
  zona_planificacion: string | null;
  zona: string | null;
  id_via: string | null;
  nombre_via: string | null;
  /** Entidad que reportó el siniestro (CTE, ATM, DMQ, municipios, etc.) —
   * no es una sola fuente, la BDD de la ANT consolida varios entes de control. */
  ente_control: string | null;
  feriado: boolean;
  codigo_causa: string | null;
  causa_probable: string | null;
  tipo_siniestro: string | null;
  lesionados: number;
  fallecidos: number;
  num_vehiculos: number;
}

export interface AntSiniestrosPage {
  data: AntSiniestro[];
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
}

export interface AntSiniestrosFilters {
  provincias?: string[];
  tipoSiniestro?: string;
  from?: string;
  to?: string;
  page?: number;
}

export interface AntSiniestrosOpciones {
  tipos_siniestro: string[];
  provincias: string[];
}

export function getAntSiniestros(filters: AntSiniestrosFilters = {}): Promise<AntSiniestrosPage> {
  return apiClient.get<AntSiniestrosPage>('/ant/siniestros', {
    query: {
      provincias: filters.provincias?.length ? filters.provincias.join(',') : undefined,
      tipo_siniestro: filters.tipoSiniestro,
      from: filters.from,
      to: filters.to,
      page: filters.page,
    },
  });
}

export function getAntSiniestrosOpciones(): Promise<AntSiniestrosOpciones> {
  return apiClient.get<AntSiniestrosOpciones>('/ant/siniestros/opciones');
}

export interface AntUploadResult {
  creados: number;
  actualizados: number;
  omitidos: number;
  total: number;
}

/** Sube el .xlsx mensual de la ANT — parsea y hace upsert por código
 * directo en el backend, sin pasos manuales. Puede pesar 100+ MB y tardar
 * varios minutos en Render free tier, de ahí el timeout largo. */
export function uploadAntSiniestros(file: File): Promise<AntUploadResult> {
  const form = new FormData();
  form.append('file', file);
  return apiClient.form<AntUploadResult>('/admin/ant/upload', form, 10 * 60_000);
}
