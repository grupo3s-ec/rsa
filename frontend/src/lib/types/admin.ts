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

// ── Reportería ────────────────────────────────────────────────────────────────

export interface ReportPeriodPoint {
  date: string;
  total: number;
}

export interface IncidentReport {
  period: { from: string; to: string };
  totals: { all: number; open: number; in_period: number };
  by_period: ReportPeriodPoint[];
  by_type:     { type: string; total: number }[];
  by_severity: { severity: string; total: number }[];
  by_source:   { source: string; total: number }[];
}

// ── Auditoría ─────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: number;
  user_id: number | null;
  user: { id: number; name: string; email: string } | null;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  entity_label: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface AuditLogPage {
  data: AuditLogEntry[];
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
}
