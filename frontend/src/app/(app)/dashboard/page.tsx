'use client';

import { useEffect, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { AlertTriangle, CheckCircle2, RefreshCw, Route, Truck, Users } from 'lucide-react';
import { getDashboardStats } from '@/lib/api/admin';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { severityMeta, statusMeta } from '@/lib/incidents/format';
import { Skeleton } from '@/components/ui/skeleton';
import { SeverityBadge } from '@/components/incidents/SeverityBadge';
import { useCountUp } from '@/lib/ui/use-count-up';
import { relativeTime } from '@/lib/ui/relative-time';
import type { DashboardStats } from '@/types/dashboard';
import type { IncidentSeverity, IncidentStatus } from '@/types/incident';

// ── Color para estado ─────────────────────────────────────────────────────────

const STATUS_HEX: Record<IncidentStatus, string> = {
  open:        '#3b82f6',
  in_progress: '#a855f7',
  resolved:    '#22c55e',
  archived:    '#6b7280',
};

// ── Tooltip ───────────────────────────────────────────────────────────────────

interface TooltipPayload { name: string; value: number }

function ChartTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/60 bg-popover px-3 py-2 text-sm shadow-md">
      <span className="font-medium">{payload[0].name}</span>
      <span className="ml-2 text-muted-foreground">{payload[0].value}</span>
    </div>
  );
}

// ── Stat card con count-up ────────────────────────────────────────────────────

interface StatCardProps {
  label: string;
  value: number;
  sub?: string;
  icon: React.ReactNode;
  valueClass?: string;
}

