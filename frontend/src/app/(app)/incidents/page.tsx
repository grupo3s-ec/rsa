"use client";

/**
 * Vista general de incidentes: feed limpio con filtros por severidad y
 * estado (en cliente), pensado para que el operador revise el estado
 * global de un vistazo y abra el detalle con un click.
 */

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, CircleAlert, Inbox } from "lucide-react";
import { Alert, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { IncidentDetailDialog } from "@/components/incidents/IncidentDetailDialog";
import { cn } from "@/lib/utils";
import {
  conditionMeta,
  formatDateEs,
  severityMeta,
  statusMeta,
} from "@/lib/incidents/format";
import { getIncidents } from "@/services/incidents.service";
import type {
  Incident,
  IncidentSeverity,
  IncidentStatus,
} from "@/types/incident";

type SeverityFilter = IncidentSeverity | "all";
type StatusFilter = IncidentStatus | "all";

/** Severidades en orden de urgencia para los chips de filtro. */
const SEVERITY_FILTERS: SeverityFilter[] = [
  "all",
  "critical",
  "high",
  "medium",
  "low",
];

const STATUS_FILTERS: StatusFilter[] = ["all", "open", "in_progress"];

/** Señal de color del badge de estado: verde activo → gris cerrado. */
const STATUS_BADGE_CLASS: Record<IncidentStatus, string> = {
  open: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  in_progress: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  resolved: "bg-muted text-muted-foreground",
  archived: "bg-muted/60 text-muted-foreground/70",
};

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  useEffect(() => {
    let active = true;

    getIncidents()
      .then((response) => {
        if (!active) {
          return;
        }

        setIncidents(response.data);
        setTotal(response.meta.total);
        setLoading(false);
      })
      .catch((cause: unknown) => {
        if (!active) {
          return;
        }

        setError(
          cause instanceof Error
            ? cause.message
            : "No se pudieron cargar los incidentes.",
        );
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(
    () =>
      incidents.filter(
        (incident) =>
          (severityFilter === "all" || incident.severity === severityFilter) &&
          (statusFilter === "all" || incident.status === statusFilter),
      ),
    [incidents, severityFilter, statusFilter],
  );

  function handleSelect(incident: Incident): void {
    setSelectedIncident(incident);
    setDetailOpen(true);
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-3xl px-4 py-8">
        {/* Cabecera: título + conteo total como número grande. */}
        <header className="flex items-end justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Incidentes</h1>
          {!loading && !error ? (
            <span className="text-3xl font-semibold tabular-nums leading-none text-foreground/80">
              {total}
            </span>
          ) : null}
        </header>

        {/* Filtros: chips de severidad y de estado. */}
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex flex-wrap gap-1.5">
            {SEVERITY_FILTERS.map((filter) => (
              <FilterChip
                key={filter}
                active={severityFilter === filter}
                onClick={() => setSeverityFilter(filter)}
                activeClass={
                  filter === "all"
                    ? "text-foreground ring-foreground/30"
                    : cn(severityMeta[filter].textClass, severityMeta[filter].ring)
                }
              >
                {filter !== "all" ? (
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      severityMeta[filter].dotClass,
                    )}
                  />
                ) : null}
                {filter === "all" ? "Todos" : severityMeta[filter].label}
              </FilterChip>
            ))}
          </div>

          <span className="hidden h-4 w-px bg-border sm:block" aria-hidden />

          <div className="flex flex-wrap gap-1.5">
            {STATUS_FILTERS.map((filter) => (
              <FilterChip
                key={filter}
                active={statusFilter === filter}
                onClick={() => setStatusFilter(filter)}
                activeClass={
                  filter === "open"
                    ? "text-emerald-600 ring-emerald-500/60 dark:text-emerald-400"
                    : filter === "in_progress"
                      ? "text-amber-600 ring-amber-500/60 dark:text-amber-400"
                      : "text-foreground ring-foreground/30"
                }
              >
                {filter === "all" ? "Todos" : statusMeta[filter].label}
              </FilterChip>
            ))}
          </div>
        </div>

        {/* Contenido: loading / error / vacío / feed. */}
        <div className="mt-6">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 7 }, (_, index) => (
                <div key={index} className="flex items-center gap-3 px-3 py-2">
                  <Skeleton className="size-2 rounded-full" />
                  <Skeleton className="size-4 rounded-md" />
                  <Skeleton className="h-4 flex-1 rounded-md" />
                  <Skeleton className="h-4 w-24 rounded-md" />
                </div>
              ))}
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertTitle>{error}</AlertTitle>
            </Alert>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-20 text-muted-foreground">
              <Inbox className="size-5 opacity-60" />
              <p className="text-sm">
                {incidents.length === 0
                  ? "Sin incidentes registrados."
                  : "Sin resultados para el filtro."}
              </p>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-border/50">
                {filtered.map((incident) => (
                  <IncidentRow
                    key={incident.id}
                    incident={incident}
                    onSelect={() => handleSelect(incident)}
                  />
                ))}
              </ul>

              {total > incidents.length ? (
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  Mostrando {incidents.length} de {total}
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>

      <IncidentDetailDialog
        incident={selectedIncident}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onStatusChanged={(updated) => {
          setIncidents(prev => prev.map(i => i.id === updated.id ? updated : i));
          setSelectedIncident(prev => prev?.id === updated.id ? updated : prev);
        }}
      />
    </div>
  );
}

interface FilterChipProps {
  active: boolean;
  activeClass: string;
  onClick: () => void;
  children: React.ReactNode;
}

/** Chip de filtro: pastilla discreta que se enciende con su color semántico. */
function FilterChip({ active, activeClass, onClick, children }: FilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? cn("border-transparent bg-current/10 ring-1", activeClass)
          : "border-border/60 text-muted-foreground hover:bg-muted/60 hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

interface IncidentRowProps {
  incident: Incident;
  onSelect: () => void;
}

/** Fila del feed: señales por color y posición, sin texto redundante. */
function IncidentRow({ incident, onSelect }: IncidentRowProps) {
  const severity = severityMeta[incident.severity];
  const TypeIcon = conditionMeta[incident.condition ?? 'fisica'].icon;

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className="group flex w-full items-center gap-3 px-3 py-3.5 text-left transition-colors hover:bg-muted/50"
      >
        <span
          className={cn("size-2 shrink-0 rounded-full", severity.dotClass)}
          aria-label={`Severidad ${severity.label}`}
        />
        <TypeIcon
          className={cn("size-4 shrink-0", severity.textClass)}
          aria-label={incident.type}
        />
        <span className="min-w-0 flex-1 truncate text-sm font-medium">
          {incident.title}
        </span>
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
            STATUS_BADGE_CLASS[incident.status],
          )}
        >
          {statusMeta[incident.status].label}
        </span>
        <span className="hidden shrink-0 text-xs tabular-nums text-muted-foreground sm:block">
          {formatDateEs(incident.occurred_at ?? incident.created_at)}
        </span>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-muted-foreground" />
      </button>
    </li>
  );
}
