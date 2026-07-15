'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle, ChevronDown, ChevronUp, Construction, Droplets,
  Gem, Landmark, Layers, Link2Off, Mountain, RefreshCw, Route,
  TreePine, TrendingDown, Users, Waves, HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getMitEventos, getMitEventosOpciones, type MitAdverseEvent, type MitEventosOpciones } from '@/lib/api/mit-eventos';

interface TipoMeta { icon: typeof Mountain; bg: string; text: string; dot: string; }

const TIPO_META: Record<string, TipoMeta> = {
  'Deslizamiento/Derrumbe':               { icon: Mountain,   bg: 'bg-amber-500/10',   text: 'text-amber-600 dark:text-amber-400',   dot: 'bg-amber-500' },
  'Socavamiento/Socavón':                 { icon: Waves,      bg: 'bg-sky-500/10',     text: 'text-sky-600 dark:text-sky-400',       dot: 'bg-sky-500' },
  'Caída de rocas':                       { icon: Gem,        bg: 'bg-orange-500/10',  text: 'text-orange-600 dark:text-orange-400', dot: 'bg-orange-500' },
  'Caída de árboles':                     { icon: TreePine,   bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  'Pérdida de calzada':                   { icon: TrendingDown, bg: 'bg-red-500/10',   text: 'text-red-600 dark:text-red-400',       dot: 'bg-red-500' },
  'Hundimiento':                          { icon: TrendingDown, bg: 'bg-rose-500/10',  text: 'text-rose-600 dark:text-rose-400',     dot: 'bg-rose-500' },
  'Falla geológica':                      { icon: Layers,     bg: 'bg-violet-500/10',  text: 'text-violet-600 dark:text-violet-400', dot: 'bg-violet-500' },
  'Inundación/Nivel de agua':             { icon: Droplets,   bg: 'bg-blue-500/10',    text: 'text-blue-600 dark:text-blue-400',     dot: 'bg-blue-500' },
  'Trabajos programados/Mantenimiento':   { icon: Construction, bg: 'bg-slate-500/10', text: 'text-slate-600 dark:text-slate-400',   dot: 'bg-slate-500' },
  'Cierre por conflicto social':          { icon: Users,      bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-600 dark:text-fuchsia-400', dot: 'bg-fuchsia-500' },
  'Colapso de puente/alcantarilla':       { icon: Link2Off,   bg: 'bg-red-600/10',     text: 'text-red-700 dark:text-red-400',       dot: 'bg-red-600' },
};

const OTRO_META: TipoMeta = { icon: HelpCircle, bg: 'bg-muted/40', text: 'text-muted-foreground', dot: 'bg-muted-foreground' };

function getTipoMeta(tipo: string): TipoMeta {
  return TIPO_META[tipo] ?? OTRO_META;
}

function MES_NOMBRE(mes: number): string {
  return ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][mes - 1] ?? '';
}

function EventoCard({ evento }: { evento: MitAdverseEvent }) {
  const [expanded, setExpanded] = useState(false);
  const meta = getTipoMeta(evento.tipo_evento);
  const Icon = meta.icon;

  return (
    <div className={cn('rounded-xl border border-border/40 transition-colors hover:border-border', meta.bg)}>
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <p className="text-sm font-medium text-foreground leading-snug flex-1">{evento.tramo}</p>
          <span className={cn('shrink-0 inline-flex items-center gap-1 text-[10px] font-semibold rounded-full px-2 py-0.5 whitespace-nowrap', meta.text, 'bg-background/60 border border-current/20')}>
            <Icon className="size-2.5" />
            {evento.tipo_evento}
          </span>
        </div>

        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mb-2">
          <span className={cn('size-1.5 rounded-full shrink-0', meta.dot)} />
          <span>{evento.provincia}{evento.ruta_codigo ? ` · ${evento.ruta_codigo}` : ''}</span>
          <span className="ml-auto shrink-0 text-right">{MES_NOMBRE(evento.boletin_mes)} {evento.boletin_anio}</span>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
          {evento.evento}
        </p>

        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          {expanded ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          {expanded ? 'Ver menos' : 'Ver detalle'}
        </button>

        {expanded && (
          <div className="mt-2 space-y-2">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">Periodo monitoreado: </span>
              {evento.fecha_periodo_texto}
            </p>
            {evento.acciones_realizadas && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-medium text-foreground">Acciones realizadas: </span>
                {evento.acciones_realizadas}
              </p>
            )}
            {evento.observaciones && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-medium text-foreground">Observaciones: </span>
                {evento.observaciones}
              </p>
            )}
            {evento.recomendaciones && (
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-medium text-foreground">Recomendaciones: </span>
                {evento.recomendaciones}
              </p>
            )}
            <div className="rounded-lg border border-border/40 bg-background/60 p-2.5 flex items-start gap-2">
              <Landmark className="size-3.5 text-muted-foreground shrink-0 mt-0.5" />
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">{evento.fuente_nombre}</span>
                <br />
                {evento.fuente_boletin} — {MES_NOMBRE(evento.boletin_mes)} {evento.boletin_anio}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface MitEventosPanelProps {
  /** Provincias con eventos del histórico MIT cercanos a la ruta calculada
   * (NO las mismas que las de restricciones ECU911 — son fuentes de datos
   * distintas) — permite acotar el histórico automáticamente a la ruta activa. */
  conflictProvinces?: string[] | null;
}

const today = new Date().toISOString().split('T')[0]!;

export function MitEventosPanel({ conflictProvinces }: MitEventosPanelProps = {}) {
  const hasRouteProvinces = !!conflictProvinces && conflictProvinces.length > 0;
  const [useRoute, setUseRoute] = useState(true);

  const [opciones, setOpciones] = useState<MitEventosOpciones | null>(null);
  const [rutaCodigo, setRutaCodigo] = useState('');
  const [tipoEvento, setTipoEvento] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState(today);
  const [search, setSearch] = useState('');

  const [eventos,   setEventos]   = useState<MitAdverseEvent[]>([]);
  const [page,      setPage]      = useState(1);
  const [lastPage,  setLastPage]  = useState(1);
  const [total,     setTotal]     = useState(0);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(false);

  // Todas las provincias en conflicto, no solo la primera — una ruta puede
  // cruzar varias.
  const routeProvincias = useRoute && hasRouteProvinces ? conflictProvinces ?? undefined : undefined;

  // Debounce del texto libre — evita un request por tecla mientras se escribe.
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    getMitEventosOpciones().then(setOpciones).catch(() => setOpciones(null));
  }, []);

  // Descarta respuestas obsoletas si llegan fuera de orden.
  const requestIdRef = useRef(0);

  const load = useCallback(async (pageToLoad: number, append: boolean) => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(false);
    try {
      const pageData = await getMitEventos({
        rutaCodigo: rutaCodigo || undefined,
        tipoEvento: tipoEvento || undefined,
        provincias: routeProvincias,
        from: from || undefined,
        to: to || undefined,
        search: debouncedSearch || undefined,
        page: pageToLoad,
      });
      if (requestId !== requestIdRef.current) return;
      setEventos(prev => append ? [...prev, ...pageData.data] : pageData.data);
      setPage(pageData.current_page);
      setLastPage(pageData.last_page);
      setTotal(pageData.total);
    } catch {
      if (requestId !== requestIdRef.current) return;
      setError(true);
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [rutaCodigo, tipoEvento, routeProvincias, from, to, debouncedSearch]);

  useEffect(() => {
    void load(1, false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rutaCodigo, tipoEvento, routeProvincias, from, to, debouncedSearch]);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Encabezado */}
      <div className="shrink-0 p-4 pb-3 border-b border-border/40">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Landmark className="size-4 text-amber-500" />
            Histórico MIT · Eventos Adversos
          </h2>
        </div>

        {hasRouteProvinces && (
          <button
            type="button"
            onClick={() => setUseRoute(v => !v)}
            className={cn('flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors border w-fit mb-2',
              useRoute
                ? 'bg-foreground text-background border-foreground'
                : 'border-border/50 text-muted-foreground hover:text-foreground hover:border-border')}
          >
            <Route className="size-3" /> Solo la ruta calculada
          </button>
        )}

        {/* Ruta / tramo y tipo de evento — mismas cabeceras que la tabla fuente */}
        <div className="flex items-center gap-1.5 mb-2">
          <select value={rutaCodigo} onChange={e => setRutaCodigo(e.target.value)}
            className="h-7 flex-1 min-w-0 rounded-md border border-border/50 bg-background px-2 text-[11px] text-foreground">
            <option value="">Todas las rutas</option>
            {opciones?.rutas.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <select value={tipoEvento} onChange={e => setTipoEvento(e.target.value)}
            className="h-7 flex-1 min-w-0 rounded-md border border-border/50 bg-background px-2 text-[11px] text-foreground">
            <option value="">Todos los tipos</option>
            {opciones?.tipos_evento.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Fecha del evento */}
        <div className="flex items-center gap-1.5 mb-2">
          <input type="date" value={from} max={to}
            onChange={e => setFrom(e.target.value)}
            className="h-7 flex-1 min-w-0 rounded-md border border-border/50 bg-background px-2 text-[11px]" />
          <span className="text-muted-foreground text-xs">–</span>
          <input type="date" value={to} min={from} max={today}
            onChange={e => setTo(e.target.value)}
            className="h-7 flex-1 min-w-0 rounded-md border border-border/50 bg-background px-2 text-[11px]" />
        </div>

        {/* Búsqueda libre */}
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por tramo o evento…"
          className="w-full rounded-lg border border-border/50 bg-muted/30 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground outline-none focus:border-border focus:bg-muted/50 transition-colors"
        />

        {total > 0 && (
          <p className="mt-1.5 text-[10px] text-muted-foreground">{total} evento{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}</p>
        )}
      </div>

      {/* Lista */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-2">
        {loading && eventos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
            <RefreshCw className="size-5 animate-spin" />
            <span className="text-xs">Consultando histórico…</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
            <AlertTriangle className="size-5 text-amber-500" />
            <span className="text-xs text-center">No se pudo cargar el histórico.</span>
            <button type="button" onClick={() => void load(1, false)} className="text-xs text-primary underline">
              Reintentar
            </button>
          </div>
        ) : eventos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-1 text-muted-foreground text-center px-4">
            <span className="text-xs">Sin eventos para los filtros actuales</span>
          </div>
        ) : (
          <>
            {eventos.map(ev => <EventoCard key={ev.id} evento={ev} />)}
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