function StatCard({ label, value, sub, icon, valueClass = 'text-foreground' }: StatCardProps) {
  const animated = useCountUp(value);
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border/60 bg-card px-5 py-4">
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold leading-tight tabular-nums ${valueClass}`}>{animated}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

// ── Página ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  return (
    <RoleGuard allowedRoles={['admin', 'operator']}>
      <DashboardPageContent />
    </RoleGuard>
  );
}

function DashboardPageContent() {
  const [stats, setStats]       = useState<DashboardStats | null>(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchStats(silent = false) {
    if (silent) setRefreshing(true);
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch {}
    finally {
      setLoading(false);
      if (silent) setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    if (loading) return;
    const id = setInterval(() => fetchStats(true), 60_000);
    return () => clearInterval(id);
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <DashboardSkeleton />;
  if (!stats)  return (
    <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
      No se pudo cargar el dashboard.
    </div>
  );

  const severityData = (Object.keys(severityMeta) as IncidentSeverity[])
    .map(key => ({ key, name: severityMeta[key].label, value: stats.incidents.by_severity[key] ?? 0, hex: severityMeta[key].hex }))
    .filter(d => d.value > 0);

  const statusData = (Object.keys(statusMeta) as IncidentStatus[])
    .map(key => ({ key, name: statusMeta[key].label, value: stats.incidents.by_status[key] ?? 0, hex: STATUS_HEX[key] }))
    .filter(d => d.value > 0);

  const typeData = Object.keys(stats.incidents.by_type)
    .map(name => ({ name, value: stats.incidents.by_type[name] ?? 0 }))
    .filter(d => d.value > 0);

  const openCount       = stats.incidents.by_status['open'] ?? 0;
  const resolvedCount   = stats.incidents.by_status['resolved'] ?? 0;
  const inProgressCount = stats.incidents.by_status['in_progress'] ?? 0;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-6 px-6 py-6">

        {/* Indicador de actualización silenciosa */}
        <div className="flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground/50">
          {refreshing && (
            <>
              <RefreshCw className="size-2.5 animate-spin" />
              <span>Actualizando…</span>
            </>
          )}
        </div>

        {/* KPI principales */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard
            label="Incidentes totales"
            value={stats.incidents.total}
            icon={<AlertTriangle className="size-4" />}
          />
          <StatCard
            label="Incidentes abiertos"
            value={openCount}
            valueClass={openCount > 0 ? 'text-red-500' : 'text-foreground'}
            icon={<AlertTriangle className="size-4" />}
          />
          <StatCard
            label="Vehículos activos"
            value={stats.vehicles.active}
            sub={`de ${stats.vehicles.total} total`}
            icon={<Truck className="size-4" />}
          />
          <StatCard
            label="Rutas activas"
            value={stats.routes.active}
            sub={`de ${stats.routes.total} total`}
            icon={<Route className="size-4" />}
          />
        </div>

        {/* KPI secundarios */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard
            label="Usuarios registrados"
            value={stats.users.total}
            sub={`${stats.users.by_role['driver'] ?? 0} conductores`}
            icon={<Users className="size-4" />}
          />
          <StatCard
            label="Incidentes resueltos"
            value={resolvedCount}
            valueClass="text-green-500"
            icon={<CheckCircle2 className="size-4" />}
          />
          <StatCard
            label="En progreso"
            value={inProgressCount}
            valueClass="text-purple-500"
            icon={<AlertTriangle className="size-4" />}
          />
        </div>

        {/* Gráficas */}
        <div className="grid gap-4 md:grid-cols-2">

          {/* Donut — severidad */}
          <ChartCard title="Por severidad">
            {severityData.length === 0 ? <EmptyChart /> : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={severityData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                      {severityData.map(d => <Cell key={d.key} fill={d.hex} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <Legend items={severityData.map(d => ({ label: d.name, count: d.value, hex: d.hex }))} />
              </>
            )}
          </ChartCard>

          {/* Donut — estado */}
          <ChartCard title="Por estado">
            {statusData.length === 0 ? <EmptyChart /> : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={statusData} cx="50%" cy="50%" innerRadius={55} outerRadius={80} paddingAngle={3} dataKey="value">
                      {statusData.map(d => <Cell key={d.key} fill={d.hex} />)}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <Legend items={statusData.map(d => ({ label: d.name, count: d.value, hex: d.hex }))} />
              </>
            )}
          </ChartCard>

          {/* Bar — tipo */}
          <ChartCard title="Por tipo" className="md:col-span-2">
            {typeData.length === 0 ? <EmptyChart /> : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={typeData} barSize={32}>
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6b7280' }} axisLine={false} tickLine={false} width={24} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f3f4f6', opacity: 0.6 }} />
                  <Bar dataKey="value" fill="#1A3562" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        {/* Últimos incidentes */}
        <div className="rounded-xl border border-border/60 bg-card">
          <div className="border-b border-border/60 px-5 py-3">
            <p className="text-sm font-medium">Últimos incidentes</p>
          </div>
          {stats.incidents.recent.length === 0
            ? <p className="px-5 py-8 text-center text-sm text-muted-foreground">Sin incidentes registrados</p>
            : (
              <ul className="divide-y divide-border/40">
                {stats.incidents.recent.map(inc => (
                  <li key={inc.id} className="flex items-center gap-3 px-5 py-3">
                    <SeverityBadge severity={inc.severity} />
                    <span className="min-w-0 flex-1 truncate text-sm">{inc.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {relativeTime(inc.occurred_at ?? inc.created_at)}
                    </span>
                  </li>
                ))}
              </ul>
            )
          }
        </div>

      </div>
    </div>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function ChartCard({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-border/60 bg-card p-5 ${className ?? ''}`}>
      <p className="mb-4 text-sm font-medium">{title}</p>
      {children}
    </div>
  );
}

function Legend({ items }: { items: { label: string; count: number; hex: string }[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
      {items.map(item => (
        <span key={item.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="size-2 rounded-full" style={{ backgroundColor: item.hex }} />
          {item.label} ({item.count})
        </span>
      ))}
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
      Sin datos aún
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-6 px-6 py-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-[76px] rounded-xl" />)}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-[76px] rounded-xl" />)}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-[280px] rounded-xl" />
          <Skeleton className="h-[280px] rounded-xl" />
          <Skeleton className="h-[280px] rounded-xl md:col-span-2" />
        </div>
        <Skeleton className="h-[200px] rounded-xl" />
      </div>
    </div>
  );
}
