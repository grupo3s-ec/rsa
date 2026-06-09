import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Incident } from "@/types/incident";
import { SeverityBadge } from "@/components/incidents/SeverityBadge";

interface IncidentSidebarProps {
  incidents: Incident[];
  loading: boolean;
  error: string | null;
  selectedIncidentId: number | null;
  onSelectIncident: (incident: Incident) => void;
}

export function IncidentSidebar({
  incidents,
  loading,
  error,
  selectedIncidentId,
  onSelectIncident,
}: IncidentSidebarProps) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Alertas en ruta</CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        {loading ? (
          <>
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </>
        ) : null}

        {!loading && error ? (
          <Alert variant="destructive">
            <AlertTitle>Error al cargar alertas</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {!loading && !error && incidents.length === 0 ? (
          <Alert>
            <AlertTitle>Sin alertas</AlertTitle>
            <AlertDescription>
              No se encontraron incidentes activos dentro del rango consultado.
            </AlertDescription>
          </Alert>
        ) : null}

        {!loading && !error
          ? incidents.map((incident) => {
              const isSelected = selectedIncidentId === incident.id;

              return (
                <button
                  key={incident.id}
                  type="button"
                  onClick={() => onSelectIncident(incident)}
                  className={[
                    "w-full rounded-xl border p-4 text-left transition hover:bg-muted",
                    isSelected ? "border-primary bg-muted" : "border-border",
                  ].join(" ")}
                >
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <h3 className="font-semibold leading-tight">{incident.title}</h3>
                    <SeverityBadge severity={incident.severity} />
                  </div>

                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {incident.description ?? "Sin descripción disponible."}
                  </p>

                  <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{incident.type}</span>
                    <span>{incident.status}</span>
                  </div>
                </button>
              );
            })
          : null}

        {!loading && !error && incidents.length > 0 ? (
          <Button variant="outline" className="w-full" disabled>
            {incidents.length} alerta(s) encontradas
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
