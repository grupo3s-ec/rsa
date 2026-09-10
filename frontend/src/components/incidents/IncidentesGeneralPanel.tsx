'use client';

/**
 * Vista general de incidentes (todos los reportados en el sistema, no solo
 * los de una ruta calculada) — vive como sidebar dentro de /mapa, con el
 * mapa siempre visible detrás, en vez de una pantalla aparte que lo
 * reemplace (ver `RoutePlanner`'s `incidentesViewOpen`).
 */

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronRight, CircleAlert, Clock, Inbox } from 'lucide-react';
import { Alert, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  conditionMeta,
  formatDateEs,
  severityMeta,
  statusMeta,
} from '@/lib/incidents/format';
import { getExpiryState } from '@/lib/incidents/expiry';
import { getIncidents } from '@/services/incidents.service';
import type { Incident, IncidentSeverity, IncidentStatus } from '@/types/incident';

type SeverityFilter = IncidentSeverity | 'all';
type StatusFilter = IncidentStatus | 'all';

// "critical" no está en el filtro: ninguno de los tipos de incidente
// predefinidos lo usa (solo alto/medio/bajo) — un tipo personalizado
// ("+Otro") sí podría crearse con esa severidad, pero no vale la pena un
// filtro dedicado para un caso que hoy nunca ocurre en la práctica.
const SEVERITY_FILTERS: SeverityFilter[] = ['all', 'high', 'medium', 'low'];
const STATUS_FILTERS: StatusFilter[] = ['all', 'open', 'in_progress'];

const STATUS_BADGE_CLASS: Record<IncidentStatus, string> = {
  open: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  in_progress: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
  resolved: 'bg-muted text-muted-foreground',
  archived: 'bg-muted/60 text-muted-foreground/70',
};

interface IncidentesGeneralPanelProps {
  selectedIncidentId: number | null;
  onSelectIncident: (incident: Incident) => void;
  /** Incrementar para forzar un refetch — ej. al crear una novedad nueva o
   * cambiar el estado de una desde su Sheet de detalle. Sin esto, la lista
   * quedaba desactualizada hasta recargar la página entera. */
  refreshKey?: number;
}

export function IncidentesGeneralPanel({ selectedIncidentId, onSelectIncident, refreshKey }: IncidentesGeneralPanelProps) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    let active = true;
    getIncidents()
      .then((response) => {
        if (!active) return;
        setIncidents(response.data);
        setTotal(response.meta.total);
        setLoading(false);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los incidentes.');
        setLoading(false);
      });
    return () => { active = false; };
  }, [refreshKey]);

  const filtered = useMemo(
    () => incidents.filter((incident) =>
      (severityFilter === 'all' || incident.severity === severityFilter)
      && (statusFilter === 'all' || incident.status === statusFilter),
    ),
    [incidents, severityFilter, statusFilter],
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Filtros: chips de severidad y de estado. */}
      <div className="shrink-0 space-y-2 border-b border-border/40 px-4 py-3">
        <div className="flex flex-wrap gap-1.5">
          {SEVERITY_FILTERS.map((filter) => (
            <FilterChip
              key={filter}
              active={severityFilter === filter}
              onClick={() => setSeverityFilter(filter)}
              activeClass={
                filter === 'all'
                  ? 'text-foreground ring-foreground/30'
                  : cn(severityMeta[filter].textClass, severityMeta[filter].ring)
              }
            >
              {filter !== 'all' ? <span className={cn('size-1.5 rounded-full', severityMeta[filter].dotClass)} /> : null}
              {filter === 'all' ? 'Todos' : severityMeta[filter].label}
            </FilterChip>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_FILTERS.map((filter) => (
            <FilterChip
              key={filter}
              active={statusFilter === filter}
              onClick={() => setStatusFilter(filter)}
              activeClass={
                filter === 'open'
                  ? 'text-emerald-600 ring-emerald-500/60 dark:text-emerald-400'
                  : filter === 'in_progress'
                    ? 'text-amber-600 ring-amber-500/60 dark:text-amber-400'
                    : 'text-foreground ring-foreground/30'
              }
            >
              {filter === 'all' ? 'Todos' : statusMeta[filter].label}
            </FilterChip>
          ))}
        </div>
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="space-y-3 p-3">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="flex items-center gap-3 px-1 py-1">
                <Skeleton className="size-2 rounded-full" />
                <Skeleton className="size-4 rounded-md" />
                <Skeleton className="h-4 flex-1 rounded-md" />
              </div>
            ))}
          </div>
        ) : error ? (
          <Alert variant="destructive" className="m-3 border-none">
            <CircleAlert />
            <AlertTitle>{error}</AlertTitle>
          </Alert>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-muted-foreground">
            <Inbox className="size-5 opacity-60" />
            <p className="text-sm">{incidents.length === 0 ? 'Sin incidentes registrados.' : 'Sin resultados para el filtro.'}</p>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-border/50">
              {filtered.map((incident) => (
                <IncidentRow
                  key={incident.id}
                  incident={incident}
                  selected={incident.id === selectedIncidentId}
                  onSelect={() => onSelectIncident(incident)}
                />
              ))}
            </ul>
            {total > incidents.length ? (
              <p className="px-3 py-3 text-center text-xs text-muted-foreground">
                Mostrando {incidents.length} de {total}
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

interface FilterChipProps {
  active: boolean;
  activeClass: string;
  onClick: () => void;
  children: React.ReactNode;
}

function FilterChip({ active, activeClass, onClick, children }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
        active
          ? cn('border-transparent bg-current/10 ring-1', activeClass)
          : 'border-border/60 text-muted-foreground hover:bg-muted/60 hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

interface IncidentRowProps {
  incident: Incident;
  selected: boolean;
  onSelect: () => void;
}

function IncidentRow({ incident, selected, onSelect }: IncidentRowProps) {
  const severity = severityMeta[incident.severity];
  const TypeIcon = conditionMeta[incident.condition ?? 'fisica'].icon;
  const expiry = getExpiryState(incident.expires_at, incident.status);

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'group flex w-full items-center gap-2.5 px-3 py-3 text-left transition-colors hover:bg-muted/50',
          selected && 'bg-muted/60',
        )}
      >
        <span className={cn('size-2 shrink-0 rounded-full', severity.dotClass)} aria-label={`Severidad ${severity.label}`} />
        <TypeIcon className={cn('size-4 shrink-0', severity.textClass)} aria-label={incident.type} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{incident.title}</span>
          <span className="mt-0.5 block text-[11px] text-muted-foreground">{formatDateEs(incident.occurred_at ?? incident.created_at)}</span>
        </span>
        {expiry && (
          <span className="shrink-0" title={expiry === 'expired' ? 'Necesita seguimiento' : 'Por caducar'}>
            {expiry === 'expired' ? <AlertTriangle className="size-3.5 text-red-500" /> : <Clock className="size-3.5 text-amber-500" />}
          </span>
        )}
        <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium', STATUS_BADGE_CLASS[incident.status])}>
          {statusMeta[incident.status].label}
        </span>
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" />
      </button>
    </li>
  );
}
