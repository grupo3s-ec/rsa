import { apiClient } from '@/lib/api/client';

export interface MitAdverseEvent {
  id: number;
  region: number | null;
  provincia: string;
  fecha_periodo_texto: string;
  tramo: string;
  evento: string;
  acciones_realizadas: string | null;
  observaciones: string | null;
  recomendaciones: string | null;
  ruta_codigo: string | null;
  tipo_evento: string;
  fecha_evento_inicio: string | null;
  fecha_evento_fin: string | null;
  inicio_lat: number | null;
  inicio_lng: number | null;
  fin_lat: number | null;
  fin_lng: number | null;
  geocoding_status: 'pendiente' | 'ok' | 'fallido';
  /** JSON (`string[]`) con la polyline codificada (formato estándar de
   * Google) de cada tramo (`step`) de la ruta por carretera entre inicio y
   * fin — decodificar cada una con `google.maps.geometry.encoding.decodePath`
   * y concatenarlas da el trazado completo. `null` si aún no se calculó, o si
   * no hay ruta conocida entre esos dos puntos; el mapa cae de vuelta a una
   * línea recta en ese caso. */
  ruta_polyline: string | null;
  fuente_nombre: string;
  fuente_boletin: string;
  boletin_mes: number;
  boletin_anio: number;
}

export interface MitEventosPage {
  data: MitAdverseEvent[];
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
}

export interface MitEventosFilters {
  rutaCodigo?: string;
  tipoEvento?: string;
  /** Una o más provincias (una ruta calculada puede cruzar varias) — se
   * envían todas juntas, no solo la primera. */
  provincias?: string[];
  from?: string;
  to?: string;
  search?: string;
  page?: number;
}

export interface MitEventosOpciones {
  tipos_evento: string[];
  rutas: string[];
  provincias: string[];
}

export function getMitEventos(filters: MitEventosFilters = {}): Promise<MitEventosPage> {
  return apiClient.get<MitEventosPage>('/mit/eventos-adversos', {
    query: {
      ruta_codigo: filters.rutaCodigo,
      tipo_evento: filters.tipoEvento,
      provincias: filters.provincias?.length ? filters.provincias.join(',') : undefined,
      from: filters.from,
      to: filters.to,
      search: filters.search,
      page: filters.page,
    },
  });
}

export function getMitEventosOpciones(): Promise<MitEventosOpciones> {
  return apiClient.get<MitEventosOpciones>('/mit/eventos-adversos/opciones');
}
