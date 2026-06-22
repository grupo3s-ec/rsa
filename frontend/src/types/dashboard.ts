import type { Incident } from './incident';

export interface DashboardStats {
  incidents: {
    total: number;
    open: number;
    by_severity: Partial<Record<string, number>>;
    by_type: Partial<Record<string, number>>;
    by_status: Partial<Record<string, number>>;
    recent: Pick<Incident, 'id' | 'title' | 'type' | 'severity' | 'status' | 'occurred_at' | 'created_at'>[];
  };
  users: {
    total: number;
    by_role: Partial<Record<string, number>>;
  };
  vehicles: {
    total: number;
    active: number;
  };
  routes: {
    total: number;
    active: number;
  };
}
