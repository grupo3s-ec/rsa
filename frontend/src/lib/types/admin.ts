export type UserRole = 'admin' | 'operator' | 'driver';

export interface AdminUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  created_at: string;
}

export interface Vehicle {
  id: number;
  placa: string;
  marca: string;
  modelo: string;
  anio: number | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface PredefinedRoute {
  id: number;
  nombre: string;
  descripcion: string | null;
  origen: string;
  destino: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin:    'Administrador',
  operator: 'Operador',
  driver:   'Conductor',
};
