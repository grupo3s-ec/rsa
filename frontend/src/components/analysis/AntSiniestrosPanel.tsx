'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CarFront, Route, Skull, ZoomIn } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { getAntSiniestros, getAntSiniestrosOpciones, type AntSiniestro, type AntSiniestrosOpciones } from '@/lib/api/ant-siniestros';
import type { RawLatLngBounds } from '@/lib/geo';

function SiniestroCard({ s }: { s: AntSiniestro }) {
  return (
    <div className="rounded-xl border border-border/40 p-3.5 transition-colors hover:border-border">
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <p className="text-sm font-medium text-foreground leading-snug flex-1">
          {s.tipo_siniestro ?? 'Siniestro de tránsito'}
        </p>
        {(s.fallecidos > 0 || s.lesionados > 0) && (
          <span className={cn('shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5',
            s.fallecidos > 0 ? 'bg-red-500/10 text-red-600 dark:text-red-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400')}>
            {s.fallecidos > 0 ? <Skull className="size-2.5" /> : <AlertTriangle className="size-2.5" />}
            {s.fallecidos > 0 ? `${s.fallecidos} fallecido${s.fallecidos !== 1 ? 's' : ''}` : `${s.lesionados} lesionado${s.lesionados !== 1 ? 's' : ''}`}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-2">
        <span className="size-1.5 rounded-full shrink-0 bg-teal-500" />
        <span>{[s.parroquia, s.canton, s.provincia].filter(Boolean).join(', ')}</span>
        {/* `fecha` llega como datetime ISO completo con la hora siempre en
            00:00:00 — la hora real viene aparte en `hora`. */}
        <span className="ml-auto shrink-0 text-right">
          {s.fecha?.split('T')[0] ?? ''}{s.hora ? ` · ${s.hora.slice(0, 5)}` : ''}
        </span>
      </div>
      {s.direccion && (
        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{s.direccion}</p>
      )}
      {s.causa_probable && (
        <p className="mt-1 text-[11px] text-muted-foreground/80 leading-relaxed line-clamp-2">
          <span className="font-medium text-foreground/70">Causa: </span>{s.causa_probable}
        </p>
      )}
    </div>
  );
}

interface AntSiniestrosPanelProps {
  /** Provincias cercanas a la ruta calculada (mismo criterio que los demás
   * paneles de Riesgos) — acota el listado automáticamente. */
  conflictProvinces?: string[] | null;
  /** Bounds geográficos del rango enfocado en el mapa/gráfico (zoom-detalle)
   * — filtra la página ya cargada por contención, 100% client-side, sin
   * cambios de backend. Mismo patrón que MitEventosPanel. */
  focusedBounds?: RawLatLngBounds | null;
}

export function AntSiniestrosPanel({ conflictProvinces, focusedBounds }: AntSiniestrosPanelProps) {
  const hasRouteProvinces = !!conflictProvinces && conflictProvinces.length > 0;
  const [useRoute, setUseRoute] = useState(true);

  const hasFocusedBounds = !!focusedBounds;
  const [useFocused, setUseFocused] = useState(true);

  const [opciones, setOpciones] = useState<AntSiniestrosOpciones | null>(null);
  const [tipoSiniestro, setTipoSiniestro] = useState('');
  // Mes/año — valor de un <input type="month"> ("YYYY-MM") o '' = todos los
  // periodos. Se traduce a un rango from/to (primer y último día del mes)
  // para el backend, que ya soportaba ese filtro pero no se exponía en la UI.
  const [mesAnio, setMesAnio] = useState('');

  const [siniestros, setSiniestros] = useState<AntSiniestro[]>([]);
  const [page,        setPage]      = useState(1);
  const [lastPage,    setLastPage]  = useState(1);
  const [total,       setTotal]     = useState(0);
  const [loading,     setLoading]   = useState(false);
  const [error,       setError]     = useState(false);

  const routeProvincias = useRoute && hasRouteProvinces ? conflictProvinces ?? undefined : undefined;

  // "YYYY-MM" del <input type="month"> → rango from/to (primer y último día
  // de ese mes) para el backend, que ya soportaba `from`/`to` pero no se
  // exponía en la UI.
  const { from, to } = useMemo(() => {
    if (!mesAnio) return { from: undefined, to: undefined };
    const [yearStr, monthStr] = mesAnio.split('-');
    const year = Number(yearStr);
    const month = Number(monthStr);
    const lastDay = new Date(year, month, 0).getDate();
    return {
      from: `${mesAnio}-01`,
      to: `${mesAnio}-${String(lastDay).padStart(2, '0')}`,
    };
  }, [mesAnio]);

  useEffect(() => {
    getAntSiniestrosOpciones().then(setOpciones).catch(() => setOpciones(null));
  }, []);

  async function load(pageToLoad: number, append: boolean): Promise<void> {
    setLoading(true);
    setError(false);
    try {
      const pageData = await getAntSiniestros({
        provincias: routeProvincias,
        tipoSiniestro: tipoSiniestro || undefined,
        from,
        to,
        page: pageToLoad,
      });
      setSiniestros((prev) => (append ? [...prev, ...pageData.data] : pageData.data));
      setPage(pageData.current_page);
      setLastPage(pageData.last_page);
      setTotal(pageData.total);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeProvincias, tipoSiniestro, from, to]);

  // Filtra lo YA cargado por contención geográfica (zoom-detalle) — 100%
  // client-side, no dispara peticiones nuevas. Mismo patrón que
  // MitEventosPanel.eventosVisibles.
  const siniestrosVisibles = useMemo(() => {
    if (!useFocused || !focusedBounds) return siniestros;
    const dentro = (lat: number, lng: number) =>
      lat <= focusedBounds.north && lat >= focusedBounds.south
      && lng >= focusedBounds.west && lng <= focusedBounds.east;
    return siniestros.filter((s) => dentro(s.lat, s.lng));
  }, [siniestros, useFocused, focusedBounds]);

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="shrink-0 p-4 pb-3 border-b border-border/40">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <CarFront className="size-4 text-teal-600 dark:text-teal-400" />
          Siniestros de Tránsito · ANT
        </h2>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {hasRouteProvinces && (
            <button
              type="button"
              onClick={() => setUseRoute((v) => !v)}
              className={cn('flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors border w-fit',
                useRoute
                  ? 'bg-foreground text-background border-foreground'
                  : 'border-border/50 text-muted-foreground hover:text-foreground hover:border-border')}
            >
              <Route className="size-3" /> Solo la ruta calculada
            </button>
          )}
          {hasFocusedBounds && (
            <button
              type="button"
              onClick={() => setUseFocused((v) => !v)}
              className={cn('flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors border w-fit',
                useFocused
                  ? 'bg-foreground text-background border-foreground'
                  : 'border-border/50 text-muted-foreground hover:text-foreground hover:border-border')}
            >
              <ZoomIn className="size-3" /> Solo lo visible en el mapa
            </button>
          )}
        </div>

        <select value={tipoSiniestro} onChange={(e) => setTipoSiniestro(e.target.value)}
          className="mt-2 h-7 w-full rounded-md border border-border/50 bg-background px-2 text-[11px] text-foreground">
          <option value="">Todos los tipos</option>
          {opciones?.tipos_siniestro.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>

        <div className="mt-1.5 flex items-center gap-1.5">
          <input
            type="month"
            value={mesAnio}
            onChange={(e) => setMesAnio(e.target.value)}
            max={new Date().toISOString().slice(0, 7)}
            className="h-7 flex-1 rounded-md border border-border/50 bg-background px-2 text-[11px] text-foreground"
          />
          {mesAnio && (
            <button
              type="button"
              onClick={() => setMesAnio('')}
              className="shrink-0 text-[10px] text-muted-foreground underline hover:text-foreground"
            >
              Todos los periodos
            </button>
          )}
        </div>

        {total > 0 && (
          <p className="mt-1.5 text-[10px] text-muted-foreground">
            {total} siniestro{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
        {loading && siniestros.length === 0 ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2 rounded-xl border border-border/40 p-3.5">
                <Skeleton className="h-4 w-3/5" />
                <Skeleton className="h-3 w-2/5" />
                <Skeleton className="h-3 w-full" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
            <AlertTriangle className="size-5 text-amber-500" />
            <span className="text-xs text-center">No se pudo cargar el histórico ANT.</span>
            <button type="button" onClick={() => void load(1, false)} className="text-xs text-primary underline">
              Reintentar
            </button>
          </div>
        ) : (
          <>
            {siniestrosVisibles.length === 0 ? (
              // El filtro de zoom puede dejar la página actual sin
              // resultados aunque existan más páginas con datos dentro del
              // tramo enfocado — sin sacar el botón de este condicional, el
              // usuario quedaba sin forma de cargarlas.
              <div className="flex flex-col items-center justify-center h-32 gap-1 text-muted-foreground text-center px-4">
                <span className="text-xs">Sin siniestros para los filtros actuales</span>
              </div>
            ) : (
              siniestrosVisibles.map((s) => <SiniestroCard key={s.id} s={s} />)
            )}
            {page < lastPage && (
              <button
                type="button"
                onClick={() => void load(page + 1, true)}
                disabled={loading}
                className="w-full rounded-lg border border-border/50 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:border-border transition-colors disabled:opacity-50"
              >
                {loading ? 'Cargando…' : 'Cargar más'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
