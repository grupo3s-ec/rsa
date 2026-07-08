'use client';

import { useEffect, useState } from 'react';
import { Flame, LoaderCircle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Ecu911Response, Ecu911Via } from '@/types/ecu911';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type HeatLevel = 'low' | 'medium' | 'high' | 'critical';

interface ProvinciaHeat {
  nombre: string;
  cerradas: number;      // estado_actual_id = 595
  parciales: number;     // estado_actual_id = 594
  restricciones: number; // estado_actual_id = 592
  total: number;
  score: number;         // cerrada=3, parcial=2, restricción=1
  level: HeatLevel;
}

// ─── Meta visual por nivel ────────────────────────────────────────────────────

const HEAT_META: Record<HeatLevel, {
  label: string;
  bar: string;
  bg: string;
  text: string;
  dot: string;
  hex: string;
}> = {
  low:      { label: 'Bajo',     hex: '#10b981', bar: 'bg-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  medium:   { label: 'Medio',    hex: '#f97316', bar: 'bg-orange-500',  bg: 'bg-orange-500/10',  text: 'text-orange-600 dark:text-orange-400',   dot: 'bg-orange-500'  },
  high:     { label: 'Alto',     hex: '#f59e0b', bar: 'bg-amber-500',   bg: 'bg-amber-500/10',   text: 'text-amber-600  dark:text-amber-400',    dot: 'bg-amber-500'   },
  critical: { label: 'Crítico',  hex: '#dc2626', bar: 'bg-red-600',     bg: 'bg-red-600/10',     text: 'text-red-600    dark:text-red-400',       dot: 'bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.7)]' },
};

// ─── Procesamiento de datos ECU911 ────────────────────────────────────────────

function deriveLevel(p: Omit<ProvinciaHeat, 'level'>): HeatLevel {
  if (p.cerradas > 0) return 'critical';
  if (p.parciales > 0) return 'high';
  if (p.restricciones >= 2) return 'medium';
  return 'low';
}

function processVias(vias: Ecu911Via[]): ProvinciaHeat[] {
  const map = new Map<string, Omit<ProvinciaHeat, 'level'>>();

  for (const via of vias) {
    const key = via.Provincia.descripcion;
    const prev = map.get(key) ?? { nombre: key, cerradas: 0, parciales: 0, restricciones: 0, total: 0, score: 0 };

    if (via.estado_actual_id === 595) { prev.cerradas++;      prev.score += 3; }
    else if (via.estado_actual_id === 594) { prev.parciales++;     prev.score += 2; }
    else if (via.estado_actual_id === 592) { prev.restricciones++; prev.score += 1; }

    prev.total++;
    map.set(key, prev);
  }

  return Array.from(map.values())
    .map((p) => ({ ...p, level: deriveLevel(p) }))
    .sort((a, b) => b.score - a.score);
}

// ─── Componente ───────────────────────────────────────────────────────────────

interface CalorPanelProps {
  /**
   * null  → sin ruta seleccionada → mostrar todo Ecuador
   * []    → ruta sin conflictos cercanos → mostrar aviso
   * [...]  → provincias con restricciones en la ruta
   */
  filterProvinces?: string[] | null;
}

export function CalorPanel({ filterProvinces }: CalorPanelProps) {
  const [provincias, setProvincias] = useState<ProvinciaHeat[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState<string | null>(null);
  const [updatedAt,  setUpdatedAt]  = useState<Date | null>(null);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ecu911');
      if (!res.ok) throw new Error(`ECU911 respondió ${res.status}`);
      const json = (await res.json()) as Ecu911Response;
      setProvincias(processVias(json.data ?? []));
      setUpdatedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar datos');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchData();
    // Auto-refresh cada 5 minutos
    const id = setInterval(() => { void fetchData(); }, 5 * 60 * 1000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Aplicar filtro de ruta cuando está definido
  const filterSet = filterProvinces !== null && filterProvinces !== undefined
    ? new Set(filterProvinces)
    : null;
  const displayed = filterSet !== null
    ? provincias.filter((p) => filterSet.has(p.nombre))
    : provincias;

  const totalVias   = displayed.reduce((s, p) => s + p.total, 0);
  const cerradas    = displayed.reduce((s, p) => s + p.cerradas, 0);
  const maxScore    = Math.max(...displayed.map((p) => p.score), 1);
  const critCount   = displayed.filter((p) => p.level === 'critical').length;

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto bg-background p-6">

      {/* Encabezado */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Flame className="size-4 text-orange-500" />
            Mapa de Calor — Restricciones ECU911
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {filterSet !== null
              ? filterSet.size > 0
                ? `Filtrado por ruta · ${filterSet.size} provincia${filterSet.size !== 1 ? 's' : ''} afectada${filterSet.size !== 1 ? 's' : ''}`
                : 'Sin restricciones en los alrededores de la ruta'
              : 'Concentración de vías con problemas por provincia · Ecuador'}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-4">
          {!loading && (
            <>
              <div className="flex flex-col items-end text-xs">
                <span className="text-muted-foreground">Vías afectadas</span>
                <span className="text-base font-bold text-foreground tabular-nums">{totalVias}</span>
              </div>
              {cerradas > 0 && (
                <div className="flex flex-col items-end text-xs">
                  <span className="text-muted-foreground">Cerradas</span>
                  <span className="text-base font-bold text-red-600 dark:text-red-400 tabular-nums">{cerradas}</span>
                </div>
              )}
            </>
          )}
          <button
            type="button"
            onClick={() => void fetchData()}
            disabled={loading}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-50"
            aria-label="Actualizar"
          >
            <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Estado carga / error */}
      {loading && provincias.length === 0 ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" />
          Cargando datos ECU911…
        </div>
      ) : error ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : filterSet !== null && filterSet.size === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Sin restricciones activas en los alrededores de la ruta
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          Sin vías con restricciones activas
        </div>
      ) : (
        <>
          {/* Tira de calor visual */}
          <div className="space-y-1">
            <div className="flex h-5 overflow-hidden rounded-full gap-px">
              {displayed.map((p) => {
                const totalScore = displayed.reduce((s, x) => s + x.score, 0);
                const width = Math.max((p.score / totalScore) * 100, 2);
                return (
                  <div
                    key={p.nombre}
                    title={`${p.nombre}: ${p.total} vía${p.total !== 1 ? 's' : ''}`}
                    className={cn('transition-opacity hover:opacity-75', HEAT_META[p.level].bar)}
                    style={{
                      width: `${width}%`,
                      opacity: 0.45 + (p.score / maxScore) * 0.55,
                    }}
                  />
                );
              })}
            </div>
            <div className="flex justify-between px-1 text-[10px] text-muted-foreground">
              <span>{displayed[0]?.nombre}</span>
              <span className="text-right">{displayed[displayed.length - 1]?.nombre}</span>
            </div>
          </div>

          {/* Resumen de zonas críticas */}
          {critCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
              <span className="size-2 shrink-0 rounded-full bg-red-600 shadow-[0_0_8px_rgba(220,38,38,0.7)]" />
              <p className="text-xs font-medium text-red-700 dark:text-red-400">
                {critCount} provincia{critCount !== 1 ? 's' : ''} con vías cerradas
              </p>
            </div>
          )}

          {/* Lista de provincias */}
          <div className="flex flex-col gap-2">
            {displayed.map((p) => {
              const meta   = HEAT_META[p.level];
              const barPct = (p.score / maxScore) * 100;
              const badges: { label: string; color: string }[] = [];
              if (p.cerradas)      badges.push({ label: `${p.cerradas} cerrada${p.cerradas !== 1 ? 's' : ''}`,          color: 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400' });
              if (p.parciales)     badges.push({ label: `${p.parciales} parcial${p.parciales !== 1 ? 'es' : ''}`,       color: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' });
              if (p.restricciones) badges.push({ label: `${p.restricciones} restricción${p.restricciones !== 1 ? 'es' : ''}`, color: 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400' });

              return (
                <div
                  key={p.nombre}
                  className={cn('rounded-xl border border-border/40 p-4 transition-colors hover:border-border', meta.bg)}
                >
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className={cn('size-2 shrink-0 rounded-full', meta.dot)} />
                      <span className="truncate text-sm font-medium text-foreground">{p.nombre}</span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={cn('text-xs font-semibold', meta.text)}>{meta.label}</span>
                      <span className="tabular-nums text-sm font-bold text-foreground">
                        {p.total} vía{p.total !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  {/* Barra de densidad */}
                  <div className="h-1.5 overflow-hidden rounded-full bg-border/30">
                    <div
                      className={cn('h-full rounded-full transition-all', meta.bar)}
                      style={{ width: `${barPct}%` }}
                    />
                  </div>

                  {/* Badges por tipo */}
                  {badges.length > 0 && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {badges.map((b) => (
                        <span
                          key={b.label}
                          className={cn('rounded-full px-2 py-0.5 text-[10px] font-semibold', b.color)}
                        >
                          {b.label}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pie — leyenda + timestamp */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/40 pt-3 text-[11px] text-muted-foreground">
            <div className="flex flex-wrap gap-4">
              {(Object.entries(HEAT_META) as [HeatLevel, typeof HEAT_META[HeatLevel]][]).map(([key, m]) => (
                <span key={key} className="flex items-center gap-1.5">
                  <span className={cn('size-2.5 rounded-full', m.dot)} />
                  {m.label}
                </span>
              ))}
            </div>
            {updatedAt && (
              <span>
                Actualizado {updatedAt.toLocaleTimeString('es-EC', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
