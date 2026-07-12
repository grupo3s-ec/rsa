import { Route } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { conditionMeta, severityMeta, statusMeta } from "@/lib/incidents/format";
import type { Incident } from "@/types/incident";

interface IncidentSidebarProps {
  incidents: Incident[];
  loading: boolean;
  error: string | null;
  hasSearched: boolean;
  selectedIncidentId: number | null;
  onSelectIncident: (incident: Incident) => void;
}

export function IncidentSidebar({
  incidents,
  loading,
  error,
  hasSearched,
  selectedIncidentId,
  onSelectIncident,
}: IncidentSidebarProps) {
  const hasCritical = incidents.some(
    (incident) => incident.severity === "critical",
  );

  return (
    <div className="flex max-h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-background/80 shadow-lg backdrop-blur">
      {/* Encabezado: título, conteo y punto de alerta crítica. */}
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Alertas en ruta</h2>
          {hasCritical ? (
            <span
              className="size-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.8)]"
              aria-label="Hay alertas críticas"
            />
          ) : null}
        </div>
        {!loading && !error && hasSearched ? (
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium tabular-nums text-muted-foreground">
            {incidents.length}
          </span>
        ) : null}
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto scroll-smooth p-2">
        {loading ? (
          <div className="space-y-2 p-1">
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
            <Skeleton className="h-14 w-full rounded-xl" />
          </div>
        ) : null}

        {!loading && error ? (
          <Alert variant="destructive" className="border-none">
            <AlertTitle>No se pudieron cargar las alertas</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {/* Estado inicial: guía para el usuario antes de buscar ruta. */}
        {!loading && !error && !hasSearched ? (
          <div className="flex flex-col items-center gap-3 px-3 py-10 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground/50">
              <Route className="size-6" />
            </span>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground/80">
                ¿A dónde vas hoy?
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Elige tu punto de salida y destino, luego presiona{" "}
                <span className="font-medium text-foreground/70">
                  «Ver ruta y alertas»
                </span>{" "}
                para ver los incidentes en tu camino.
              </p>
            </div>
          </div>
        ) : null}

        {/* Sin resultados después de buscar. */}
        {!loading && !error && hasSearched && incidents.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-3 py-10 text-center">
            <span className="text-2xl">✅</span>
            <p className="text-sm font-medium text-foreground/80">
              Ruta despejada
            </p>
            <p className="text-xs text-muted-foreground">
              No hay incidentes reportados en este trayecto.
            </p>
          </div>
        ) : null}

        {!loading && !error
          ? incidents.map((incident) => {
              const severity = severityMeta[incident.severity];
              const TypeIcon = conditionMeta[incident.condition ?? 'fisica'].icon;
              const isSelected = selectedIncidentId === incident.id;

              return (
                <button
                  key={incident.id}
                  type="button"
                  onClick={() => onSelectIncident(incident)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-200 hover:bg-muted/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
                    isSelected && cn("bg-muted/70 ring-2", severity.ring),
                  )}
                >
                  {/* Icono del tipo teñido con el color de severidad. */}
                  <span
                    className="flex size-8 shrink-0 items-center justify-center rounded-full text-white shadow-sm"
                    style={{ backgroundColor: severity.hex }}
                  >
                    <TypeIcon className="size-4" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium leading-tight">
                      {incident.title}
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{incident.type}</span>
                      <span aria-hidden>·</span>
                      <span>{statusMeta[incident.status].label}</span>
                    </span>
                  </span>

                  {/* Badge de severidad: legible de un vistazo. */}
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      severity.textClass,
                      incident.severity === "critical" && "bg-red-500/10",
                      incident.severity === "high" && "bg-orange-500/10",
                      incident.severity === "medium" && "bg-amber-500/10",
                      incident.severity === "low" && "bg-emerald-500/10",
                    )}
                  >
                    {severity.label}
                  </span>
                </button>
              );
            })
          : null}
      </div>
    </div>
  );
}
