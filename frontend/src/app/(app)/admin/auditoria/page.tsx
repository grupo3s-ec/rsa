'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { getAuditLog } from '@/lib/api/admin';
import type { AuditLogEntry, AuditLogPage } from '@/lib/types/admin';

const ACTION_LABELS: Record<string, string> = {
  'login':                  'Inicio de sesión',
  'logout':                 'Cierre de sesión',
  'incident.create':        'Incidente creado',
  'incident.status_change': 'Cambio de estado',
  'user.create':            'Usuario creado',
  'user.update':            'Usuario editado',
  'user.delete':            'Usuario eliminado',
};

const ACTION_COLORS: Record<string, string> = {
  'login':                  'bg-emerald-500/10 text-emerald-600',
  'logout':                 'bg-slate-500/10 text-slate-500',
  'incident.create':        'bg-blue-500/10 text-blue-600',
  'incident.status_change': 'bg-amber-500/10 text-amber-600',
  'user.create':            'bg-primary/10 text-primary',
  'user.update':            'bg-primary/10 text-primary',
  'user.delete':            'bg-destructive/10 text-destructive',
};

const ACTIONS = Object.keys(ACTION_LABELS);

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return 'ahora mismo';
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
}

export default function AuditoriaPage() {
  return (
    <RoleGuard allowedRoles={['admin']}>
      <AuditoriaPageContent />
    </RoleGuard>
  );
}

function AuditoriaPageContent() {
  const [page,          setPage]          = useState(1);
  const [actionFilter,  setActionFilter]  = useState('');
  const [result,        setResult]        = useState<AuditLogPage | null>(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState<string | null>(null);

  async function load(p: number, action: string) {
    setLoading(true);
    setError(null);
    try {
      setResult(await getAuditLog({ page: p, ...(action ? { action } : {}) }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar auditoría.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(page, actionFilter); }, [page, actionFilter]);

  function handleActionChange(a: string) {
    setActionFilter(a);
    setPage(1);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold">Auditoría</h1>
          <p className="text-sm text-muted-foreground">Registro de acciones del sistema</p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Acción</label>
          <select
            value={actionFilter}
            onChange={e => handleActionChange(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">Todas</option>
            {ACTIONS.map(a => (
              <option key={a} value={a}>{ACTION_LABELS[a]}</option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-border/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 bg-muted/40">
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Cuándo</th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Usuario</th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Acción</th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">Detalle</th>
              <th className="px-4 py-2.5 text-left font-medium text-muted-foreground">IP</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Cargando…</td>
              </tr>
            ) : !result?.data.length ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Sin registros.</td>
              </tr>
            ) : (
              result.data.map((log: AuditLogEntry) => (
                <tr key={log.id} className="border-b border-border/40 last:border-0 hover:bg-muted/30 transition-colors">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground" title={log.created_at}>
                    {relativeTime(log.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    {log.user ? (
                      <div>
                        <p className="font-medium leading-none">{log.user.name}</p>
                        <p className="text-xs text-muted-foreground">{log.user.email}</p>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ACTION_COLORS[log.action] ?? 'bg-muted text-muted-foreground'}`}>
                      {ACTION_LABELS[log.action] ?? log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {log.entity_label ?? '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {log.ip_address ?? '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      {result && result.last_page > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {result.total} registros · Página {result.current_page} de {result.last_page}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={page <= 1 || loading}
              onClick={() => setPage(p => p - 1)}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={page >= result.last_page || loading}
              onClick={() => setPage(p => p + 1)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
