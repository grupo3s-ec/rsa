'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, Route, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { relativeTime } from '@/lib/ui/relative-time';
import type { Ecu911Via, Ecu911Response } from '@/types/ecu911';

// Mapeo de estado_actual_id a meta visual
const ESTADO_META: Record<number, { label: string; bg: string; text: string; dot: string }> = {
  592: {
    label: 'Con restricción',
    bg:   'bg-orange-500/10',
    text: 'text-orange-600 dark:text-orange-400',
    dot:  'bg-orange-500',
  },
  594: {
    label: 'Parcialmente habilitada',
    bg:   'bg-amber-500/10',
    text: 'text-amber-600 dark:text-amber-400',
    dot:  'bg-amber-500',
  },
  595: {
    label: 'Cerrada',
    bg:   'bg-red-500/10',
    text: 'text-red-600 dark:text-red-400',
    dot:  'bg-red-600',
  },
};

const DEFAULT_ESTADO_META = {
  label: 'Afectada',
  bg:   'bg-muted/40',
  text: 'text-muted-foreground',
  dot:  'bg-muted-foreground',
};

type FilterEstado = 'todas' | 592 | 594 | 595;

function getEstadoMeta(id: number) {
  return ESTADO_META[id] ?? DEFAULT_ESTADO_META;
}

function ViaCard({ via }: { via: Ecu911Via }) {
  const [expanded, setExpanded] = useState(false);
  const meta = getEstadoMeta(via.estado_actual_id);
  const hasAlterna = via.DetalleViaAlterna.length > 0;

  return (
    <div className={cn('rounded-xl border border-border/40 transition-colors hover:border-border', meta.bg)}>
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <p className="text-sm font-medium text-foreground leading-snug flex-1">{via.descripcion}</p>
          <span className={cn('shrink-0 text-[10px] font-semibold rounded-full px-2 py-0.5 whitespace-nowrap', meta.text, 'bg-background/60 border border-current/20')}>
            {meta.label}
          </span>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-2">
          <span className={cn('size-1.5 rounded-full shrink-0', meta.dot)} />
          <span>{via.Provincia.descripcion} · {via.Canton.descripcion}</span>
          <span className="ml-auto shrink-0 text-right" title={via.modified}>
            {relativeTime(via.modified)} · {new Date(via.modified.replace(' ', 'T')).toLocaleString('es-EC', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {via.observaciones}
        </p>

        {(via.observaciones.length > 120 || hasAlterna) && (
          <button
            type="button"
            onClick={() => setExpanded(v => !v)}
            className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
            {expanded ? 'Ver menos' : (hasAlterna ? 'Ver vías alternas' : 'Ver completo')}
          </button>
        )}

        {expanded && (
          <div className="mt-2 space-y-1.5">
            {via.observaciones.length > 120 && (
              <p className="text-xs text-muted-foreground leading-relaxed">{via.observaciones}</p>
            )}
            {hasAlterna && (
              <div className="rounded-lg border border-border/40 bg-background/60 p-2.5">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                  Vías alternas
                </p>
                {via.DetalleViaAlterna.map(d => (
                  <p key={d.id} className="text-xs text-foreground">{d.Via.descripcion}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function ViaEstadoPanel() {
  const [vias,        setVias]        = useState<Ecu911Via[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState(false);
  const [fetchedAt,   setFetchedAt]   = useState<string | null>(null);
  const [filter,      setFilter]      = useState<FilterEstado>('todas');
  const [search,      setSearch]      = useState('');
  const [clock,       setClock]       = useState('');
  const clockRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reloj en vivo (igual que ECU911)
  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleString('es-EC', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }));
    tick();
    clockRef.current = setInterval(tick, 1000);
    return () => { if (clockRef.current) clearInterval(clockRef.current); };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/ecu911');
      if (!res.ok) throw new Error();
      const json = (await res.json()) as Ecu911Response;
      setVias(json.data ?? []);
      setFetchedAt(new Date().toISOString());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // Auto-refresh cada 5 minutos
  useEffect(() => {
    const id = setInterval(() => { void load(); }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [load]);

  const counts: Record<FilterEstado, number> = {
    todas: vias.length,
    592:   vias.filter(v => v.estado_actual_id === 592).length,
    594:   vias.filter(v => v.estado_actual_id === 594).length,
    595:   vias.filter(v => v.estado_actual_id === 595).length,
  };

  const filtered = vias.filter(v => {
    if (filter !== 'todas' && v.estado_actual_id !== filter) return false;
    if (search && !v.descripcion.toLowerCase().includes(search.toLowerCase()) &&
        !v.Provincia.descripcion.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Encabezado */}
      <div className="shrink-0 p-4 pb-3 border-b border-border/40">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Route className="size-4 text-orange-500" />
            Estado de Vías · ECU911
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { void load(); }}
              disabled={loading}
              className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('size-3.5', loading && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Reloj en vivo + última consulta (igual que ECU911) */}
        <div className="flex items-center justify-between mb-2">
          <p className="text-[11px] font-mono font-medium text-foreground/70 tabular-nums">{clock}</p>
          {fetchedAt && (
            <p className="text-[10px] text-muted-foreground">
              Fuente ECU911 · última consulta {relativeTime(fetchedAt)}
            </p>
          )}
        </div>

        {/* Filtros de estado */}
        <div className="flex gap-1.5 mt-2.5 flex-wrap">
          {([
            { id: 'todas' as FilterEstado, label: `Todas (${counts.todas})`, dot: 'bg-muted-foreground' },
            { id: 595 as FilterEstado,     label: `Cerradas (${counts[595]})`, dot: 'bg-red-500' },
            { id: 594 as FilterEstado,     label: `Parciales (${counts[594]})`, dot: 'bg-amber-500' },
            { id: 592 as FilterEstado,     label: `Restricción (${counts[592]})`, dot: 'bg-orange-500' },
          ] as const).map(f => (
            <button
              key={String(f.id)}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors border',
                filter === f.id
                  ? 'bg-foreground text-background border-foreground'
                  : 'border-border/50 text-muted-foreground hover:text-foreground hover:border-border',
              )}
            >
              <span className={cn('size-1.5 rounded-full', f.dot)} />
              {f.label}
            </button>
          ))}
        </div>

        {/* Búsqueda */}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar vía o provincia…"
          className="mt-2 w-full rounded-lg border border-border/50 bg-muted/30 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-border focus:bg-muted/50 transition-colors"
        />
      </div>

      {/* Lista */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
        {loading && vias.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
            <RefreshCw className="size-5 animate-spin" />
            <span className="text-xs">Consultando ECU911…</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
            <AlertTriangle className="size-5 text-amber-500" />
            <span className="text-xs text-center">No se pudo conectar con ECU911.<br />Reintenta en unos segundos.</span>
            <button
              type="button"
              onClick={() => { void load(); }}
              className="text-xs text-primary underline"
            >
              Reintentar
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-1 text-muted-foreground">
            <span className="text-xs">Sin resultados para los filtros actuales</span>
          </div>
        ) : (
          filtered.map(via => <ViaCard key={via.id} via={via} />)
        )}
      </div>
    </div>
  );
}
