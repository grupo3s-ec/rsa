"use client";

import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IncidentDetailDialog } from "@/components/incidents/IncidentDetailDialog";
import { IncidentSidebar } from "@/components/incidents/IncidentSidebar";
import { getRouteIncidents } from "@/services/routes.service";
import type { Incident, RouteIncidentQuery } from "@/types/incident";

const defaultRoute: RouteIncidentQuery = {
  origin_lat: -0.1,
  origin_lng: -78.5,
  destination_lat: -0.3,
  destination_lng: -78.45,
};

type CoordinateField = keyof RouteIncidentQuery;

export function RoutePlanner() {
  const [route, setRoute] = useState<RouteIncidentQuery>(defaultRoute);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateCoordinate(field: CoordinateField, value: string): void {
    setRoute((currentRoute) => ({
      ...currentRoute,
      [field]: Number(value),
    }));
  }

  async function handleSearch(): Promise<void> {
    setLoading(true);
    setError(null);

    try {
      const response = await getRouteIncidents(route);
      setIncidents(response.data);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "No se pudieron cargar los incidentes.";

      setError(message);
      setIncidents([]);
    } finally {
      setLoading(false);
    }
  }

  function handleSelectIncident(incident: Incident): void {
    setSelectedIncident(incident);
    setDetailOpen(true);
  }

  return (
    <div className="grid min-h-screen gap-4 bg-muted/30 p-4 lg:grid-cols-[420px_1fr]">
      <section className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>RSA — Route Safety Analysis</CardTitle>
            <CardDescription>
              Consulta inicial de alertas operativas entre un origen y destino.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="origin_lat">Origen latitud</Label>
                <Input
                  id="origin_lat"
                  type="number"
                  step="0.0000001"
                  value={route.origin_lat}
                  onChange={(event) => updateCoordinate("origin_lat", event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="origin_lng">Origen longitud</Label>
                <Input
                  id="origin_lng"
                  type="number"
                  step="0.0000001"
                  value={route.origin_lng}
                  onChange={(event) => updateCoordinate("origin_lng", event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="destination_lat">Destino latitud</Label>
                <Input
                  id="destination_lat"
                  type="number"
                  step="0.0000001"
                  value={route.destination_lat}
                  onChange={(event) =>
                    updateCoordinate("destination_lat", event.target.value)
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="destination_lng">Destino longitud</Label>
                <Input
                  id="destination_lng"
                  type="number"
                  step="0.0000001"
                  value={route.destination_lng}
                  onChange={(event) =>
                    updateCoordinate("destination_lng", event.target.value)
                  }
                />
              </div>
            </div>

            <Button className="w-full" onClick={handleSearch} disabled={loading}>
              {loading ? "Consultando ruta..." : "Buscar alertas en ruta"}
            </Button>

            <Alert>
              <AlertTitle>Filtro MVP</AlertTitle>
              <AlertDescription>
                Este primer entregable usa bounding box aproximado. Luego se migrará
                a PostGIS con ST_DWithin para precisión geoespacial real.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        <IncidentSidebar
          incidents={incidents}
          loading={loading}
          error={error}
          selectedIncidentId={selectedIncident?.id ?? null}
          onSelectIncident={handleSelectIncident}
        />
      </section>

      <section className="min-h-[560px] rounded-xl border bg-background p-4">
        <div className="flex h-full items-center justify-center rounded-lg border border-dashed bg-muted/30 p-8 text-center">
          <div className="max-w-md space-y-2">
            <h2 className="text-xl font-semibold">Mapa pendiente</h2>
            <p className="text-sm text-muted-foreground">
              En el siguiente bloque se integrará Google Maps JavaScript API,
              Directions API, marcadores de incidentes y selección desde el mapa.
            </p>
          </div>
        </div>
      </section>

      <IncidentDetailDialog
        incident={selectedIncident}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
    </div>
  );
}
