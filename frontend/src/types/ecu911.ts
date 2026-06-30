export interface Ecu911GroupDetail {
  id: number;
  grupo_id: number;
  parent_id: number;
  nombre: string;
  details: null;
  estado: string;
  created: string;
}

export interface Ecu911EstadoActual {
  id: number;
  grupo_id: number;
  parent_id: number;
  nombre: string;
  details: null;
  estado: string;
  created: string;
}

export interface Ecu911Centro {
  id: number;
  nombre: string;
  provincia_id: number;
}

export interface Ecu911Provincia {
  id: number;
  parent_id: number;
  descripcion: string;
  tipo: string;
  codigo: string;
  estado: string;
  created: string;
  region: string | null;
}

export interface Ecu911Canton {
  id: number;
  parent_id: number;
  descripcion: string;
  tipo: string;
  codigo: string;
  estado: string;
  created: string;
  region: null;
}

export interface Ecu911ViaSimple {
  id: string;
  descripcion: string;
  codigo: string | null;
  estado_actual_id: number;
  observaciones: string;
  created: string;
  modified: string;
  categoria_id: number;
  estado: string;
}

export interface Ecu911DetalleViaAlterna {
  id: string;
  via_id: string;
  via_alterna_id: string;
  created: string;
  Via: Ecu911ViaSimple;
}

export interface Ecu911ViaRef {
  id: string;
  via_id: string;
  via_alterna_id: string;
  created: string;
}

export interface Ecu911Via {
  id: string;
  descripcion: string;
  codigo: string | null;
  estado_actual_id: number;
  centro_id: number;
  provincia_id: number;
  canton_id: number;
  observaciones: string;
  created: string;
  modified: string;
  categoria_id: number;
  estado: string;
  GroupDetail: Ecu911GroupDetail;
  EstadoActual: Ecu911EstadoActual;
  Centro: Ecu911Centro;
  Provincia: Ecu911Provincia;
  Canton: Ecu911Canton;
  ViaAlterna: Ecu911ViaRef[];
  DetalleViaAlterna: Ecu911DetalleViaAlterna[];
}

export interface Ecu911Response {
  data: Ecu911Via[];
  total: number;
  code: number;
}
