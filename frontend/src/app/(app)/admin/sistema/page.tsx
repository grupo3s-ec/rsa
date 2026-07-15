'use client';

import { useEffect, useState } from 'react';
import { getDashboardStats } from '@/lib/api/admin';
import { RoleGuard } from '@/components/auth/RoleGuard';
import type { DashboardStats } from '@/types/dashboard';

export default function SistemaPage() {
  return (
    <RoleGuard allowedRoles={['admin']}>
      <SistemaPageContent />
    </RoleGuard>
  );
}

function SistemaPageContent() {
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    getDashboardStats().then(setStats).catch(() => null);
  }, []);

  const items = stats ? [
    { group: 'Incidentes',  label: 'Total',    value: stats.incidents.total },
    { group: 'Incidentes',  label: 'Abiertos', value: stats.incidents.open },
    { group: 'Usuarios',    label: 'Total',    value: stats.users.total },
    { group: 'Vehículos',   label: 'Total',    value: stats.vehicles.total },
    { group: 'Vehículos',   label: 'Activos',  value: stats.vehicles.active },
    { group: 'Rutas',       label: 'Total',    value: stats.routes.total },
    { group: 'Rutas',       label: 'Activas',  value: stats.routes.active },
  ] : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-base font-semibold">Sistema</h1>
        <p className="text-sm text-muted-foreground">Información general del estado de la plataforma</p>
      </div>

      {/* Info de la plataforma */}
      <div className="rounded-xl border border-border/60 bg-card divide-y divide-border/40">
        {[
          { label: 'Plataforma',   value: 'RSA — Route Safety Analysis' },
          { label: 'Organización', value: 'Grupo3S' },
          { label: 'Backend',      value: 'Laravel 13 · PHP 8.4 (Render free tier)' },
          { label: 'Frontend',     value: 'Next.js 16 · Cloudflare Workers' },
          { label: 'Base de datos',value: 'PostgreSQL (Supabase)' },
          { label: 'Almacenamiento',value: 'Cloudflare R2' },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between px-4 py-3 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="font-medium">{value}</span>
          </div>
        ))}
      </div>

      {/* Conteos en tiempo real */}
      {stats ? (
        <div>
          <p className="mb-3 text-sm font-medium text-muted-foreground">Estado actual</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {items.map(({ group, label, value }) => (
              <div key={`${group}-${label}`} className="rounded-xl border border-border/60 bg-card p-4">
                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground/60">{group}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="py-6 text-center text-sm text-muted-foreground">Cargando estadísticas…</div>
      )}
    </div>
  );
}
