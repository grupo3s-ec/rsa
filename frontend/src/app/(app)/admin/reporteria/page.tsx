'use client';

import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, Legend,
  Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { getIncidentReport, getReportExportUrl } from '@/lib/api/admin';
import { getToken } from '@/lib/auth/token';
import type { IncidentReport } from '@/lib/types/admin';

const TYPE_LABELS: Record<string, string> = {
  accident:    'Accidente',
  traffic:     'Tráfico',
  hazard:      'Peligro',
  road_damage: 'Vía dañada',
  weather:     'Clima',
  other:       'Otro',
};
const TYPE_COLORS: Record<string, string> = {
  accident:    '#ef4444',
  traffic:     '#f59e0b',
  hazard:      '#f97316',
  road_damage: '#a16207',
  weather:     '#3b82f6',
  other:       '#6b7280',
};
const SEV_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#eab308',
  low:      '#22c55e',
};
const SEV_LABELS: Record<string, string> = {
  critical: 'Crítica',
  high:     'Alta',
  medium:   'Media',
  low:      'Baja',
};

const today = new Date().toISOString().split('T')[0]!;
const thirtyDaysAgo = new Date(Date.now() - 29 * 86_400_000).toISOString().split('T')[0]!;

export default function ReporteriaPage() {
  const [from,    setFrom]    = useState(thirtyDaysAgo);
  const [to,      setTo]      = useState(today);
  const [data,    setData]    = useState<IncidentReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  async function load(f: string, t: string) {
    setLoading(true);
    setError(null);
    try {
      setData(await getIncidentReport(f, t));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al cargar reportes.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(from, to); }, []);

  function handleApply() { void load(from, to); }

  function handleExport() {
    const url = getReportExportUrl(from, to);
    const token = getToken();
    // Descarga directa con token en header no es posible desde <a>, usamos fetch
    void fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'incidentes.csv';
        a.click();
        URL.revokeObjectURL(a.href);
      });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Encabezado + filtros */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-base font-semibold">Reportería</h1>
          <p className="text-sm text-muted-foreground">Análisis de incidentes por período</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-muted-foreground">Desde</label>
            <input
              type="date"
              value={from}
              max={to}
              onChange={e => setFrom(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-muted-foreground">Hasta</label>
            <input
              type="date"
              value={to}
              min={from}
              max={today}
              onChange={e => setTo(e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-sm"
            />
          </div>
          <Button size="sm" variant="outline" onClick={handleApply} disabled={loading}>
            Aplicar
          </Button>
          <Button size="sm" variant="outline" onClick={handleExport} disabled={loading || !data}>
            <Download className="size-3.5" />
            CSV
          </Button>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      ) : null}

      {/* KPIs */}
      {data ? (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total incidentes',  value: data.totals.all },
              { label: 'Abiertos',          value: data.totals.open },
              { label: 'En el período',     value: data.totals.in_period },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-xl border border-border/60 bg-card p-4">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
              </div>
            ))}
          </div>

          {/* Incidentes por día */}
          <div className="rounded-xl border border-border/60 bg-card p-4">
            <p className="mb-3 text-sm font-medium">Incidentes por día</p>
            {data.by_period.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Sin datos en el período.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data.by_period} margin={{ top: 4, right: 8, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10 }}
                    tickFormatter={d => d.slice(5)}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }}
                    labelFormatter={d => String(d)}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    name="Incidentes"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Tipo + Severidad */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Por tipo */}
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <p className="mb-3 text-sm font-medium">Por tipo</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data.by_type} layout="vertical" margin={{ top: 0, right: 8, bottom: 0, left: 60 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} stroke="hsl(var(--muted-foreground))" />
                  <YAxis
                    type="category"
                    dataKey="type"
                    tick={{ fontSize: 10 }}
                    tickFormatter={t => TYPE_LABELS[t] ?? t}
                    stroke="hsl(var(--muted-foreground))"
                  />
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }}
                    formatter={(v, n, p) => [v, TYPE_LABELS[(p.payload as { type: string }).type] ?? n]}
                  />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                    {data.by_type.map((entry) => (
                      <Cell key={entry.type} fill={TYPE_COLORS[entry.type] ?? '#6b7280'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Por severidad */}
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <p className="mb-3 text-sm font-medium">Por severidad</p>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={data.by_severity}
                    dataKey="total"
                    nameKey="severity"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    label={(props) => {
                      const sev = String((props as { severity?: string }).severity ?? '');
                      const pct = typeof props.percent === 'number' ? props.percent : 0;
                      return `${SEV_LABELS[sev] ?? sev} ${(pct * 100).toFixed(0)}%`;
                    }}
                    labelLine={false}
                  >
                    {data.by_severity.map((entry) => (
                      <Cell key={entry.severity} fill={SEV_COLORS[entry.severity] ?? '#6b7280'} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid hsl(var(--border))' }}
                    formatter={(v, n) => [v, SEV_LABELS[String(n)] ?? n]}
                  />
                  <Legend formatter={(v) => SEV_LABELS[v] ?? v} iconSize={10} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Por fuente */}
          <div className="rounded-xl border border-border/60 bg-card p-4">
            <p className="mb-3 text-sm font-medium">Por fuente</p>
            <div className="flex flex-wrap gap-3">
              {data.by_source.map((s) => (
                <div key={s.source} className="flex items-center gap-2 rounded-lg border border-border/60 px-4 py-2.5">
                  <span className="text-sm text-muted-foreground capitalize">{s.source}</span>
                  <span className="text-base font-semibold tabular-nums">{s.total}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : loading ? (
        <div className="py-16 text-center text-sm text-muted-foreground">Cargando…</div>
      ) : null}
    </div>
  );
}
