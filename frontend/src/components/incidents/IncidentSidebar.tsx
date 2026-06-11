import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { severityMeta, statusMeta, typeMeta } from "@/lib/incidents/format";
import type { Incident } from "@/types/incident";

interface IncidentSidebarProps {
  incidents: Incident[];
  loading: boolean;
  error: string | null;
  selectedIncidentId: number | null;
  onSelectIncident: (incident: Incident) => void;
}

/**
 * Panel flotante de alertas: lista limpia donde la severidad se lee
 * por color y el tipo por icono — sin texto redundante.
 */
export function IncidentSidebar({
  incidents,
  loading,
  error,
  selectedIncidentId,
  onSelectIncident,
}: IncidentSidebarProps) {
  const hasCritical = incidents.some(
    (incident) => incident.severity === "critical",
  );

  return (
    <div className="flex max-h-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-background/80 shadow-lg backdrop-blur">
      {/* Encabezado minimal: título, conteo y aviso crítico por color. */}
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
        {!loading && !error ? (
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

        {!loading && !error && incidents.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            Sin novedades en este trayecto.
          </p>
        ) : null}

        {!loading && !error
          ? incidents.map((incident) => {
              const severity = severityMeta[incident.severity];
              const type = typeMeta[incident.type];
              const TypeIcon = type.icon;
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
                  {/* Icono de tipo teñido con el color de severidad. */}
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
                      <span>{type.label}</span>
                      <span aria-hidden>·</span>
                      <span>{statusMeta[incident.status].label}</span>
                    </span>
                  </span>

                  {/* Punto de severidad: la lectura rápida del riesgo. */}
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      severity.dotClass,
                    )}
                    aria-label={`Severidad ${severity.label}`}
                  />
                </button>
              );
            })
          : null}
      </div>
    </div>
  );
}
